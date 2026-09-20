import jwt from "jsonwebtoken";
import { query } from "../config/db.js";
import { HttpError } from "../utils/errors.js";
export async function loadUser(id) {
  const {
    rows: [u],
  } = await query(
    `SELECT id,name,email,phone,active,primary_admin,token_version FROM users WHERE id=$1`,
    [id],
  );
  if (!u || !u.active) return null;
  u.roles = (
    await query(
      "SELECT r.name FROM roles r JOIN user_roles ur ON ur.role_id=r.id WHERE ur.user_id=$1",
      [id],
    )
  ).rows.map((r) => r.name);
  u.permissions = (
    await query(
      "SELECT DISTINCT p.name FROM permissions p JOIN role_permissions rp ON rp.permission_id=p.id JOIN user_roles ur ON ur.role_id=rp.role_id WHERE ur.user_id=$1",
      [id],
    )
  ).rows.map((p) => p.name);
  return u;
}
export async function optionalAuth(req, res, next) {
  const token = req.headers.authorization?.replace(/^Bearer /, "");
  if (token) {
    try {
      const data = jwt.verify(token, process.env.JWT_SECRET, {
        algorithms: ["HS256"],
      });
      req.user = await loadUser(data.sub);
      if (!req.user || req.user.token_version !== data.version) throw Error();
    } catch {
      return next(
        new HttpError(401, "Your session has expired. Please sign in again."),
      );
    }
  }
  next();
}
export const authenticated = (req, res, next) =>
  req.user ? next() : next(new HttpError(401, "Please sign in."));
export const can = (user, permission) =>
  !!user &&
  (user.roles.includes("SUPER_ADMIN") || user.permissions.includes(permission));
export const permit = (permission) => (req, res, next) =>
  can(req.user, permission)
    ? next()
    : next(
        new HttpError(
          req.user ? 403 : 401,
          "You do not have permission to perform this action.",
        ),
      );
export const tokenFor = (user) =>
  jwt.sign({ version: user.token_version }, process.env.JWT_SECRET, {
    subject: String(user.id),
    expiresIn: process.env.JWT_EXPIRES_IN || "1d",
    algorithm: "HS256",
  });
