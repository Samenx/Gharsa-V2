import { Router } from "express";
import multer from "multer";
import sharp from "sharp";
import { randomUUID } from "node:crypto";
import { unlink } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { query, transaction } from "../config/db.js";
import { permit } from "../middleware/auth.js";
import { assert } from "../utils/errors.js";
import { audit } from "../services/admin.js";
export const uploadDir = fileURLToPath(
  new URL("../../uploads/", import.meta.url),
);
const r = Router();
r.use(permit("media.manage"));
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) =>
    cb(
      null,
      ["image/jpeg", "image/png", "image/webp", "image/avif"].includes(
        file.mimetype,
      ),
    ),
});
r.get("/", async (req, res) =>
  res.json((await query("SELECT * FROM media ORDER BY id DESC")).rows),
);
r.post("/", upload.single("image"), async (req, res) => {
  assert(req.file, "Upload a JPG, PNG, WebP, or AVIF image under 5 MB.");
  const filename = randomUUID() + ".webp";
  let image;
  try {
    image = await sharp(req.file.buffer, { limitInputPixels: 40000000 })
      .rotate()
      .resize({
        width: 2400,
        height: 2400,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: 85 })
      .toBuffer();
  } catch {
    assert(false, "The uploaded file is not a valid image.");
  }
  await sharp(image).toFile(path.join(uploadDir, filename));
  try {
    const m = await transaction(async (db) => {
      const m = (
        await db.query(
          "INSERT INTO media(filename,path,title,alt,mime_type,size) VALUES($1,$2,$3,$4,$5,$6) RETURNING *",
          [
            filename,
            "/uploads/" + filename,
            req.file.originalname.slice(0, 200),
            String(req.body.alt || "").slice(0, 500),
            "image/webp",
            image.length,
          ],
        )
      ).rows[0];
      await audit(db, req.user, "upload", "media", m.id, "Uploaded " + m.title);
      return m;
    });
    res.status(201).json(m);
  } catch (e) {
    await unlink(path.join(uploadDir, filename));
    throw e;
  }
});
r.put("/:id", async (req, res) => {
  const d = z
    .object({ title: z.string().max(200), alt: z.string().max(500) })
    .parse(req.body);
  res.json(
    await transaction(async (db) => {
      const m = (
        await db.query(
          "UPDATE media SET title=$1,alt=$2 WHERE id=$3 RETURNING *",
          [d.title, d.alt, req.params.id],
        )
      ).rows[0];
      assert(m, "Media not found.", 404);
      await audit(
        db,
        req.user,
        "update",
        "media",
        m.id,
        "Updated media metadata",
      );
      return m;
    }),
  );
});
r.delete("/:id", async (req, res) => {
  const m = await transaction(async (db) => {
    const m = (
      await db.query("SELECT * FROM media WHERE id=$1 FOR UPDATE", [
        req.params.id,
      ])
    ).rows[0];
    assert(m, "Media not found.", 404);
    const used = (
      await db.query(
        `SELECT 1 FROM products WHERE main_image=$1 UNION ALL SELECT 1 FROM product_images WHERE path=$1 UNION ALL SELECT 1 FROM categories WHERE image=$1 UNION ALL SELECT 1 FROM testimonials WHERE image=$1 UNION ALL SELECT 1 FROM page_sections WHERE configuration::text LIKE $2 OR content LIKE $2 UNION ALL SELECT 1 FROM site_settings WHERE value::text LIKE $2 UNION ALL SELECT 1 FROM order_items WHERE image=$1 UNION ALL SELECT 1 FROM product_variations WHERE image=$1 LIMIT 1`,
        [m.path, "%" + m.path + "%"],
      )
    ).rowCount;
    assert(
      !used,
      "This image is in use. Remove its references before deleting it.",
    );
    await db.query("DELETE FROM media WHERE id=$1", [m.id]);
    await audit(db, req.user, "delete", "media", m.id, "Deleted " + m.title);
    return m;
  });
  await unlink(path.join(uploadDir, path.basename(m.filename))).catch(() => {});
  res.json({ success: true });
});
export default r;
