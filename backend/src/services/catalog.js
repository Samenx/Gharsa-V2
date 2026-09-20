import { query } from "../config/db.js";
export const productSelect = `SELECT p.*,(SELECT min(COALESCE(v.sale_price,v.regular_price)) FROM product_variations v WHERE v.product_id=p.id AND v.active) variation_from_price,COALESCE((SELECT jsonb_agg(jsonb_build_object('id',v.id,'name',v.name,'regular_price',v.regular_price,'sale_price',v.sale_price,'stock_quantity',v.stock_quantity,'image',v.image,'translations',v.translations) ORDER BY v.display_order,v.id) FROM product_variations v WHERE v.product_id=p.id AND v.active),'[]') variations,EXISTS(SELECT 1 FROM product_variations v WHERE v.product_id=p.id AND v.active) has_variations,c.name category_name,c.translations category_translations,c.slug category_slug,COALESCE(r.average_rating,0)::float average_rating,COALESCE(r.review_count,0)::int review_count FROM products p LEFT JOIN categories c ON c.id=p.category_id LEFT JOIN (SELECT product_id,AVG(rating) average_rating,COUNT(*) review_count FROM reviews WHERE status='approved' GROUP BY product_id) r ON r.product_id=p.id`;
export async function listProducts(params = {}) {
  const conditions = ["p.active=true"];
  const values = [];
  const add = (sql, v) => {
    values.push(v);
    conditions.push(sql.replaceAll("?", `$${values.length}`));
  };
  if (params.search)
    add(
      "(p.name ILIKE ? OR p.translations->'ar'->>'name' ILIKE ? OR p.description ILIKE ? OR p.sku ILIKE ? OR c.name ILIKE ? OR EXISTS(SELECT 1 FROM categories sc WHERE sc.id=p.subcategory_id AND sc.name ILIKE ?))",
      `%${String(params.search).slice(0, 200)}%`,
    );
  if (params.category)
    add(
      `(p.category_id IN (WITH RECURSIVE tree AS (SELECT id FROM categories WHERE slug=? UNION ALL SELECT c.id FROM categories c JOIN tree t ON c.parent_id=t.id) SELECT id FROM tree) OR p.subcategory_id IN (WITH RECURSIVE tree AS (SELECT id FROM categories WHERE slug=? UNION ALL SELECT c.id FROM categories c JOIN tree t ON c.parent_id=t.id) SELECT id FROM tree) OR p.id IN (SELECT pc.product_id FROM product_categories pc WHERE pc.category_id IN (WITH RECURSIVE tree AS (SELECT id FROM categories WHERE slug=? UNION ALL SELECT c.id FROM categories c JOIN tree t ON c.parent_id=t.id) SELECT id FROM tree)))`,
      params.category,
    );
  for (const [key, op] of [
    ["min", ">="],
    ["max", "<="],
  ])
    if (
      params[key] !== undefined &&
      params[key] !== "" &&
      Number.isFinite(Number(params[key]))
    )
      add(
        `(COALESCE((SELECT min(COALESCE(v.sale_price,v.regular_price)) FROM product_variations v WHERE v.product_id=p.id AND v.active),CASE WHEN p.on_sale THEN COALESCE(p.sale_price,p.regular_price) ELSE p.regular_price END)) ${op} ?`,
        Number(params[key]),
      );
  if (params.sale === "true" || params.source === "sale")
    conditions.push("p.on_sale=true AND p.sale_price IS NOT NULL");
  if (["popular", "featured"].includes(params.source))
    conditions.push(`p.${params.source}=true`);
  if(params.stock==='in_stock') conditions.push("(EXISTS(SELECT 1 FROM product_variations v WHERE v.product_id=p.id AND v.active AND v.stock_quantity>0) OR (NOT EXISTS(SELECT 1 FROM product_variations v WHERE v.product_id=p.id AND v.active) AND p.stock_quantity>0 AND p.stock_status='in_stock'))");
  if(params.stock==='out_of_stock') conditions.push("NOT EXISTS(SELECT 1 FROM product_variations v WHERE v.product_id=p.id AND v.active AND v.stock_quantity>0) AND (EXISTS(SELECT 1 FROM product_variations v WHERE v.product_id=p.id AND v.active) OR p.stock_quantity=0 OR p.stock_status='out_of_stock')");
  if(params.location) add('EXISTS(SELECT 1 FROM product_locations pl JOIN suitable_locations sl ON sl.id=pl.location_id WHERE pl.product_id=p.id AND sl.slug=?)',String(params.location).slice(0,100));
  for(const [key,names] of Object.entries({light:['Light','Sunlight','Exposure'],watering:['Watering','Water'],difficulty:['Difficulty','Care level'],size:['Size','Plant size','Height']})) {
    if(params[key]) {values.push(names); const namesParam='$'+values.length;add(`EXISTS(SELECT 1 FROM product_attributes pa WHERE pa.product_id=p.id AND (pa.attribute_key='${key}' OR pa.name=ANY(${namesParam}::text[])) AND pa.value ILIKE ?)`, '%'+String(params[key]).slice(0,100)+'%');}
  }
  if (params.ids) {
    const ids = String(params.ids)
      .split(",")
      .map(Number)
      .filter(Number.isInteger)
      .slice(0, 100);
    add("p.id=ANY(?::int[])", ids);
  }
  const where = conditions.join(" AND ");
  const total = Number(
    (
      await query(
        `SELECT count(*) FROM products p LEFT JOIN categories c ON c.id=p.category_id WHERE ${where}`,
        values,
      )
    ).rows[0].count,
  );
  const settings =
    (await query("SELECT value FROM site_settings WHERE key='store'")).rows[0]
      ?.value || {};
  const limit = Math.min(
    100,
    Math.max(1, Number(params.limit) || settings.products_per_page || 12),
  );
  const page = Math.max(1, Number.parseInt(params.page) || 1);
  const sort =
    {
      newest: "p.created_at DESC",
      popularity:"(SELECT COALESCE(sum(oi.quantity),0) FROM order_items oi JOIN orders o ON o.id=oi.order_id WHERE oi.product_id=p.id AND o.status NOT IN ('cancelled','refunded')) DESC",
      price_asc:
        "COALESCE((SELECT min(COALESCE(v.sale_price,v.regular_price)) FROM product_variations v WHERE v.product_id=p.id AND v.active),CASE WHEN p.on_sale THEN COALESCE(p.sale_price,p.regular_price) ELSE p.regular_price END) ASC",
      price_desc:
        "COALESCE((SELECT min(COALESCE(v.sale_price,v.regular_price)) FROM product_variations v WHERE v.product_id=p.id AND v.active),CASE WHEN p.on_sale THEN COALESCE(p.sale_price,p.regular_price) ELSE p.regular_price END) DESC",
      name: "p.name ASC",
      rating: "average_rating DESC",
    }[params.sort] || "p.id ASC";
  const rows = (
    await query(
      `${productSelect} WHERE ${where} ORDER BY ${sort},p.id LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
      [...values, limit, (page - 1) * limit],
    )
  ).rows;
  return {
    items: rows.map(publicProduct),
    total,
    page,
    pages: Math.ceil(total / limit),
    limit,
  };
}

export function publicProduct(product) {
  const { cost_price, ...publicFields } = product;
  return publicFields;
}
