import "dotenv/config";
import bcrypt from "bcryptjs";
import { readFile, readdir, stat } from "node:fs/promises";
import { pool, transaction } from "../../src/config/db.js";
import sanitizeHtml from "sanitize-html";
const slug = (s) =>
  s
    .toLowerCase()
    .replace(/&/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
const plain = (s) =>
  sanitizeHtml(s || "", { allowedTags: [], allowedAttributes: {} })
    .replace(/&amp;/g, "&")
    .replace(/&#8217;/g, "'")
    .replace(/&nbsp;/g, " ")
    .trim();
if (
  !process.env.SUPER_ADMIN_EMAIL ||
  !process.env.SUPER_ADMIN_PASSWORD ||
  process.env.SUPER_ADMIN_PASSWORD.length < 12
)
  throw Error(
    "Set SUPER_ADMIN_EMAIL and SUPER_ADMIN_PASSWORD (at least 12 characters) before seeding.",
  );
const catalog = JSON.parse(
  await readFile(new URL("./catalog.json", import.meta.url), "utf8"),
);
await transaction(async (db) => {
  const resources = ["products", "categories", "users", "roles", "pages"];
  const permissions = resources
    .flatMap((r) =>
      ["view", "create", "edit", "delete"].map((a) => r + "." + a),
    )
    .concat([
      "dashboard.view",
      "inventory.view",
      "inventory.edit",
      "orders.view",
      "orders.edit",
      "orders.refund",
      "sections.edit",
      "navigation.edit",
      "coupons.manage",
      "reviews.manage",
      "settings.manage",
      "media.manage",
      "seo.manage",
      "testimonials.manage",
      "messages.manage",
      "audit.view",
    ]);
  for (const p of permissions)
    await db.query(
      "INSERT INTO permissions(name) VALUES($1) ON CONFLICT DO NOTHING",
      [p],
    );
  const roleSets = {
    SUPER_ADMIN: permissions,
    ADMIN: permissions,
    STORE_MANAGER: permissions.filter(
      (p) =>
        !p.startsWith("roles.") &&
        !p.startsWith("users.") &&
        !p.startsWith("settings.") &&
        !p.startsWith("audit."),
    ),
    CONTENT_MANAGER: permissions.filter(
      (p) =>
        p.startsWith("pages.") ||
        [
          "sections.edit",
          "navigation.edit",
          "media.manage",
          "seo.manage",
          "testimonials.manage",
          "categories.view",
        ].includes(p),
    ),
    CUSTOMER: [],
  };
  for (const [name, perms] of Object.entries(roleSets)) {
    const {
      rows: [r],
    } = await db.query(
      "INSERT INTO roles(name,description,protected) VALUES($1,$2,true) ON CONFLICT(name) DO UPDATE SET name=EXCLUDED.name RETURNING id",
      [name, name.replaceAll("_", " ")],
    );
    for (const p of perms)
      await db.query(
        "INSERT INTO role_permissions SELECT $1,id FROM permissions WHERE name=$2 ON CONFLICT DO NOTHING",
        [r.id, p],
      );
  }
  const found = (
    await db.query("SELECT id FROM users WHERE primary_admin=true")
  ).rows[0];
  if (!found) {
    const {
      rows: [u],
    } = await db.query(
      "INSERT INTO users(name,email,password_hash,primary_admin) VALUES($1,$2,$3,true) RETURNING id",
      [
        process.env.SUPER_ADMIN_NAME || "GHARSA Administrator",
        process.env.SUPER_ADMIN_EMAIL.toLowerCase(),
        await bcrypt.hash(process.env.SUPER_ADMIN_PASSWORD, 12),
      ],
    );
    await db.query(
      "INSERT INTO user_roles SELECT $1,id FROM roles WHERE name='SUPER_ADMIN'",
      [u.id],
    );
  }
  const imageRoot = new URL(
    "../../../frontend/public/images/",
    import.meta.url,
  );
  for (const filename of await readdir(imageRoot)) {
    if (!/\.(webp|png|jpg|jpeg)$/i.test(filename)) continue;
    const info = await stat(new URL(filename, imageRoot));
    const path = "/images/" + filename;
    const label = filename.replace(/\.[^.]+$/, "").replaceAll("-", " ");
    await db.query(
      "INSERT INTO media(filename,path,alt,title,mime_type,size) VALUES($1,$2,$3,$3,$4,$5) ON CONFLICT(path) DO NOTHING",
      [
        filename,
        path,
        label,
        filename.endsWith(".webp")
          ? "image/webp"
          : filename.endsWith(".png")
            ? "image/png"
            : "image/jpeg",
        info.size,
      ],
    );
  }
  if ((await db.query("SELECT 1 FROM pages LIMIT 1")).rowCount) {
    console.log(
      "Existing store content preserved. Roles and permissions verified.",
    );
    return;
  }
  const hierarchy = {
    "Climbing & Hanging Plants": [
      "Climbing Plants",
      "Hanging Baskets",
      "Hanging Plants",
      "Indoor Vines",
      "Trailing Plants",
      "Outdoor Climbers",
      "Vining Plants",
    ],
    "Flowering Plants": [
      "Geraniums",
      "Jasmine",
      "Orchids",
      "Roses",
      "Seasonal Flowers",
    ],
    "Indoor Plants": [
      "Easy-Care Indoor Plants",
      "Indoor Palms",
      "Low-Light Plants",
      "Tropical Foliage",
    ],
    "Outdoor Plants": [
      "Flowering Outdoor Plants",
      "Full-Sun Plants",
      "Garden Plants",
      "Climbers & Vines",
      "Ground Cover Plants",
      "Shade Plants",
    ],
    Trees: [
      "Citrus Trees",
      "Evergreen Trees",
      "Fruit Trees",
      "Olive Trees",
      "Ornamental Trees",
      "Palm Trees",
    ],
    Sales: [],
  };
  const categoryImages = {
    "Indoor Plants": "/images/reference-5.webp",
    "Outdoor Plants": "/images/reference-6.webp",
    "Climbing & Hanging Plants": "/images/reference-7.webp",
    Trees: "/images/reference-8.webp",
    "Flowering Plants": "/images/reference-10.webp",
    Sales: "/images/reference-11.webp",
  };
  const categoryIds = {};
  for (const [i, [name, children]] of Object.entries(hierarchy).entries()) {
    const c = (
      await db.query(
        "INSERT INTO categories(name,slug,image,display_order,description) VALUES($1,$2,$3,$4,$5) RETURNING id",
        [
          name,
          slug(name),
          categoryImages[name],
          i,
          `Discover our collection of ${name.toLowerCase()}, selected with care for your home and garden.`,
        ],
      )
    ).rows[0];
    categoryIds[name] = c.id;
    for (const [j, child] of children.entries()) {
      const sub = (
        await db.query(
          "INSERT INTO categories(name,slug,parent_id,display_order,image) VALUES($1,$2,$3,$4,$5) RETURNING id",
          [child, slug(child), c.id, j, categoryImages[name]],
        )
      ).rows[0];
      categoryIds[child] = sub.id;
    }
  }
  const products = [...catalog].sort((a, b) => {
    const first = [
      "Bougainvillea",
      "Bougainvillea Flowering Plant",
      "Geranium",
    ];
    return (
      (first.includes(a.name) ? first.indexOf(a.name) : 10) -
      (first.includes(b.name) ? first.indexOf(b.name) : 10)
    );
  });
  for (const [i, p] of products.entries()) {
    const cats = p.categories.map((c) => c.name.replaceAll("&amp;", "&"));
    const sub = cats.find(
      (c) => categoryIds[c] && !Object.hasOwn(hierarchy, c),
    );
    const root =
      Object.keys(hierarchy).find((name) => hierarchy[name].includes(sub)) ||
      cats.find((c) => Object.hasOwn(hierarchy, c)) ||
      "Indoor Plants";
    const factor = 10 ** p.prices.currency_minor_unit;
    const regular = Number(p.prices.regular_price) / factor;
    const sale = p.on_sale ? Number(p.prices.sale_price) / factor : null;
    const image = p.local_images[0]?.path || "/images/reference-5.webp";
    const {
      rows: [product],
    } = await db.query(
      `INSERT INTO products(name,slug,sku,short_description,description,regular_price,sale_price,stock_quantity,category_id,subcategory_id,featured,popular,on_sale,main_image,seo_title,meta_description) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) RETURNING id`,
      [
        plain(p.name),
        p.slug,
        p.sku || "GH-" + String(i + 1).padStart(4, "0"),
        plain(p.short_description) ||
          `Bring a little nature into your space with ${plain(p.name)}.`,
        plain(p.description) ||
          `A beautiful ${plain(p.name)} plant, carefully selected and packed by GHARSA. Ideal for adding life and character to your home or garden. Contact our team for plant-specific care guidance.`,
        regular,
        sale,
        i === products.length - 1 ? 3 : 20,
        categoryIds[root],
        categoryIds[sub] || null,
        i % 3 === 0,
        i < 3,
        p.on_sale,
        image,
        plain(p.name) + " | GHARSA",
        plain(p.short_description).slice(0, 160),
      ],
    );
    for (const [j, img] of p.local_images.entries())
      await db.query(
        "INSERT INTO product_images(product_id,path,alt,display_order) VALUES($1,$2,$3,$4)",
        [product.id, img.path, img.alt, j],
      );
    for (const a of p.attributes || [])
      await db.query(
        "INSERT INTO product_attributes(product_id,name,value) VALUES($1,$2,$3)",
        [product.id, a.name, (a.terms || []).map((t) => t.name).join(", ")],
      );
    await db.query(
      "INSERT INTO inventory_transactions(product_id,product_name,delta,before_quantity,after_quantity,reason) VALUES($1,$2,$3,0,$3,$4)",
      [
        product.id,
        plain(p.name),
        i === products.length - 1 ? 3 : 20,
        "Initial catalogue stock",
      ],
    );
  }
  const settings = {
    store_name: "GHARSA",
    logo: "/images/reference-0.webp",
    footer_logo: "/images/reference-15.webp",
    favicon: "/images/reference-1.webp",
    phone: "+962 770 060 1798",
    email: "ahmadsamenpc@gmail.com",
    address: "Amman, King Hussein Business Park",
    currency: "JOD",
    free_shipping_threshold: 50,
    shipping_cost: 3,
    tax_rate: 0,
    products_per_page: 12,
    store_notice: "",
    footer_text: "Bring life home. Discover plants that belong in your space.",
    copyright: "Copyright © 2026 Gharsa",
    social_links: [],
    cod_enabled: true,
    footer_cta_title: "Ready to Find your Perfect Plant?",
    footer_cta_text:
      "Browse our online store or visit us in person to experience the beauty of nature.",
    footer_cta_image: "/images/footer-bg.webp",
  };
  await db.query("INSERT INTO site_settings(key,value) VALUES('store',$1)", [
    settings,
  ]);
  const pageIds = {};
  for (const [title, slugValue] of [
    ["Home", "home"],
    ["About", "about"],
    ["Contact Us", "contact"],
  ])
    pageIds[slugValue] = (
      await db.query(
        "INSERT INTO pages(title,slug,published,seo_title) VALUES($1,$2,true,$3) RETURNING id",
        [title, slugValue, title + " | GHARSA"],
      )
    ).rows[0].id;
  async function section(
    page,
    type,
    title,
    subtitle,
    content,
    configuration,
    position,
  ) {
    await db.query(
      "INSERT INTO page_sections(page_id,section_type,title,subtitle,content,configuration,display_order) VALUES($1,$2,$3,$4,$5,$6,$7)",
      [pageIds[page], type, title, subtitle, content, configuration, position],
    );
  }
  await section(
    "home",
    "image_slider",
    "Bring Life Home",
    "",
    "",
    {
      slides: [
        {
          image: "/images/reference-2.webp",
          alt: "GHARSA — Bring Life Home. Discover plants that belong in your space. Shop plants.",
          url: "/shop",
        },
        {
          image: "/images/reference-3.webp",
          alt: "Explore the GHARSA plant collection",
          url: "/shop?category=outdoor-plants",
        },
        {
          image: "/images/reference-4.webp",
          alt: "Find your perfect plant at GHARSA",
          url: "/shop?category=indoor-plants",
        },
      ],
    },
    0,
  );
  await section(
    "home",
    "features",
    "",
    "",
    "",
    {
      items: [
        { title: "Secure Payment", text: "Safe. Simple. Secure" },
        { title: "Free Shipping", text: "For $50 order" },
        {
          title: "Delivered with Care",
          text: "deliver your plants safely and carefully to your doorstep",
        },
        {
          title: "Excellent Service",
          text: "We provide reliable service from order to delivery",
        },
      ],
    },
    10,
  );
  await section(
    "home",
    "cta_banner",
    "Flash Sale: Up to 50% Off On Select Items!",
    "Don’t miss out on our flash sale event! For a limited time, enjoy up to 50% off on a selection of our best-selling products.",
    "",
    {
      url: "/shop?sale=true",
      button: "Shop Now",
      image: "/images/middle-cta.webp",
    },
    20,
  );
  await section(
    "home",
    "category_grid",
    "Our Categories",
    "",
    "",
    {
      category_ids: [
        "Indoor Plants",
        "Outdoor Plants",
        "Climbing & Hanging Plants",
        "Trees",
      ].map((n) => categoryIds[n]),
    },
    30,
  );
  await section(
    "home",
    "popular_products",
    "Popular Products",
    "",
    "",
    {
      source: "popular",
      limit: 3,
      columns: 3,
      showPrice: true,
      showRating: true,
      showAddToCart: true,
    },
    40,
  );
  await section(
    "home",
    "testimonials",
    "What Our Customers Say",
    "Discover the reasons why people loves us and become your go-to partner.",
    "",
    {},
    50,
  );
  for (const [i, t] of [
    {
      name: "Lina, Amman",
      body: "It made finding the right plant so much easier. I was able to browse plants based on my home conditions and choose one that actually fits my space. The plant arrived healthy and well-packed.",
      image: "/images/reference-12.webp",
    },
    {
      name: "Omar, Amman",
      body: "I really liked how Gharsa gives information about each plant instead of just showing the price. I finally found a plant that works well with the temperature and light in my apartment.",
      image: "/images/reference-13.webp",
    },
    {
      name: "Ahmad, Zarqa",
      body: "The ordering process was simple, and the plant looked exactly like the pictures. The care instructions were also very helpful because I’m not experienced with plants.",
      image: "/images/reference-14.webp",
    },
  ].entries())
    await db.query(
      "INSERT INTO testimonials(name,body,image,display_order) VALUES($1,$2,$3,$4)",
      [t.name, t.body, t.image, i],
    );
  await section(
    "about",
    "image_text",
    "We are Passionate About Our Work",
    "We strive to provide our customers with the highest quality",
    "<p>At GHARSA, we believe a plant is more than something you place in a corner. It is a small beginning — a living thing that grows with time, brings color into a quiet room, and slowly turns a house into a home.</p><p>We created GHARSA to make that feeling easier to find. From the first leaf to the first new branch, we want to help people discover the beauty of growing something of their own.</p>",
    {
      image: "/images/about-us.webp",
      alt: "A carefully tended collection of plants",
    },
    0,
  );
  await section(
    "about",
    "features",
    "Our Core Values that Drive Everything We Do",
    "",
    "",
    {
      large: true,
      items: [
        {
          title: "Passionate About Work",
          text: "Passion and enthusiasm for every plant and every customer.",
        },
        {
          title: "Creative Team Members",
          text: "A creative team dedicated to helping your ideas grow.",
        },
        {
          title: "Innovation Solutions",
          text: "Finding thoughtful new ways to bring nature closer.",
        },
        {
          title: "Quality Products",
          text: "Carefully selected plants that bring lasting joy.",
        },
        {
          title: "Customer Satisfaction",
          text: "Reliable care and service from order to delivery.",
        },
        {
          title: "Simple Interface",
          text: "Making it easy to discover the right plant for you.",
        },
      ],
    },
    10,
  );
  await section(
    "about",
    "image_text",
    "Our Mission",
    "",
    "<p>Our mission is to bring people closer to nature by making plants accessible, meaningful, and easy to discover. We aim to help every person find the right plant for their space and lifestyle, while providing the knowledge and inspiration to help it thrive.</p><p>We want to turn ordinary spaces into places filled with life, color, and character — making it easier for people across Jordan to grow, connect, and live with nature every day.</p><ul><li>Quality and Variety</li><li>Sustainable Practices</li><li>Expert Guidance</li><li>Experienced Team</li></ul>",
    {
      image: "/images/our-mission.webp",
      alt: "Growing plants with care",
      reverse: true,
    },
    20,
  );
  await section(
    "contact",
    "contact_form",
    "Send us Message",
    "Let’s Connect",
    "",
    {},
    0,
  );
  const menu = (
    await db.query(
      "INSERT INTO menus(name,location) VALUES('Main navigation','header') RETURNING id",
    )
  ).rows[0];
  for (const [i, [label, url, pid]] of [
    ["Home", "/", pageIds.home],
    ["Shop", "/shop", null],
    ["About", "/about", pageIds.about],
    ["Contact", "/contact", pageIds.contact],
  ].entries())
    await db.query(
      "INSERT INTO menu_items(menu_id,label,url,page_id,display_order) VALUES($1,$2,$3,$4,$5)",
      [menu.id, label, url, pid, i],
    );
  await db.query(
    "INSERT INTO coupons(code,description,discount_type,discount_amount,minimum_order,usage_per_user) VALUES('WELCOME10','Welcome to GHARSA','percentage',10,5,1)",
  );
  console.log(
    "Seeded GHARSA catalogue, categories, pages, navigation, settings, and Super Admin.",
  );
});
await pool.end();
