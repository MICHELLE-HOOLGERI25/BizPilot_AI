import {
  createBrowserRouter,
  Navigate,
} from "react-router-dom";

import AppShell from "./AppShell";

import DashboardPage from "../pages/DashboardPage";
import ProductsPage from "../pages/ProductsPage";
import InventoryPage from "../pages/InventoryPage";
import SalesPage from "../pages/SalesPage";
import SuppliersPage from "../pages/SuppliersPage";
import PurchaseOrdersPage from "../pages/PurchaseOrdersPage";
import ReplenishmentPage from "../pages/ReplenishmentPage";
import ReportsPage from "../pages/ReportsPage";



export const router = createBrowserRouter([
  {
    path: "/",
    element: <Navigate to="/admin" replace />,
  },
  {
    path: "/admin",
    element: <AppShell />,
    children: [
      { index: true, element: <DashboardPage /> },
      { path: "products", element: <ProductsPage /> },
      { path: "inventory", element: <InventoryPage /> },
      { path: "sales", element: <SalesPage /> },
      { path: "suppliers", element: <SuppliersPage /> },
      { path: "purchase-orders", element: <PurchaseOrdersPage /> },
      { path: "replenishment", element: <ReplenishmentPage /> },
      { path: "reports", element: <ReportsPage /> },
    ],
  },
]);