
import { useState } from "react";
import {
  TrendingUp,
  ShoppingBag,
  Wallet,
  AlertTriangle,
  ArrowUpRight,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  BarChart,
  Bar,
} from "recharts";

import {
  dashboardMockData,
  recentOrders,
  inventoryAlerts,
  type DashboardPeriod,
} from "../mocks/dashboardData";

const euro = new Intl.NumberFormat("en-IE", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

function MetricCard({
  title,
  value,
  icon: Icon,
}: {
  title: string;
  value: string;
  icon: typeof Wallet;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm font-medium text-slate-500">
          {title}
        </p>
        <div className="rounded-xl bg-amber-50 p-2 text-amber-700">
          <Icon size={20} />
        </div>
      </div>
      <h3 className="text-2xl font-bold text-slate-900">
        {value}
      </h3>
    </div>
  );
}

export default function DashboardPage() {
  const [period, setPeriod] =
    useState<DashboardPeriod>("30d");

  const data = dashboardMockData[period];

  const metrics = [
    {
      title: "Total Revenue",
      value: euro.format(data.revenue),
      icon: Wallet,
    },
    {
      title: "Total Orders",
      value: data.orders.toLocaleString(),
      icon: ShoppingBag,
    },
    {
      title: "Gross Profit",
      value: euro.format(data.grossProfit),
      icon: TrendingUp,
    },
    {
      title: "Low Stock Products",
      value: String(data.lowStockCount),
      icon: AlertTriangle,
    },
  ];

  return (
    <div className="space-y-7">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold tracking-[0.2em] text-amber-700">
            VELORA / BUSINESS INTELLIGENCE
          </p>
          <h1 className="mt-2 text-3xl font-bold text-slate-900">
            Executive Dashboard
          </h1>
          <p className="mt-2 text-slate-500">
            Your business performance at a glance.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <span className="rounded-full bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
            Demo Data
          </span>
          <select
            aria-label="Reporting period"
            value={period}
            onChange={(event) =>
              setPeriod(
                event.target.value as DashboardPeriod
              )
            }
            className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium"
          >
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
            <option value="90d">Last 90 Days</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => (
          <MetricCard key={metric.title} {...metric} />
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm xl:col-span-2">
          <div className="mb-6">
            <h2 className="text-lg font-semibold">
              Revenue Overview
            </h2>
            <p className="text-sm text-slate-500">
              Revenue across your selected reporting period
            </p>
          </div>

          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.salesTrend}>
                <defs>
                  <linearGradient
                    id="revenueFill"
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop
                      offset="5%"
                      stopColor="#c5a46d"
                      stopOpacity={0.3}
                    />
                    <stop
                      offset="95%"
                      stopColor="#c5a46d"
                      stopOpacity={0}
                    />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 12 }}
                />
                <YAxis
                  tick={{ fontSize: 12 }}
                />
                <Tooltip
                  formatter={(value) =>
                    euro.format(Number(value ?? 0))
                  }
                />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="#b18a4a"
                  strokeWidth={3}
                  fill="url(#revenueFill)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold">
            Sales by Category
          </h2>
          <p className="mb-6 text-sm text-slate-500">
            Category revenue breakdown
          </p>

          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={data.categories}
                layout="vertical"
                margin={{ left: 18, right: 12 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  horizontal={false}
                />
                <XAxis type="number" hide />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={85}
                  tick={{ fontSize: 12 }}
                />
                <Tooltip
                  formatter={(value) =>
                    euro.format(Number(value ?? 0))
                  }
                />
                <Bar
                  dataKey="revenue"
                  fill="#c5a46d"
                  radius={[0, 6, 6, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 p-5">
            <h2 className="text-lg font-semibold">
              Recent Orders
            </h2>
            <ArrowUpRight size={19} className="text-slate-400" />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="p-4">Order</th>
                  <th className="p-4">Customer</th>
                  <th className="p-4">Amount</th>
                  <th className="p-4">Status</th>
                </tr>
              </thead>
              <tbody>
                {recentOrders.map((order) => (
                  <tr
                    key={order.id}
                    className="border-t border-slate-100"
                  >
                    <td className="p-4 font-medium">
                      {order.id}
                    </td>
                    <td className="p-4">{order.customer}</td>
                    <td className="p-4">
                      {euro.format(order.total)}
                    </td>
                    <td className="p-4">
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium">
                        {order.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center gap-2 border-b border-slate-100 p-5">
            <AlertTriangle size={19} className="text-amber-600" />
            <h2 className="text-lg font-semibold">
              Inventory Alerts
            </h2>
          </div>

          <div className="divide-y divide-slate-100">
            {inventoryAlerts.map((item) => (
              <div
                key={item.sku}
                className="flex items-center justify-between gap-3 p-5"
              >
                <div>
                  <p className="font-medium text-slate-900">
                    {item.product}
                  </p>
                  <p className="text-xs text-slate-500">
                    {item.sku} · Reorder at {item.reorderPoint}
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-amber-50 px-3 py-1 text-sm font-semibold text-amber-800">
                  {item.available} left
                </span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
