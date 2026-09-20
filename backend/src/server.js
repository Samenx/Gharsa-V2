import { app } from "./app.js";
import { pool } from "./config/db.js";
const server = app.listen(process.env.PORT || 5000, () =>
  console.log(`GHARSA API listening on port ${process.env.PORT || 5000}`),
);
process.on("SIGTERM", () =>
  server.close(async () => {
    await pool.end();
    process.exit(0);
  }),
);
