import { Router } from "express";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { query, transaction } from "../config/db.js";
import { permit, can } from "../middleware/auth.js";

import { audit } from "../services/admin.js";

import { assert } from "../utils/errors.js";
import { text, email, password } from "../validators/index.js";
const r = Router();
r.get("/permissions", permit("roles.view"), async (req, res) =>
  res.json((await query("SELECT * FROM permissions ORDER BY name")).rows),
);
r.get("/roles", permit("roles.view"), async (req, res) =>
  res.json(
    (
      await query(
        "SELECT r.*,COALESCE(array_agg(rp.permission_id) FILTER(WHERE rp.permission_id IS NOT NULL),'{}') permission_ids FROM roles r LEFT JOIN role_permissions rp ON rp.role_id=r.id GROUP BY r.id ORDER BY r.id",
      )
    ).rows,
  ),
);
async function assertAuthority(db, actor, targetId, type) {
  if (actor.roles.includes("SUPER_ADMIN")) return;
  const sql =
    type === "user"
      ? "SELECT DISTINCT p.name FROM permissions p JOIN role_permissions rp ON rp.permission_id=p.id JOIN user_roles ur ON ur.role_id=rp.role_id WHERE ur.user_id=$1"
      : "SELECT p.name FROM permissions p JOIN role_permissions rp ON rp.permission_id=p.id WHERE rp.role_id=$1";
  const { rows } = await db.query(sql, [targetId]);
  assert(
    rows.every((p) => can(actor, p.name)),
    "You cannot modify an account or role with permissions beyond your own.",
    403,
  );
}
async function roleSave(req, res) {
  const d = z
    .object({
      name: text,
      description: z.string().max(1000),
      permission_ids: z.array(z.number().int().positive()),
    })
    .parse(req.body);
  await transaction(async (db) => {
    let id = req.params.id;
    if (id) {
      const role = (
        await db.query("SELECT * FROM roles WHERE id=$1 FOR UPDATE", [id])
      ).rows[0];
      assert(role, "Role not found.", 404);
      await assertAuthority(db, req.user, id, "role");
      assert(
        !role.protected,
        "Built-in roles cannot be edited. Create a custom role.",
      );
    }
    const names = (
      await db.query("SELECT name FROM permissions WHERE id=ANY($1::int[])", [
        d.permission_ids,
      ])
    ).rows.map((x) => x.name);
    assert(
      names.every((p) => can(req.user, p)),
      "You cannot grant permissions you do not hold.",
      403,
    );
    if (id)
      await db.query("UPDATE roles SET name=$1,description=$2 WHERE id=$3", [
        d.name,
        d.description,
        id,
      ]);
    else
      id = (
        await db.query(
          "INSERT INTO roles(name,description) VALUES($1,$2) RETURNING id",
          [d.name, d.description],
        )
      ).rows[0].id;
    await db.query("DELETE FROM role_permissions WHERE role_id=$1", [id]);
    for (const pid of new Set(d.permission_ids))
      await db.query("INSERT INTO role_permissions VALUES($1,$2)", [id, pid]);
    await audit(db, req.user, "save", "roles", id, `Saved role ${d.name}`);
  });
  res.json({ success: true });
}
r.post("/roles", permit("roles.create"), roleSave);
r.put("/roles/:id", permit("roles.edit"), roleSave);
r.delete("/roles/:id", permit("roles.delete"), async (req, res) => {
  await transaction(async (db) => {
    const role = (
      await db.query("SELECT * FROM roles WHERE id=$1 FOR UPDATE", [
        req.params.id,
      ])
    ).rows[0];
    assert(role && !role.protected, "Built-in roles cannot be deleted.");
    await assertAuthority(db, req.user, role.id, "role");
    assert(
      !(await db.query("SELECT 1 FROM user_roles WHERE role_id=$1", [role.id]))
        .rowCount,
      "Remove this role from users before deleting it.",
    );
    await db.query("DELETE FROM roles WHERE id=$1", [role.id]);
    await audit(
      db,
      req.user,
      "delete",
      "roles",
      role.id,
      "Deleted " + role.name,
    );
  });
  res.json({ success: true });
});
r.get("/users", permit("users.view"), async (req, res) =>
  res.json(
    (
      await query(
        "SELECT u.id,u.name,u.email,u.phone,u.active,u.primary_admin,u.created_at,COALESCE(array_agg(ur.role_id) FILTER(WHERE ur.role_id IS NOT NULL),'{}') role_ids FROM users u LEFT JOIN user_roles ur ON ur.user_id=u.id WHERE ($1::boolean=false OR EXISTS(SELECT 1 FROM user_roles cr JOIN roles r ON r.id=cr.role_id WHERE cr.user_id=u.id AND r.name='CUSTOMER')) GROUP BY u.id ORDER BY u.id DESC",
        [req.query.customers === "true"],
      )
    ).rows,
  ),
);
r.get(
  "/users/:id/orders",
  permit("users.view"),
  permit("orders.view"),
  async (req, res) =>
    res.json(
      (
        await query("SELECT * FROM orders WHERE user_id=$1 ORDER BY id DESC", [
          req.params.id,
        ])
      ).rows,
    ),
);
async function userSave(req, res) {
  const d = z
    .object({
      name: text,
      email,
      phone: z.string().max(50).default(""),
      active: z.boolean().default(true),
      password: password.optional(),
      role_ids: z.array(z.number().int().positive()).optional(),
    })
    .parse(req.body);
  await transaction(async (db) => {
    let id = req.params.id;
    const target = id
      ? (await db.query("SELECT * FROM users WHERE id=$1 FOR UPDATE", [id]))
          .rows[0]
      : null;
    if (id) {
      assert(target, "User not found.", 404);
      await assertAuthority(db, req.user, id, "user");
    }
    if (target?.primary_admin) {
      assert(
        req.user.primary_admin,
        "Only the primary administrator may edit this account.",
        403,
      );
      assert(d.active, "The primary administrator cannot be disabled.");
    }
    const targetSuper =
      id &&
      (
        await db.query(
          "SELECT 1 FROM user_roles ur JOIN roles r ON r.id=ur.role_id WHERE ur.user_id=$1 AND r.name='SUPER_ADMIN'",
          [id],
        )
      ).rowCount;
    assert(
      !targetSuper || req.user.roles.includes("SUPER_ADMIN"),
      "Only a Super Admin may edit a Super Admin.",
      403,
    );
    if (d.role_ids !== undefined) {
      assert(
        can(req.user, "roles.edit"),
        "Role assignment requires roles.edit.",
        403,
      );
      const roles = (
        await db.query("SELECT * FROM roles WHERE id=ANY($1::int[])", [
          d.role_ids,
        ])
      ).rows;
      assert(roles.length === new Set(d.role_ids).size, "Invalid role.");
      assert(
        !roles.some((x) => x.name === "SUPER_ADMIN") ||
          req.user.roles.includes("SUPER_ADMIN"),
        "Only Super Admin can assign this role.",
        403,
      );
      if (target?.primary_admin)
        assert(
          roles.some((x) => x.name === "SUPER_ADMIN"),
          "Primary administrator must retain SUPER_ADMIN.",
        );
      const permissions = (
        await db.query(
          "SELECT DISTINCT p.name FROM permissions p JOIN role_permissions rp ON rp.permission_id=p.id WHERE rp.role_id=ANY($1::int[])",
          [d.role_ids],
        )
      ).rows;
      assert(
        permissions.every((x) => can(req.user, x.name)),
        "You cannot assign permissions you do not hold.",
        403,
      );
    }
    if (id) {
      await db.query(
        "UPDATE users SET name=$1,email=$2,phone=$3,active=$4,updated_at=now() WHERE id=$5",
        [d.name, d.email, d.phone, d.active, id],
      );
      if (d.password)
        await db.query(
          "UPDATE users SET password_hash=$1,token_version=token_version+1 WHERE id=$2",
          [await bcrypt.hash(d.password, 12), id],
        );
    } else {
      assert(d.password, "A password is required.");
      id = (
        await db.query(
          "INSERT INTO users(name,email,phone,active,password_hash) VALUES($1,$2,$3,$4,$5) RETURNING id",
          [
            d.name,
            d.email,
            d.phone,
            d.active,
            await bcrypt.hash(d.password, 12),
          ],
        )
      ).rows[0].id;
    }
    if (d.role_ids !== undefined) {
      await db.query("DELETE FROM user_roles WHERE user_id=$1", [id]);
      for (const rid of new Set(d.role_ids))
        await db.query("INSERT INTO user_roles VALUES($1,$2)", [id, rid]);
    } else if (!target)
      await db.query(
        "INSERT INTO user_roles SELECT $1,id FROM roles WHERE name='CUSTOMER'",
        [id],
      );
    await audit(
      db,
      req.user,
      "save",
      "users",
      id,
      `Saved user ${d.email}${d.role_ids ? " and role assignments" : ""}`,
    );
  });
  res.json({ success: true });
}
r.post("/users", permit("users.create"), userSave);
r.put("/users/:id", permit("users.edit"), userSave);
r.delete("/users/:id", permit("users.delete"), async (req, res) => {
  await transaction(async (db) => {
    const u = (
      await db.query("SELECT * FROM users WHERE id=$1 FOR UPDATE", [
        req.params.id,
      ])
    ).rows[0];
    assert(
      u && !u.primary_admin && u.id !== req.user.id,
      "This account is protected.",
    );
    await assertAuthority(db, req.user, u.id, "user");
    const superRole = (
      await db.query(
        "SELECT 1 FROM user_roles ur JOIN roles r ON r.id=ur.role_id WHERE ur.user_id=$1 AND r.name='SUPER_ADMIN'",
        [u.id],
      )
    ).rowCount;
    assert(
      !superRole || req.user.roles.includes("SUPER_ADMIN"),
      "Only Super Admin may delete a Super Admin.",
      403,
    );
    assert(
      !(await db.query("SELECT 1 FROM orders WHERE user_id=$1", [u.id]))
        .rowCount,
      "This customer has orders. Disable the account instead.",
    );
    await db.query("DELETE FROM users WHERE id=$1", [u.id]);
    await audit(db, req.user, "delete", "users", u.id, "Deleted " + u.email);
  });
  res.json({ success: true });
});
export default r;
