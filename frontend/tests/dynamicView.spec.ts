
import { test, expect } from "@playwright/test";

import {
  validateDynamicView,
  type DynamicView,
} from "../src/types/dynamicView";

const validReport: DynamicView = {
  id: "test-report-001",
  title: "Sales Performance Report",
  description: "Automated validation test report",
  source: "demo",
  createdAt: "2026-10-09T10:00:00Z",
  widgets: [
    {
      id: "revenue-kpi",
      type: "kpi",
      title: "Total Revenue",
      value: 125000,
      format: "currency",
    },
    {
      id: "revenue-chart",
      type: "bar",
      title: "Monthly Revenue",
      xKey: "month",
      yKey: "revenue",
      data: [
        { month: "January", revenue: 25000 },
        { month: "February", revenue: 30000 },
        { month: "March", revenue: 35000 },
      ],
      format: "currency",
    },
    {
      id: "inventory-table",
      type: "table",
      title: "Inventory Overview",
      columns: [
        { key: "sku", label: "SKU" },
        { key: "stock", label: "Stock" },
      ],
      rows: [
        { sku: "VEL-201", stock: 25 },
        { sku: "VEL-305", stock: 40 },
      ],
    },
  ],
};

test.describe("BizPilot AI - Dynamic Report Validation", () => {
  test("accepts a valid report with KPI, chart and table", () => {
    expect(validateDynamicView(validReport)).toBe(true);
  });

  test("rejects unsupported widget types", () => {
    const invalidReport = {
      ...validReport,
      widgets: [
        {
          id: "unsafe-widget",
          type: "custom-html",
          title: "Unsafe HTML",
          html: "<script>alert('unsafe')</script>",
        },
      ],
    };

    expect(validateDynamicView(invalidReport)).toBe(false);
  });

  test("rejects reports with missing required fields", () => {
    const invalidReport = {
      title: "Missing Fields Report",
      widgets: [],
    };

    expect(validateDynamicView(invalidReport)).toBe(false);
  });

  test("rejects a KPI containing an invalid value", () => {
    const invalidReport = {
      ...validReport,
      widgets: [
        {
          id: "invalid-kpi",
          type: "kpi",
          title: "Invalid Revenue",
          value: "not-a-number",
        },
      ],
    };

    expect(validateDynamicView(invalidReport)).toBe(false);
  });

  test("rejects reports exceeding the widget limit", () => {
    const widgets = Array.from(
      { length: 21 },
      (_, index) => ({
        id: `kpi-${index}`,
        type: "kpi",
        title: `KPI ${index}`,
        value: index,
      })
    );

    expect(
      validateDynamicView({
        ...validReport,
        widgets,
      })
    ).toBe(false);
  });

  test("rejects charts with invalid numeric data", () => {
    const invalidReport = {
      ...validReport,
      widgets: [
        {
          id: "invalid-chart",
          type: "line",
          title: "Revenue Trend",
          xKey: "month",
          yKey: "revenue",
          data: [
            { month: "January", revenue: "incorrect" },
          ],
        },
      ],
    };

    expect(validateDynamicView(invalidReport)).toBe(false);
  });
});
