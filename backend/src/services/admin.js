import { can } from "../middleware/auth.js";
import { z } from "zod";
import sanitizeHtml from "sanitize-html";
import { assert } from "../utils/errors.js";
export const audit = (db, user, action, resource, id, description) =>
  db.query(
    "INSERT INTO audit_logs(user_id,action,resource_type,resource_id,description) VALUES($1,$2,$3,$4,$5)",
    [user.id, action, resource, String(id), description],
  );
export async function validateHierarchy(db, table, id, parentId) {
  if (!parentId) return;
  assert(Number(id) !== Number(parentId), "A record cannot be its own parent.");
  const { rows } = await db.query(
    `WITH RECURSIVE ancestors AS (SELECT id,parent_id FROM ${table} WHERE id=$1 UNION SELECT c.id,c.parent_id FROM ${table} c JOIN ancestors a ON c.id=a.parent_id) SELECT id FROM ancestors`,
    [parentId],
  );
  assert(
    !rows.some((r) => r.id === Number(id)),
    "This parent would create a circular hierarchy.",
  );
}
export async function saveResource(db, key, resource, body, id, user) {
  const data = resource.schema.parse(body);
  if (key === "pages")
    assert(
      ![
        "admin",
        "api",
        "shop",
        "search",
        "product",
        "cart",
        "checkout",
        "login",
        "register",
        "account",
        "uploads",
        "sitemap",
        "robots", "faq", "wishlist", "compare", "returns", "guarantee", "delivery",
      ].includes(data.slug),
      "This slug is reserved by the application.",
    );
  if (key === "sections") {
    data.content = sanitizeHtml(data.content, {
      allowedTags: sanitizeHtml.defaults.allowedTags.concat(["img"]),
      allowedAttributes: {
        ...sanitizeHtml.defaults.allowedAttributes,
        img: ["src", "alt", "width", "height"],
      },
      allowedSchemes: ["http", "https"],
    });
    validateConfiguration(data.configuration);
    if (["hero", "image_slider"].includes(data.section_type)) {
      z.object({
        animation_style: z.enum(["fade", "slide", "zoom", "none"]).optional(),
        transition_ms: z.number().int().min(100).max(3000).optional(),
        slide_interval_ms: z.number().int().min(2000).max(30000).optional(),
      }).parse(data.configuration);
    }
    for(const translation of Object.values(data.translations||{})) if(translation.content) translation.content=sanitizeHtml(translation.content);
  }
  if(data.sku) {
    const other=key==='products'?'product_variations':'products';
    assert(!(await db.query(`SELECT 1 FROM ${other} WHERE sku=$1`,[data.sku])).rowCount,'SKU is already used by another product or size.');
  }
  if (key === "products") {
    assert(
      data.sale_price === null || data.sale_price <= data.regular_price,
      "Sale price cannot exceed regular price.",
    );
    if (data.subcategory_id) {
      const { rows } = await db.query(
        "WITH RECURSIVE ancestors AS (SELECT id,parent_id FROM categories WHERE id=$1 UNION SELECT c.id,c.parent_id FROM categories c JOIN ancestors a ON c.id=a.parent_id) SELECT id FROM ancestors",
        [data.subcategory_id],
      );
      assert(
        rows.some((c) => c.id === data.category_id),
        "Subcategory must belong to the selected category.",
      );
    }
  }
  if (["categories", "navigation"].includes(key)) {
    await validateHierarchy(db, resource.table, id, data.parent_id);
    if (key === "navigation" && data.parent_id) {
      const p = (
        await db.query("SELECT menu_id FROM menu_items WHERE id=$1", [
          data.parent_id,
        ])
      ).rows[0];
      assert(
        p?.menu_id === data.menu_id,
        "Parent must belong to the same menu.",
      );
    }
  }
  if (data.starts_at && data.ends_at) assert(data.ends_at >= data.starts_at, 'End date must follow start date.');
  if (key === 'delivery_rules') assert(data.maximum_days >= data.minimum_days, 'Maximum delivery days must be at least the minimum.');
  if (key === 'bundle_items' && data.variation_id) {
    assert((await db.query('SELECT 1 FROM product_variations WHERE id=$1 AND product_id=$2',[data.variation_id,data.product_id])).rowCount, 'Variation does not belong to product.');
  }
  if (key === 'product_variations') {
    assert(data.sale_price === null || data.sale_price <= data.regular_price,'Sale price cannot exceed regular price.');
    const old = id ? (await db.query('SELECT * FROM product_variations WHERE id=$1 FOR UPDATE',[id])).rows[0] : null;
    if(old) assert(old.product_id === data.product_id,'A variation cannot be moved to another product.');
    if(data.stock_quantity !== (old?.stock_quantity||0)) {
      assert(can(user,'inventory.edit'),'Inventory edit permission is required to change stock.',403);
      await db.query('INSERT INTO inventory_transactions(product_id,product_name,user_id,delta,before_quantity,after_quantity,reason,variation_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',[data.product_id,data.name,user.id,data.stock_quantity-(old?.stock_quantity||0),old?.stock_quantity||0,data.stock_quantity,'Variation stock adjustment',old?.id||null]);
    }
  }
  const columns = Object.keys(data),
    values = Object.entries(data).map(([key,value])=>key==='links'?JSON.stringify(value):value);
  const sql = id
    ? `UPDATE ${resource.table} SET ${columns.map((c, i) => `${c}=$${i + 1}`).join(",")} WHERE id=$${columns.length + 1} RETURNING *`
    : `INSERT INTO ${resource.table}(${columns.join(",")}) VALUES(${columns.map((_, i) => "$" + (i + 1)).join(",")}) RETURNING *`;
  if (id) values.push(id);
  const record = (await db.query(sql, values)).rows[0];
  assert(record, "Record not found.", 404);
  if (key === "products") {
    if (body.category_ids !== undefined) {
      const ids=z.array(z.number().int().positive()).max(30).parse(body.category_ids);
      await db.query('DELETE FROM product_categories WHERE product_id=$1',[record.id]);
      for(const cid of new Set(ids))await db.query('INSERT INTO product_categories VALUES($1,$2)',[record.id,cid]);
    }
    if (body.location_ids !== undefined) {
      const locations = z.array(z.number().int().positive()).max(30).parse(body.location_ids);
      await db.query('DELETE FROM product_locations WHERE product_id=$1',[record.id]);
      for (const location of new Set(locations)) await db.query('INSERT INTO product_locations VALUES($1,$2)',[record.id,location]);
    }
    if (body.images !== undefined) {
      const images = z
        .array(
          z.object({
            path: z.string().regex(/^(\/[^/]|https?:\/\/)/),
            alt: z.string().max(500).default(""),
          }),
        )
        .max(30)
        .parse(body.images);
      await db.query("DELETE FROM product_images WHERE product_id=$1", [
        record.id,
      ]);
      for (const [i, img] of images.entries())
        await db.query(
          "INSERT INTO product_images(product_id,path,alt,display_order) VALUES($1,$2,$3,$4)",
          [record.id, img.path, img.alt, i],
        );
    }
    if (body.attributes !== undefined) {
      const attrs = z
        .array(
          z.object({
            name: z.string().min(1).max(100),
            value: z.string().max(1000),
            attribute_key:z.string().max(100).default(""),
            attribute_group:z.string().max(100).default("care"),
            translations:z.record(z.string(),z.object({name:z.string().max(100).optional(),value:z.string().max(1000).optional()})).default({}),
          }),
        )
        .max(50)
        .parse(body.attributes);
      await db.query("DELETE FROM product_attributes WHERE product_id=$1", [
        record.id,
      ]);
      for (const a of attrs)
        await db.query(
          "INSERT INTO product_attributes(product_id,name,value,attribute_key,attribute_group,translations) VALUES($1,$2,$3,$4,$5,$6)",
          [record.id, a.name, a.value,a.attribute_key,a.attribute_group,a.translations],
        );
    }
    if (body.related_ids !== undefined) {
      const ids = z
        .array(z.number().int().positive())
        .max(30)
        .parse(body.related_ids);
      await db.query("DELETE FROM product_relations WHERE product_id=$1", [
        record.id,
      ]);
      for (const rid of new Set(ids))
        await db.query("INSERT INTO product_relations VALUES($1,$2)", [
          record.id,
          rid,
        ]);
    }
  }
  if (key === "coupons")
    for (const [field, table, col] of [
      ["product_ids", "coupon_products", "product_id"],
      ["category_ids", "coupon_categories", "category_id"],
    ])
      if (body[field] !== undefined) {
        const ids = z
          .array(z.number().int().positive())
          .max(100)
          .parse(body[field]);
        await db.query(`DELETE FROM ${table} WHERE coupon_id=$1`, [record.id]);
        for (const v of new Set(ids))
          await db.query(
            `INSERT INTO ${table}(coupon_id,${col}) VALUES($1,$2)`,
            [record.id, v],
          );
      }
  await audit(
    db,
    user,
    id ? "update" : "create",
    key,
    record.id,
    `${id ? "Updated" : "Created"} ${key}: ${record.name || record.title || record.code || record.id}`,
  );
  return record;
}
function validateConfiguration(value) {
  if (Array.isArray(value)) {
    for (const v of value) validateConfiguration(v);
  } else if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value)) {
      if (typeof v === "string" && /(url|image|src|href|destination)$/i.test(k))
        assert(
          !v || /^\/(?!\/)/.test(v) || /^https?:\/\//.test(v),
          "Section links and images must use safe URLs.",
        );
      validateConfiguration(v);
    }
  }
}
