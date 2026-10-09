import { test, expect } from "@playwright/test";

test.describe("BizPilot AI - Navigation Tests", () => {

  test("opens the Dashboard", async ({ page }) => {
    await page.goto("/admin");

    await expect(page).toHaveURL(/\/admin\/?$/);

    await expect(
      page.getByRole("link", { name: "Dashboard" })
    ).toBeVisible();
  });

  test("opens the Products page", async ({ page }) => {
    await page.goto("/admin");

    await page
      .getByRole("link", { name: "Products" })
      .click();

    await expect(page).toHaveURL(/\/admin\/products$/);
  });

  test("opens Inventory using the Copilot", async ({ page }) => {
    await page.goto("/admin");

    await page
      .getByRole("textbox", { name: "Ask BizPilot AI" })
      .fill("Open Inventory");

    await page
      .getByRole("button", { name: "Send request" })
      .click();

    await expect(page).toHaveURL(
      /\/admin\/inventory$/,
      { timeout: 10000 }
    );
  });

  test("opens Reports using the Copilot", async ({ page }) => {
    await page.goto("/admin");

    await page
      .getByRole("textbox", { name: "Ask BizPilot AI" })
      .fill("reports");

    await page
      .getByRole("button", { name: "Send request" })
      .click();

    await expect(page).toHaveURL(
      /\/admin\/reports$/,
      { timeout: 10000 }
    );
  });

  test("opens Purchase Orders", async ({ page }) => {
    await page.goto("/admin");

    await page
      .getByRole("link", { name: "Purchase Orders" })
      .click();

    await expect(page).toHaveURL(
      /\/admin\/purchase-orders$/
    );
  });

});