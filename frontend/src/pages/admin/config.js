const field = (name, type = "text", options = {}) => ({
  name,
  label: name.replaceAll("_", " ").replace(/^./, (s) => s.toUpperCase()),
  type,
  ...options,
});
const seo = [
  field("seo_title"),
  field("meta_description", "textarea"),
  field("canonical_url", "url"),
  field("noindex", "checkbox"),
];
const resource = (title, permission, columns, fields, extra = {}) => ({
  title,
  permission,
  columns,
  fields,
  ...extra,
});
export const config = {
  products: resource(
    "Products",
    "products",
    ["name", "sku", "regular_price", "stock_quantity", "active"],
    [
      field("name", "text", { required: true }),
      field("slug", "text", { required: true }),
      field("sku", "text", { required: true }),
      field("short_description", "textarea"),
      field("description", "textarea"),
      field("regular_price", "number", { required: true }),
      field("sale_price", "number", { nullable: true }),
      field("cost_price", "number"),
      field("category_id", "reference", {
        resource: "categories",
        nullable: true,
      }),
      field("subcategory_id", "reference", {
        resource: "categories",
        nullable: true,
      }),
      field("main_image", "image"),
      field("images", "gallery", {
        initial: [],
        hint: "Add images from the media library and describe them for accessibility.",
      }),
      field("attributes", "attributes", {
        initial: [],
        hint: "Add plant care, pot size, or any other product specifications.",
      }),
      field("related_ids", "multireference", {
        resource: "products",
        initial: [],
        hint: "Select related products.",
      }),
      field("featured", "checkbox"),
      field("popular", "checkbox"),
      field("on_sale", "checkbox"),
      field("active", "checkbox", { initial: true }),
      ...seo,
    ],
    { duplicate: true },
  ),
  categories: resource(
    "Categories",
    "categories",
    ["name", "slug", "parent_id", "display_order", "active"],
    [
      field("name", "text", { required: true }),
      field("slug", "text", { required: true }),
      field("description", "textarea"),
      field("image", "image"),
      field("parent_id", "reference", {
        resource: "categories",
        nullable: true,
      }),
      field("display_order", "number"),
      field("active", "checkbox", { initial: true }),
      ...seo,
    ],
  ),
  pages: resource(
    "Pages",
    "pages",
    ["title", "slug", "published"],
    [
      field("title", "text", { required: true }),
      field("slug", "text", { required: true }),
      field("published", "checkbox"),
      ...seo,
    ],
    { duplicate: true },
  ),
  sections: resource(
    "Sections",
    "sections.edit",
    ["title", "section_type", "page_id", "display_order", "enabled"],
    [
      field("page_id", "reference", { resource: "pages", required: true }),
      field("section_type", "select", {
        options: [
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
        ],
      }),
      field("title"),
      field("subtitle"),
      field("content", "textarea", {
        hint: "HTML is sanitized by the server. Scripts and unsafe embeds are removed.",
      }),
      field("configuration", "json", {
        initial: {},
        hint: "Use the page builder for guided section settings.",
      }),
      field("display_order", "number"),
      field("enabled", "checkbox", { initial: true }),
    ],
  ),
  navigation: resource(
    "Navigation",
    "navigation.edit",
    ["label", "menu_id", "url", "parent_id", "display_order"],
    [
      field("menu_id", "reference", { resource: "menus", required: true }),
      field("label", "text", { required: true }),
      field("url", "text"),
      field("category_id", "reference", {
        resource: "categories",
        nullable: true,
      }),
      field("page_id", "reference", { resource: "pages", nullable: true }),
      field("parent_id", "reference", {
        resource: "navigation",
        nullable: true,
      }),
      field("display_order", "number"),
    ],
  ),
  menus: resource(
    "Menus",
    "navigation.edit",
    ["name", "location"],
    [
      field("name", "text", { required: true }),
      field("location", "text", { required: true }),
    ],
  ),
  testimonials: resource(
    "Testimonials",
    "testimonials.manage",
    ["name", "rating", "active", "display_order"],
    [
      field("name", "text", { required: true }),
      field("body", "textarea", { required: true }),
      field("image", "image"),
      field("rating", "number", { initial: 5, min: 1, max: 5 }),
      field("display_order", "number"),
      field("active", "checkbox", { initial: true }),
    ],
  ),
  coupons: resource(
    "Coupons",
    "coupons.manage",
    ["code", "discount_type", "discount_amount", "active"],
    [
      field("code", "text", { required: true }),
      field("description", "textarea"),
      field("discount_type", "select", { options: ["percentage", "fixed"] }),
      field("discount_amount", "number", { required: true }),
      field("minimum_order", "number"),
      field("maximum_discount", "number", { nullable: true }),
      field("start_date", "datetime-local", { nullable: true }),
      field("expiration_date", "datetime-local", { nullable: true }),
      field("usage_limit", "number", { nullable: true }),
      field("usage_per_user", "number", { initial: 1 }),
      field("product_ids", "multireference", {
        resource: "products",
        initial: [],
        hint: "Choose eligible products; leave both scopes empty for the entire store.",
      }),
      field("category_ids", "multireference", {
        resource: "categories",
        initial: [],
        hint: "Choose eligible categories, including their descendants.",
      }),
      field("active", "checkbox", { initial: true }),
    ],
  ),
  reviews: resource(
    "Reviews",
    "reviews.manage",
    ["title", "body", "rating", "status"],
    [field("status", "select", { options: ["pending", "approved", "hidden"] })],
    { updateOnly: true },
  ),
  messages: resource(
    "Contact messages",
    "messages.manage",
    ["name", "email", "message", "is_read"],
    [field("is_read", "checkbox")],
    { updateOnly: true },
  ),
  users: resource(
    "Users",
    "users",
    ["name", "email", "phone", "active"],
    [
      field("name", "text", { required: true }),
      field("email", "email", { required: true }),
      field("phone"),
      field("active", "checkbox", { initial: true }),
      field("password", "password", {
        hint: "Minimum 10 characters. Leave empty to keep the current password.",
      }),
      field("role_ids", "multireference", {
        resource: "roles",
        initial: [],
        permission: "roles.edit",
      }),
    ],
  ),
  roles: resource(
    "Roles & permissions",
    "roles",
    ["name", "description", "protected"],
    [
      field("name", "text", { required: true }),
      field("description", "textarea"),
      field("permission_ids", "multireference", {
        resource: "permissions",
        initial: [],
      }),
    ],
  ),
};
export const permission = (c, action) =>
  c.permission.includes(".") ? c.permission : c.permission + "." + action;
