
import { test, expect } from "@playwright/test";

const routes = [
  "/admin",
  "/admin/products",
  "/admin/inventory",
  "/admin/sales",
  "/admin/suppliers",
  "/admin/purchase-orders",
  "/admin/replenishment",
  "/admin/reports",
];

test.describe("BizPilot AI - Responsive Smoke Tests", () => {
  for (const route of routes) {
    test(`renders ${route} on a tablet viewport`, async ({ page }) => {
      await page.setViewportSize({
        width: 1024,
        height: 768,
      });

      await page.goto(route);

      await expect(
        page.getByRole("heading", {
          name: "BizPilot Copilot",
        })
      ).toBeVisible();

      await expect(
        page.locator("body")
      ).toBeVisible();
    });
  }
});