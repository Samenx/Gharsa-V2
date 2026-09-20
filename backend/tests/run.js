import "dotenv/config";
import pg from "pg";
import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
const dbName = "gharsa_test_" + randomBytes(5).toString("hex");
const pool = new pg.Pool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 5432),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});
await pool.query(`CREATE DATABASE ${dbName}`);
const env = {
  ...process.env,
  DB_NAME: dbName,
  NODE_ENV: "test",
  SUPER_ADMIN_EMAIL: "test-admin@gharsa.local",
  SUPER_ADMIN_PASSWORD: randomBytes(24).toString("hex"),
};
let code = 0;
try {
  for (const args of [
    ["database/migrate.js"],
    ["database/seeds/seed.js"],
    ["database/seeds/v2.js"],
    ["database/seeds/v2-content.js"],
    ["database/seeds/v2-details.js"],
    ["database/seeds/v2-settings.js"],
    ["--test", "--test-concurrency=1", "tests/integration.test.js","tests/v2.test.js"],
  ]) {
    const p = spawnSync(process.execPath, args, { env, stdio: "inherit" });
    if (p.status) {
      code = p.status;
      break;
    }
  }
} finally {
  await pool.query(`DROP DATABASE ${dbName} WITH (FORCE)`);
  await pool.end();
}
process.exitCode = code;
