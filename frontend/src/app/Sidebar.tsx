import { NavLink } from "react-router-dom";

import {
  LayoutDashboard,
  Package,
  Boxes,
  ChartNoAxesCombined,
  Truck,
  ClipboardList,
  RefreshCcw,
  FileBarChart,
  BrainCircuit,
} from "lucide-react";

const navigation = [
  { label: "Dashboard", path: "/admin", icon: LayoutDashboard },
  { label: "Products", path: "/admin/products", icon: Package },
  { label: "Inventory", path: "/admin/inventory", icon: Boxes },
  { label: "Sales Analytics", path: "/admin/sales", icon: ChartNoAxesCombined },
  { label: "Suppliers", path: "/admin/suppliers", icon: Truck },
  { label: "Purchase Orders", path: "/admin/purchase-orders", icon: ClipboardList },
  { label: "Replenishment", path: "/admin/replenishment", icon: RefreshCcw },
  { label: "Reports & Views", path: "/admin/reports", icon: FileBarChart },
];

export default function Sidebar() {
  return (
    <aside className="sticky top-0 flex h-screen w-64 shrink-0 flex-col bg-slate-950 text-white">
      <div className="flex items-center gap-3 border-b border-slate-800 px-6 py-6">
        <div className="rounded-lg bg-blue-600 p-2">
          <BrainCircuit size={24} />
        </div>
        <div>
          <h1 className="text-xl font-bold">BizPilot AI</h1>
          <p className="text-xs tracking-widest text-amber-300">
             VELORA ADMIN
          </p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto p-4">
        {navigation.map(({ label, path, icon: Icon }) => (
          <NavLink
            key={path}
            to={path}
            end={path === "/admin"}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-lg px-4 py-3 text-sm transition-colors ${
                isActive
                  ? "bg-blue-600 font-semibold text-white"
                  : "text-slate-300 hover:bg-slate-800 hover:text-white"
              }`
            }
          >
            <Icon size={19} />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-slate-800 p-4 text-xs text-slate-400">
        BizPilot AI — Development
      </div>
    </aside>
  );
}