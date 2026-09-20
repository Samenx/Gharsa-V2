import { Router } from "express";
import { z } from "zod";
import { rateLimit } from "express-rate-limit";
import { query, pool, transaction } from "../config/db.js";
import { authenticated } from "../middleware/auth.js";
import {
  listProducts,
  productSelect,
  publicProduct,
} from "../services/catalog.js";
import { quote, placeOrder } from "../services/checkout.js";
import { cart, checkout, email, text } from "../validators/index.js";
import { assert } from "../utils/errors.js";
import { productV2 } from "../services/v2.js";
const r = Router();
r.get("/settings", async (req, res) =>
  res.json(
    (await query("SELECT value FROM site_settings WHERE key='store'")).rows[0]
      ?.value || {},
  ),
);
r.get("/categories", async (req, res) =>
  res.json(
    (
      await query(
        "SELECT * FROM categories WHERE active=true ORDER BY display_order,id",
      )
    ).rows,
  ),
);
r.get("/products", async (req, res) => res.json(await listProducts(req.query)));
r.get("/products/:slug", async (req, res) => {
  const p = (
    await query(`${productSelect} WHERE p.slug=$1 AND p.active=true`, [
      req.params.slug,
    ])
  ).rows[0];
  assert(p, "Product not found.", 404);
  Object.assign(p,await productV2(pool,p.id));
  p.images = (
    await query(
      "SELECT * FROM product_images WHERE product_id=$1 ORDER BY display_order,id",
      [p.id],
    )
  ).rows;
  p.attributes = (
    await query(
      "SELECT * FROM product_attributes WHERE product_id=$1 ORDER BY id",
      [p.id],
    )
  ).rows;
  p.reviews = (
    await query(
      "SELECT r.id,r.rating,r.title,r.body,r.created_at,u.name FROM reviews r JOIN users u ON u.id=r.user_id WHERE r.product_id=$1 AND r.status='approved' ORDER BY r.created_at DESC",
      [p.id],
    )
  ).rows;
  p.related = (
    await query(
      `${productSelect} WHERE p.active=true AND p.id<>$1 AND (p.category_id=$2 OR p.id IN(SELECT related_id FROM product_relations WHERE product_id=$1)) LIMIT 4`,
      [p.id, p.category_id],
    )
  ).rows;
  p.recommended = (await listProducts({ source: "featured", limit: 4 })).items;
  p.related = p.related.map(publicProduct);
  res.json(publicProduct(p));
});
r.get("/pages/:slug", async (req, res) => {
  const p = (
    await query("SELECT * FROM pages WHERE slug=$1 AND published=true", [
      req.params.slug,
    ])
  ).rows[0];
  assert(p, "Page not found.", 404);
  p.sections = (
    await query(
      "SELECT * FROM page_sections WHERE page_id=$1 AND enabled=true ORDER BY display_order,id",
      [p.id],
    )
  ).rows;
  res.json(p);
});
r.get("/navigation", async (req, res) =>
  res.json(
    (
      await query(
        `SELECT mi.*,m.location,COALESCE(CASE WHEN c.id IS NOT NULL THEN '/shop?category='||c.slug END,CASE WHEN p.id IS NOT NULL THEN CASE WHEN p.slug='home' THEN '/' ELSE '/'||p.slug END END,mi.url) destination FROM menu_items mi JOIN menus m ON m.id=mi.menu_id LEFT JOIN categories c ON c.id=mi.category_id LEFT JOIN pages p ON p.id=mi.page_id ORDER BY mi.display_order,mi.id`,
      )
    ).rows,
  ),
);
r.get("/testimonials", async (req, res) =>
  res.json(
    (
      await query(
        "SELECT * FROM testimonials WHERE active=true ORDER BY display_order,id",
      )
    ).rows,
  ),
);
r.post(
  "/contact",
  rateLimit({
    windowMs: 3600000,
    limit: 15,
    message: { error: "Too many messages. Try again later." },
  }),
  async (req, res) => {
    const d = z
      .object({
        name: text,
        email,
        phone: z.string().max(50),
        message: z.string().trim().min(5).max(5000),
      })
      .parse(req.body);
    await query(
      "INSERT INTO contact_messages(name,email,phone,message) VALUES($1,$2,$3,$4)",
      Object.values(d),
    );
    res.status(201).json({ success: true });
  },
);
r.get("/cart", authenticated, async (req, res) =>
  res.json(
    (
      await query(
        "SELECT ci.product_id,ci.quantity,ci.variation_id,ci.bundle_id FROM cart_items ci JOIN carts c ON c.id=ci.cart_id WHERE c.user_id=$1",
        [req.user.id],
      )
    ).rows,
  ),
);
r.put("/cart", authenticated, async (req, res) => {
  const d = cart.parse(req.body);
  await transaction(async (db) => {
    const {
      rows: [c],
    } = await db.query(
      "INSERT INTO carts(user_id) VALUES($1) ON CONFLICT(user_id) DO UPDATE SET user_id=EXCLUDED.user_id RETURNING id",
      [req.user.id],
    );
    await db.query("DELETE FROM cart_items WHERE cart_id=$1", [c.id]);
    for (const i of d.items)
      await db.query(
        "INSERT INTO cart_items(cart_id,product_id,quantity,variation_id,bundle_id) VALUES($1,$2,$3,$4,$5) ON CONFLICT(cart_id,product_id,(COALESCE(variation_id,0)),(COALESCE(bundle_id,0))) DO UPDATE SET quantity=EXCLUDED.quantity",
        [c.id, i.product_id, i.quantity,i.variation_id,i.bundle_id],
      );
  });
  res.json(d.items);
});
r.post("/cart/quote", async (req, res) => {
  const d = cart
    .extend({
      coupon: z.string().max(80).optional(),
      email: z.string().max(254).optional(),
    })
    .parse(req.body);
  const q = await quote(
    pool,
    d.items,
    d.coupon,
    req.user?.email || d.email,
    req.user?.id,
  );
  res.json({
    ...q,
    coupon: q.coupon?.code,
    items: q.items.map(publicProduct),
    settings: undefined,
  });
});
r.post(
  "/checkout",
  rateLimit({
    windowMs: 60000,
    limit: 20,
    message: { error: "Too many checkout attempts." },
  }),
  async (req, res) => {
    const d = checkout.parse(req.body);
    if (req.user) d.email = req.user.email;
    res.status(201).json(await placeOrder(d, req.user));
  },
);
r.get("/orders", authenticated, async (req, res) =>
  res.json(
    (
      await query(
        "SELECT * FROM orders WHERE user_id=$1 ORDER BY created_at DESC",
        [req.user.id],
      )
    ).rows,
  ),
);
r.get("/orders/:id", authenticated, async (req, res) => {
  const o = (
    await query("SELECT * FROM orders WHERE id=$1 AND user_id=$2", [
      req.params.id,
      req.user.id,
    ])
  ).rows[0];
  assert(o, "Order not found.", 404);
  o.items = (
    await query("SELECT * FROM order_items WHERE order_id=$1", [o.id])
  ).rows;
  res.json(o);
});
r.get("/wishlist", authenticated, async (req, res) =>
  res.json(
    (
      await query(
        `${productSelect} JOIN wishlist_items wi ON wi.product_id=p.id JOIN wishlists w ON w.id=wi.wishlist_id WHERE w.user_id=$1 AND p.active=true`,
        [req.user.id],
      )
    ).rows.map(publicProduct),
  ),
);
r.post("/wishlist/:id", authenticated, async (req, res) => {
  await transaction(async (db) => {
    const {
      rows: [w],
    } = await db.query(
      "INSERT INTO wishlists(user_id) VALUES($1) ON CONFLICT(user_id) DO UPDATE SET user_id=EXCLUDED.user_id RETURNING id",
      [req.user.id],
    );
    await db.query(
      "INSERT INTO wishlist_items(wishlist_id,product_id) VALUES($1,$2) ON CONFLICT DO NOTHING",
      [w.id, req.params.id],
    );
  });
  res.status(201).json({ success: true });
});
r.delete("/wishlist/:id", authenticated, async (req, res) => {
  await query(
    "DELETE FROM wishlist_items WHERE product_id=$1 AND wishlist_id IN(SELECT id FROM wishlists WHERE user_id=$2)",
    [req.params.id, req.user.id],
  );
  res.json({ success: true });
});
r.post("/reviews", authenticated, async (req, res) => {
  const d = z
    .object({
      product_id: z.number().int().positive(),
      rating: z.coerce.number().int().min(1).max(5),
      title: text,
      body: z.string().min(5).max(5000),
    })
    .parse(req.body);
  await query(
    "INSERT INTO reviews(product_id,user_id,rating,title,body) VALUES($1,$2,$3,$4,$5)",
    [d.product_id, req.user.id, d.rating, d.title, d.body],
  );
  res
    .status(201)
    .json({ message: "Thank you. Your review is awaiting moderation." });
});
export default r;
