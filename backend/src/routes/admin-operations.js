import { Router } from "express";
import { z } from "zod";

import { query, transaction } from "../config/db.js";
import { permit, can } from "../middleware/auth.js";

import { audit } from "../services/admin.js";
import { changeOrderStatus } from "../services/checkout.js";
import { assert } from "../utils/errors.js";
import { text } from "../validators/index.js";
const r = Router();
r.get("/inventory", permit("inventory.view"), async (req, res) =>
  res.json(
    (
      await query(
        "SELECT id,name,sku,stock_quantity,low_stock_threshold,stock_status FROM products ORDER BY stock_quantity,id",
      )
    ).rows,
  ),
);
r.get("/inventory/:id/history", permit("inventory.view"), async (req, res) =>
  res.json(
    (
      await query(
        "SELECT * FROM inventory_transactions WHERE product_id=$1 ORDER BY id DESC",
        [req.params.id],
      )
    ).rows,
  ),
);
r.post("/inventory/:id", permit("inventory.edit"), async (req, res) => {
  const d = z
    .object({
      quantity: z.coerce.number().int().min(0),
      reason: text,
      low_stock_threshold: z.coerce.number().int().min(0),
      stock_status: z.enum(["in_stock", "out_of_stock"]),
    })
    .parse(req.body);
  await transaction(async (db) => {
    const p = (
      await db.query("SELECT * FROM products WHERE id=$1 FOR UPDATE", [
        req.params.id,
      ])
    ).rows[0];
    assert(p, "Product not found.", 404);
    await db.query(
      "UPDATE products SET stock_quantity=$1,low_stock_threshold=$2,stock_status=$3,updated_at=now() WHERE id=$4",
      [d.quantity, d.low_stock_threshold, d.stock_status, p.id],
    );
    await db.query(
      "INSERT INTO inventory_transactions(product_id,product_name,user_id,delta,before_quantity,after_quantity,reason) VALUES($1,$2,$3,$4,$5,$6,$7)",
      [
        p.id,
        p.name,
        req.user.id,
        d.quantity - p.stock_quantity,
        p.stock_quantity,
        d.quantity,
        d.reason,
      ],
    );
    await audit(
      db,
      req.user,
      "stock",
      "inventory",
      p.id,
      `${p.name}: ${p.stock_quantity} → ${d.quantity}. ${d.reason}`,
    );
  });
  res.json({ success: true });
});
r.get("/orders", permit("orders.view"), async (req, res) =>
  res.json((await query("SELECT * FROM orders ORDER BY id DESC")).rows),
);
r.get("/orders/:id", permit("orders.view"), async (req, res) => {
  const o = (await query("SELECT * FROM orders WHERE id=$1", [req.params.id]))
    .rows[0];
  assert(o, "Order not found.", 404);
  o.items = (
    await query("SELECT * FROM order_items WHERE order_id=$1", [o.id])
  ).rows;
  res.json(o);
});
r.put("/orders/:id", permit("orders.edit"), async (req, res) => {
  const status = z
    .enum([
      "pending",
      "processing",
      "paid",
      "shipped",
      "completed",
      "cancelled",
      "refunded",
    ])
    .parse(req.body.status);
  if (status === "refunded")
    assert(
      can(req.user, "orders.refund"),
      "Refund permission is required.",
      403,
    );
  const o = await transaction(async (db) => {
    const result = await changeOrderStatus(db, req.params.id, status, req.user);
    await audit(
      db,
      req.user,
      "status",
      "orders",
      result.id,
      `${result.order_number}: ${status}`,
    );
    return result;
  });
  res.json(o);
});
export default r;
