import { useMemo, useState } from "react";
import { ArrowDownRight, ArrowUpRight, BarChart3, RotateCcw, ShoppingBag, TrendingUp, Undo2 } from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { dateBefore, grossProfit, mockSales, mockToday, netRevenue, type SaleRecord } from "../mocks/salesData";

type Period = "7" | "30" | "90" | "custom";
type Channel = "All" | "Online" | "In-store";
const euro = new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
const percent = (value: number) => `${value.toFixed(1)}%`;
const summarize = (rows: SaleRecord[]) => ({
  revenue: rows.reduce((sum, row) => sum + netRevenue(row), 0),
  profit: rows.reduce((sum, row) => sum + grossProfit(row), 0),
  orders: new Set(rows.map((row) => row.id)).size, // 1 sale line = 1 synthetic order in demo
  units: rows.reduce((sum, row) => sum + row.units, 0),
  returns: rows.reduce((sum, row) => sum + row.returnedUnits, 0),
});

export default function SalesPage() {
  const [period, setPeriod] = useState<Period>("30");
  const [from, setFrom] = useState(dateBefore(mockToday, 29));
  const [to, setTo] = useState(mockToday);
  const [channel, setChannel] = useState<Channel>("All");
  const [region, setRegion] = useState("All");
  const [validation, setValidation] = useState("");

  const startDate = period === "custom" ? from : dateBefore(mockToday, Number(period) - 1);
  const endDate = period === "custom" ? to : mockToday;
  const datesValid = startDate <= endDate && endDate <= mockToday && startDate >= dateBefore(mockToday, 219);
  const dayCount = datesValid
    ? Math.round((Date.parse(`${endDate}T00:00:00Z`) - Date.parse(`${startDate}T00:00:00Z`)) / 86400000) + 1
    : 0;
  const prevEnd = datesValid ? dateBefore(startDate, 1) : "";
  const prevStart = datesValid ? dateBefore(startDate, dayCount) : "";

  const matchesScope = (row: SaleRecord) =>
    (channel === "All" || row.channel === channel) && (region === "All" || row.region === region);

  const current = useMemo(() => datesValid
    ? mockSales.filter((row) => row.date >= startDate && row.date <= endDate && matchesScope(row))
    : [], [startDate, endDate, channel, region, datesValid]);
  const previous = useMemo(() => datesValid
    ? mockSales.filter((row) => row.date >= prevStart && row.date <= prevEnd && matchesScope(row))
    : [], [prevStart, prevEnd, channel, region, datesValid]);
  const totals = useMemo(() => summarize(current), [current]);
  const prior = useMemo(() => summarize(previous), [previous]);
  const change = prior.revenue ? ((totals.revenue - prior.revenue) / prior.revenue) * 100 : null;
  const returnRate = totals.units ? (totals.returns / totals.units) * 100 : 0;
  const margin = totals.revenue ? (totals.profit / totals.revenue) * 100 : 0;

  const trends = useMemo(() => {
    const grouped = new Map<string, { date: string; revenue: number; orders: number; profit: number }>();
    for (const row of current) {
      const existing = grouped.get(row.date) ?? { date: row.date, revenue: 0, orders: 0, profit: 0 };
      existing.revenue += netRevenue(row);
      existing.orders += 1;
      existing.profit += grossProfit(row);
      grouped.set(row.date, existing);
    }
    return [...grouped.values()].sort((a, b) => a.date.localeCompare(b.date));
  }, [current]);

  const categories = useMemo(() => {
    const grouped = new Map<string, { name: string; revenue: number; units: number }>();
    for (const row of current) {
      const existing = grouped.get(row.category) ?? { name: row.category, revenue: 0, units: 0 };
      existing.revenue += netRevenue(row);
      existing.units += row.units;
      grouped.set(row.category, existing);
    }
    return [...grouped.values()].sort((a, b) => b.revenue - a.revenue);
  }, [current]);

  const products = useMemo(() => {
    const grouped = new Map<string, { sku: string; name: string; revenue: number; units: number; profit: number }>();
    for (const row of current) {
      const existing = grouped.get(row.sku) ?? { sku: row.sku, name: row.productName, revenue: 0, units: 0, profit: 0 };
      existing.revenue += netRevenue(row);
      existing.units += row.units;
      existing.profit += grossProfit(row);
      grouped.set(row.sku, existing);
    }
    return [...grouped.values()].sort((a, b) => b.revenue - a.revenue);
  }, [current]);

  console.log("Order Volume Data:", trends);
  const card = "rounded-2xl border border-slate-200 bg-white p-5 shadow-sm";
  const select = "rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-amber-600";
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold tracking-[0.2em] text-amber-700">VELORA / BUSINESS INTELLIGENCE</p>
          <h1 className="mt-2 text-3xl font-bold text-slate-900">Sales Analytics</h1>
          <p className="mt-2 text-slate-500">Explore revenue, profitability, and product performance.</p>
        </div>
        <span className="rounded-full bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">Synthetic demo data</span>
      </div>

      <section className={`${card} flex flex-wrap items-end gap-3`} aria-label="Sales report filters">
        <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">Reporting period
          <select className={select} value={period} onChange={(event) => { setPeriod(event.target.value as Period); setValidation(""); }}>
            <option value="7">Last 7 days</option><option value="30">Last 30 days</option>
            <option value="90">Last 90 days</option><option value="custom">Custom dates</option>
          </select>
        </label>
        {period === "custom" && <>
          <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">From
            <input aria-label="Start date" type="date" value={from} min={dateBefore(mockToday, 219)} max={mockToday} onChange={(e) => setFrom(e.target.value)} className={select}/>
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">To
            <input aria-label="End date" type="date" value={to} min={dateBefore(mockToday, 219)} max={mockToday} onChange={(e) => setTo(e.target.value)} className={select}/>
          </label>
        </>}
        <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">Sales channel
          <select className={select} value={channel} onChange={(e) => setChannel(e.target.value as Channel)}>
            <option>All</option><option>Online</option><option>In-store</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">Region
          <select className={select} value={region} onChange={(e) => setRegion(e.target.value)}>
            <option>All</option><option>North</option><option>South</option><option>East</option><option>West</option>
          </select>
        </label>
        <button type="button" className="flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm hover:bg-slate-50" onClick={() => { setPeriod("30"); setChannel("All"); setRegion("All"); setValidation(""); }}>
          <RotateCcw size={15}/> Reset
        </button>
      </section>

      {!datesValid ? <div role="alert" className="rounded-xl bg-red-50 p-4 text-red-700">Select valid dates within the last 220 days, with the start on or before the end.</div> : null}
      {validation && <p role="alert">{validation}</p>}
      {datesValid && <>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { label: "Net Revenue", value: euro.format(totals.revenue), icon: TrendingUp, detail: change === null ? "No prior-period baseline" : `${change >= 0 ? "+" : ""}${percent(change)} vs previous period`, direction: change },
            { label: "Orders", value: totals.orders.toLocaleString(), icon: ShoppingBag, detail: `${totals.units.toLocaleString()} units sold` },
            { label: "Gross Profit", value: euro.format(totals.profit), icon: BarChart3, detail: `${percent(margin)} gross margin` },
            { label: "Return Rate", value: percent(returnRate), icon: Undo2, detail: `${totals.returns} of ${totals.units} units returned` },
          ].map(({ label, value, icon: Icon, detail, direction }) =>
            <article key={label} className={card}>
              <div className="flex items-center justify-between"><p className="text-sm text-slate-500">{label}</p><Icon size={20} className="text-amber-700"/></div>
              <p className="mt-4 text-2xl font-bold text-slate-900">{value}</p>
              <p className="mt-2 flex items-center gap-1 text-xs text-slate-500">
                {direction !== undefined && direction !== null && (direction >= 0 ? <ArrowUpRight size={14}/> : <ArrowDownRight size={14}/>)}{detail}
              </p>
            </article>
          )}
        </div>
        <div className="grid gap-5 xl:grid-cols-3">
          <section className={`${card} xl:col-span-2`}>
            <h2 className="text-lg font-semibold">Revenue Trend</h2><p className="mb-5 text-xs text-slate-500">Daily net sales in EUR · {startDate} to {endDate}</p>
            <div className="h-72"><ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trends}><CartesianGrid strokeDasharray="3 3" vertical={false}/>
                <XAxis dataKey="date" tick={{ fontSize: 10 }} minTickGap={22}/><YAxis tick={{ fontSize: 11 }} width={60}/>
                <Tooltip formatter={(value) => euro.format(Number(value ?? 0))}/>
                <Area dataKey="revenue" name="Revenue" type="monotone" fill="#e8d7b7" stroke="#af8850" strokeWidth={2}/>
              </AreaChart>
            </ResponsiveContainer></div>
          </section>
          <section className={card}>
            <h2 className="text-lg font-semibold">Category Performance</h2><p className="mb-5 text-xs text-slate-500">Net revenue by category</p>
            <div className="h-72"><ResponsiveContainer width="100%" height="100%">
              <BarChart data={categories} layout="vertical" margin={{ left: 15, right: 8 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false}/><XAxis type="number" tick={{ fontSize: 10 }}/>
                <YAxis type="category" dataKey="name" width={84} tick={{ fontSize: 11 }}/>
                <Tooltip formatter={(value) => euro.format(Number(value ?? 0))}/>
                <Bar dataKey="revenue" name="Revenue" fill="#af8850" radius={[0, 5, 5, 0]}/>
              </BarChart>
            </ResponsiveContainer></div>
          </section>
        </div>
        <div className="grid gap-5 xl:grid-cols-2">
          <section className={card}>
            <h2 className="text-lg font-semibold">Order Volume</h2><p className="mb-5 text-xs text-slate-500">Daily count of demo orders</p>
            <div className="h-72 min-w-0">
  <ResponsiveContainer width="100%" height="100%">
    <BarChart
      data={trends}
      margin={{ top: 10, right: 10, left: 0, bottom: 5 }}
    >
      <CartesianGrid strokeDasharray="3 3" vertical={false} />

      <XAxis
        dataKey="date"
        tick={{ fontSize: 10 }}
        minTickGap={20}
      />

      <YAxis
        domain={[0, "auto"]}
        allowDecimals={false}
        tick={{ fontSize: 11 }}
      />

      <Tooltip />

      <Bar
        dataKey="orders"
        name="Orders"
        fill="#B18A4A"
        radius={[5, 5, 0, 0]}
        maxBarSize={35}
        isAnimationActive={false}
      />
    </BarChart>
  </ResponsiveContainer>
</div>
          </section>
          <section className={`${card} overflow-x-auto`}>
            <h2 className="text-lg font-semibold">Best-selling Products</h2><p className="mb-4 text-xs text-slate-500">Ranked by net revenue</p>
            <table className="w-full text-left text-sm"><thead className="border-b text-xs text-slate-500"><tr><th className="py-3 pr-3">Product</th><th className="py-3 pr-3 text-right">Units</th><th className="py-3 text-right">Revenue</th></tr></thead>
              <tbody>{products.slice(0, 6).map((item) => <tr key={item.sku} className="border-b border-slate-100"><td className="py-3 pr-3"><span className="block font-medium">{item.name}</span><span className="text-xs text-slate-500">{item.sku}</span></td><td className="py-3 pr-3 text-right">{item.units}</td><td className="py-3 text-right font-medium">{euro.format(item.revenue)}</td></tr>)}</tbody>
            </table>
            {products.length === 0 && <p className="py-6 text-sm text-slate-500">No sales in this period.</p>}
          </section>
        </div>
        <p className="text-xs text-slate-500">Demo metrics: net revenue = quantity × unit price − discounts − refunded unit value; gross profit deducts cost of non-returned units. Comparisons use the immediately preceding equal-length period. These are illustrative calculations, not production accounting.</p>
      </>}
    </div>
  );
}