export const settingsFields = [
  field("store_name"),
  field("translations", "json", {
    initial: {},
    hint: 'Store translations, e.g. {"ar":{"store_name":"غرسة","footer_text":"نباتات لحياة أجمل"}}',
  }),
  field("logo", "image"),
  field("footer_logo", "image"),
  field("favicon", "image"),
  field("phone"),
  field("email", "email"),
  field("address", "textarea"),
  field("currency", "select", { options: ["JOD"] }),
  field("free_shipping_threshold", "number"),
  field("shipping_cost", "number"),
  field("tax_rate", "number"),
  field("products_per_page", "number"),
  field("store_notice"),
  field("footer_text", "textarea"),
  field("copyright"),
  field("footer_contact_title", "text", { initial: "Let’s connect" }),
  field("facebook_url", "url", {
    label: "Facebook profile URL",
    hint: "Your store’s Facebook page. Leave empty to show the icon without a link.",
  }),
  field("instagram_url", "url", {
    label: "Instagram profile URL",
    hint: "Your store’s Instagram profile. Leave empty to show the icon without a link.",
  }),
  field("footer_newsletter_image", "image", {
    label: "Newsletter background image",
    initial: "/images/footer-bg.webp",
  }),
  field("footer_newsletter_title", "text", {
    label: "Newsletter heading",
  }),
  field("footer_newsletter_text", "textarea", {
    label: "Newsletter description",
  }),
  field("social_links", "json", { initial: [], label: "Other social links" }),
  field("cod_enabled", "checkbox"),
  field("welcome_discount_enabled", "checkbox", {
    hint: "First-order discount for signed-in newsletter subscribers. Cannot combine with coupons or bundles.",
  }),
  field("welcome_discount_percent", "number", { initial: 10, min: 0, max: 50 }),
  field("welcome_discount_minimum", "number", { initial: 0, min: 0 }),
];
export const sectionDefaults = {
  hero: {
    animation_style: "fade",
    transition_ms: 900,
    slide_interval_ms: 6000,
    slides: [
      {
        image: "",
        mobile_image: "",
        secondary_url: "/faq",
        secondary_button: "Find your plant",
        alt: "",
        url: "/shop",
        title: "",
        text: "",
        button: "Shop Now",
      },
    ],
  },
  image_slider: {
    animation_style: "fade",
    transition_ms: 900,
    slide_interval_ms: 6000,
    slides: [{ image: "", alt: "", url: "/shop" }],
  },
  image_text: { image: "", alt: "", reverse: false, button: "", url: "/shop" },
  category_grid: { category_ids: [] },
  product_grid: {
    source: "popular",
    limit: 4,
    columns: 4,
    showPrice: true,
    showRating: true,
    showAddToCart: true,
    product_ids: [],
  },
  featured_products: { limit: 4, columns: 4 },
  popular_products: { limit: 4, columns: 4 },
  sale_products: { limit: 4, columns: 4 },
  cta_banner: { image: "", url: "/shop", button: "Shop Now" },
  features: { items: [{ title: "", text: "" }] },
  gallery: { images: [{ image: "", alt: "" }] },
};

