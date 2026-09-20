import { test, after } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { app } from "../src/app.js";
import { pool, query } from "../src/config/db.js";
const client = request(app);
let admin, customer, content, inventoryUser, product, category, order, role;
const call = (method, url, body, token = admin) => {
  const q = client[method]("/api" + url);
  if (token) q.set("Authorization", "Bearer " + token);
  return body === undefined ? q : q.send(body);
};
const credentials = {
  name: "Test Customer",
  email: "customer@example.com",
  phone: "0790000000",
  password: "Customer-Strong-123",
  confirm_password: "Customer-Strong-123",
};
const address = {
  first_name: "Test",
  last_name: "Customer",
  phone: "0790000000",
  address: "10 Garden Street",
  city: "Amman",
  country: "Jordan",
  additional_address: "Apartment 2",
};
after(() => pool.end());
test("authentication, accounts and authorization", async () => {
  let r = await call(
    "post",
    "/auth/login",
    {
      email: process.env.SUPER_ADMIN_EMAIL,
      password: process.env.SUPER_ADMIN_PASSWORD,
    },
    null,
  );
  assert.equal(r.status, 200);
  admin = r.body.token;
  const dashboard = await call("get", "/admin/dashboard");
  assert.equal(dashboard.status, 200, JSON.stringify(dashboard.body));
  assert.ok(dashboard.body.stats);
  r = await call("post", "/auth/register", credentials, null);
  assert.equal(r.status, 201);
  customer = r.body.token;
  assert.equal(
    (await call("post", "/auth/register", credentials, null)).status,
    409,
  );
  assert.equal(
    (
      await call(
        "post",
        "/auth/login",
        { email: credentials.email, password: "wrong" },
        null,
      )
    ).status,
    401,
  );
  assert.equal(
    (await call("get", "/admin/products", undefined, customer)).status,
    403,
  );
  assert.equal(
    (await call("get", "/admin/products", undefined, null)).status,
    401,
  );
  assert.equal(
    (
      await call(
        "put",
        "/auth/profile",
        { name: "Updated Customer", phone: "0788888888" },
        customer,
      )
    ).status,
    200,
  );
  const a = await call(
    "post",
    "/auth/addresses",
    { ...address, label: "Home" },
    customer,
  );
  assert.equal(a.status, 201);
  assert.equal(
    (await call("get", "/auth/addresses", undefined, customer)).body.length,
    1,
  );
  await call("delete", "/auth/addresses/" + a.body.id, undefined, customer);
  const roles = (await call("get", "/admin/roles")).body;
  role = roles.find((r) => r.name === "CONTENT_MANAGER");
  r = await call("post", "/admin/users", {
    name: "Content Editor",
    email: "editor@example.com",
    password: "Content-Strong-123",
    role_ids: [role.id],
  });
  assert.equal(r.status, 200);
  content = (
    await call(
      "post",
      "/auth/login",
      { email: "editor@example.com", password: "Content-Strong-123" },
      null,
    )
  ).body.token;
  assert.equal(
    (await call("get", "/admin/pages", undefined, content)).status,
    200,
  );
  for (const endpoint of ["inventory", "users", "orders", "dashboard"])
    assert.equal(
      (await call("get", "/admin/" + endpoint, undefined, content)).status,
      403,
    );
  const user = (await call("get", "/admin/users")).body.find(
    (u) => u.email === "editor@example.com",
  );
  await call("put", "/admin/users/" + user.id, { ...user, active: false });
  assert.equal((await call("get", "/auth/me", undefined, content)).status, 401);
  await call("put", "/admin/users/" + user.id, { ...user, active: true });
  assert.equal((await call("get", "/auth/me", undefined, content)).status, 200);
  const primary = (await call("get", "/admin/users")).body.find(
    (u) => u.primary_admin,
  );
  assert.equal(
    (await call("delete", "/admin/users/" + primary.id)).status,
    400,
  );
  const perms = (await call("get", "/admin/permissions")).body;
  const selected = perms
    .filter((p) =>
      ["inventory.view", "inventory.edit", "products.view"].includes(p.name),
    )
    .map((p) => p.id);
  assert.equal(
    (
      await call("post", "/admin/roles", {
        name: "Inventory Employee",
        description: "Stock only",
        permission_ids: selected,
      })
    ).status,
    200,
  );
  const custom = (await call("get", "/admin/roles")).body.find(
    (r) => r.name === "Inventory Employee",
  );
  await call("post", "/admin/users", {
    name: "Inventory",
    email: "inventory@example.com",
    password: "Inventory-Strong-123",
    role_ids: [custom.id],
  });
  inventoryUser = (
    await call(
      "post",
      "/auth/login",
      { email: "inventory@example.com", password: "Inventory-Strong-123" },
      null,
    )
  ).body.token;
  assert.equal(
    (await call("get", "/admin/inventory", undefined, inventoryUser)).status,
    200,
  );
  assert.equal(
    (await call("post", "/admin/products", {}, inventoryUser)).status,
    403,
  );
  await call("put", "/admin/roles/" + custom.id, {
    name: custom.name,
    description: "Read only",
    permission_ids: [],
  });
  assert.equal(
    (await call("get", "/admin/inventory", undefined, inventoryUser)).status,
    403,
  );
});
test("catalogue, category hierarchy, products, inventory and search", async () => {
  let r = await call("post", "/admin/categories", {
    name: "Test category",
    slug: "test-category",
    active: true,
  });
  assert.equal(r.status, 201);
  category = r.body;
  const sub = (
    await call("post", "/admin/categories", {
      name: "Test child",
      slug: "test-child",
      parent_id: category.id,
    })
  ).body;
  assert.equal(
    (
      await call("put", "/admin/categories/" + category.id, {
        ...category,
        parent_id: sub.id,
      })
    ).status,
    400,
  );
  r = await call("post", "/admin/products", {
    name: "Test Plant",
    slug: "test-plant",
    sku: "TEST-001",
    regular_price: 10,
    sale_price: 8,
    on_sale: true,
    category_id: category.id,
    subcategory_id: sub.id,
    main_image: "/images/reference-9.webp",
    attributes: [{ name: "Light", value: "Indirect" }],
    images: [{ path: "/images/reference-9.webp", alt: "Test plant" }],
  });
  assert.equal(r.status, 201);
  product = r.body;
  assert.equal(
    (
      await call("post", "/admin/inventory/" + product.id, {
        quantity: 10,
        reason: "Received ten plants",
        low_stock_threshold: 3,
        stock_status: "in_stock",
      })
    ).status,
    200,
  );
  const detail = (await call("get", "/products/test-plant", undefined, null))
    .body;
  assert.equal(detail.stock_quantity, 10);
  assert.equal(detail.attributes[0].value, "Indirect");
  assert.equal(detail.images.length, 1);
  assert.equal(
    (
      await call(
        "get",
        "/products?search=TEST-001&category=test-category",
        undefined,
        null,
      )
    ).body.total,
    1,
  );
  assert.equal(
    (
      await call(
        "get",
        "/products?category=test-child&sale=true&min=7&max=9",
        undefined,
        null,
      )
    ).body.total,
    1,
  );
  assert.equal(
    (
      await call(
        "get",
        "/products?search=';DROP%20TABLE%20users;--",
        undefined,
        null,
      )
    ).status,
    200,
  );
  assert.equal(
    (await call("get", "/admin/inventory/" + product.id + "/history")).body
      .length,
    1,
  );
  const copy = await call(
    "post",
    "/admin/products/" + product.id + "/duplicate",
    {},
  );
  assert.equal(copy.status, 201);
  assert.equal(copy.body.active, false);
  assert.equal(
    (await call("delete", "/admin/products/" + copy.body.id)).status,
    200,
  );
});
test("server cart, wishlist and moderated reviews", async () => {
  const items = [{ product_id: product.id, quantity: 2, variation_id:null,bundle_id:null }];
  assert.equal((await call("put", "/cart", { items }, customer)).status, 200);
  assert.deepEqual(
    (await call("get", "/cart", undefined, customer)).body,
    items,
  );
  assert.equal(
    (await call("post", "/wishlist/" + product.id, {}, customer)).status,
    201,
  );
  assert.equal(
    (await call("get", "/wishlist", undefined, customer)).body.length,
    1,
  );
  await call("delete", "/wishlist/" + product.id, undefined, customer);
  assert.equal(
    (await call("get", "/wishlist", undefined, customer)).body.length,
    0,
  );
  assert.equal(
    (
      await call(
        "post",
        "/reviews",
        {
          product_id: product.id,
          rating: 5,
          title: "Lovely",
          body: "Healthy plant delivered with care.",
        },
        customer,
      )
    ).status,
    201,
  );
  assert.equal(
    (await call("get", "/products/test-plant", undefined, null)).body
      .review_count,
    0,
  );
  const review = (await call("get", "/admin/reviews")).body[0];
  await call("put", "/admin/reviews/" + review.id, { status: "approved" });
  let p = (await call("get", "/products/test-plant", undefined, null)).body;
  assert.equal(p.average_rating, 5);
  assert.equal(p.review_count, 1);
  await call("put", "/admin/reviews/" + review.id, { status: "hidden" });
  assert.equal(
    (await call("get", "/products/test-plant", undefined, null)).body
      .review_count,
    0,
  );
  await call("delete", "/admin/reviews/" + review.id);
});
test("coupons, trusted totals, checkout idempotency, ownership and stock restoration", async () => {
  const coupon = (
    await call("post", "/admin/coupons", {
      code: "TEST20",
      discount_type: "percentage",
      discount_amount: 20,
      minimum_order: 5,
      maximum_discount: 10,
      usage_limit: 3,
      usage_per_user: 1,
      product_ids: [product.id],
    })
  ).body;
  const items = [{ product_id: product.id, quantity: 2, variation_id:null,bundle_id:null }];
  const q = await call(
    "post",
    "/cart/quote",
    { items, coupon: "TEST20" },
    customer,
  );
  assert.equal(q.status, 200);
  assert.equal(q.body.subtotal, 16);
  assert.equal(q.body.discount, 3.2);
  assert.equal(q.body.total, 15.8);
  const payload = {
    items,
    coupon: "TEST20",
    email: credentials.email,
    shipping_address: address,
    payment_method: "cod",
    idempotency_key: randomUUID(),
    total: 0,
    unit_price: 0,
  };
  const r = await call("post", "/checkout", payload, customer);
  assert.equal(r.status, 201, JSON.stringify(r.body));
  order = r.body;
  assert.equal(Number(order.total), 15.8);
  assert.equal(
    (await call("post", "/checkout", payload, customer)).body.id,
    order.id,
  );
  assert.equal(
    (await call("get", "/products/test-plant", undefined, null)).body
      .stock_quantity,
    8,
  );
  assert.equal(
    (await call("get", "/cart", undefined, customer)).body.length,
    0,
  );
  assert.equal(
    (await call("get", "/orders", undefined, customer)).body.length,
    1,
  );
  assert.equal(
    (await call("get", "/orders/" + order.id, undefined, content)).status,
    404,
  );
  assert.equal(
    (await call("post", "/cart/quote", { items, coupon: "TEST20" }, customer))
      .status,
    400,
  );
  assert.equal(
    (
      await call(
        "post",
        "/checkout",
        {
          ...payload,
          coupon: "",
          items: [{ product_id: product.id, quantity: 99 }],
          idempotency_key: randomUUID(),
        },
        customer,
      )
    ).status,
    400,
  );
  assert.equal(
    (await call("get", "/products/test-plant", undefined, null)).body
      .stock_quantity,
    8,
  );
  assert.equal(
    (await call("put", "/admin/orders/" + order.id, { status: "cancelled" }))
      .status,
    200,
  );
  assert.equal(
    (await call("get", "/products/test-plant", undefined, null)).body
      .stock_quantity,
    10,
  );
  await call("put", "/admin/orders/" + order.id, { status: "cancelled" });
  assert.equal(
    (await call("get", "/products/test-plant", undefined, null)).body
      .stock_quantity,
    10,
  );
  assert.equal(
    (await call("put", "/admin/orders/" + order.id, { status: "processing" }))
      .status,
    400,
  );
  assert.equal(
    (await call("delete", "/admin/coupons/" + coupon.id)).status,
    409,
  );
});
test("concurrent checkout cannot oversell and rolls back all items", async () => {
  await call("post", "/admin/inventory/" + product.id, {
    quantity: 1,
    reason: "Concurrency test",
    low_stock_threshold: 1,
    stock_status: "in_stock",
  });
  const payload = {
    items: [{ product_id: product.id, quantity: 1 }],
    email: credentials.email,
    shipping_address: address,
    payment_method: "cod",
  };
  const results = await Promise.all([
    call(
      "post",
      "/checkout",
      { ...payload, idempotency_key: randomUUID() },
      customer,
    ),
    call(
      "post",
      "/checkout",
      { ...payload, idempotency_key: randomUUID() },
      customer,
    ),
  ]);
  assert.deepEqual(results.map((r) => r.status).sort(), [201, 400]);
  assert.equal(
    (await call("get", "/products/test-plant", undefined, null)).body
      .stock_quantity,
    0,
  );
});
test("CMS CRUD, sanitization, ordering, publishing, navigation and settings", async () => {
  let r = await call(
    "post",
    "/admin/pages",
    { title: "Test Page", slug: "test-page", published: false },
    content,
  );
  assert.equal(r.status, 201);
  const page = r.body;
  assert.equal(
    (await call("get", "/pages/test-page", undefined, null)).status,
    404,
  );
  const s = (
    await call(
      "post",
      "/admin/sections",
      {
        page_id: page.id,
        section_type: "rich_text",
        title: "Hello",
        content:
          "<p>Safe</p><script>alert(1)</script><img src=x onerror=alert(1)>",
        configuration: {},
      },
      content,
    )
  ).body;
  assert.ok(!s.content.includes("<script"));
  assert.ok(!s.content.includes("onerror"));
  assert.equal(
    (
      await call(
        "post",
        "/admin/sections",
        {
          page_id: page.id,
          section_type: "hero",
          configuration: { slides: [{ url: "javascript:alert(1)" }] },
        },
        content,
      )
    ).status,
    400,
  );
  const second = (
    await call(
      "post",
      "/admin/sections",
      { page_id: page.id, section_type: "text", title: "Second" },
      content,
    )
  ).body;
  assert.equal(
    (
      await call(
        "post",
        "/admin/sections/reorder",
        { page_id: page.id, ids: [second.id, s.id] },
        content,
      )
    ).status,
    200,
  );
  await call(
    "put",
    "/admin/pages/" + page.id,
    { ...page, published: true },
    content,
  );
  const publicPage = (await call("get", "/pages/test-page", undefined, null))
    .body;
  assert.equal(publicPage.sections[0].title, "Second");
  const copy = await call(
    "post",
    "/admin/pages/" + page.id + "/duplicate",
    {},
    content,
  );
  assert.equal(copy.status, 201);
  await call("delete", "/admin/pages/" + copy.body.id, undefined, content);
  const menus = (await call("get", "/admin/menus")).body;
  const item = (
    await call("post", "/admin/navigation", {
      menu_id: menus[0].id,
      label: "Test Page",
      page_id: page.id,
    })
  ).body;
  assert.equal(
    (await call("get", "/navigation", undefined, null)).body.find(
      (x) => x.id === item.id,
    ).destination,
    "/test-page",
  );
  await call("delete", "/admin/navigation/" + item.id);
  const settings = (await call("get", "/admin/settings")).body;
  assert.equal(
    (
      await call("put", "/admin/settings", {
        ...settings,
        store_notice: "Test notice",
      })
    ).status,
    200,
  );
  assert.equal(
    (await call("get", "/settings", undefined, null)).body.store_notice,
    "Test notice",
  );
  assert.equal(
    (
      await call("put", "/admin/seo/pages/" + page.id, {
        seo_title: "New SEO",
        meta_description: "Description",
        canonical_url: "",
        noindex: true,
      })
    ).status,
    200,
  );
  assert.equal(
    (await call("get", "/pages/test-page", undefined, null)).body.seo_title,
    "New SEO",
  );
  assert.equal((await client.get("/sitemap.xml")).status, 200);
  assert.equal((await client.get("/robots.txt")).status, 200);
  await call("delete", "/admin/pages/" + page.id, undefined, content);
});
test("messages, testimonials, media validation, metadata, deletion protection and audit", async () => {
  assert.equal(
    (
      await call(
        "post",
        "/contact",
        {
          name: "Visitor",
          email: "visitor@example.com",
          phone: "0790000000",
          message: "Can you help me choose a plant?",
        },
        null,
      )
    ).status,
    201,
  );
  const msg = (await call("get", "/admin/messages")).body[0];
  assert.equal(
    (await call("put", "/admin/messages/" + msg.id, { is_read: true })).status,
    200,
  );
  await call("delete", "/admin/messages/" + msg.id);
  const t = (
    await call("post", "/admin/testimonials", {
      name: "Test reviewer",
      body: "A great plant store",
      rating: 5,
    })
  ).body;
  assert.equal(
    (await call("put", "/admin/testimonials/" + t.id, { ...t, active: false }))
      .status,
    200,
  );
  await call("delete", "/admin/testimonials/" + t.id);
  const invalid = await client
    .post("/api/admin/media")
    .set("Authorization", "Bearer " + admin)
    .attach("image", Buffer.from("<script>bad</script>"), {
      filename: "bad.png",
      contentType: "image/png",
    });
  assert.equal(invalid.status, 400);
  const buffer = await sharp({
    create: { width: 20, height: 20, channels: 3, background: "#88ad35" },
  })
    .png()
    .toBuffer();
  const upload = await client
    .post("/api/admin/media")
    .set("Authorization", "Bearer " + admin)
    .attach("image", buffer, {
      filename: "plant.png",
      contentType: "image/png",
    });
  assert.equal(upload.status, 201);
  const m = upload.body;
  assert.equal(
    (
      await call("put", "/admin/media/" + m.id, {
        title: "Plant photo",
        alt: "A green plant",
      })
    ).status,
    200,
  );
  const p = (await call("get", "/admin/products/" + product.id)).body;
  await call("put", "/admin/products/" + product.id, {
    ...p,
    main_image: m.path,
  });
  assert.equal((await call("delete", "/admin/media/" + m.id)).status, 400);
  await call("put", "/admin/products/" + product.id, {
    ...p,
    main_image: "/images/reference-9.webp",
  });
  assert.equal((await call("delete", "/admin/media/" + m.id)).status, 200);
  assert.ok((await call("get", "/admin/audit-logs")).body.length > 20);
  assert.equal((await call("post", "/auth/logout", {}, customer)).status, 200);
  assert.equal(
    (await call("get", "/auth/me", undefined, customer)).status,
    401,
  );
});

