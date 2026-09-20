import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { access, mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { pool, transaction } from "../../src/config/db.js";

const run = promisify(execFile);
const source = process.argv[2];
if (!source)
  throw Error("Usage: npm run import:plants -- /path/to/plant-database.xlsx");
await access(source);

const xml = (
  await run("unzip", ["-p", source, "xl/worksheets/sheet1.xml"], {
    maxBuffer: 10 * 1024 * 1024,
  })
).stdout;
const readZip = async (entry, encoding = "utf8") =>
  (await run("unzip", ["-p", source, entry], { encoding, maxBuffer: 20 * 1024 * 1024 })).stdout;
const entity = (value = "") =>
  value
    .replace(/&#(x[0-9a-f]+|\d+);/gi, (_, code) =>
      String.fromCodePoint(
        code[0].toLowerCase() === "x"
          ? parseInt(code.slice(1), 16)
          : Number(code),
      ),
    )
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .trim();
const column = (reference) => reference.replace(/\d/g, "");
const columnNumber = (reference) =>
  [...reference].reduce((value, letter) => value * 26 + letter.charCodeAt(0) - 64, 0) - 1;
const parseRows = (sheet) =>
  [...sheet.matchAll(/<x:row\b([^>]*)>([\s\S]*?)<\/x:row>/g)].map(([, rowAttributes, row]) => {
    const cells = { __row: Number(rowAttributes.match(/\br="(\d+)"/)?.[1]) };
    for (const [, reference, content] of row.matchAll(
      /<x:c\b[^>]*\br="([A-Z]+\d+)"[^>]*>([\s\S]*?)<\/x:c>/g,
    ))
      cells[column(reference)] = entity(
        content.match(/<x:v>([\s\S]*?)<\/x:v>/)?.[1],
      );
    return cells;
  });
const rows = parseRows(xml);
const headers = Object.fromEntries(
  Object.entries(rows.find((row) => row.A === "Plant ID") || {}).map(
    ([key, value]) => [value, key],
  ),
);
const field = (row, name) => row[headers[name]] || "";
const plants = rows
  .filter((row) => /^GH-\d+$/.test(field(row, "Plant ID")))
  .map((row) =>
    Object.fromEntries(
      Object.keys(headers).map((name) => [name, field(row, name)]),
    ),
  );
if (plants.length !== 100)
  throw Error(`Expected 100 plant records, found ${plants.length}.`);

// Excel stores inserted images separately from cells. Their drawing anchors use
// zero-based row/column positions, which lets us keep each image with its row.
const imageColumns = new Map(
  ["Product Image 1", "Product Image 2"]
    .filter((name) => headers[name])
    .map((name) => [columnNumber(headers[name]), name]),
);
const imagesByPlantId = new Map();
if (imageColumns.size) {
  const [drawing, relationships] = await Promise.all([
    readZip("xl/drawings/drawing1.xml"),
    readZip("xl/drawings/_rels/drawing1.xml.rels"),
  ]);
  const relationshipTargets = new Map(
    [...relationships.matchAll(/<Relationship\b([^>]*)\/?\s*>/g)].map(([, attributes]) => [
      attributes.match(/\bId="([^"]+)"/)?.[1],
      attributes.match(/\bTarget="([^"]+)"/)?.[1],
    ]),
  );
  const mediaByRow = new Map();
  for (const [, anchor] of drawing.matchAll(/<xdr:oneCellAnchor\b[^>]*>([\s\S]*?)<\/xdr:oneCellAnchor>/g)) {
    const col = Number(anchor.match(/<xdr:col>(\d+)<\/xdr:col>/)?.[1]);
    const row = Number(anchor.match(/<xdr:row>(\d+)<\/xdr:row>/)?.[1]);
    const relationshipId = anchor.match(/r:embed="([^"]+)"/)?.[1];
    const imageField = imageColumns.get(col);
    const target = relationshipTargets.get(relationshipId)?.replace(/^\//, "");
    if (imageField && target) mediaByRow.set(`${row + 1}:${imageField}`, target);
  }
  for (const row of rows) {
    const plantId = field(row, "Plant ID");
    if (!/^GH-\d+$/.test(plantId)) continue;
    const rowNumber = row.__row;
    imagesByPlantId.set(plantId, ["Product Image 1", "Product Image 2"]
      .map((name) => mediaByRow.get(`${rowNumber}:${name}`))
      .filter(Boolean));
  }
}
const assetDirectory = fileURLToPath(new URL("../../../frontend/public/images/imported/", import.meta.url));
await mkdir(assetDirectory, { recursive: true });
const imagePaths = new Map();
for (const plant of plants) {
  const files = imagesByPlantId.get(plant["Plant ID"]) || [];
  const paths = [];
  for (const [index, sourcePath] of files.entries()) {
    const extension = path.extname(sourcePath).toLowerCase() || ".jpg";
    const filename = `${plant["Plant ID"].toLowerCase()}-${index + 1}${extension}`;
    await writeFile(path.join(assetDirectory, filename), await readZip(sourcePath, null));
    paths.push(`/images/imported/${filename}`);
  }
  imagePaths.set(plant["Plant ID"], paths);
}

