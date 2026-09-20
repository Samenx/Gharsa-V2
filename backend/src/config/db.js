import "dotenv/config";
import pg from "pg";
export const pool = new pg.Pool({
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT || 5432),
  database: process.env.DB_NAME || "gharsa",
  user: process.env.DB_USER || "postgres",
  password: process.env.DB_PASSWORD || "",
  max: 15,
});
export const query = (text, params = []) => pool.query(text, params);
export async function transaction(fn) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
