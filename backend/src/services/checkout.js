import { deliveryEstimate } from "./v2.js";
import { paymentMethod } from "./payments.js";
import { randomBytes } from "node:crypto";
import { assert } from "../utils/errors.js";
import { transaction } from "../config/db.js";
export const mills = (v) => Math.round(Number(v) * 1000);
export const price = (p) =>
  p.on_sale && p.sale_price !== null ? p.sale_price : p.regular_price;
export async function quote(db, items, code, email, userId, lock = false) {
  assert(items.length, "Your cart is empty.");
  const merged = new Map();
  for (const i of items) { const key=`${i.product_id}:${i.variation_id||0}:${i.bundle_id||0}`;const old=merged.get(key);merged.set(key,{...i,quantity:(old?.quantity||0)+i.quantity}); }
  const ids = [...new Set(items.map(i=>i.product_id))].sort((a,b)=>a-b);
  const {rows:products}=await db.query(`SELECT * FROM products WHERE id=ANY($1::int[]) ORDER BY id ${lock?'FOR UPDATE':''}`,[ids]);
  assert(products.length===ids.length,'A product is no longer available.');
  const {rows:variations}=await db.query(`SELECT * FROM product_variations WHERE product_id=ANY($1::int[]) ORDER BY id ${lock?'FOR UPDATE':''}`,[ids]);
  const demand=new Map();
  let subtotal=0;
  const lines=[...merged.values()].map(i=>{
    const p=products.find(p=>p.id===i.product_id),v=variations.find(v=>v.id===i.variation_id);
    assert(p.active,'A product is no longer available.');
    if(i.variation_id) assert(v?.active&&v.product_id===p.id,'Selected size is not available for this plant.');
    else assert(!variations.some(v=>v.product_id===p.id&&v.active),`${p.name}: choose a size.`);
    const stock=v||p, key=v?'v'+v.id:'p'+p.id;
    demand.set(key,(demand.get(key)||0)+i.quantity);
    assert((v||p.stock_status==='in_stock')&&stock.stock_quantity>=demand.get(key),`${p.name}: only ${stock.stock_quantity} units available.`);
    const amount=mills(v?(v.sale_price??v.regular_price):price(p));
    subtotal+=amount*i.quantity;
    return {...p,variation_id:v?.id||null,variation_name:v?.name||'',bundle_id:i.bundle_id||null,sku:v?.sku||p.sku,main_image:v?.image||p.main_image,quantity:i.quantity,stock_quantity:stock.stock_quantity,unit_price:amount/1000,line_discount:0};
  });
  let bundleDiscount=0;
  for(const id of [...new Set(lines.map(l=>l.bundle_id).filter(Boolean))]) {
    const b=(await db.query(`SELECT * FROM bundles WHERE id=$1 ${lock?'FOR UPDATE':''}`,[id])).rows[0];
    assert(b?.active&&(!b.starts_at||b.starts_at<=new Date())&&(!b.ends_at||b.ends_at>=new Date()),'This bundle is no longer available.');
    const allowed=(await db.query('SELECT * FROM bundle_items WHERE bundle_id=$1',[id])).rows;
    const selected=lines.filter(l=>l.bundle_id===id),base=selected.filter(l=>l.id===b.base_product_id);
    assert(base.length===1,'A bundle must include its base plant.');
    const count=base[0].quantity;
    for(const l of selected.filter(l=>l.id!==b.base_product_id)) {
      const a=allowed.find(a=>a.product_id===l.id&&(a.variation_id||null)===l.variation_id);
      assert(a&&l.quantity===a.quantity*count,'Bundle quantities or products are invalid.');
    }
    for(const a of allowed.filter(a=>!a.optional)) assert(selected.some(l=>l.id===a.product_id&&l.variation_id===(a.variation_id||null)&&l.quantity===a.quantity*count),'A required bundle item is missing.');
    assert(selected.length>1,'Choose at least one add-on to receive the bundle discount.');
    for(const l of selected){l.line_discount=Math.round(mills(l.unit_price)*l.quantity*Number(b.discount_percent)/100)/1000;bundleDiscount+=mills(l.line_discount);}
  }
  let discount = 0,
    coupon = null;
  if (code) {
    assert(!bundleDiscount,"Coupons cannot be combined with bundle discounts.");
    coupon = (
      await db.query(
        `SELECT * FROM coupons WHERE code=$1 ${lock ? "FOR UPDATE" : ""}`,
        [code.trim().toUpperCase()],
      )
    ).rows[0];
    assert(coupon && coupon.active, "This coupon is not available.");
    const now = new Date();
    assert(
      (!coupon.start_date || coupon.start_date <= now) &&
        (!coupon.expiration_date || coupon.expiration_date >= now),
      "This coupon is not valid at this time.",
    );
    assert(
      subtotal >= mills(coupon.minimum_order),
      "The minimum order for this coupon has not been reached.",
    );
    const uses = (
      await db.query(
        "SELECT COUNT(*)::int total,COUNT(*) FILTER(WHERE lower(email)=lower($2) OR ($3::int IS NOT NULL AND user_id=$3))::int personal FROM coupon_usage WHERE coupon_id=$1",
        [coupon.id, email || "", userId || null],
      )
    ).rows[0];
    assert(
      !coupon.usage_limit || uses.total < coupon.usage_limit,
      "Coupon usage limit reached.",
    );
    assert(
      !coupon.usage_per_user || uses.personal < coupon.usage_per_user,
      "You have already used this coupon.",
    );
    const productIds = (
      await db.query(
        "SELECT product_id FROM coupon_products WHERE coupon_id=$1",
        [coupon.id],
      )
    ).rows.map((x) => x.product_id);
    const categoryIds = (
      await db.query(
        "WITH RECURSIVE tree AS (SELECT category_id id FROM coupon_categories WHERE coupon_id=$1 UNION SELECT c.id FROM categories c JOIN tree t ON c.parent_id=t.id) SELECT id FROM tree",
        [coupon.id],
      )
    ).rows.map((x) => x.id);
    const eligible = lines
      .filter(
        (p) =>
          (!productIds.length && !categoryIds.length) ||
          productIds.includes(p.id) ||
          categoryIds.includes(p.category_id) ||
          categoryIds.includes(p.subcategory_id),
      )
      .reduce((s, p) => s + mills(p.unit_price) * p.quantity, 0);
    assert(
      eligible > 0,
      "This coupon does not apply to the items in your cart.",
    );
    discount =
      coupon.discount_type === "percentage"
        ? Math.round((eligible * Number(coupon.discount_amount)) / 100)
        : mills(coupon.discount_amount);
    if (coupon.maximum_discount !== null)
      discount = Math.min(discount, mills(coupon.maximum_discount));
    discount = Math.min(discount, eligible);
  }
  discount += bundleDiscount;
  discount = Math.min(discount,subtotal);
  const settings =
    (await db.query("SELECT value FROM site_settings WHERE key='store'"))
      .rows[0]?.value || {};
  let welcomeDiscount=0;
  if(settings.welcome_discount_enabled && userId && email && !coupon && !bundleDiscount && subtotal>=mills(settings.welcome_discount_minimum||0)) {
    const eligible=await db.query("SELECT 1 FROM newsletter_subscribers n JOIN users u ON lower(u.email)=n.email WHERE n.email=lower($1) AND n.status='subscribed' AND u.id=$2 AND NOT EXISTS(SELECT 1 FROM welcome_redemptions w WHERE w.email=n.email) AND NOT EXISTS(SELECT 1 FROM orders o WHERE lower(o.customer->>'email')=n.email)",[email,userId]);
    if(eligible.rowCount) {welcomeDiscount=Math.round(subtotal*Math.min(50,Math.max(0,Number(settings.welcome_discount_percent||0)))/100);discount+=welcomeDiscount;}
  }
  const shipping =
    subtotal >= mills(settings.free_shipping_threshold ?? 50)
      ? 0
      : mills(settings.shipping_cost ?? 3);
  const tax = Math.round(
    ((subtotal - discount) * Number(settings.tax_rate || 0)) / 100,
  );
  return {
    items: lines,
    bundle_discount: bundleDiscount / 1000,
    welcome_discount:welcomeDiscount/1000,
    subtotal: subtotal / 1000,
    discount: discount / 1000,
    shipping: shipping / 1000,
    tax: tax / 1000,
    total: (subtotal - discount + shipping + tax) / 1000,
    coupon,
    settings,
  };
}
export async function placeOrder(data, user) {
  return transaction(async (db) => {
    await db.query("SELECT pg_advisory_xact_lock(hashtext($1))", [
      data.idempotency_key,
    ]);
    const existing = (
      await db.query("SELECT * FROM orders WHERE idempotency_key=$1", [
        data.idempotency_key,
      ])
    ).rows[0];
    if (existing) {
      assert(
        existing.user_id === (user?.id || null) &&
          existing.customer.email === data.email,
        "Invalid checkout reference.",
        409,
      );
      return existing;
    }
    await db.query("SELECT pg_advisory_xact_lock(hashtext($1))",["welcome:"+data.email.toLowerCase()]);
    const q = await quote(
      db,
      data.items,
      data.coupon,
      data.email,
      user?.id,
      true,
    );
    paymentMethod(data.payment_method, q.settings);
    const customer = {
      name:
        data.shipping_address.first_name +
        " " +
        data.shipping_address.last_name,
      email: data.email,
      phone: data.shipping_address.phone,
    };
    const {
      rows: [order],
    } = await db.query(
      `INSERT INTO orders(order_number,user_id,customer,shipping_address,subtotal,discount,shipping,tax,total,payment_method,notes,idempotency_key) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
      [
        "GH-" +
          Date.now().toString(36).toUpperCase() +
          "-" +
          randomBytes(3).toString("hex").toUpperCase(),
        user?.id || null,
        customer,
        data.shipping_address,
        q.subtotal,
        q.discount,
        q.shipping,
        q.tax,
        q.total,
        data.payment_method,
        data.notes,
        data.idempotency_key,
      ],
    );
    if(q.welcome_discount>0){await db.query('INSERT INTO welcome_redemptions(email,order_id) VALUES(lower($1),$2)',[data.email,order.id]);await db.query('UPDATE orders SET welcome_discount=$1 WHERE id=$2',[q.welcome_discount,order.id]);}
    order.delivery_estimate=await deliveryEstimate(db,data.shipping_address.city);
    await db.query('UPDATE orders SET delivery_estimate=$1 WHERE id=$2',[order.delivery_estimate,order.id]);
    const returnPolicy=(await db.query('SELECT * FROM return_policies WHERE active ORDER BY id DESC LIMIT 1')).rows[0];
    const policies=(await db.query('SELECT * FROM guarantee_policies WHERE active ORDER BY id DESC')).rows;
    for (const p of q.items) {
      const policy=policies.find(g=>(!g.product_ids.length&&!g.category_ids.length)||g.product_ids.includes(p.id)||g.category_ids.includes(p.category_id)||g.category_ids.includes(p.subcategory_id));
      await db.query(
        "INSERT INTO order_items(order_id,product_id,name,sku,image,quantity,unit_price,variation_id,variation_name,bundle_id,discount,guarantee_snapshot,return_snapshot) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)",
        [order.id, p.id, p.name, p.sku, p.main_image, p.quantity, p.unit_price,p.variation_id,p.variation_name,p.bundle_id,p.line_discount,policy||null,returnPolicy||null],
      );
      const stockResult=await db.query(
        `UPDATE ${p.variation_id ? "product_variations" : "products"} SET stock_quantity=stock_quantity-$1,updated_at=now() WHERE id=$2 RETURNING stock_quantity`,
        [p.quantity, p.variation_id||p.id],
      );
      await db.query(
        "INSERT INTO inventory_transactions(product_id,product_name,user_id,delta,before_quantity,after_quantity,reason,variation_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8)",
        [
          p.id,
          p.name,
          user?.id || null,
          -p.quantity,
          stockResult.rows[0].stock_quantity + p.quantity,
          stockResult.rows[0].stock_quantity,
          "Order " + order.order_number,
          p.variation_id,
        ],
      );
    }
    if (q.coupon)
      await db.query(
        "INSERT INTO coupon_usage(coupon_id,user_id,email,order_id) VALUES($1,$2,$3,$4)",
        [q.coupon.id, user?.id || null, data.email, order.id],
      );
    if (user)
      await db.query(
        "DELETE FROM cart_items WHERE cart_id IN (SELECT id FROM carts WHERE user_id=$1)",
        [user.id],
      );
    return order;
  });
}
export async function changeOrderStatus(db, id, status, user) {
  const {
    rows: [order],
  } = await db.query("SELECT * FROM orders WHERE id=$1 FOR UPDATE", [id]);
  assert(order, "Order not found.", 404);
  const transitions = {
    pending: ["processing", "paid", "cancelled"],
    processing: ["paid", "shipped", "cancelled"],
    paid: ["shipped", "cancelled", "refunded"],
    shipped: ["completed", "refunded"],
    completed: ["refunded"],
    cancelled: [],
    refunded: [],
  };
  assert(
    status === order.status || transitions[order.status].includes(status),
    "Invalid order status transition.",
  );
  if (["cancelled", "refunded"].includes(status) && !order.inventory_restored) {
    const items = (
      await db.query(
        "SELECT * FROM order_items WHERE order_id=$1 ORDER BY product_id,variation_id",
        [id],
      )
    ).rows;
    for (const i of items) {
      if (!i.product_id) continue;
      const {
        rows: [p],
      } = await db.query(`SELECT * FROM ${i.variation_id?"product_variations":"products"} WHERE id=$1 FOR UPDATE`, [
        i.variation_id||i.product_id,
      ]);
      await db.query(
        `UPDATE ${i.variation_id?"product_variations":"products"} SET stock_quantity=stock_quantity+$1,updated_at=now() WHERE id=$2`,
        [i.quantity, p.id],
      );
      await db.query(
        "INSERT INTO inventory_transactions(product_id,product_name,user_id,delta,before_quantity,after_quantity,reason,variation_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8)",
        [
          i.product_id,
          i.name,
          user.id,
          i.quantity,
          p.stock_quantity,
          p.stock_quantity + i.quantity,
          "Restore " + order.order_number,
          i.variation_id,
        ],
      );
    }
    await db.query("UPDATE orders SET inventory_restored=true WHERE id=$1", [
      id,
    ]);
  }
  return (
    await db.query(
      "UPDATE orders SET status=$1,completed_at=CASE WHEN $1='completed' THEN COALESCE(completed_at,now()) ELSE completed_at END,payment_status=CASE WHEN $1 IN ('paid','completed') THEN 'paid' WHEN $1='refunded' THEN 'refunded' ELSE payment_status END,updated_at=now() WHERE id=$2 RETURNING *",
      [status, id],
    )
  ).rows[0];
}