const trans = field("translations", "json", {
  initial: {},
  hint: 'Language fields, for example {"ar":{"title":"العنوان"}}. English uses the main fields.',
});
const activeField = field("active", "checkbox", { initial: true });
const ref = (name, resource, nullable = false) =>
  field(name, "reference", { resource, nullable, required: !nullable });
const orderField = field("display_order", "number");
const json = (name, initial = []) => field(name, "json", { initial });
const dates = [
  field("starts_at", "datetime-local", { nullable: true }),
  field("ends_at", "datetime-local", { nullable: true }),
];
Object.assign(config, {
  faqs: resource(
    "FAQs",
    "faqs.manage",
    ["question", "group_name", "product_id", "active"],
    [
      ref("product_id", "products", true),
      field("question", "text", { required: true }),
      field("answer", "textarea", { required: true }),
      field("group_name", "select", {
        options: [
          "Ordering",
          "Payment",
          "Delivery",
          "Returns",
          "Plant care",
          "Accounts",
          "Discounts",
          "Guarantee",
        ],
      }),
      orderField,
      activeField,
      trans,
    ],
  ),
  announcements: resource(
    "Announcements",
    "announcements.manage",
    ["title", "starts_at", "ends_at", "active"],
    [
      field("title", "text", { required: true }),
      field("url"),
      field("link_label"),
      ...dates,
      field("dismissible", "checkbox", { initial: true }),
      orderField,
      activeField,
      trans,
    ],
  ),
  delivery_rules: resource(
    "Delivery rules",
    "delivery.manage",
    ["name", "city", "processing_days", "minimum_days", "maximum_days"],
    [
      field("name", "text", { required: true }),
      field("city", "text", {
        initial: "*",
        hint: "Use * for the default rule, or enter a city name.",
      }),
      field("processing_days", "number", { initial: 1 }),
      field("minimum_days", "number", { initial: 1 }),
      field("maximum_days", "number", { initial: 3 }),
      json("weekend_days", [5]),
      field("cutoff_hour", "number", { nullable: true, min: 0, max: 23 }),
      activeField,
      trans,
    ],
  ),
  climate_profiles: resource(
    "Climate profiles",
    "calendar.manage",
    ["name", "city", "active"],
    [
      field("name", "text", { required: true }),
      field("city", "text", { required: true }),
      field("latitude", "number", { nullable: true }),
      field("longitude", "number", { nullable: true }),
      field("description", "textarea"),
      activeField,
      trans,
    ],
  ),
  suitable_locations: resource(
    "Suitable locations",
    "products.edit",
    ["name", "slug", "active"],
    [
      field("name", "text", { required: true }),
      field("slug", "text", { required: true }),
      field("icon"),
      activeField,
      trans,
    ],
  ),
  calendar_rules: resource(
    "Plant calendar",
    "calendar.manage",
    ["product_id", "activity", "climate_profile_id", "active"],
    [
      ref("product_id", "products"),
      ref("climate_profile_id", "climate_profiles", true),
      field("activity", "select", {
        options: ["planting", "flowering", "pruning", "repotting"],
      }),
      json("months"),
      field("notes", "textarea"),
      activeField,
      trans,
    ],
  ),
  return_policies: resource(
    "Return policies",
    "returns.manage",
    ["title", "window_days", "active"],
    [
      field("title", "text", { required: true }),
      field("content", "textarea"),
      field("window_days", "number", { initial: 14 }),
      field("conditions", "textarea"),
      field("excluded_product_ids", "multireference", {
        resource: "products",
        initial: [],
      }),
      activeField,
      trans,
    ],
  ),
  guarantee_policies: resource(
    "Plant guarantees",
    "guarantees.manage",
    ["title", "duration_days", "active"],
    [
      field("title", "text", { required: true }),
      field("duration_days", "number", { initial: 90 }),
      field("conditions", "textarea", { required: true }),
      field("exclusions", "textarea"),
      field("evidence_required", "checkbox", { initial: true }),
      field("resolution_type", "select", {
        options: ["replacement", "refund", "store_credit"],
      }),
      field("product_ids", "multireference", {
        resource: "products",
        initial: [],
      }),
      field("category_ids", "multireference", {
        resource: "categories",
        initial: [],
      }),
      activeField,
      trans,
    ],
  ),
  footer_columns: resource(
    "Footer columns",
    "footer.manage",
    ["title", "display_order", "active"],
    [
      field("title", "text", { required: true }),
      field("links", "json", {
        initial: [],
        hint: 'Array of {"label":"FAQ","url":"/faq"} links.',
      }),
      orderField,
      activeField,
      trans,
    ],
  ),
  bundles: resource(
    "Bundles",
    "bundles.manage",
    ["name", "base_product_id", "discount_percent", "active"],
    [
      field("name", "text", { required: true }),
      ref("base_product_id", "products"),
      field("discount_percent", "number", { initial: 5, min: 0, max: 100 }),
      ...dates,
      activeField,
      trans,
    ],
  ),
  bundle_items: resource(
    "Bundle items",
    "bundles.manage",
    ["bundle_id", "product_id", "quantity", "optional"],
    [
      ref("bundle_id", "bundles"),
      ref("product_id", "products"),
      field("variation_id", "number", { nullable: true }),
      field("quantity", "number", { initial: 1, min: 1, max: 20 }),
      field("optional", "checkbox", { initial: true }),
      orderField,
    ],
  ),
});
for (const key of [
  "products",
  "categories",
  "pages",
  "sections",
  "navigation",
  "testimonials",
])
  config[key].fields.push(trans);
config.products.fields.push(
  field("location_ids", "multireference", {
    resource: "suitable_locations",
    initial: [],
  }),
  field("story", "json", {
    initial: {},
    hint: "Optional sections: introduction, why_love, best_place, care, planting. Each value is text.",
  }),
);

config.product_variations = resource(
  "Product sizes & variations",
  "products.edit",
  ["name", "sku", "product_id", "regular_price", "stock_quantity", "active"],
  [
    ref("product_id", "products"),
    field("name", "text", { required: true }),
    field("sku", "text", { required: true }),
    field("regular_price", "number", { required: true }),
    field("sale_price", "number", { nullable: true }),
    field("stock_quantity", "number", { min: 0, initial: 0 }),
    field("low_stock_threshold", "number", { initial: 5, min: 0 }),
    field("image", "image"),
    field("height"),
    field("pot_size"),
    orderField,
    activeField,
    trans,
  ],
);

config.products.fields.push(
  field("category_ids", "multireference", {
    resource: "categories",
    initial: [],
    label: "Additional categories",
    hint: "Add office or other collections without changing the main category.",
  }),
);
