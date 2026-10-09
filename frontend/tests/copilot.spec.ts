import { test, expect } from "@playwright/test";

test.describe("BizPilot AI - Copilot Tests", () => {
  test("creates and reopens a generated dashboard", async ({ page }) => {
    await page.goto("/admin");

    const input = page.getByRole("textbox", {
      name: "Ask BizPilot AI",
    });

    const send = page.getByRole("button", {
      name: "Send request",
    });

    await input.fill(
      "Create a dashboard comparing sales and stockout risks"
    );
    await send.click();

    await expect(page).toHaveURL(
      /\/admin\/reports\?view=generated-/,
      { timeout: 15000 }
    );

    await expect(
      page.getByRole("heading", {
        name: "Sales & Stockout Intelligence",
      })
    ).toBeVisible();

    await input.fill("Go to Inventory");
    await send.click();

    await expect(page).toHaveURL(
      /\/admin\/inventory$/,
      { timeout: 10000 }
    );

    await input.fill("Open Sales & Stockout Intelligence");
    await send.click();

    await expect(page).toHaveURL(
      /\/admin\/reports\?view=generated-/,
      { timeout: 10000 }
    );

    await expect(
      page.getByRole("heading", {
        name: "Sales & Stockout Intelligence",
      })
    ).toBeVisible();
  });

  test("requires approval before simulated deletion", async ({ page }) => {
    await page.goto("/admin/products");

    const input = page.getByRole("textbox", {
      name: "Ask BizPilot AI",
    });

    await input.fill("Delete product VEL-201");

    await page.getByRole("button", {
      name: "Send request",
    }).click();

    await expect(
      page.getByText("Confirmation required")
    ).toBeVisible({ timeout: 10000 });

    await page.getByRole("button", {
      name: "Approve demo",
    }).click();

    await expect(
      page.getByText(
        "Demo approval recorded. No product or supplier was deleted."
      ).first()
    ).toBeVisible();

    await expect(
      page.getByText("Signature Leather Tote")
    ).toBeVisible();
  });

  
test("cancels simulated deletion without removing the product", async ({ page }) => {
  await page.goto("/admin/products");

  const input = page.getByRole("textbox", {
    name: "Ask BizPilot AI",
  });

  await input.fill("Delete product VEL-201");

  await page.getByRole("button", {
    name: "Send request",
  }).click();

  await expect(
    page.getByText("Confirmation required")
  ).toBeVisible({ timeout: 10000 });

  await page.getByRole("button", {
    name: "Cancel",
    exact: true,
  }).click();

  await expect(
    page.getByText("Signature Leather Tote")
  ).toBeVisible();

  await expect(
    page.getByRole("button", {
      name: "Approve demo",
    })
  ).not.toBeVisible();
});

test("does not navigate when the Copilot is awaiting approval", async ({ page }) => {
  await page.goto("/admin/products");

  const input = page.getByRole("textbox", {
    name: "Ask BizPilot AI",
  });

  await input.fill("Delete product VEL-201");

  await page.getByRole("button", {
    name: "Send request",
  }).click();

  await expect(
    page.getByText("Confirmation required")
  ).toBeVisible({ timeout: 10000 });

  await expect(page).toHaveURL(/\/admin\/products$/);

  await expect(
    page.getByRole("button", {
      name: "Approve demo",
    })
  ).toBeVisible();
});

});