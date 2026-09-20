import { Router } from "express";
import { z } from "zod";

import { query, transaction } from "../config/db.js";
import { permit } from "../middleware/auth.js";
import { resources } from "../config/resources.js";
import { audit } from "../services/admin.js";

import { assert } from "../utils/errors.js";
import { text, email, safeUrl } from "../validators/index.js";
const r = Router();
r.get("/dashboard", permit("dashboard.view"), async (req, res) => {
  const stats = (
    await query(
      `SELECT (SELECT COALESCE(SUM(total),0) FROM orders WHERE status NOT IN('cancelled','refunded')) total_sales,(SELECT COUNT(*) FROM orders) total_orders,(SELECT COUNT(DISTINCT ur.user_id) FROM user_roles ur JOIN roles r ON r.id=ur.role_id WHERE r.name='CUSTOMER') total_customers,(SELECT COUNT(*) FROM products) total_products,(SELECT COUNT(*) FROM products WHERE stock_quantity<=low_stock_threshold AND stock_quantity>0) low_stock,(SELECT COUNT(*) FROM products WHERE stock_quantity=0 OR stock_status='out_of_stock') out_of_stock`,
    )
  ).rows[0];
  res.json({
    stats,
    recent_orders: (
      await query(
        "SELECT id,order_number,total,status,created_at FROM orders ORDER BY id DESC LIMIT 6",
      )
    ).rows,
    recent_customers: (
      await query(
        "SELECT u.name,u.created_at FROM users u WHERE EXISTS(SELECT 1 FROM user_roles ur JOIN roles r ON r.id=ur.role_id WHERE ur.user_id=u.id AND r.name='CUSTOMER') ORDER BY u.id DESC LIMIT 5",
      )
    ).rows,
    best_sellers: (
      await query(
        "SELECT i.name,SUM(i.quantity)::int quantity FROM order_items i JOIN orders o ON o.id=i.order_id WHERE o.status NOT IN('cancelled','refunded') GROUP BY i.name ORDER BY quantity DESC LIMIT 5",
      )
    ).rows,
    chart: (
      await query(
        "SELECT date_trunc('day',created_at)::date AS day,SUM(total) total FROM orders WHERE created_at>now()-interval '30 days' AND status NOT IN('cancelled','refunded') GROUP BY 1 ORDER BY 1",
      )
    ).rows,
  });
});
r.get("/settings", permit("settings.manage"), async (req, res) =>
  res.json(
    (await query("SELECT value FROM site_settings WHERE key='store'")).rows[0]
      ?.value || {},
  ),
);
r.put("/settings", permit("settings.manage"), async (req, res) => {
  const d = z
    .object({
      store_name: text,
      logo: safeUrl,
      footer_logo: safeUrl.default(""),
      favicon: safeUrl,
      phone: z.string().max(100),
      email,
      address: z.string().max(1000),
      currency: z.literal("JOD"),
      free_shipping_threshold: z.coerce.number().min(0),
      shipping_cost: z.coerce.number().min(0),
      tax_rate: z.coerce.number().min(0).max(100),
      products_per_page: z.coerce.number().int().min(1).max(100),
      store_notice: z.string().max(1000),
      footer_text: z.string().max(2000),
      copyright: z.string().max(500),
      social_links: z.array(z.object({ label: text, url: safeUrl })),
      translations:z.record(z.string(),z.record(z.string(),z.string().max(2000))).default({}),
      cod_enabled: z.boolean(),
      welcome_discount_enabled:z.boolean().default(false),
      welcome_discount_percent:z.coerce.number().min(0).max(50).default(10),
      welcome_discount_minimum:z.coerce.number().min(0).default(0),
      footer_cta_enabled: z.boolean().default(true),
      footer_cta_button: z.string().max(100).default("Shop Now"),
      footer_cta_url: safeUrl.default("/shop"),
      footer_contact_title: z.string().max(100).default("Let’s connect"),
      facebook_url: z.union([z.literal(""), z.url().refine(value => /^https?:\/\//i.test(value), "Use an HTTP or HTTPS profile URL.")]).optional(),
      instagram_url: z.union([z.literal(""), z.url().refine(value => /^https?:\/\//i.test(value), "Use an HTTP or HTTPS profile URL.")]).optional(),
      footer_newsletter_enabled: z.boolean().default(true),
      footer_newsletter_image: safeUrl.default("/images/footer-bg.webp"),
      footer_newsletter_title: z.string().max(150).default(""),
      footer_newsletter_text: z.string().max(1000).default(""),
      footer_cta_title: text,
      footer_cta_text: z.string().max(1000),
      footer_cta_image: safeUrl,
    })
    .parse(req.body);
  await transaction(async (db) => {
    await db.query(
      "INSERT INTO site_settings(key,value) VALUES('store',$1) ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value",
      [d],
    );
    await audit(
      db,
      req.user,
      "update",
      "settings",
      "store",
      "Updated site settings",
    );
  });
  res.json(d);
});
r.get("/audit-logs", permit("audit.view"), async (req, res) =>
  res.json(
    (
      await query(
        "SELECT a.*,u.name user_name FROM audit_logs a LEFT JOIN users u ON u.id=a.user_id ORDER BY a.id DESC LIMIT 1000",
      )
    ).rows,
  ),
);
r.get("/seo", permit("seo.manage"), async (req, res) => {
  const result = {};
  for (const table of ["pages", "products", "categories"])
    result[table] = (
      await query(
        `SELECT id,${table === "pages" ? "title" : "name"} label,slug,seo_title,meta_description,canonical_url,noindex FROM ${table} ORDER BY id`,
      )
    ).rows;
  res.json(result);
});
r.put("/seo/:type/:id", permit("seo.manage"), async (req, res) => {
  assert(
    ["pages", "products", "categories"].includes(req.params.type),
    "Invalid resource",
  );
  const d = resources[req.params.type].schema
    .pick({
      seo_title: true,
      meta_description: true,
      canonical_url: true,
      noindex: true,
    })
    .parse(req.body);
  await transaction(async (db) => {
    await db.query(
      `UPDATE ${req.params.type} SET seo_title=$1,meta_description=$2,canonical_url=$3,noindex=$4 WHERE id=$5`,
      [...Object.values(d), req.params.id],
    );
    await audit(
      db,
      req.user,
      "update",
      "seo",
      req.params.id,
      "Updated " + req.params.type + " SEO",
    );
  });
  res.json({ success: true });
});
r.post("/sections/reorder", permit("sections.edit"), async (req, res) => {
  const d = z
    .object({
      page_id: z.number().int().positive(),
      ids: z.array(z.number().int().positive()).max(200),
    })
    .parse(req.body);
  await transaction(async (db) => {
    const rows = (
      await db.query(
        "SELECT id FROM page_sections WHERE page_id=$1 FOR UPDATE",
        [d.page_id],
      )
    ).rows;
    assert(
      rows.length === new Set(d.ids).size &&
        rows.every((s) => d.ids.includes(s.id)),
      "Provide every section on this page exactly once.",
    );
    for (const [i, id] of d.ids.entries())
      await db.query(
        "UPDATE page_sections SET display_order=$1,updated_at=now() WHERE id=$2",
        [i * 10, id],
      );
    await audit(
      db,
      req.user,
      "reorder",
      "sections",
      d.page_id,
      "Reordered page sections",
    );
  });
  res.json({ success: true });
});
export default r;
