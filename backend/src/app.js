import "dotenv/config";
import express from "express";
import compression from "compression";
import cors from "cors";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import auth from "./routes/auth.js";
import v2 from "./routes/v2.js";
import { localized } from "./services/v2.js";
import store from "./routes/store.js";
import admin from "./routes/admin.js";
import media, { uploadDir } from "./routes/media.js";
import { optionalAuth } from "./middleware/auth.js";
import { errorHandler } from "./utils/errors.js";
import { query } from "./config/db.js";
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32)
  throw Error("JWT_SECRET must contain at least 32 characters.");
export const app = express();
app.disable("x-powered-by");
app.use(compression());
const proxyHops = Number(process.env.TRUST_PROXY_HOPS || 0);
if (Number.isInteger(proxyHops) && proxyHops > 0)
  app.set("trust proxy", proxyHops);
app.use(helmet({ crossOriginResourcePolicy: { policy: "same-site" } }));
app.use(cors({ origin: process.env.FRONTEND_URL || "http://localhost:5173" }));
app.use(express.json({ limit: "1mb" }));
app.use(
  "/uploads",
  express.static(uploadDir, { dotfiles: "deny", maxAge: "1d" }),
);
app.get("/api/health", async (req, res) => {
  await query("SELECT 1");
  res.json({ status: "ok" });
});
app.use(
  "/api",
  rateLimit({
    windowMs: 60000,
    limit: 500,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: { error: "Too many requests." },
  }),
  optionalAuth,
);
app.use("/api/auth", auth);
app.use("/api/admin/media", media);
app.use("/api/admin", admin);
app.use('/api', (req,res,next)=>{
  if(!req.path.startsWith('/admin') && !req.path.startsWith('/auth')) { const send=res.json.bind(res);res.json=value=>send(localized(value,req.headers['accept-language']?.startsWith('ar')?'ar':'en')); }
  next();
});
app.use('/api',v2);
app.use("/api", store);
const xml = (s) =>
  String(s).replace(
    /[<>&"']/g,
    (c) =>
      ({
        "<": "&lt;",
        ">": "&gt;",
        "&": "&amp;",
        '"': "&quot;",
        "'": "&apos;",
      })[c],
  );
app.get("/sitemap.xml", async (req, res) => {
  const base = process.env.PUBLIC_URL || process.env.FRONTEND_URL;
  const urls = ["/shop", "/contact"];
  for (const p of (
    await query("SELECT slug FROM pages WHERE published=true AND noindex=false")
  ).rows)
    urls.push(p.slug === "home" ? "/" : "/" + p.slug);
  for (const p of (
    await query("SELECT slug FROM products WHERE active=true AND noindex=false")
  ).rows)
    urls.push("/product/" + p.slug);
  for (const c of (
    await query(
      "SELECT slug FROM categories WHERE active=true AND noindex=false",
    )
  ).rows)
    urls.push("/shop?category=" + c.slug);
  res
    .type("xml")
    .send(
      '<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' +
        [...new Set(urls)]
          .map((u) => "<url><loc>" + xml(base + u) + "</loc></url>")
          .join("") +
        "</urlset>",
    );
});
app.get("/robots.txt", (req, res) =>
  res
    .type("text")
    .send(
      `User-agent: *\nDisallow: /admin\nDisallow: /account\nDisallow: /api\nSitemap: ${process.env.PUBLIC_URL || process.env.FRONTEND_URL}/sitemap.xml\n`,
    ),
);
app.use((req, res) => res.status(404).json({ error: "Not found." }));
app.use(errorHandler);