test("seeded catalogue is editable, internal costs remain private, address ownership and password revocation", async () => {
  const seeded = (await call("get", "/admin/products")).body.filter(
    (p) => p.slug !== "test-plant",
  );
  for (const p of seeded) {
    const full = (await call("get", "/admin/products/" + p.id)).body;
    const result = await call("put", "/admin/products/" + p.id, full);
    assert.equal(
      result.status,
      200,
      p.name + ": " + JSON.stringify(result.body),
    );
  }
  assert.equal(
    (await call("get", "/products?limit=100", undefined, null)).body.items[0]
      .cost_price,
    undefined,
  );
  const fresh = (
    await call(
      "post",
      "/auth/login",
      { email: credentials.email, password: credentials.password },
      null,
    )
  ).body.token;
  const saved = (
    await call("post", "/auth/addresses", { ...address, label: "Work" }, fresh)
  ).body;
  assert.equal(
    (
      await call(
        "put",
        "/auth/addresses/" + saved.id,
        { ...address, label: "Changed", city: "Zarqa" },
        content,
      )
    ).status,
    404,
  );
  assert.equal(
    (
      await call(
        "put",
        "/auth/addresses/" + saved.id,
        { ...address, label: "Changed", city: "Zarqa" },
        fresh,
      )
    ).status,
    200,
  );
  const passwordChange = await call(
    "put",
    "/auth/password",
    {
      current_password: credentials.password,
      password: "Changed-Strong-456",
      confirm_password: "Changed-Strong-456",
    },
    fresh,
  );
  assert.equal(passwordChange.status, 200);
  assert.equal((await call("get", "/auth/me", undefined, fresh)).status, 401);
  assert.equal(
    (await call("get", "/auth/me", undefined, passwordChange.body.token))
      .status,
    200,
  );
});

