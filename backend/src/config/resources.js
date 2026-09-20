import { z } from "zod";
import { text, slug, seo, safeUrl } from "../validators/index.js";
const str = z.string().max(20000).default(""),
  bool = z.boolean().default(false),
  id = z.coerce.number().int().positive().nullable().default(null),
  num = z.coerce.number().min(0).default(0),
  order = z.coerce.number().int().default(0);
export const sectionTypes = [
  "hero",
  "image_slider",
  "text",
  "rich_text",
  "image_text",
  "category_grid",
  "product_grid",
  "featured_products",
  "popular_products",
  "sale_products",
  "testimonials",
  "cta_banner",
  "features",
  "contact_form",
  "gallery",
  "custom_html",
];
export const resources = {
  products: {
    table: "products",
    permission: "products",
    search: ["name", "sku", "slug"],
    schema: z.object({
      name: text,
      slug,
      sku: text,
      short_description: str,
      description: str,
      regular_price: num,
      sale_price: z.coerce.number().min(0).nullable().default(null),
      cost_price: num,
      category_id: id,
      subcategory_id: id,
      featured: bool,
      popular: bool,
      on_sale: bool,
      active: z.boolean().default(true),
      main_image: safeUrl.default(""),
      ...seo,
    }),
    extras: ["images", "attributes", "related_ids"],
  },
  categories: {
    table: "categories",
    permission: "categories",
    search: ["name", "slug"],
    schema: z.object({
      name: text,
      slug,
      description: str,
      image: safeUrl.default(""),
      parent_id: id,
      display_order: order,
      active: z.boolean().default(true),
      ...seo,
    }),
  },
  pages: {
    table: "pages",
    permission: "pages",
    search: ["title", "slug"],
    schema: z.object({ title: text, slug, published: bool, ...seo }),
  },
  sections: {
    table: "page_sections",
    permission: "sections.edit",
    search: ["title", "section_type"],
    schema: z.object({
      page_id: z.coerce.number().int().positive(),
      section_type: z.enum(sectionTypes),
      title: str,
      subtitle: str,
      content: str,
      configuration: z.record(z.string(), z.unknown()).default({}),
      display_order: order,
      enabled: z.boolean().default(true),
    }),
  },
  navigation: {
    table: "menu_items",
    permission: "navigation.edit",
    search: ["label"],
    schema: z.object({
      menu_id: z.coerce.number().int().positive(),
      parent_id: id,
      label: text,
      url: safeUrl.default(""),
      category_id: id,
      page_id: id,
      display_order: order,
    }),
  },
  menus: {
    table: "menus",
    permission: "navigation.edit",
    search: ["name", "location"],
    schema: z.object({ name: text, location: slug }),
  },
  testimonials: {
    table: "testimonials",
    permission: "testimonials.manage",
    search: ["name", "body"],
    schema: z.object({
      name: text,
      body: text,
      image: safeUrl.default(""),
      rating: z.coerce.number().int().min(1).max(5).default(5),
      display_order: order,
      active: z.boolean().default(true),
    }),
  },
  coupons: {
    table: "coupons",
    permission: "coupons.manage",
    search: ["code", "description"],
    schema: z.object({
      code: z
        .string()
        .trim()
        .min(1)
        .max(80)
        .transform((s) => s.toUpperCase()),
      description: str,
      discount_type: z.enum(["percentage", "fixed"]),
      discount_amount: z.coerce.number().positive(),
      minimum_order: num,
      maximum_discount: z.coerce.number().min(0).nullable().default(null),
      start_date: z.iso.datetime({ offset: true }).nullable().default(null),
      expiration_date: z.iso
        .datetime({ offset: true })
        .nullable()
        .default(null),
      usage_limit: z.coerce.number().int().positive().nullable().default(null),
      usage_per_user: z.coerce.number().int().positive().default(1),
      active: z.boolean().default(true),
    }),
    extras: ["product_ids", "category_ids"],
  },
  reviews: {
    table: "reviews",
    permission: "reviews.manage",
    search: ["title", "body"],
    updateOnly: true,
    schema: z.object({ status: z.enum(["pending", "approved", "hidden"]) }),
  },
  messages: {
    table: "contact_messages",
    permission: "messages.manage",
    search: ["name", "email", "message"],
    updateOnly: true,
    schema: z.object({ is_read: z.boolean() }),
  },
};
const translations = z.record(z.string().regex(/^[a-z]{2}(?:-[A-Z]{2})?$/), z.record(z.string(), z.string().max(20000))).default({});
const active = z.boolean().default(true);
const integer = z.coerce.number().int().nonnegative();
const date = z.iso.datetime({ offset: true }).nullable().default(null);
const ids = z.array(z.number().int().positive()).max(100).default([]);
function v2(table, permission, search, shape, extra = {}) {
  resources[table] = { table, permission, search, schema: z.object(shape), ...extra };
}
v2('faqs','faqs.manage',['question','answer','group_name'],{product_id:id,question:text,answer:str,group_name:text.default('Ordering'),display_order:order,active,translations});
v2('announcements','announcements.manage',['title'],{title:text,url:safeUrl.default(''),link_label:str,starts_at:date,ends_at:date,active,dismissible:z.boolean().default(true),display_order:order,translations});
v2('delivery_rules','delivery.manage',['name','city'],{name:text,city:text.default('*'),processing_days:integer.max(30).default(1),minimum_days:integer.max(60).default(1),maximum_days:integer.max(90).default(3),weekend_days:z.array(integer.max(6)).max(6).default([5]),cutoff_hour:integer.max(23).nullable().default(null),active,translations});
v2('climate_profiles','calendar.manage',['name','city'],{name:text,city:text,latitude:z.coerce.number().min(-90).max(90).nullable().default(null),longitude:z.coerce.number().min(-180).max(180).nullable().default(null),description:str,active,translations});
v2('suitable_locations','products.edit',['name','slug'],{name:text,slug,icon:str,active,translations});
v2('calendar_rules','calendar.manage',['activity','notes'],{product_id:z.coerce.number().int().positive(),climate_profile_id:id,activity:z.enum(['planting','flowering','pruning','repotting']),months:z.array(integer.min(1).max(12)).max(12),notes:str,active,translations});
v2('return_policies','returns.manage',['title','content'],{title:text,content:str,window_days:integer.max(365).default(14),conditions:str,excluded_product_ids:ids,active,translations});
v2('guarantee_policies','guarantees.manage',['title','conditions'],{title:text,duration_days:integer.min(1).max(730).default(90),conditions:text,exclusions:str,evidence_required:z.boolean().default(true),resolution_type:z.enum(['replacement','refund','store_credit']).default('replacement'),product_ids:ids,category_ids:ids,active,translations});
v2('footer_columns','footer.manage',['title'],{title:text,links:z.array(z.object({label:text,url:safeUrl,translations})).max(30).default([]),display_order:order,active,translations});
v2('bundles','bundles.manage',['name'],{name:text,base_product_id:z.coerce.number().int().positive(),discount_percent:z.coerce.number().min(0).max(100).default(5),starts_at:date,ends_at:date,active,translations});
v2('bundle_items','bundles.manage',[],{bundle_id:z.coerce.number().int().positive(),product_id:z.coerce.number().int().positive(),variation_id:id,quantity:integer.min(1).max(20).default(1),optional:z.boolean().default(true),display_order:order});
for (const key of ['products','categories','pages','sections','navigation','testimonials']) resources[key].schema = resources[key].schema.extend({translations});
resources.products.schema = resources.products.schema.extend({story:z.record(z.string(),z.string().max(10000)).default({})});
resources.products.extras.push('location_ids','category_ids');
export function permissionFor(resource, action) {
  return resource.permission.includes(".")
    ? resource.permission
    : `${resource.permission}.${action}`;
}

v2('product_variations','products.edit',['name','sku'],{product_id:z.coerce.number().int().positive(),name:text,sku:text,regular_price:num,sale_price:z.coerce.number().nonnegative().nullable().default(null),stock_quantity:integer.default(0),low_stock_threshold:integer.default(5),image:safeUrl.default(''),height:str,pot_size:str,active,display_order:order,translations});
