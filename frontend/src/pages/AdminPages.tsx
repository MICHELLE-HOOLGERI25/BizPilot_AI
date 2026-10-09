import type { ReactNode } from "react";

type PageProps = {
  title: string;
  description: string;
  children?: ReactNode;
};

function Page({ title, description, children }: PageProps) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">
          {title}
        </h1>
        <p className="mt-2 text-slate-500">{description}</p>
      </div>

      {children ?? (
        <div className="rounded-xl border border-slate-200 bg-white p-8">
          <p className="text-slate-500">
            This module is ready for implementation.
          </p>
        </div>
      )}
    </div>
  );
}

export function DashboardPage() {
  return (
    <Page
      title="Executive Dashboard"
      description="An exclusive overview of Velora's retail performance and business insights."
    />
  );
}

export function ProductsPage() {
  return (
    <Page
      title="Products"
      description="Manage product information, pricing and categories."
    />
  );
}

export function InventoryPage() {
  return (
    <Page
      title="Inventory"
      description="Monitor stock availability across locations."
    />
  );
}

export function SalesPage() {
  return (
    <Page
      title="Sales Analytics"
      description="Explore revenue, orders and sales trends."
    />
  );
}

export function SuppliersPage() {
  return (
    <Page
      title="Suppliers"
      description="Manage suppliers and delivery performance."
    />
  );
}

export function PurchaseOrdersPage() {
  return (
    <Page
      title="Purchase Orders"
      description="Review and manage purchasing workflows."
    />
  );
}

export function ReplenishmentPage() {
  return (
    <Page
      title="Replenishment"
      description="Identify stockout risks and replenishment needs."
    />
  );
}

export function ReportsPage() {
  return (
    <Page
      title="Reports & Dynamic Views"
      description="Explore saved reports and AI-generated dashboards."
    />
  );
}