import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { query, transaction } from "../config/db.js";
import { authenticated, loadUser, tokenFor } from "../middleware/auth.js";
import { text, email, password, address } from "../validators/index.js";
import { assert } from "../utils/errors.js";
const router = Router();
const limit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Too many attempts. Please try again later." },
});
router.post("/register", limit, async (req, res) => {
  const d = z
    .object({
      name: text,
      email,
      phone: z.string().max(50).default(""),
      password,
      confirm_password: z.string(),
    })
    .parse(req.body);
  assert(d.password === d.confirm_password, "Passwords do not match.");
  const id = await transaction(async (db) => {
    const {
      rows: [u],
    } = await db.query(
      "INSERT INTO users(name,email,phone,password_hash) VALUES($1,$2,$3,$4) RETURNING id",
      [d.name, d.email, d.phone, await bcrypt.hash(d.password, 12)],
    );
    await db.query(
      "INSERT INTO user_roles SELECT $1,id FROM roles WHERE name='CUSTOMER'",
      [u.id],
    );
    return u.id;
  });
  const user = await loadUser(id);
  res.status(201).json({ user, token: tokenFor(user) });
});
router.post("/login", limit, async (req, res) => {
  const d = z.object({ email, password: z.string().max(72) }).parse(req.body);
  const {
    rows: [u],
  } = await query("SELECT * FROM users WHERE email=$1", [d.email]);
  assert(
    u && u.active && (await bcrypt.compare(d.password, u.password_hash)),
    "Invalid email or password.",
    401,
  );
  const user = await loadUser(u.id);
  res.json({ user, token: tokenFor(user) });
});
router.get("/me", authenticated, (req, res) => res.json(req.user));
router.post("/logout", authenticated, async (req, res) => {
  await query("UPDATE users SET token_version=token_version+1 WHERE id=$1", [
    req.user.id,
  ]);
  res.json({ success: true });
});
router.put("/profile", authenticated, async (req, res) => {
  const d = z.object({ name: text, phone: z.string().max(50) }).parse(req.body);
  await query(
    "UPDATE users SET name=$1,phone=$2,updated_at=now() WHERE id=$3",
    [d.name, d.phone, req.user.id],
  );
  res.json(await loadUser(req.user.id));
});
router.put("/password", authenticated, async (req, res) => {
  const d = z
    .object({
      current_password: z.string(),
      password,
      confirm_password: z.string(),
    })
    .parse(req.body);
  assert(d.password === d.confirm_password, "Passwords do not match.");
  const {
    rows: [u],
  } = await query("SELECT password_hash FROM users WHERE id=$1", [req.user.id]);
  assert(
    await bcrypt.compare(d.current_password, u.password_hash),
    "Current password is incorrect.",
  );
  await query(
    "UPDATE users SET password_hash=$1,token_version=token_version+1 WHERE id=$2",
    [await bcrypt.hash(d.password, 12), req.user.id],
  );
  res.json({ token: tokenFor(await loadUser(req.user.id)) });
});
router.get("/addresses", authenticated, async (req, res) =>
  res.json(
    (
      await query("SELECT * FROM addresses WHERE user_id=$1 ORDER BY id", [
        req.user.id,
      ])
    ).rows,
  ),
);
router.post("/addresses", authenticated, async (req, res) => {
  const d = address.extend({ label: text.default("Home") }).parse(req.body);
  const keys = Object.keys(d);
  res
    .status(201)
    .json(
      (
        await query(
          `INSERT INTO addresses(user_id,${keys.join(",")}) VALUES($1,${keys.map((_, i) => "$" + (i + 2)).join(",")}) RETURNING *`,
          [req.user.id, ...Object.values(d)],
        )
      ).rows[0],
    );
});
router.put("/addresses/:id", authenticated, async (req, res) => {
  const d = address.extend({ label: text.default("Home") }).parse(req.body);
  const columns = Object.keys(d);
  const {
    rows: [saved],
  } = await query(
    `UPDATE addresses SET ${columns.map((c, i) => `${c}=$${i + 1}`).join(",")} WHERE id=$${columns.length + 1} AND user_id=$${columns.length + 2} RETURNING *`,
    [...Object.values(d), req.params.id, req.user.id],
  );
  assert(saved, "Address not found.", 404);
  res.json(saved);
});
router.delete("/addresses/:id", authenticated, async (req, res) => {
  await query("DELETE FROM addresses WHERE id=$1 AND user_id=$2", [
    req.params.id,
    req.user.id,
  ]);
  res.json({ success: true });
});
export default router;
