import { pool, transaction } from "../src/config/db.js";
import { readdir, readFile } from "node:fs/promises";
await pool.query(
  "CREATE TABLE IF NOT EXISTS schema_migrations(name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ DEFAULT now())",
);
for (const name of (
  await readdir(new URL("./migrations/", import.meta.url))
).sort()) {
  if (
    !(await pool.query("SELECT 1 FROM schema_migrations WHERE name=$1", [name]))
      .rowCount
  ) {
    await transaction(async (db) => {
      await db.query(
        await readFile(
          new URL("./migrations/" + name, import.meta.url),
          "utf8",
        ),
      );
      await db.query("INSERT INTO schema_migrations(name) VALUES($1)", [name]);
    });
    console.log("Applied", name);
  }
}
await pool.end();
