import { z } from "zod";
export const text = z.string().trim().min(1).max(500);
export const email = z.email().toLowerCase();
export const password = z
  .string()
  .min(10)
  .max(72)
  .refine(
    (v) => Buffer.byteLength(v, "utf8") <= 72,
    "Password must fit within 72 UTF-8 bytes.",
  );
export const item = z.object({
  product_id: z.coerce.number().int().positive(),
  variation_id: z.coerce.number().int().positive().nullable().default(null),
  bundle_id: z.coerce.number().int().positive().nullable().default(null),
  quantity: z.coerce.number().int().min(1).max(999),
});
export const cart = z.object({ items: z.array(item).max(100) });
export const address = z.object({
  first_name: text,
  last_name: text,
  phone: text,
  address: text,
  city: text,
  additional_address: z.string().max(1000).default(""),
  country: z.literal("Jordan").default("Jordan"),
});
export const checkout = cart.extend({
  email,
  shipping_address: address,
  notes: z.string().max(2000).default(""),
  coupon: z.string().max(80).optional(),
  payment_method: z.literal("cod"),
  idempotency_key: z.uuid(),
});
export const slug = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  .max(150);
export const seo = {
  seo_title: z.string().max(200).default(""),
  meta_description: z.string().max(500).default(""),
  canonical_url: z.union([z.url(), z.literal("")]).default(""),
  noindex: z.boolean().default(false),
};
export const safeUrl = z
  .string()
  .max(2000)
  .refine(
    (v) => !v || /^\/(?!\/)/.test(v) || /^https?:\/\//.test(v),
    "Use a relative path or an http(s) URL",
  );
