import { test, expect } from "@playwright/test";

test("Products page displays the correct catalogue", async ({ page }) => {
  await page.goto("/admin/products");

  await expect(
    page.getByText("Signature Leather Tote")
  ).toBeVisible();

  await expect(
    page.getByText("Velora Eau de Parfum")
  ).toBeVisible();

  await expect(
    page.getByText("Cashmere Wrap")
  ).toBeVisible();
});

test("Products search filters by SKU", async ({ page }) => {
  await page.goto("/admin/products");

  await page
    .getByPlaceholder("Search products or SKU...")
    .fill("VEL-201");

  await expect(
    page.getByText("Signature Leather Tote")
  ).toBeVisible();

  await expect(
    page.getByText("Cashmere Wrap")
  ).not.toBeVisible();
});