import { query, transaction } from "../config/db.js";
import { can } from "../middleware/auth.js";
import { permissionFor } from "../config/resources.js";
import { saveResource, audit } from "../services/admin.js";

import { assert } from "../utils/errors.js";

export const list = async (req, res) => {
  assert(
    can(req.user, permissionFor(req.resource, "view")),
    "Access denied.",
    403,
  );
  const params = [];
  let where = "";
  if (req.query.search && req.resource.search.length) {
    params.push("%" + String(req.query.search).slice(0, 200) + "%");
    where =
      " WHERE " + req.resource.search.map((c) => `${c} ILIKE $1`).join(" OR ");
  }
  res.json(
    (
      await query(
        `SELECT * FROM ${req.resource.table}${where} ORDER BY id DESC LIMIT 1000`,
        params,
      )
    ).rows,
  );
};
export const detail = async (req, res) => {
  assert(
    can(req.user, permissionFor(req.resource, "view")),
    "Access denied.",
    403,
  );
  const d = (
    await query(`SELECT * FROM ${req.resource.table} WHERE id=$1`, [
      req.params.id,
    ])
  ).rows[0];
  assert(d, "Record not found.", 404);
  if (req.resourceKey === "products") {
    d.category_ids=(await query('SELECT category_id FROM product_categories WHERE product_id=$1',[d.id])).rows.map(x=>x.category_id);
    d.location_ids = (await query('SELECT location_id FROM product_locations WHERE product_id=$1',[d.id])).rows.map(x=>x.location_id);
    d.images = (
      await query(
        "SELECT path,alt FROM product_images WHERE product_id=$1 ORDER BY display_order",
        [d.id],
      )
    ).rows;
    d.attributes = (
      await query(
        "SELECT name,value,attribute_key,attribute_group,translations FROM product_attributes WHERE product_id=$1",
        [d.id],
      )
    ).rows;
    d.related_ids = (
      await query(
        "SELECT related_id FROM product_relations WHERE product_id=$1",
        [d.id],
      )
    ).rows.map((x) => x.related_id);
  }
  if (req.resourceKey === "coupons") {
    d.product_ids = (
      await query("SELECT product_id FROM coupon_products WHERE coupon_id=$1", [
        d.id,
      ])
    ).rows.map((x) => x.product_id);
    d.category_ids = (
      await query(
        "SELECT category_id FROM coupon_categories WHERE coupon_id=$1",
        [d.id],
      )
    ).rows.map((x) => x.category_id);
  }
  res.json(d);
};
export const create = async (req, res) => {
  assert(!req.resource.updateOnly, "Creation is not available.", 405);
  assert(
    can(req.user, permissionFor(req.resource, "create")),
    "Access denied.",
    403,
  );
  res
    .status(201)
    .json(
      await transaction((db) =>
        saveResource(
          db,
          req.resourceKey,
          req.resource,
          req.body,
          null,
          req.user,
        ),
      ),
    );
};
export const update = async (req, res) => {
  assert(
    can(req.user, permissionFor(req.resource, "edit")),
    "Access denied.",
    403,
  );
  res.json(
    await transaction((db) =>
      saveResource(
        db,
        req.resourceKey,
        req.resource,
        req.body,
        req.params.id,
        req.user,
      ),
    ),
  );
};
export const remove = async (req, res) => {
  assert(
    can(req.user, permissionFor(req.resource, "delete")),
    "Access denied.",
    403,
  );
  await transaction(async (db) => {
    if(req.resourceKey === "product_variations") assert(!(await db.query("SELECT 1 FROM order_items WHERE variation_id=$1 LIMIT 1",[req.params.id])).rowCount,"This size has order history. Deactivate it instead.");
    const result = await db.query(
      `DELETE FROM ${req.resource.table} WHERE id=$1 RETURNING *`,
      [req.params.id],
    );
    assert(result.rowCount, "Record not found.", 404);
    await audit(
      db,
      req.user,
      "delete",
      req.resourceKey,
      req.params.id,
      "Deleted " +
        (result.rows[0].name ||
          result.rows[0].title ||
          result.rows[0].code ||
          req.params.id),
    );
  });
  res.json({ success: true });
};
export const duplicate = async (req, res) => {
  assert(
    ["products", "pages"].includes(req.resourceKey),
    "Cannot duplicate this resource",
  );
  assert(
    can(req.user, permissionFor(req.resource, "create")) &&
      can(req.user, permissionFor(req.resource, "view")),
    "Access denied.",
    403,
  );
  const result = await transaction(async (db) => {
    const source = (
      await db.query(`SELECT * FROM ${req.resource.table} WHERE id=$1`, [
        req.params.id,
      ])
    ).rows[0];
    assert(source, "Record not found.", 404);
    const suffix = Date.now().toString(36);
    source.slug += "-copy-" + suffix;
    if (source.sku) source.sku += "-COPY-" + suffix;
    if (source.name) source.name += " (copy)";
    if (source.title) source.title += " (copy)";
    source.active = false;
    source.published = false;
    const created = await saveResource(
      db,
      req.resourceKey,
      req.resource,
      source,
      null,
      req.user,
    );
    if (req.resourceKey === "pages")
      await db.query(
        "INSERT INTO page_sections(page_id,section_type,title,subtitle,content,configuration,display_order,enabled) SELECT $1,section_type,title,subtitle,content,configuration,display_order,enabled FROM page_sections WHERE page_id=$2",
        [created.id, req.params.id],
      );
    else {
      await db.query(
        "INSERT INTO product_images(product_id,path,alt,display_order) SELECT $1,path,alt,display_order FROM product_images WHERE product_id=$2",
        [created.id, req.params.id],
      );
      await db.query(
        "INSERT INTO product_attributes(product_id,name,value) SELECT $1,name,value FROM product_attributes WHERE product_id=$2",
        [created.id, req.params.id],
      );
    }
    return created;
  });
  res.status(201).json(result);
};
