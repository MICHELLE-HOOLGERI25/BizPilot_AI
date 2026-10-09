
import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";

import { useLocation, useNavigate } from "react-router-dom";

import {
  Bot,
  ChevronDown,
  ChevronUp,
  Send,
  ShieldAlert,
  CheckCircle2,
  LoaderCircle,
  XCircle,
  ExternalLink,
  AlertTriangle,
  FileText,
  Wrench,
  Ban,
} from "lucide-react";

import { agentApi } from "../api/agent";
import { validNavigation } from "../mocks/mockAgent";

import type {
  AgentTask,
  ConversationMessage,
  StepStatus,
  TaskStatus,
} from "../types/agent";

const stepColors: Record<StepStatus, string> = {
  pending: "text-slate-400",
  running: "text-blue-600",
  completed: "text-emerald-600",
  failed: "text-red-600",
  blocked: "text-amber-600",
};

const taskColors: Record<TaskStatus, string> = {
  pending: "bg-slate-100 text-slate-700",
  running: "bg-blue-100 text-blue-700",
  awaiting_approval: "bg-amber-100 text-amber-800",
  completed: "bg-emerald-100 text-emerald-700",
  failed: "bg-red-100 text-red-700",
  cancelled: "bg-slate-200 text-slate-700",
  partial: "bg-orange-100 text-orange-800",
};

function StepIcon({ status }: { status: StepStatus }) {
  if (status === "running") {
    return <LoaderCircle size={16} className="animate-spin" />;
  }

  if (status === "completed") {
    return <CheckCircle2 size={16} />;
  }

  if (status === "failed") {
    return <XCircle size={16} />;
  }

  if (status === "blocked") {
    return <Ban size={16} />;
  }

  return (
    <span className="inline-block h-4 w-4 rounded-full border border-current" />
  );
}

