
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { FileBarChart2, Search, ShieldCheck } from "lucide-react";

import DynamicViewRenderer from "../dynamic-ui/DynamicViewRenderer";
import { demoReports } from "../mocks/reportsData";
import { readGeneratedReports } from "../mocks/generatedReports";

import {
  validateDynamicView,
  type DynamicView,
} from "../types/dynamicView";

const STORE_KEY = "velora_demo_saved_reports_v1";

function readSavedReports(): DynamicView[] {
  try {
    const json = window.localStorage.getItem(STORE_KEY);
    if (!json) return [];

    const parsed: unknown = JSON.parse(json);

    if (!Array.isArray(parsed)) return [];

    return parsed.filter(validateDynamicView);
  } catch {
    return [];
  }
}

export default function ReportsPage() {
  const [searchParams, setSearchParams] = useSearchParams();

  // Unique report ID supplied through validated navigation.
  const requestedViewId = searchParams.get("view");

  const [saved, setSaved] = useState<DynamicView[]>(
    readSavedReports
  );

  const [generated, setGenerated] = useState<DynamicView[]>(
    readGeneratedReports
  );

  const [activeId, setActiveId] = useState<string>(
    () =>
      readGeneratedReports().at(-1)?.id ??
      demoReports[0].id
  );

  const [search, setSearch] = useState("");
  const [notice, setNotice] = useState("");

  const all = useMemo(
    () => [
      ...generated.slice().reverse(),
      ...demoReports,
      ...saved,
    ],
    [generated, saved]
  );

  // Handle new report IDs received through Copilot navigation.
  useEffect(() => {
    if (!requestedViewId) return;

    const latestGenerated = readGeneratedReports();
    const latestSaved = readSavedReports();

    setGenerated(latestGenerated);
    setSaved(latestSaved);
  }, [requestedViewId]);

  // Prefer the requested report ID; otherwise use the current selection.
  const active =
    (requestedViewId
      ? all.find((report) => report.id === requestedViewId)
      : undefined) ??
    all.find((report) => report.id === activeId) ??
    all[0];

  const matches = all.filter((report) =>
    `${report.title} ${report.description}`
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  // Select a report and synchronize its URL.
  function selectReport(id: string) {
    const exists = all.some((report) => report.id === id);

    if (!exists) return;

    setActiveId(id);
    setNotice("");
    setSearchParams({ view: id });
  }

  function refreshGenerated() {
    const list = readGeneratedReports();

    setGenerated(list);

    if (list.length) {
      const latest = list[list.length - 1];

      setActiveId(latest.id);
      setSearchParams({ view: latest.id });

      setNotice("Loaded latest generated demo report.");
    } else {
      setNotice(
        "No generated reports yet. Ask the Copilot to create one."
      );
    }
  }

  function saveCopy() {
    if (!active) return;

    const copy: DynamicView = {
      ...active,
      id: `saved-${crypto.randomUUID()}`,
      title: `${active.title} (Copy)`,
      source: "demo",
      createdAt: new Date().toISOString().slice(0, 10),
    };

    const next = [...saved, copy];

    try {
      window.localStorage.setItem(
        STORE_KEY,
        JSON.stringify(next)
      );

      setSaved(next);
      setActiveId(copy.id);
      setSearchParams({ view: copy.id });

      setNotice("Report copy saved in this browser.");
    } catch {
      setNotice("Unable to save report copy.");
    }
  }

  function deleteSaved() {
    if (!active) return;

    if (!saved.some((report) => report.id === active.id)) {
      return;
    }

    if (
      !window.confirm(
        `Remove saved demo report "${active.title}"?`
      )
    ) {
      return;
    }

    const next = saved.filter(
      (report) => report.id !== active.id
    );

    try {
      window.localStorage.setItem(
        STORE_KEY,
        JSON.stringify(next)
      );

      setSaved(next);
      setActiveId(demoReports[0].id);
      setSearchParams({ view: demoReports[0].id });

      setNotice("Saved demo report removed.");
    } catch {
      setNotice("Unable to remove saved demo report.");
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold tracking-[.2em] text-amber-700">
            VELORA / REPORTING STUDIO
          </p>

          <h1 className="mt-2 text-3xl font-bold text-slate-950">
            Reports & Dynamic Views
          </h1>

          <p className="mt-2 text-slate-500">
            Explore validated report layouts, charts and metrics.
          </p>
        </div>

        <span className="rounded-full bg-amber-50 px-4 py-2 text-xs font-medium text-amber-800">
          Synthetic demo data
        </span>
      </div>

      <div className="grid gap-5 xl:grid-cols-[280px_minmax(0,1fr)]">
        {/* Report navigation */}
        <aside className="min-w-0 space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <label className="flex items-center gap-2 rounded-xl border border-slate-200 px-3">
            <Search size={17} className="text-slate-500" />

            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="min-w-0 flex-1 py-3 text-sm outline-none"
              placeholder="Find a report..."
              aria-label="Find a report"
            />
          </label>

          <button
            type="button"
            onClick={refreshGenerated}
            className="w-full rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800"
          >
            Refresh generated reports
          </button>

          {matches.map((report) => {
            const isActive = report.id === active?.id;

            const isSaved = saved.some(
              (item) => item.id === report.id
            );

            const isGenerated = generated.some(
              (item) => item.id === report.id
            );

            return (
              <button
                type="button"
                key={report.id}
                onClick={() => selectReport(report.id)}
                className={`w-full rounded-xl border p-3 text-left ${
                  isActive
                    ? "border-amber-500 bg-amber-50"
                    : "border-slate-100 hover:bg-slate-50"
                }`}
              >
                <div className="flex items-center gap-2">
                  <FileBarChart2
                    size={16}
                    className="shrink-0 text-amber-700"
                  />

                  <span className="font-medium text-slate-900">
                    {report.title}
                  </span>
                </div>

                <p className="mt-1 text-xs text-slate-500">
                  {report.createdAt} ·{" "}
                  {isSaved
                    ? "Saved in browser"
                    : isGenerated
                      ? "Mock-generated"
                      : "Example"}
                </p>
              </button>
            );
          })}

          {matches.length === 0 && (
            <p className="p-3 text-sm text-slate-500">
              No matching reports.
            </p>
          )}
        </aside>

        {/* Selected report */}
        <main className="min-w-0 space-y-5">
          {active && (
            <>
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-bold">
                      {active.title}
                    </h2>

                    <p className="mt-1 text-sm text-slate-500">
                      {active.description}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={saveCopy}
                      className="rounded-xl bg-slate-950 px-4 py-2 text-sm text-white hover:bg-slate-800"
                    >
                      Save a Copy
                    </button>

                    {saved.some(
                      (report) => report.id === active.id
                    ) && (
                      <button
                        type="button"
                        onClick={deleteSaved}
                        className="rounded-xl border border-red-200 px-4 py-2 text-sm text-red-700"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </div>

                <p className="mt-4 flex items-center gap-2 text-xs text-slate-500">
                  <ShieldCheck size={15} />
                  Only approved widget types are rendered;
                  no generated code runs.
                </p>

                {notice && (
                  <p
                    role="status"
                    className="mt-3 text-sm text-amber-800"
                  >
                    {notice}
                  </p>
                )}
              </div>

              <DynamicViewRenderer view={active} />
            </>
          )}
        </main>
      </div>
    </div>
  );
}
