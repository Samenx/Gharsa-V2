import { test, expect } from "@playwright/test";
import dotenv from "dotenv";
dotenv.config({ path: "backend/.env", quiet: true });
test("V2 guest wishlist, comparison, FAQ search and office collections", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/shop");
  await page
    .getByRole("button", {
      name: "Save Bougainvillea to wishlist",
      exact: true,
    })
    .click();
  await page.goto("/wishlist");
  await expect(
    page.getByRole("heading", { name: "Bougainvillea", exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Bougainvillea", exact: true }),
  ).toBeVisible();
  await page.goto("/shop");
  await page.locator(".compare-button").nth(0).click();
  await page.locator(".compare-button").nth(1).click();
  await page.goto("/compare");
  await expect(page.locator(".compare-table thead img")).toHaveCount(2);
  await page.goto("/faq");
  await page.getByRole("textbox", { name: "Search questions" }).fill("payment");
  await expect(page.locator(".faq-list details")).toHaveCount(1);
  await page.locator(".faq-list summary").click();
  await expect(page.locator(".faq-list p")).toContainText("Cash on delivery");
  await page.goto("/shop?category=office-plants");
  await expect(page.locator(".product-card")).toHaveCount(5);
  expect(errors).toEqual([]);
});
test("Arabic storefront and mobile layouts remain usable", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "العربية", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.locator("html")).toHaveAttribute("lang", "ar");
  await expect(page.locator(".hero-slide.is-active .hero-editorial h1")).toContainText("لمسة خضراء");
  for (const url of [
    "/",
    "/shop",
    "/product/golden-pothos",
    "/faq",
    "/wishlist",
    "/compare",
    "/login",
    "/returns",
  ]) {
    await page.goto(url);
    await expect(page.locator("#main")).toBeVisible();
    await page.waitForTimeout(350);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
      url,
    ).toBe(true);
    await expect(page.locator("#main .error")).toHaveCount(0);
  }
  await page.goto("/product/golden-pothos");
  await expect(page.locator(".product-summary h1")).toHaveText("البوتس الذهبي");
  await expect(page.locator(".purchase button")).toHaveText("أضف إلى السلة");
  expect(errors).toEqual([]);
});
test("V2 admin modules load and FAQ edits appear in English and Arabic", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/login");
  await page
    .getByLabel("Email address", { exact: true })
    .fill(process.env.SUPER_ADMIN_EMAIL);
  await page
    .getByLabel("Password", { exact: true })
    .fill(process.env.SUPER_ADMIN_PASSWORD);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/admin/);
  for (const path of [
    "faqs",
    "announcements",
    "delivery_rules",
    "return_policies",
    "guarantee_policies",
    "climate_profiles",
    "calendar_rules",
    "suitable_locations",
    "bundles",
    "bundle_items",
    "footer_columns",
    "product_variations",
    "return_requests",
    "guarantee_claims",
    "newsletter_subscribers",
    "stock_notifications",
  ]) {
    await page.goto("/admin/" + path);
    await expect(page.locator(".admin-content h1")).toBeVisible();
    await expect(page.locator(".admin-content .error")).toHaveCount(0);
  }
  await page.goto("/admin/faqs");
  await page.getByRole("button", { name: /Add/ }).click();
  await page.getByLabel("Question", { exact: true }).fill("Browser V2 FAQ");
  await page.getByLabel("Answer", { exact: true }).fill("Browser FAQ answer");
  await page
    .getByLabel("Translations", { exact: true })
    .fill(
      JSON.stringify({
        ar: { question: "سؤال اختبار المتصفح", answer: "إجابة الاختبار" },
      }),
    );
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(
    page.getByRole("cell", { name: "Browser V2 FAQ", exact: true }),
  ).toBeVisible();
  try {
    await page.goto("/faq");
    await page
      .getByRole("textbox", { name: "Search questions" })
      .fill("Browser V2 FAQ");
    await expect(page.locator(".faq-list summary")).toHaveText(
      "Browser V2 FAQ+",
    );
    await page.getByRole("button", { name: "العربية", exact: true }).click();
    await page
      .getByRole("textbox", { name: "ابحث في الأسئلة" })
      .fill("سؤال اختبار المتصفح");
    await expect(page.locator(".faq-list summary")).toHaveText(
      "سؤال اختبار المتصفح+",
    );
    await page.locator(".faq-list summary").click();
    await expect(page.locator(".faq-list p")).toHaveText("إجابة الاختبار");
  } finally {
    await page.evaluate(() => localStorage.setItem("gharsa_language", "en"));
    await page.goto("/admin/faqs");
    await page
      .getByRole("row")
      .filter({ hasText: "Browser V2 FAQ" })
      .getByRole("button", { name: "Delete" })
      .click();
    await page
      .getByRole("dialog", { name: "Confirm deletion" })
      .getByRole("button", { name: "Delete", exact: true })
      .click();
    await expect(
      page.getByRole("cell", { name: "Browser V2 FAQ", exact: true }),
    ).toHaveCount(0);
  }
  expect(errors).toEqual([]);
});