const slugify = (value) =>
  value
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
const imageFor = (category) =>
  ({
    "Indoor Plants": "/images/reference-5.webp",
    "Outdoor Plants": "/images/reference-6.webp",
    "Climbing & Hanging Plants": "/images/reference-7.webp",
    Trees: "/images/reference-8.webp",
    "Flowering Plants": "/images/reference-10.webp",
  })[category] || "/images/reference-5.webp";
const warmIntro = (plant) => {
  const place = plant["Recommended Placements"].split(",")[0].toLowerCase();
  const light = plant["Light Requirement"].toLowerCase().includes("low")
    ? "a gentler-light corner"
    : "a bright, welcoming spot";
  return `${plant["Common Name"]} is a lovely choice for bringing calm, living character to ${place || "your space"}. With ${light} and a simple, steady routine, it is a reassuring companion for both new and experienced plant parents. Its care routine is ${plant["Care Difficulty"].toLowerCase()}.`;
};
const description = (plant) =>
  `${warmIntro(plant)} Place it where it receives ${plant["Light Requirement"].toLowerCase()}. ${plant.Watering}. For its happiest roots, choose ${plant.Soil.toLowerCase()} and ensure ${plant.Drainage.toLowerCase()}.`;
const detailFields = [
  ["Scientific Name", "plant", "Scientific name"],
  ["Indoor / Outdoor", "plant", "Growing setting"],
  ["Care Difficulty", "care", "Care difficulty"],
  ["Light Requirement", "care", "Light"],
  ["Watering", "care", "Watering"],
  ["Soil", "care", "Soil"],
  ["Drainage", "care", "Drainage"],
  ["Temperature", "care", "Temperature"],
  ["Humidity", "care", "Humidity"],
  ["Drought Tolerance", "care", "Drought tolerance"],
  ["Recommended Placements", "placement", "Best placement"],
  ["Jordan Suitability", "local", "Jordan suitability"],
  ["Seasonal Notes", "care", "Seasonal care"],
  ["Toxicity & Safety", "safety", "Safety"],
  ["Propagation", "care", "Propagation"],
  ["Common Pests & Diseases", "care", "Common pests & diseases"],
  ["Flowering / Fruiting", "plant", "Flowering / fruiting"],
  ["Retail Variant", "retail", "What you receive"],
  ["Price Status", "retail", "Price note"],
  ["Price Basis", "catalogue", "Price basis"],
  ["Price Check Date", "catalogue", "Price checked"],
  ["Care Sources", "catalogue", "Care sources"],
  ["Evidence Level", "catalogue", "Evidence level"],
  ["Admin Note", "catalogue", "Catalogue note"],
];

