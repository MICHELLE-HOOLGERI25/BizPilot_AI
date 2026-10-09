
import {
  generateDemoReport,
  saveGeneratedReport,
  readGeneratedReports,
} from "./generatedReports";

import { validateDynamicView } from "../types/dynamicView";

import type {
  AgentRequest,
  AgentTask,
  NavigationInstruction,
  PlanStep,
} from "../types/agent";

// -----------------------------------------------------
// Helpers
// -----------------------------------------------------

const pause = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

const now = () => new Date().toISOString();

const SAVED_REPORTS_KEY = "velora_demo_saved_reports_v1";

// -----------------------------------------------------
// Allowed navigation routes
// -----------------------------------------------------

export const ADMIN_ROUTES = {
  dashboard: "/admin",
  products: "/admin/products",
  inventory: "/admin/inventory",
  sales: "/admin/sales",
  suppliers: "/admin/suppliers",
  purchaseOrders: "/admin/purchase-orders",
  replenishment: "/admin/replenishment",
  reports: "/admin/reports",
} as const;

export const ALLOWED_ROUTES = Object.values(ADMIN_ROUTES);

// -----------------------------------------------------
// Safe navigation validation
// -----------------------------------------------------

export function validNavigation(
  value: NavigationInstruction | undefined
): string | null {
  
  if (
    !value ||
    !ALLOWED_ROUTES.some((route) => route === value.route)
  ) {
    return null;
  }


  const allowedFilters = new Set([
    "sku",
    "category",
    "status",
    "store",
    "region",
    "view",
  ]);

  const params = new URLSearchParams();

  for (const [key, val] of Object.entries(
    value.filters ?? {}
  )) {
    if (
      !allowedFilters.has(key) ||
      typeof val !== "string" ||
      val.length > 80
    ) {
      return null;
    }

    // A specific report ID must only be used on Reports.
    if (
      key === "view" &&
      value.route !== ADMIN_ROUTES.reports
    ) {
      return null;
    }

    params.set(key, val);
  }

  return (
    value.route +
    (params.size ? `?${params.toString()}` : "")
  );
}

// -----------------------------------------------------
// Detect explicit navigation commands
// -----------------------------------------------------

export function detectNavigationRoute(
  message: string
): string | null {
  const text = message
    .trim()
    .toLowerCase()
    .replace(/[.!?]+$/, "");

  const match = text.match(
    /^(open|show|go to|navigate to|take me to|switch to|view)\s+(.+)$/i
  );

  if (!match) return null;

  const target = match[2]
    .replace(/^the\s+/, "")
    .replace(/\s+(page|section|screen|tab)$/, "")
    .trim();

  const routeNames: Record<string, string> = {
    dashboard: ADMIN_ROUTES.dashboard,
    "executive dashboard": ADMIN_ROUTES.dashboard,
    home: ADMIN_ROUTES.dashboard,
    overview: ADMIN_ROUTES.dashboard,

    inventory: ADMIN_ROUTES.inventory,
    "inventory management": ADMIN_ROUTES.inventory,

    products: ADMIN_ROUTES.products,
    product: ADMIN_ROUTES.products,
    "product management": ADMIN_ROUTES.products,
    "products management": ADMIN_ROUTES.products,
    "product catalogue": ADMIN_ROUTES.products,

    sales: ADMIN_ROUTES.sales,
    "sales analytics": ADMIN_ROUTES.sales,

    suppliers: ADMIN_ROUTES.suppliers,
    supplier: ADMIN_ROUTES.suppliers,
    "supplier management": ADMIN_ROUTES.suppliers,

    "purchase orders": ADMIN_ROUTES.purchaseOrders,
    "purchase order": ADMIN_ROUTES.purchaseOrders,
    purchasing: ADMIN_ROUTES.purchaseOrders,
    procurement: ADMIN_ROUTES.purchaseOrders,

    replenishment: ADMIN_ROUTES.replenishment,
    "stock replenishment": ADMIN_ROUTES.replenishment,

    reports: ADMIN_ROUTES.reports,
    report: ADMIN_ROUTES.reports,
    "reports and views": ADMIN_ROUTES.reports,
    "reports & views": ADMIN_ROUTES.reports,
    "dynamic views": ADMIN_ROUTES.reports,
  };

  return routeNames[target] ?? null;
}

// -----------------------------------------------------
// Find generated or browser-saved reports by title
// -----------------------------------------------------

function findSavedReportByName(
  message: string
): { id: string; title: string } | null {
  const requested = message
    .toLowerCase()
    .trim()
    .replace(
      /^(open|show|view|go to|navigate to|take me to|switch to)\s+/,
      ""
    )
    .replace(/^the\s+/, "")
    .replace(/[.!?]+$/, "")
    .trim();

  if (!requested) return null;

  const generated = readGeneratedReports();

  let saved: typeof generated = [];

  try {
    const raw = localStorage.getItem(SAVED_REPORTS_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];

    if (Array.isArray(parsed)) {
      saved = parsed.filter(validateDynamicView);
    }
  } catch {
    saved = [];
  }

  const reports = [...generated, ...saved].reverse();

  const match = reports.find((report) => {
    const title = report.title.toLowerCase().trim();

    return (
      requested === title ||
      requested === `${title} report` ||
      requested === `${title} dashboard` ||
      requested === `${title} page`
    );
  });

  return match
    ? { id: match.id, title: match.title }
    : null;
}

