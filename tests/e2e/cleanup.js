import dotenv from "dotenv";
import pg from "pg";
dotenv.config({ path: "backend/.env", quiet: true });
// E2E-only fixtures are identified by both their fixed name and generated email.
// Run against a development database, never against production.
export default async function cleanup() {
  const db = new pg.Client({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
  });
  await db.connect();
  try {
    await db.query("BEGIN");
    const { rows: users } = await db.query(
      "SELECT id FROM users WHERE name='Browser Customer' AND email ~ '^browser-[0-9]+@example\\.com$'",
    );
    for (const u of users) {
      const { rows: orders } = await db.query(
        "SELECT id,order_number,inventory_restored FROM orders WHERE user_id=$1 FOR UPDATE",
        [u.id],
      );
      for (const o of orders) {
        if (!o.inventory_restored)
          await db.query(
            "UPDATE products p SET stock_quantity=p.stock_quantity+i.quantity FROM order_items i WHERE i.order_id=$1 AND i.product_id=p.id",
            [o.id],
          );
        await db.query(
          "DELETE FROM inventory_transactions WHERE reason=$1 OR reason=$2",
          ["Order " + o.order_number, "Restore " + o.order_number],
        );
        await db.query("DELETE FROM orders WHERE id=$1", [o.id]);
      }
      await db.query("DELETE FROM users WHERE id=$1", [u.id]);
    }
    await db.query(
      "DELETE FROM contact_messages WHERE name='Browser Visitor' AND email='visitor@example.com' AND message='Please help me select an indoor plant.'",
    );
    await db.query(
      "DELETE FROM inventory_transactions WHERE product_name='Browser Test Plant' AND reason='Browser test receiving'",
    );
    await db.query(
      "DELETE FROM faqs WHERE question=$1 AND answer=$2 AND translations->'ar'->>'question'=$3",
      ["Browser V2 FAQ", "Browser FAQ answer", "سؤال اختبار المتصفح"],
    );
    await db.query("COMMIT");
  } catch (e) {
    await db.query("ROLLBACK");
    throw e;
  } finally {
    await db.end();
  }
}
