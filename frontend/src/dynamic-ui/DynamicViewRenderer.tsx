
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import {
  validateDynamicView,
  type DynamicView,
} from "../types/dynamicView";

const euro = new Intl.NumberFormat("en-IE", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

function formatValue(value: number, format?: string) {
  if (format === "currency") {
    return euro.format(value);
  }

  if (format === "percent") {
    return `${value.toFixed(1)}%`;
  }

  return value.toLocaleString("en-IE");
}

export default function DynamicViewRenderer({
  view,
}: {
  view: unknown;
}) {
  // Treat report specifications as untrusted input.
  // Only validated widgets are allowed to render.
  if (!validateDynamicView(view)) {
    return (
      <div
        role="alert"
        className="rounded-xl border border-red-200 bg-red-50 p-5 text-red-700"
      >
        Unsupported or invalid report specification.
        Nothing was rendered.
      </div>
    );
  }

  const report: DynamicView = view;

  const kpiWidgets = report.widgets.filter(
    (widget) => widget.type === "kpi"
  );

  const contentWidgets = report.widgets.filter(
    (widget) => widget.type !== "kpi"
  );

  return (
    <div className="min-w-0 space-y-5">

      {/* KPI CARDS */}
      {kpiWidgets.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {kpiWidgets.map(
            (widget) =>
              widget.type === "kpi" && (
                <section
                  key={widget.id}
                  className="min-w-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
                >
                  <p className="text-sm font-medium text-slate-500">
                    {widget.title}
                  </p>

                  <p className="mt-3 text-3xl font-bold text-slate-950">
                    {formatValue(
                      widget.value,
                      widget.format
                    )}
                  </p>

                  {widget.description && (
                    <p className="mt-2 text-xs text-slate-500">
                      {widget.description}
                    </p>
                  )}
                </section>
              )
          )}
        </div>
      )}

      {/* CHARTS AND TABLES */}
      <div className="grid min-w-0 grid-cols-1 gap-5 xl:grid-cols-2">
        {contentWidgets.map((widget) => (
          <section
            key={widget.id}
            className="min-w-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
          >
            <h3 className="mb-5 text-lg font-semibold text-slate-900">
              {widget.title}
            </h3>

            {/* BAR AND LINE CHARTS */}
            {(widget.type === "bar" ||
              widget.type === "line") && (
              <div className="h-72 min-w-0 w-full">
                <ResponsiveContainer
                  width="100%"
                  height="100%"
                >
                  {widget.type === "bar" ? (
                    <BarChart
                      data={widget.data}
                      margin={{
                        top: 10,
                        right: 12,
                        left: 0,
                        bottom: 5,
                      }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        vertical={false}
                      />

                      <XAxis
                        dataKey={widget.xKey}
                        tick={{ fontSize: 11 }}
                        minTickGap={15}
                      />

                      <YAxis
                        tick={{ fontSize: 11 }}
                        width={65}
                      />

                      <Tooltip
                        formatter={(value) =>
                          formatValue(
                            Number(value ?? 0),
                            widget.format
                          )
                        }
                      />

                      <Bar
                        dataKey={widget.yKey}
                        name={widget.title}
                        fill="#b18a4a"
                        radius={[5, 5, 0, 0]}
                        maxBarSize={55}
                      />
                    </BarChart>
                  ) : (
                    <LineChart
                      data={widget.data}
                      margin={{
                        top: 10,
                        right: 12,
                        left: 0,
                        bottom: 5,
                      }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        vertical={false}
                      />

                      <XAxis
                        dataKey={widget.xKey}
                        tick={{ fontSize: 11 }}
                        minTickGap={15}
                      />

                      <YAxis
                        tick={{ fontSize: 11 }}
                        width={65}
                      />

                      <Tooltip
                        formatter={(value) =>
                          formatValue(
                            Number(value ?? 0),
                            widget.format
                          )
                        }
                      />

                      <Line
                        type="monotone"
                        dataKey={widget.yKey}
                        name={widget.title}
                        stroke="#b18a4a"
                        strokeWidth={3}
                        dot={{ r: 3 }}
                        activeDot={{ r: 6 }}
                      />
                    </LineChart>
                  )}
                </ResponsiveContainer>
              </div>
            )}

            {/* DYNAMIC TABLE */}
            {widget.type === "table" && (
              <div
                className="w-full max-w-full overflow-x-auto rounded-lg border border-slate-100"
                role="region"
                aria-label={`${widget.title} table`}
                tabIndex={0}
              >
                <table className="w-full min-w-max border-collapse text-left text-sm">
                  <thead className="border-b border-slate-200 bg-slate-50">
                    <tr>
                      {widget.columns.map((column) => (
                        <th
                          key={column.key}
                          scope="col"
                          className="min-w-28 whitespace-nowrap px-4 py-3 text-xs font-semibold text-slate-600"
                        >
                          {column.label}
                        </th>
                      ))}
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-100">
                    {widget.rows.map((row, index) => (
                      <tr
                        key={index}
                        className="transition-colors hover:bg-slate-50"
                      >
                        {widget.columns.map((column) => (
                          <td
                            key={column.key}
                            className="min-w-28 max-w-60 px-4 py-3 align-middle text-sm text-slate-700"
                          >
                            <div className="break-words">
                              {row[column.key] ?? "—"}
                            </div>
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>

                {widget.rows.length === 0 && (
                  <div className="p-6 text-center text-sm text-slate-500">
                    No data available for this report.
                  </div>
                )}
              </div>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}