await transaction(async (db) => {
  const categoryIds = new Map();
  const categoryId = async (name, parentId = null) => {
    const key = `${parentId || "root"}:${name}`;
    if (categoryIds.has(key)) return categoryIds.get(key);
    let result = await db.query(
      "SELECT id FROM categories WHERE name=$1 AND parent_id IS NOT DISTINCT FROM $2",
      [name, parentId],
    );
    if (!result.rowCount) {
      const base = slugify(parentId ? `${name}-${parentId}` : name);
      let slug = base,
        suffix = 2;
      while (
        (await db.query("SELECT 1 FROM categories WHERE slug=$1", [slug]))
          .rowCount
      )
        slug = `${base}-${suffix++}`;
      result = await db.query(
        "INSERT INTO categories(name,slug,parent_id,description,image) VALUES($1,$2,$3,$4,$5) RETURNING id",
        [
          name,
          slug,
          parentId,
          `Explore our ${name.toLowerCase()} collection.`,
          imageFor(name),
        ],
      );
    }
    categoryIds.set(key, result.rows[0].id);
    return result.rows[0].id;
  };

  for (const plant of plants) {
    const spreadsheetImages = imagePaths.get(plant["Plant ID"]) || [];
    const category = await categoryId(plant["Main Category"]);
    const subcategory = await categoryId(plant.Subcategory, category);
    const price = (Number(plant["Min Price"]) + Number(plant["Max Price"])) / 2;
    const existing = await db.query(
      "SELECT id,main_image FROM products WHERE sku=$1 OR lower(name)=lower($2) ORDER BY sku=$1 DESC LIMIT 1",
      [plant["Plant ID"], plant["Common Name"]],
    );
    // A product with an existing catalogue image predates this spreadsheet.
    // Keep its curated imagery; only spreadsheet-created/imported products get
    // the spreadsheet's embedded photos.
    const productImages =
      !existing.rowCount || existing.rows[0].main_image.startsWith("/images/imported/")
        ? spreadsheetImages
        : [];
    const mainImage = productImages[0] || existing.rows[0]?.main_image || imageFor(plant["Main Category"]);
    const story = {
      "Why you'll love it": warmIntro(plant),
      "Care in Jordan": `${plant["Jordan Suitability"]}. ${plant["Seasonal Notes"]}`,
      "Good to know": `${plant["Toxicity & Safety"]}. ${plant["Flowering / Fruiting"]}`,
    };
    let productId;
    if (existing.rowCount) {
      productId = existing.rows[0].id;
      await db.query(
        "UPDATE products SET name=$1,sku=$2,short_description=$3,description=$4,regular_price=$5,sale_price=NULL,on_sale=false,stock_quantity=GREATEST(stock_quantity,20),stock_status='in_stock',category_id=$6,subcategory_id=$7,main_image=$8,seo_title=$9,meta_description=$10,story=$11,updated_at=now() WHERE id=$12",
        [
          plant["Common Name"],
          plant["Plant ID"],
          warmIntro(plant),
          description(plant),
          price,
          category,
          subcategory,
          mainImage,
          `${plant["Common Name"]} care guide | GHARSA`,
          warmIntro(plant).slice(0, 160),
          story,
          productId,
        ],
      );
    } else {
      const base = slugify(plant["Common Name"]);
      let slug = base,
        suffix = 2;
      while (
        (await db.query("SELECT 1 FROM products WHERE slug=$1", [slug]))
          .rowCount
      )
        slug = `${base}-${suffix++}`;
      productId = (
        await db.query(
          "INSERT INTO products(name,slug,sku,short_description,description,regular_price,stock_quantity,category_id,subcategory_id,main_image,seo_title,meta_description,story) VALUES($1,$2,$3,$4,$5,$6,20,$7,$8,$9,$10,$11,$12) RETURNING id",
          [
            plant["Common Name"],
            slug,
            plant["Plant ID"],
            warmIntro(plant),
            description(plant),
            price,
            category,
            subcategory,
            mainImage,
            `${plant["Common Name"]} care guide | GHARSA`,
            warmIntro(plant).slice(0, 160),
            story,
          ],
        )
      ).rows[0].id;
    }
    if (productImages.length) {
      await db.query("DELETE FROM product_images WHERE product_id=$1 AND path LIKE '/images/imported/%'", [productId]);
      for (const [displayOrder, imagePath] of productImages.entries())
        await db.query("INSERT INTO product_images(product_id,path,alt,display_order) VALUES($1,$2,$3,$4)", [productId, imagePath, `${plant["Common Name"]} product image`, displayOrder]);
    }
    await db.query("DELETE FROM product_attributes WHERE product_id=$1", [
      productId,
    ]);
    for (const [sourceName, group, name] of detailFields)
      if (plant[sourceName])
        await db.query(
          "INSERT INTO product_attributes(product_id,name,value,attribute_key,attribute_group) VALUES($1,$2,$3,$4,$5)",
          [
            productId,
            name,
            plant[sourceName],
            slugify(sourceName).replaceAll("-", "_"),
            group,
          ],
        );
  }
});
console.log(`Imported ${plants.length} plant records from ${source}.`);
await pool.end();