// -----------------------------------------------------
// Page names
// -----------------------------------------------------

function getPageName(route: string): string {
  const names: Record<string, string> = {
    "/admin": "Executive Dashboard",
    "/admin/products": "Products Management",
    "/admin/inventory": "Inventory Management",
    "/admin/sales": "Sales Analytics",
    "/admin/suppliers": "Suppliers Management",
    "/admin/purchase-orders": "Purchase Orders",
    "/admin/replenishment": "Replenishment",
    "/admin/reports": "Reports & Dynamic Views",
  };

  return names[route] ?? "Dashboard";
}

// -----------------------------------------------------
// Task plan helper
// -----------------------------------------------------

function makeStep(
  step_id: string,
  description: string,
  tool_id?: string
): PlanStep {
  return {
    step_id,
    description,
    tool_id,
    status: "pending",
  };
}

// -----------------------------------------------------
// Create mock agent task
// -----------------------------------------------------

export function initialMockTask(
  req: AgentRequest
): AgentTask {
  const message = req.message.toLowerCase().trim();

  // Detect destructive actions.
  const deleteIntent =
    /\b(delete|remove|erase)\b/.test(message);

  // Detect creation of a dashboard/report.
  const createReport =
    !deleteIntent &&
    /\b(create|generate|build|make|design)\b/.test(message) &&
    /\b(reports?|dashboards?|charts?|visuali[sz]ations?)\b/.test(
      message
    );

  // Explicit navigation to one of the eight pages.
  const explicitRoute =
    !deleteIntent && !createReport
      ? detectNavigationRoute(req.message)
      : null;

  // Look up a previously generated or saved dashboard.
  const selectedReport =
    !deleteIntent && !createReport && !explicitRoute
      ? findSavedReportByName(req.message)
      : null;

  // General business intent matching.
  const reportIntent =
    /\b(reports?|dashboards?|charts?|visuali[sz]e|visuali[sz]ations?)\b/.test(
      message
    );

  const replenishmentIntent =
    /\b(replenish|replenishment|reorder|stockout|out.of.stock|running out)\b/.test(
      message
    );

  const inventoryIntent =
    /\b(inventory|stock|warehouse|stock levels|stock quantity)\b/.test(
      message
    );

  const purchaseOrderIntent =
    /\b(purchase orders?|procurement|purchasing)\b/.test(
      message
    );

  const supplierIntent =
    /\b(suppliers?|vendors?)\b/.test(message);

  const salesIntent =
    /\b(sales|revenue|profit|orders sold)\b/.test(
      message
    );

  const productIntent =
    /\b(products?|sku|price|catalogue)\b/.test(
      message
    );

  // ---------------------------------------------------
  // Select destination
  // ---------------------------------------------------

  let route: string = ADMIN_ROUTES.dashboard;

  if (explicitRoute) {
    route = explicitRoute;
  } else if (selectedReport) {
    route = ADMIN_ROUTES.reports;
  } else if (createReport || reportIntent) {
    route = ADMIN_ROUTES.reports;
  } else if (replenishmentIntent) {
    route = ADMIN_ROUTES.replenishment;
  } else if (inventoryIntent) {
    route = ADMIN_ROUTES.inventory;
  } else if (purchaseOrderIntent) {
    route = ADMIN_ROUTES.purchaseOrders;
  } else if (supplierIntent) {
    route = ADMIN_ROUTES.suppliers;
  } else if (salesIntent) {
    route = ADMIN_ROUTES.sales;
  } else if (productIntent) {
    route = ADMIN_ROUTES.products;
  }

  const pageName = getPageName(route);

  // ---------------------------------------------------
  // Prepare navigation instruction
  // ---------------------------------------------------

  const navigation_instruction: NavigationInstruction = {
    route,
    ...(selectedReport
      ? {
          filters: {
            view: selectedReport.id,
          },
        }
      : {}),
  };

  // ---------------------------------------------------
  // Plan
  // ---------------------------------------------------

  const plan: PlanStep[] = [
    makeStep(
      "classify",
      "Understand the request"
    ),

    makeStep(
      "retrieve",
      "Find registered capabilities",
      "metadata.search"
    ),

    makeStep(
      "execute",
      deleteIntent
        ? "Prepare a confirmation request"
        : createReport
          ? "Compose validated demo report"
          : selectedReport
            ? `Open ${selectedReport.title}`
            : `Open ${pageName}`,
      deleteIntent
        ? "products.delete.request"
        : createReport
          ? "reports.generate.demo"
          : "ui.navigate"
    ),

    makeStep(
      "verify",
      "Report outcome"
    ),
  ];

  // ---------------------------------------------------
  // Demo approval
  // ---------------------------------------------------

  const approval = deleteIntent
    ? {
        approval_id: crypto.randomUUID(),
        operation: "delete (demo only)",
        target_summary: req.message,
        impact_summary:
          "No backend changes will occur. This only simulates an approval workflow.",
        expires_at: new Date(
          Date.now() + 5 * 60_000
        ).toISOString(),
        status: "pending" as const,
      }
    : undefined;

  // ---------------------------------------------------
  // Response summary
  // ---------------------------------------------------

  let summary: string;

  if (deleteIntent) {
    summary =
      "Approval needed for a simulated destructive action.";
  } else if (createReport) {
    summary =
      "Preparing a new dynamic dashboard using demo data.";
  } else if (selectedReport) {
    summary = `Opened ${selectedReport.title}.`;
  } else if (explicitRoute) {
    summary = `Opened ${pageName}.`;
  } else {
    summary = `Opened ${pageName} based on your request.`;
  }

  return {
    task_id: crypto.randomUUID(),
    status: "pending",
    created_at: now(),
    updated_at: now(),
    plan,
    evidence: [],
    pending_approval: approval,

    result: {
      status: deleteIntent
        ? "awaiting_approval"
        : "completed",

      summary,

      findings: [
        "This is a mock response, not a real AI or database query.",
      ],

      evidence: [],

      navigation_instruction: deleteIntent
        ? undefined
        : navigation_instruction,

      partial_failures: [],
    },
  };
}