export default function CopilotPanel() {
  const location = useLocation();
  const navigate = useNavigate();

  const [expanded, setExpanded] = useState(true);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [task, setTask] = useState<AgentTask | null>(null);

  const [messages, setMessages] = useState<ConversationMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      text:
        "Welcome to BizPilot AI! Try “Open Inventory”, " +
        "“Go to Products”, “Create a sales dashboard” or " +
        "“Delete product VEL-201” (demo approval only).",
      created_at: new Date().toISOString(),
    },
  ]);

  const bottom = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottom.current?.scrollIntoView({
      behavior: "smooth",
    });
  }, [messages, task?.status, expanded]);

  function append(
    role: ConversationMessage["role"],
    text: string,
    task_id?: string
  ) {
    setMessages((previous) => [
      ...previous,
      {
        id: crypto.randomUUID(),
        role,
        text,
        task_id,
        created_at: new Date().toISOString(),
      },
    ]);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const message = input.trim();

    if (!message || busy) return;

    const previousTaskId = task?.task_id;

    setInput("");
    append("user", message);
    setBusy(true);
    setTask(null);

    try {
      const filters = Object.fromEntries(
        new URLSearchParams(location.search)
      );

      const result = await agentApi.submit(
        {
          message,
          current_route: location.pathname,
          current_filters: filters,
          client_request_id: crypto.randomUUID(),
          active_task_id: previousTaskId,
        },
        setTask
      );

      setTask(result);

      if (result.result) {
        append(
          "assistant",
          result.result.summary,
          result.task_id
        );
      } else if (result.error) {
        append("assistant", result.error, result.task_id);
      }

      // Navigate only after a successful task.
      if (
        result.status === "completed" &&
        result.result?.status === "completed"
      ) {
        const destination = validNavigation(
          result.result.navigation_instruction
        );

        if (
          destination &&
          destination !== location.pathname + location.search
        ) {
          navigate(destination);
        }
      }
    } catch (error) {
      append(
        "assistant",
        `Task failed: ${
          error instanceof Error
            ? error.message
            : "Unknown error"
        }`
      );
    } finally {
      setBusy(false);
    }
  }

  async function respond(approve: boolean) {
    if (!task || busy) return;

    setBusy(true);

    try {
      const next = approve
        ? await agentApi.approve(task)
        : await agentApi.cancel(task);

      setTask(next);

      append(
        "assistant",
        next.result?.summary ?? "Approval resolved",
        next.task_id
      );
    } catch {
      append(
        "assistant",
        "Could not resolve approval."
      );
    } finally {
      setBusy(false);
    }
  }

  const link =
    task?.status === "completed" &&
    task.result?.status === "completed"
      ? validNavigation(task.result.navigation_instruction)
      : null;

  const evidence = task
    ? [
        ...(task.evidence ?? []),
        ...(task.result?.evidence ?? []),
      ]
    : [];

  return (
    <aside
      aria-label="AI Copilot"
      className="flex h-full min-h-0 w-full flex-col border-l border-slate-200 bg-white"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-200 p-4">
        <div className="flex items-center gap-2">
          <Bot
            size={20}
            className="text-amber-700"
          />

          <div>
            <h2 className="text-sm font-bold text-slate-900">
              BizPilot Copilot
            </h2>

            <p className="text-xs text-slate-500">
              Simulated agent · demo mode
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() =>
            setExpanded((value) => !value)
          }
          aria-label={
            expanded
              ? "Collapse copilot"
              : "Expand copilot"
          }
          className="rounded-lg p-2 hover:bg-slate-100"
        >
          {expanded ? (
            <ChevronDown size={18} />
          ) : (
            <ChevronUp size={18} />
          )}
        </button>
      </div>

      {expanded && (
        <>
          {/* Conversation and task details */}
          <div
            className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4"
            aria-live="polite"
          >
            {messages.map((message) => (
              <div
                key={message.id}
                className={`rounded-xl p-3 text-sm ${
                  message.role === "user"
                    ? "ml-7 bg-slate-950 text-white"
                    : "mr-3 bg-slate-100 text-slate-800"
                }`}
              >
                {message.text}
              </div>
            ))}

            {task && (
              <div className="space-y-4 rounded-xl border border-amber-200 bg-amber-50/40 p-3 text-sm">
                {/* Status */}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <strong>Task progress</strong>

                  <span
                    className={`rounded-full px-2 py-1 text-xs font-medium capitalize ${
                      taskColors[task.status] ??
                      "bg-slate-100 text-slate-700"
                    }`}
                  >
                    {task.status.replaceAll("_", " ")}
                  </span>
                </div>

                <p className="break-all text-[11px] text-slate-500">
                  Task ID: {task.task_id}
                </p>

                {/* Plan and steps */}
                <ol className="space-y-3">
                  {task.plan.map((step) => (
                    <li
                      key={step.step_id}
                      className="flex items-start gap-2"
                    >
                      <span
                        className={
                          stepColors[step.status] ??
                          "text-slate-500"
                        }
                      >
                        <StepIcon
                          status={step.status}
                        />
                      </span>

                      <div className="min-w-0 flex-1">
                        <p className="font-medium">
                          {step.description}
                        </p>

                        {step.tool_id && (
                          <p className="break-all text-xs text-slate-500">
                            Tool: {step.tool_id}
                          </p>
                        )}

                        {step.safe_result_summary && (
                          <p className="mt-1 text-xs text-slate-600">
                            {step.safe_result_summary}
                          </p>
                        )}

                        {step.duration_ms !== undefined && (
                          <p className="mt-1 text-xs text-slate-500">
                            Duration: {step.duration_ms} ms
                          </p>
                        )}

                        {step.error_code && (
                          <p className="mt-1 text-xs text-red-700">
                            Error: {step.error_code}
                          </p>
                        )}
                      </div>
                    </li>
                  ))}
                </ol>

                {/* Tool execution cards */}
                {task.tool_executions &&
                  task.tool_executions.length > 0 && (
                    <section className="space-y-2">
                      <h3 className="flex items-center gap-2 font-semibold">
                        <Wrench size={16} />
                        Tool executions
                      </h3>

                      {task.tool_executions.map((tool) => (
                        <div
                          key={tool.execution_id}
                          className="space-y-1 rounded-lg border border-slate-200 bg-white p-3"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <strong className="break-words text-xs">
                              {tool.label ?? tool.tool_id}
                            </strong>

                            <span
                              className={`text-xs ${
                                stepColors[tool.status] ??
                                "text-slate-500"
                              }`}
                            >
                              {tool.status}
                            </span>
                          </div>

                          <p className="break-all text-xs text-slate-500">
                            {tool.tool_id}
                          </p>

                          {tool.safe_result_summary && (
                            <p className="text-xs text-slate-700">
                              {tool.safe_result_summary}
                            </p>
                          )}

                          {tool.duration_ms !== undefined && (
                            <p className="text-xs text-slate-500">
                              Duration: {tool.duration_ms} ms
                            </p>
                          )}

                          {(tool.error_code ||
                            tool.error_message) && (
                            <p className="text-xs text-red-700">
                              {tool.error_code}
                              {tool.error_code &&
                              tool.error_message
                                ? ": "
                                : ""}
                              {tool.error_message}
                            </p>
                          )}
                        </div>
                      ))}
                    </section>
                  )}

                {/* Approval and cancellation */}
                {task.pending_approval?.status === "pending" &&
                  task.status === "awaiting_approval" && (
                    <section className="space-y-2 rounded-lg border border-red-200 bg-white p-3">
                      <h3 className="flex items-center gap-2 font-semibold text-red-700">
                        <ShieldAlert size={18} />
                        Confirmation required
                      </h3>

                      <p className="break-words">
                        {task.pending_approval.target_summary}
                      </p>

                      <p className="text-xs text-slate-600">
                        Operation:{" "}
                        {task.pending_approval.operation}
                      </p>

                      <p className="text-xs text-slate-500">
                        {task.pending_approval.impact_summary}
                      </p>

                      <p className="text-xs text-slate-500">
                        Expires:{" "}
                        {task.pending_approval.expires_at}
                      </p>

                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() =>
                            void respond(false)
                          }
                          className="rounded-lg border px-3 py-2 disabled:opacity-50"
                        >
                          Cancel
                        </button>

                        <button
                          type="button"
                          disabled={busy}
                          onClick={() =>
                            void respond(true)
                          }
                          className="rounded-lg bg-red-600 px-3 py-2 text-white disabled:opacity-50"
                        >
                          Approve demo
                        </button>
                      </div>
                    </section>
                  )}

                {/* Final result */}
                {task.result && (
                  <section className="space-y-2">
                    <h3 className="flex items-center gap-2 font-semibold">
                      <FileText size={16} />
                      Result
                    </h3>

                    <div className="rounded-lg border border-slate-200 bg-white p-3">
                      <p
                        className={
                          task.status === "failed" ||
                          task.result.status === "failed"
                            ? "font-medium text-red-700"
                            : task.status === "partial" ||
                                task.result.status === "partial"
                              ? "font-medium text-orange-800"
                              : "font-medium text-slate-900"
                        }
                      >
                        {task.result.summary}
                      </p>

                      {task.result.findings.map(
                        (finding, index) => (
                          <p
                            key={index}
                            className="mt-2 text-xs text-slate-600"
                          >
                            {finding}
                          </p>
                        )
                      )}
                    </div>
                  </section>
                )}

                {/* Task errors */}
                {task.error && (
                  <div
                    role="alert"
                    className="rounded-lg border border-red-200 bg-red-50 p-3 text-red-800"
                  >
                    <div className="flex items-center gap-2">
                      <XCircle size={16} />
                      <span>{task.error}</span>
                    </div>
                  </div>
                )}

                {/* Partial failures */}
                {(task.result?.partial_failures?.length ?? 0) > 0 && (
                  <section
                    role="alert"
                    className="space-y-2 rounded-lg border border-orange-200 bg-orange-50 p-3"
                  >
                    <h3 className="flex items-center gap-2 font-semibold text-orange-800">
                      <AlertTriangle size={16} />
                      Partial failures
                    </h3>

                    {task.result?.partial_failures?.map(
                      (failure, index) => (
                        <p
                          key={index}
                          className="text-xs text-orange-900"
                        >
                          {failure}
                        </p>
                      )
                    )}
                  </section>
                )}

                {/* Evidence and sources */}
                {evidence.length > 0 && (
                  <section className="space-y-2">
                    <h3 className="font-semibold">
                      Evidence and sources
                    </h3>

                    {evidence.map((item, index) => (
                      <div
                        key={`${item.record_id ?? item.label}-${index}`}
                        className="space-y-1 rounded-lg border border-slate-200 bg-white p-3"
                      >
                        <p className="font-medium">
                          {item.label}
                        </p>

                        <p className="break-words text-xs">
                          {item.value}
                        </p>

                        {item.record_id && (
                          <p className="break-all text-xs text-slate-500">
                            Record ID: {item.record_id}
                          </p>
                        )}

                        {item.source && (
                          <p className="text-xs text-slate-500">
                            Source: {item.source}
                          </p>
                        )}

                        {item.timestamp && (
                          <p className="text-xs text-slate-500">
                            Timestamp: {item.timestamp}
                          </p>
                        )}
                      </div>
                    ))}
                  </section>
                )}

                {/* Manual navigation fallback */}
                {link && (
                  <button
                    type="button"
                    onClick={() => navigate(link)}
                    className="flex items-center gap-2 rounded-lg border border-amber-300 px-3 py-2 font-medium text-amber-800 hover:bg-amber-50"
                  >
                    <ExternalLink size={15} />
                    Open suggested page
                  </button>
                )}
              </div>
            )}

            <div ref={bottom} />
          </div>

          {/* Copilot composer */}
          <form
            onSubmit={(event) =>
              void submit(event)
            }
            className="border-t border-slate-200 p-3"
          >
            <label
              htmlFor="copilot-input"
              className="mb-2 block text-xs font-semibold text-slate-600"
            >
              Ask BizPilot AI
            </label>

            <div className="flex gap-2">
              <input
                id="copilot-input"
                value={input}
                onChange={(event) =>
                  setInput(event.target.value)
                }
                disabled={busy}
                placeholder="Ask about sales, stock, reports..."
                className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-amber-600 focus:outline-none"
              />

              <button
                type="submit"
                aria-label="Send request"
                disabled={!input.trim() || busy}
                className="rounded-lg bg-slate-950 p-2 text-white disabled:opacity-40"
              >
                {busy ? (
                  <LoaderCircle
                    size={18}
                    className="animate-spin"
                  />
                ) : (
                  <Send size={18} />
                )}
              </button>
            </div>

            <p className="mt-2 text-[11px] text-slate-500">
              No real LLM, permissions, tool calls or database
              writes yet.
            </p>
          </form>
        </>
      )}
    </aside>
  );
}
