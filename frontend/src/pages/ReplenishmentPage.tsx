import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, PackageCheck, Search, ShieldCheck } from "lucide-react";
import { replenishmentApi, type ReplenishmentApiRow } from "../api/replenishment";

const card = "rounded-2xl border border-slate-200 bg-white p-5 shadow-sm";

type Row = ReplenishmentApiRow & {
  risk: "Critical" | "At Risk" | "Covered" | "No Demand";
};

export default function ReplenishmentPage() {
  const [horizon, setHorizon] = useState(7);
  const [store, setStore] = useState("All");
  const [risk, setRisk] = useState("All");
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");

    replenishmentApi.list(horizon)
      .then((data) => {
        if (!active) return;
        setRows(data.map((r) => ({
          ...r,
          risk: r.daily_demand == null || r.daily_demand <= 0
            ? "No Demand"
            : r.available_qty <= 0
              ? "Critical"
              : r.days_of_cover != null && r.days_of_cover <= horizon
                ? "At Risk"
                : "Covered",
        })));
      })
      .catch((err: unknown) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Could not load replenishment recommendations.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => { active = false; };
  }, [horizon]);

  const visible = useMemo(() => rows.filter((r) =>
    (store === "All" || r.store_name === store) &&
    (risk === "All" || r.risk === risk) &&
    (`${r.product_name} ${r.sku}`.toLowerCase().includes(query.toLowerCase()))
  ), [rows, store, risk, query]);

  const critical = rows.filter((r) => r.risk === "Critical").length;
  const atRisk = rows.filter((r) => r.risk === "At Risk").length;
  const eligible = rows.filter((r) => (r.suggested_qty ?? 0) > 0).length;
  const stores = [...new Set(rows.map((r) => r.store_name))];

  return <div className="space-y-6">
    <div>
      <p className="text-xs font-semibold tracking-[0.2em] text-amber-700">VELORA / INVENTORY INTELLIGENCE</p>
      <h1 className="mt-2 text-3xl font-bold text-slate-900">Replenishment</h1>
      <p className="mt-2 text-slate-500">Recommendations calculated by the backend from inventory, sales, supplier lead times and incoming purchase orders.</p>
    </div>

    <div className="grid gap-4 sm:grid-cols-3">
      {[
        { label: "Out of Stock", value: critical, Icon: AlertTriangle },
        { label: `At Risk in ${horizon} Days`, value: atRisk, Icon: ShieldCheck },
        { label: "Eligible Reorder Lines", value: eligible, Icon: PackageCheck },
      ].map(({ label, value, Icon }) => <div className={card} key={label}>
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-500">{label}</p>
          <Icon size={20} className="text-amber-700" />
        </div>
        <p className="mt-4 text-3xl font-bold">{value}</p>
      </div>)}
    </div>

    <div className={`${card} flex flex-wrap items-end gap-3`}>
      <label className="flex flex-col gap-1 text-sm">Risk horizon
        <select aria-label="Risk horizon" className="rounded-lg border px-3 py-2" value={horizon} onChange={(e) => setHorizon(Number(e.target.value))}>
          <option value={7}>7 days</option><option value={14}>14 days</option><option value={30}>30 days</option>
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm">Store
        <select aria-label="Store" className="rounded-lg border px-3 py-2" value={store} onChange={(e) => setStore(e.target.value)}>
          <option>All</option>{stores.map((s) => <option key={s}>{s}</option>)}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm">Risk
        <select aria-label="Risk" className="rounded-lg border px-3 py-2" value={risk} onChange={(e) => setRisk(e.target.value)}>
          <option>All</option><option>Critical</option><option>At Risk</option><option>Covered</option><option>No Demand</option>
        </select>
      </label>
      <label className="flex flex-1 items-center gap-2 rounded-lg border px-3">
        <Search size={16} className="text-slate-400" />
        <input aria-label="Search products" className="w-full py-2 outline-none" placeholder="Search product / SKU" value={query} onChange={(e) => setQuery(e.target.value)} />
      </label>
    </div>

    {loading && <p role="status" className="text-sm text-slate-500">Loading backend recommendations…</p>}
    {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">Could not load recommendations: {error}. Check that the backend is running and accessible.</div>}

    <section className={`${card} overflow-x-auto p-0`}>
      <table className="w-full min-w-[1100px] text-left text-sm">
        <thead className="bg-slate-50 text-slate-500"><tr>
          <th className="p-4">Product / Store</th><th className="p-4">Available</th><th className="p-4">Daily Demand</th>
          <th className="p-4">Days Cover</th><th className="p-4">Risk</th><th className="p-4">Incoming</th>
          <th className="p-4">Supplier</th><th className="p-4">Lead Time</th><th className="p-4">Reorder Qty</th>
        </tr></thead>
        <tbody>
          {visible.map((r) => <tr key={`${r.sku}-${r.store_code}`} className="border-t border-slate-100">
            <td className="p-4"><p className="font-medium">{r.product_name}</p><p className="text-xs text-slate-500">{r.sku} · {r.store_name}</p></td>
            <td className="p-4">{r.available_qty}</td>
            <td className="p-4">{r.daily_demand == null ? "—" : r.daily_demand.toFixed(2)}</td>
            <td className="p-4">{r.days_of_cover == null ? "—" : r.days_of_cover.toFixed(1)}</td>
            <td className="p-4"><span className={`rounded-full px-2 py-1 text-xs ${r.risk === "Critical" ? "bg-red-50 text-red-700" : r.risk === "At Risk" ? "bg-amber-50 text-amber-800" : "bg-emerald-50 text-emerald-700"}`}>{r.risk}</span></td>
            <td className="p-4">{r.confirmed_inbound_qty}</td>
            <td className="p-4">{r.supplier_name ?? "No active supplier"}</td>
            <td className="p-4">{r.lead_time_days == null ? "—" : `${r.lead_time_days} days`}</td>
            <td className="p-4 font-semibold">{r.suggested_qty == null ? "Needs sales history" : r.suggested_qty}</td>
          </tr>)}
          {!loading && !error && visible.length === 0 && <tr><td colSpan={9} className="p-8 text-center text-slate-500">No recommendations match these filters.</td></tr>}
        </tbody>
      </table>
    </section>

    <p className="text-xs text-slate-500">Recommendations use completed sales, available inventory, incoming purchase orders, supplier lead time and safety-stock days. A missing sales history is shown as unavailable rather than guessing a reorder quantity. Recommendations are not purchase orders and do not submit orders automatically.</p>
  </div>;
}