test("coupon date/scope constraints, configured tax/shipping, payment availability and atomic multi-item failure", async () => {
  await call("post", "/admin/inventory/" + product.id, {
    quantity: 10,
    reason: "Final validation",
    low_stock_threshold: 3,
    stock_status: "in_stock",
  });
  const other = (
    await call("get", "/products?limit=100", undefined, null)
  ).body.items.find((p) => p.id !== product.id && p.stock_quantity > 0);
  const created = (
    await call("post", "/admin/coupons", {
      code: "SCOPE5",
      discount_type: "fixed",
      discount_amount: 5,
      minimum_order: 10,
      category_ids: [category.id],
    })
  ).body;
  assert.equal(
    (
      await call(
        "post",
        "/cart/quote",
        { items: [{ product_id: other.id, quantity: 1 }], coupon: "SCOPE5" },
        null,
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await call(
        "post",
        "/cart/quote",
        { items: [{ product_id: product.id, quantity: 1 }], coupon: "SCOPE5" },
        null,
      )
    ).status,
    400,
  );
  await call("put", "/admin/coupons/" + created.id, {
    ...created,
    start_date: "2099-01-01T00:00:00Z",
  });
  assert.equal(
    (
      await call(
        "post",
        "/cart/quote",
        { items: [{ product_id: product.id, quantity: 2 }], coupon: "SCOPE5" },
        null,
      )
    ).status,
    400,
  );
  await call("put", "/admin/coupons/" + created.id, {
    ...created,
    expiration_date: "2000-01-01T00:00:00Z",
  });
  assert.equal(
    (
      await call(
        "post",
        "/cart/quote",
        { items: [{ product_id: product.id, quantity: 2 }], coupon: "SCOPE5" },
        null,
      )
    ).status,
    400,
  );
  await call("delete", "/admin/coupons/" + created.id);
  const settings = (await call("get", "/admin/settings")).body;
  await call("put", "/admin/settings", {
    ...settings,
    tax_rate: 10,
    shipping_cost: 4,
    free_shipping_threshold: 20,
    cod_enabled: false,
  });
  const quoted = (
    await call(
      "post",
      "/cart/quote",
      { items: [{ product_id: product.id, quantity: 2 }] },
      null,
    )
  ).body;
  assert.equal(quoted.subtotal, 16);
  assert.equal(quoted.tax, 1.6);
  assert.equal(quoted.shipping, 4);
  assert.equal(quoted.total, 21.6);
  assert.equal(quoted.items[0].cost_price, undefined);
  const data = {
    items: [{ product_id: product.id, quantity: 2 }],
    email: "guest@example.com",
    shipping_address: address,
    payment_method: "cod",
    idempotency_key: randomUUID(),
  };
  assert.equal((await call("post", "/checkout", data, null)).status, 400);
  await call("put", "/admin/settings", settings);
  const failure = await call(
    "post",
    "/checkout",
    {
      ...data,
      items: [
        { product_id: product.id, quantity: 1 },
        { product_id: other.id, quantity: 999 },
      ],
      idempotency_key: randomUUID(),
    },
    null,
  );
  assert.equal(failure.status, 400);
  assert.equal(
    (await call("get", "/products/test-plant", undefined, null)).body
      .stock_quantity,
    10,
  );
});

test("limited user management cannot take over a more privileged account", async () => {
  const permissions = (await call("get", "/admin/permissions")).body;
  const selected = permissions
    .filter((p) =>
      [
        "users.view",
        "users.edit",
        "users.delete",
        "roles.view",
        "roles.edit",
      ].includes(p.name),
    )
    .map((p) => p.id);
  await call("post", "/admin/roles", {
    name: "Customer Support",
    description: "Limited user management",
    permission_ids: selected,
  });
  const roles = (await call("get", "/admin/roles")).body;
  const supportRole = roles.find((r) => r.name === "Customer Support");
  const adminRole = roles.find((r) => r.name === "ADMIN");
  await call("post", "/admin/users", {
    name: "Support",
    email: "support@example.com",
    password: "Support-Strong-123",
    role_ids: [supportRole.id],
  });
  await call("post", "/admin/users", {
    name: "Second Admin",
    email: "second-admin@example.com",
    password: "Admin-Strong-123",
    role_ids: [adminRole.id],
  });
  const actor = (
    await call(
      "post",
      "/auth/login",
      { email: "support@example.com", password: "Support-Strong-123" },
      null,
    )
  ).body.token;
  const target = (await call("get", "/admin/users")).body.find(
    (u) => u.email === "second-admin@example.com",
  );
  assert.equal(
    (
      await call(
        "put",
        "/admin/users/" + target.id,
        {
          name: target.name,
          email: target.email,
          phone: "",
          active: true,
          password: "Takeover-Strong-123",
        },
        actor,
      )
    ).status,
    403,
  );
  assert.equal(
    (await call("delete", "/admin/users/" + target.id, undefined, actor))
      .status,
    403,
  );
  assert.equal(
    (
      await call(
        "put",
        "/admin/users/" + target.id,
        { ...target, role_ids: [supportRole.id] },
        actor,
      )
    ).status,
    403,
  );
});