// -----------------------------------------------------
// Execute simulated task
// -----------------------------------------------------

export async function runMockTask(
  req: AgentRequest,
  onUpdate: (task: AgentTask) => void
): Promise<AgentTask> {
  let task = initialMockTask(req);

  const emit = () =>
    onUpdate({
      ...task,
      plan: task.plan.map((step) => ({ ...step })),
    });

  task = {
    ...task,
    status: "running",
  };

  emit();

  // Simulate task execution.
  for (let i = 0; i < task.plan.length; i++) {
    if (i === 3 && task.pending_approval) {
      break;
    }

    task = {
      ...task,
      updated_at: now(),
      plan: task.plan.map((step, index) =>
        index === i
          ? { ...step, status: "running" }
          : step
      ),
    };

    emit();

    await pause(350);

    task = {
      ...task,
      updated_at: now(),
      plan: task.plan.map((step, index) =>
        index === i
          ? {
              ...step,
              status: "completed",
              safe_result_summary:
                "Simulated step complete",
            }
          : step
      ),
    };

    emit();
  }

  // ---------------------------------------------------
  // Generate new demo report
  // ---------------------------------------------------

  const isReportCreation =
    /\b(create|generate|build|make|design)\b/i.test(
      req.message
    ) &&
    /\b(reports?|dashboards?|charts?|visuali[sz]ations?)\b/i.test(
      req.message
    );

  if (!task.pending_approval && isReportCreation) {
    try {
      const view = generateDemoReport(req.message);

      saveGeneratedReport(view);

      task = {
        ...task,

        result: {
          status: "completed",

          summary:
            `Created a new mock dashboard: ${view.title}. ` +
            `Opening the generated report.`,

          findings: [
            "The report was composed from existing local mock data.",
            "No LLM, backend calls, or live analytics were used.",
          ],

          evidence: [],

          navigation_instruction: {
            route: ADMIN_ROUTES.reports,
            filters: {
              view: view.id,
            },
          },

          partial_failures: [],
        },
      };
    } catch (err) {
      task = {
        ...task,
        status: "failed",

        result: {
          status: "failed",

          summary:
            "Could not build a valid demo report: " +
            (err instanceof Error
              ? err.message
              : "unknown error"),

          findings: [],
          evidence: [],
          partial_failures: [],
        },
      };

      emit();
      return task;
    }
  }

  // ---------------------------------------------------
  // Final task status
  // ---------------------------------------------------

  task = {
    ...task,

    status: task.pending_approval
      ? "awaiting_approval"
      : task.status === "failed"
        ? "failed"
        : "completed",

    updated_at: now(),
  };

  emit();

  return task;
}

// -----------------------------------------------------
// Resolve simulated approval
// -----------------------------------------------------

export function resolveMockApproval(
  task: AgentTask,
  approve: boolean
): AgentTask {
  if (
    task.status !== "awaiting_approval" ||
    !task.pending_approval
  ) {
    return task;
  }

  const expired =
    Date.now() >
    Date.parse(task.pending_approval.expires_at);

  const accepted = approve && !expired;

  return {
    ...task,

    status: accepted
      ? "completed"
      : "cancelled",

    updated_at: now(),

    pending_approval: {
      ...task.pending_approval,

      status: expired
        ? "expired"
        : approve
          ? "approved"
          : "cancelled",
    },

    plan: task.plan.map((step) =>
      step.status === "pending"
        ? {
            ...step,
            status: accepted
              ? "completed"
              : "blocked",
          }
        : step
    ),

    result: {
      status: accepted
        ? "completed"
        : "cancelled",

      summary: accepted
        ? "Demo approval recorded. No product or supplier was deleted."
        : "Request cancelled. No changes were made.",

      findings: [
        "Backend authorization and one-time confirmation must be implemented by Person 2.",
      ],

      evidence: [],
      partial_failures: [],
    },
  };
}
