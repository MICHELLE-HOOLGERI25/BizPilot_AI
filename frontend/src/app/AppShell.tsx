
import { Outlet } from "react-router-dom";
import { Bell, CircleUserRound } from "lucide-react";

import Sidebar from "./Sidebar";
import CopilotPanel from "../copilot/CopilotPanel";

export default function AppShell() {
  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* LEFT SIDEBAR */}
      <Sidebar />

      {/* MAIN APPLICATION AREA */}
      <div className="flex min-w-0 flex-1 flex-col">

        {/* TOP HEADER */}
        <header className="flex h-18 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4 sm:px-6 lg:px-8">
          <div>
            <h2 className="font-semibold text-slate-900">
              Velora
            </h2>

            <p className="text-xs text-slate-500">
              Luxury Retail & Lifestyle
            </p>
          </div>

          <div className="flex items-center gap-5">
            <Bell
              size={20}
              className="text-slate-500"
            />

            <div className="flex items-center gap-2">
              <CircleUserRound
                size={28}
                className="text-blue-600"
              />

              <span className="text-sm font-medium">
                Admin
              </span>
            </div>
          </div>
        </header>

        {/* MAIN CONTENT + AI COPILOT */}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col xl:flex-row">

          {/* CURRENT ADMIN PAGE */}
          <main className="min-w-0 flex-1 p-4 sm:p-6 lg:p-8">
            <Outlet />
          </main>

          {/* AI COPILOT PANEL */}
          <aside
            aria-label="BizPilot AI Copilot"
            className="h-[480px] shrink-0 border-t border-slate-200 bg-white xl:sticky xl:top-0 xl:h-[calc(100vh-4.5rem)] xl:w-[340px] xl:border-l xl:border-t-0"
          >
            <CopilotPanel />
          </aside>

        </div>
      </div>
    </div>
  );
}
