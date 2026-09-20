import dotenv from "dotenv";
import { spawnSync } from "node:child_process";
import { mkdir, writeFile, unlink, access } from "node:fs/promises";
import path from "node:path";
import pg from "pg";
dotenv.config({ path: "backend/.env", quiet: true });
const dir = path.resolve(".local/postgres"),
  log = path.resolve(".local/postgres.log");
const action = process.argv[2] || "start",
  port = process.env.DB_PORT || "55432";
const run = (cmd, args, env = process.env) => {
  const result = spawnSync(cmd, args, { stdio: "inherit", env });
  if (result.status) throw Error(`${cmd} exited with ${result.status}`);
};
if (!["start", "stop", "status"].includes(action))
  throw Error("Use start, stop, or status.");
await mkdir(path.dirname(dir), { recursive: true });
if (action === "start") {
  if (!process.env.DB_PASSWORD)
    throw Error(
      "Set DB_PASSWORD in backend/.env before starting the local database.",
    );
  try {
    await access(path.join(dir, "PG_VERSION"));
  } catch {
    const pwfile = path.resolve(".local/init-password");
    await writeFile(pwfile, process.env.DB_PASSWORD, { mode: 0o600 });
    try {
      run("initdb", [
        "-D",
        dir,
        "-U",
        process.env.DB_USER || "gharsa",
        "-A",
        "scram-sha-256",
        "--pwfile=" + pwfile,
      ]);
    } finally {
      await unlink(pwfile);
    }
  }
  const status = spawnSync("pg_ctl", ["-D", dir, "status"], {
    stdio: "ignore",
  });
  if (status.status)
    run("pg_ctl", [
      "-D",
      dir,
      "-l",
      log,
      "-o",
      `-p ${Number(port)} -h 127.0.0.1 -k /tmp`,
      "start",
    ]);
  const database = process.env.DB_NAME || "gharsa";
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(database))
    throw Error("Use an alphanumeric local database name.");
  const client = new pg.Client({
    host: "127.0.0.1",
    port: Number(port),
    database: "postgres",
    user: process.env.DB_USER || "gharsa",
    password: process.env.DB_PASSWORD,
  });
  await client.connect();
  try {
    if (
      !(
        await client.query("SELECT 1 FROM pg_database WHERE datname=$1", [
          database,
        ])
      ).rowCount
    )
      await client.query(`CREATE DATABASE "${database}"`);
  } finally {
    await client.end();
  }
  console.log(
    `Local PostgreSQL ready on 127.0.0.1:${port}; database ${database}.`,
  );
} else run("pg_ctl", ["-D", dir, action]);
