import { test, expect } from "@playwright/test";
import dotenv from "dotenv";
dotenv.config({ path: "backend/.env", quiet: true });
const email = `browser-${Date.now()}@example.com`;
const password = "Browser-Strong-123";
test("customer journey: guest cart merge, account, coupon, checkout, order, wishlist and review", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Our Categories" }),
  ).toBeVisible();
  await page.goto("/product/bougainvillea");
  await expect(
    page.getByRole("heading", { name: "Bougainvillea", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Add to cart", exact: true })
    .first()
    .click();
  await page.goto("/cart");
  await expect(
    page.getByRole("heading", { name: "Shopping cart" }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("spinbutton", { name: "Quantity for Bougainvillea" }),
  ).toHaveValue("1");
  await page.goto("/register");
  await page.getByLabel("Full name").fill("Browser Customer");
  await page.getByLabel("Phone").fill("0790000000");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByLabel("Confirm password").fill(password);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/account/);
  await page.goto("/cart");
  await expect(
    page.getByRole("spinbutton", { name: "Quantity for Bougainvillea" }),
  ).toHaveValue("1");
  await page
    .getByRole("spinbutton", { name: "Quantity for Bougainvillea" })
    .fill("2");
  await page.getByLabel("Coupon code").fill("WELCOME10");
  await page.getByRole("button", { name: "Apply coupon" }).click();
  await expect(page.getByText("Discount", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Proceed to checkout" }).click();
  await page.getByLabel("First name").fill("Browser");
  await page.getByLabel("Last name").fill("Customer");
  await page.getByLabel("Phone").fill("0790000000");
  await page.getByLabel("Street address").fill("10 Garden Street");
  await page.getByLabel("City", { exact: true }).fill("Amman");
  await page.getByRole("button", { name: "Place order" }).click();
  await expect(
    page.getByRole("heading", { name: "Thank you for your order." }),
  ).toBeVisible();
  await page.getByRole("link", { name: "View your orders" }).click();
  await expect(page.getByRole("link", { name: /GH-/ })).toBeVisible();
  await page.getByRole("link", { name: /GH-/ }).click();
  await expect(page.getByRole("heading", { name: /Order GH-/ })).toBeVisible();
  await page.goto("/shop");
  await page
    .getByRole("button", {
      name: "Save Bougainvillea to wishlist",
      exact: true,
    })
    .click();
  await page.goto("/account/wishlist");
  await expect(
    page.getByRole("heading", { name: "Bougainvillea", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Remove from wishlist" }).click();
  await expect(
    page.getByText("Your wishlist is waiting for something green."),
  ).toBeVisible();
  await page.goto("/product/bougainvillea");
  await page.getByLabel("Title", { exact: true }).fill("Healthy plant");
  await page
    .getByLabel("Your review")
    .fill("Beautiful plant and easy ordering.");
  await page.getByRole("button", { name: "Submit review" }).click();
  await expect(page.getByRole("status")).toContainText(
    "submitted for approval",
  );
  await page.goto("/account");
  await page.getByRole("button", { name: "Logout", exact: true }).click();
  await expect(page).toHaveURL(/\/login/);
  expect(errors).toEqual([]);
});
test("admin journey: product editor, stock, page builder, settings, navigation and all sections", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/login");
  await page.getByLabel("Email address").fill(process.env.SUPER_ADMIN_EMAIL);
  await page
    .getByLabel("Password", { exact: true })
    .fill(process.env.SUPER_ADMIN_PASSWORD);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/admin/);
  await expect(page.locator(".stats-grid .stat-card")).toHaveCount(6);
  for (const path of [
    "products",
    "categories",
    "inventory",
    "orders",
    "customers",
    "users",
    "roles",
    "pages",
    "page-builder",
    "sections",
    "navigation",
    "homepage",
    "testimonials",
    "reviews",
    "coupons",
    "media",
    "messages",
    "settings",
    "seo",
    "audit-logs",
  ]) {
    await page.goto("/admin/" + path);
    await expect(page.locator(".admin-content h1")).toBeVisible();
    await expect(page.locator(".admin-content .spinner")).toHaveCount(0);
    await expect(page.locator(".admin-content .error")).toHaveCount(0);
  }
  await page.goto("/admin/products");
  await page.getByRole("button", { name: "Add product", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Name", { exact: true }).fill("Browser Test Plant");
  await dialog.getByLabel("Slug", { exact: true }).fill("browser-test-plant");
  await dialog.getByLabel("Sku", { exact: true }).fill("BROWSER-TEST-001");
  await dialog.getByLabel("Regular price", { exact: true }).fill("12");
  await dialog.getByRole("button", { name: "Save changes" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(
    page.getByRole("cell", { name: "Browser Test Plant", exact: true }),
  ).toBeVisible();
  await page.goto("/admin/inventory");
  await page.getByLabel("Search inventory").fill("Browser Test Plant");
  await page.getByRole("button", { name: "Adjust stock" }).click();
  await page.getByRole("dialog").getByLabel("New stock quantity").fill("7");
  await page
    .getByRole("dialog")
    .getByLabel("Reason for adjustment")
    .fill("Browser test receiving");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: "History", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText(
    "Browser test receiving",
  );
  await page.getByRole("button", { name: "Close dialog" }).click();
  await page.goto("/admin/homepage");
  await page.getByRole("button", { name: "Add section", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByLabel("Title", { exact: true })
    .fill("Browser CMS verification");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Browser CMS verification" }),
  ).toBeVisible();
  await page.goto("/admin/homepage");
  page.once("dialog", (d) => d.accept());
  await page
    .locator(".builder-section")
    .filter({ hasText: "Browser CMS verification" })
    .getByRole("button", { name: "Delete section", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Browser CMS verification" }),
  ).toHaveCount(0);
  await page.goto("/admin/products");
  await page
    .getByRole("button", { name: "Delete Browser Test Plant", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Delete", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(errors).toEqual([]);
});
test("responsive pages, navigation, filtering, search and contact", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const url of [
    "/",
    "/shop",
    "/about",
    "/contact",
    "/product/bougainvillea",
    "/cart",
    "/login",
  ]) {
    await page.goto(url);
    await page.locator("footer").waitFor();
    await page.waitForTimeout(250);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      url + " has no overflow",
    ).toBe(true);
  }
  await page.goto("/");
  await page.getByRole("button", { name: "Toggle navigation" }).click();
  await page
    .locator(".main-nav")
    .getByRole("link", { name: "Shop", exact: true })
    .click();
  await expect(page).toHaveURL(/\/shop/);
  await page
    .getByRole("button", { name: "Indoor Plants", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Indoor Plants", exact: true }),
  ).toBeVisible();
  await page.getByLabel("Search products").fill("Pothos");
  await page
    .locator(".header-search")
    .getByRole("button", { name: "Search", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Results for “Pothos”" }),
  ).toBeVisible();
  await expect(page.locator(".product-card")).toHaveCount(2);
  await page.goto("/contact");
  await page.getByLabel("Name", { exact: true }).fill("Browser Visitor");
  await page.getByLabel("Email", { exact: true }).fill("visitor@example.com");
  await page.getByLabel("Phone", { exact: true }).fill("0790000000");
  await page
    .getByLabel("Message", { exact: true })
    .fill("Please help me select an indoor plant.");
  await page.getByRole("button", { name: "Submit", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("message has been sent");
});
