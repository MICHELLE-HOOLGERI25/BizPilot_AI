
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Ban,
  CheckCircle2,
  ClipboardList,
  Eye,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { apiClient } from "../lib/apiClient";
import { purchaseOrdersApi } from "../api/purchaseOrders";
import type {
  PurchaseOrderApi,
  PurchaseOrderCreatePayload,
} from "../api/purchaseOrders";

type SupplierProduct = {
  sku: string;
  product_name: string;
  unit_cost: number | string;
};

type SupplierOption = {
  id: number;
  name: string;
  is_active: boolean;
  product_coverage?: SupplierProduct[];
};

type OrderLine = {
  sku: string;
  quantity: number;
};

type Notice = {
  kind: "success" | "error";
  message: string;
};

const STORE_CODES = ["VIE", "PAR", "MIL"];

const currency = (value: number) =>
  new Intl.NumberFormat("en-IE", {
    style: "currency",
    currency: "EUR",
  }).format(value);

const dateLabel = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString();
};

const statusClass = (status: string) => {
  switch (status.toLowerCase()) {
    case "received":
      return "bg-green-100 text-green-800";
    case "submitted":
    case "approved":
      return "bg-blue-100 text-blue-800";
    case "cancelled":
      return "bg-red-100 text-red-800";
    default:
      return "bg-amber-100 text-amber-800";
  }
};

function extractSuppliers(value: unknown): SupplierOption[] {
  if (Array.isArray(value)) return value as SupplierOption[];

  if (value && typeof value === "object") {
    const response = value as {
      data?: unknown;
      items?: unknown;
      suppliers?: unknown;
    };

    if (Array.isArray(response.data)) {
      return response.data as SupplierOption[];
    }
    if (Array.isArray(response.items)) {
      return response.items as SupplierOption[];
    }
    if (Array.isArray(response.suppliers)) {
      return response.suppliers as SupplierOption[];
    }
  }

  return [];
}

function apiError(error: unknown, fallback: string): string {
  if (error && typeof error === "object") {
    const e = error as {
      message?: string;
      response?: {
        data?: {
          detail?: string | { msg?: string }[];
          message?: string;
        };
      };
    };

    const detail = e.response?.data?.detail;
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail)) {
      return detail.map((item) => item.msg ?? "Invalid input").join("; ");
    }
    if (e.response?.data?.message) return e.response.data.message;
    if (e.message) return e.message;
  }

  return fallback;
}

export default function PurchaseOrdersPage() {
  const [orders, setOrders] = useState<PurchaseOrderApi[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [suppliersLoading, setSuppliersLoading] = useState(true);
  const [search, setSearch] = useState("");

  const [selectedOrder, setSelectedOrder] =
    useState<PurchaseOrderApi | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [editingOrder, setEditingOrder] =
    useState<PurchaseOrderApi | null>(null);
  const [cancelTarget, setCancelTarget] =
    useState<PurchaseOrderApi | null>(null);
  const [busy, setBusy] = useState(false);

  const [supplierId, setSupplierId] = useState("");
  const [storeCode, setStoreCode] = useState("VIE");
  const [lines, setLines] = useState<OrderLine[]>([
    { sku: "", quantity: 1 },
  ]);
  const [confirmationToken, setConfirmationToken] = useState("");
  const [reviewPayload, setReviewPayload] =
    useState<PurchaseOrderCreatePayload | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);

  const loadOrders = useCallback(async () => {
    setLoading(true);
    try {
      const result = await purchaseOrdersApi.list();
      setOrders(result.data ?? []);
    } catch (error: unknown) {
      setNotice({
        kind: "error",
        message: apiError(error, "Could not load purchase orders."),
      });
    } finally {
      setLoading(false);
    }
  }, []);

  const loadSuppliers = useCallback(async () => {
    setSuppliersLoading(true);
    try {
      const response = await apiClient.get("/api/v1/suppliers");
      setSuppliers(
        extractSuppliers(response.data)
          .filter((supplier) => supplier.is_active)
          .sort((a, b) => a.name.localeCompare(b.name)),
      );
    } catch (error: unknown) {
      setNotice({
        kind: "error",
        message: apiError(error, "Could not load suppliers."),
      });
    } finally {
      setSuppliersLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadOrders();
    void loadSuppliers();
  }, [loadOrders, loadSuppliers]);

  const activeSupplier = useMemo(
    () => suppliers.find((supplier) => String(supplier.id) === supplierId),
    [suppliers, supplierId],
  );

  const products = activeSupplier?.product_coverage ?? [];

  const visibleOrders = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return orders;

    return orders.filter((order) =>
      [
        order.order_number,
        order.supplier_name,
        order.store_code,
        order.status,
      ].some((value) => String(value).toLowerCase().includes(query)),
    );
  }, [orders, search]);

  const totalFor = (order: PurchaseOrderApi) =>
    order.items.reduce(
      (sum, item) => sum + Number(item.unit_cost) * item.quantity,
      0,
    );

  const totalValue = orders.reduce((sum, order) => sum + totalFor(order), 0);
  const draftCount = orders.filter(
    (order) => order.status.toLowerCase() === "draft",
  ).length;

  const estimate = useMemo(
    () =>
      lines.reduce((sum, line) => {
        const product = products.find((item) => item.sku === line.sku);
        return sum + (product ? Number(product.unit_cost) * line.quantity : 0);
      }, 0),
    [lines, products],
  );

  const resetForm = () => {
    setEditingOrder(null);
    setSupplierId("");
    setStoreCode("VIE");
    setLines([{ sku: "", quantity: 1 }]);
    setConfirmationToken("");
    setReviewPayload(null);
    setReviewOpen(false);
  };

  const openCreate = () => {
    setNotice(null);
    resetForm();
    setFormOpen(true);
  };

  const openEdit = (order: PurchaseOrderApi) => {
    if (order.status.toLowerCase() !== "draft") {
      setNotice({
        kind: "error",
        message: "Only draft orders can be edited.",
      });
      return;
    }

    setNotice(null);
    setEditingOrder(order);
    setSupplierId(String(order.supplier_id));
    setStoreCode(order.store_code);
    setLines(
      order.items.map((item) => ({
        sku: item.sku,
        quantity: item.quantity,
      })),
    );
    setConfirmationToken("");
    setReviewPayload(null);
    setReviewOpen(false);
    setFormOpen(true);
    setSelectedOrder(null);
  };

  const closeForm = () => {
    if (busy) return;
    setFormOpen(false);
    resetForm();
  };

  const changeLine = (
    index: number,
    field: keyof OrderLine,
    value: string,
  ) => {
    setLines((current) =>
      current.map((line, i) => {
        if (i !== index) return line;
        if (field === "sku") return { ...line, sku: value };

        const quantity = Number(value);
        return {
          ...line,
          quantity:
            value === ""
              ? 1
              : Math.min(
                  100000,
                  Math.max(1, Number.isFinite(quantity) ? quantity : 1),
                ),
        };
      }),
    );
  };

  const addLine = () =>
    setLines((current) => [...current, { sku: "", quantity: 1 }]);

  const removeLine = (index: number) =>
    setLines((current) =>
      current.length === 1
        ? current
        : current.filter((_, i) => i !== index),
    );

  const makePayload = (): PurchaseOrderCreatePayload | null => {
    if (!activeSupplier) {
      setNotice({ kind: "error", message: "Select an active supplier." });
      return null;
    }

    if (!STORE_CODES.includes(storeCode)) {
      setNotice({ kind: "error", message: "Select a valid store." });
      return null;
    }

    if (lines.some((line) => !line.sku || line.quantity < 1)) {
      setNotice({
        kind: "error",
        message: "Select a product and quantity for every line.",
      });
      return null;
    }

    if (new Set(lines.map((line) => line.sku)).size !== lines.length) {
      setNotice({
        kind: "error",
        message: "Each SKU can appear only once. Change its quantity instead.",
      });
      return null;
    }

    if (lines.some((line) => !products.some((p) => p.sku === line.sku))) {
      setNotice({
        kind: "error",
        message: "One or more SKUs are not supplied by this supplier.",
      });
      return null;
    }

    return {
      supplier_id: Number(supplierId),
      store_code: storeCode,
      items: lines.map((line) => ({
        sku: line.sku,
        quantity: line.quantity,
      })),
    };
  };

  const reviewForm = async () => {
    setNotice(null);
    const payload = makePayload();
    if (!payload) return;

    if (editingOrder) {
      setReviewPayload(payload);
      setReviewOpen(true);
      return;
    }

    setBusy(true);
    try {
      const result = await purchaseOrdersApi.requestConfirmation(payload);
      setConfirmationToken(result.confirmation_token);
      setReviewPayload(payload);
      setReviewOpen(true);
    } catch (error: unknown) {
      setNotice({
        kind: "error",
        message: apiError(error, "Could not prepare order confirmation."),
      });
    } finally {
      setBusy(false);
    }
  };

  const confirmSave = async () => {
    if (!reviewPayload) return;

    setBusy(true);
    setNotice(null);

    try {
      if (editingOrder) {
        await purchaseOrdersApi.updateDraft(editingOrder.id, reviewPayload);
        setNotice({
          kind: "success",
          message: `Draft ${editingOrder.order_number} updated.`,
        });
      } else {
        if (!confirmationToken) {
          setNotice({
            kind: "error",
            message: "Confirmation is missing. Review the order again.",
          });
          return;
        }

        const key =
          typeof crypto !== "undefined" &&
          typeof crypto.randomUUID === "function"
            ? crypto.randomUUID()
            : `po-${Date.now()}-${Math.random().toString(36).slice(2)}`;

        const created = await purchaseOrdersApi.create(
          reviewPayload,
          confirmationToken,
          key,
        );

        setNotice({
          kind: "success",
          message: `Draft ${created.order_number} created.`,
        });
      }

      setReviewOpen(false);
      setFormOpen(false);
      resetForm();
      await loadOrders();
    } catch (error: unknown) {
      setNotice({
        kind: "error",
        message: apiError(error, "Could not save the draft."),
      });
    } finally {
      setBusy(false);
    }
  };

  const submitOrder = async (order: PurchaseOrderApi) => {
    if (order.status.toLowerCase() !== "draft") return;

    const confirmed = window.confirm(
      `Submit ${order.order_number} for approval?`,
    );
    if (!confirmed) return;

    setBusy(true);
    setNotice(null);

    try {
      const result = await purchaseOrdersApi.submitDraft(order.id);
      setNotice({
        kind: "success",
        message: `${result.order_number} submitted successfully.`,
      });
      await loadOrders();
    } catch (error: unknown) {
      setNotice({
        kind: "error",
        message: apiError(error, "Could not submit purchase order."),
      });
    } finally {
      setBusy(false);
    }
  };

  const confirmCancel = async () => {
    if (!cancelTarget) return;

    setBusy(true);
    setNotice(null);

    try {
      await purchaseOrdersApi.cancelDraft(cancelTarget.id);
      setNotice({
        kind: "success",
        message: `Draft ${cancelTarget.order_number} cancelled.`,
      });
      setCancelTarget(null);
      setSelectedOrder(null);
      await loadOrders();
    } catch (error: unknown) {
      setNotice({
        kind: "error",
        message: apiError(error, "Could not cancel the draft."),
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6 p-4 md:p-6">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2">
            <ClipboardList className="h-7 w-7 text-indigo-600" />
            <h1 className="text-2xl font-bold text-slate-900">
              Purchase Orders
            </h1>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            Manage supplier orders for your stores.
          </p>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => void loadOrders()}
            disabled={loading || busy}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw
              className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
            />
            Refresh
          </button>
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
          >
            <Plus className="h-4 w-4" />
            New Draft PO
          </button>
        </div>
      </header>

      {notice && (
        <div
          role="alert"
          className={`flex items-start gap-2 rounded-lg border p-3 text-sm ${
            notice.kind === "error"
              ? "border-red-200 bg-red-50 text-red-800"
              : "border-green-200 bg-green-50 text-green-800"
          }`}
        >
          {notice.kind === "error" ? (
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          ) : (
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          )}
          <span>{notice.message}</span>
          <button
            type="button"
            onClick={() => setNotice(null)}
            className="ml-auto"
            aria-label="Dismiss notice"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-sm text-slate-500">Total orders</p>
          <p className="mt-2 text-2xl font-bold">{orders.length}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-sm text-slate-500">Draft orders</p>
          <p className="mt-2 text-2xl font-bold">{draftCount}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-sm text-slate-500">Total order value</p>
          <p className="mt-2 text-2xl font-bold">{currency(totalValue)}</p>
        </div>
      </div>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="flex flex-col gap-3 border-b border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="font-semibold">All purchase orders</h2>
          <div className="relative w-full sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search order, supplier or store..."
              className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm outline-none focus:border-indigo-500"
            />
          </div>
        </div>

        {loading ? (
          <div className="p-10 text-center text-sm text-slate-500">
            Loading...
          </div>
        ) : visibleOrders.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-500">
            No orders found.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Order</th>
                  <th className="px-4 py-3">Supplier</th>
                  <th className="px-4 py-3">Store</th>
                  <th className="px-4 py-3">Created</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Value</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visibleOrders.map((order) => {
                  const isDraft = order.status.toLowerCase() === "draft";

                  return (
                    <tr key={order.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-semibold">
                        {order.order_number}
                      </td>
                      <td className="px-4 py-3">{order.supplier_name}</td>
                      <td className="px-4 py-3">{order.store_code}</td>
                      <td className="px-4 py-3">
                        {dateLabel(order.created_at)}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusClass(order.status)}`}
                        >
                          {order.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-medium">
                        {currency(totalFor(order))}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => setSelectedOrder(order)}
                            title="View details"
                            className="rounded-md border border-slate-300 p-2 hover:bg-white"
                          >
                            <Eye className="h-4 w-4" />
                          </button>

                          {isDraft && (
                            <>
                              <button
                                type="button"
                                onClick={() => openEdit(order)}
                                title="Edit draft"
                                className="rounded-md border border-slate-300 p-2 text-indigo-600 hover:bg-indigo-50"
                              >
                                <Pencil className="h-4 w-4" />
                              </button>

                              <button
                                type="button"
                                onClick={() => setCancelTarget(order)}
                                title="Cancel draft"
                                className="rounded-md border border-slate-300 p-2 text-red-600 hover:bg-red-50"
                              >
                                <Ban className="h-4 w-4" />
                              </button>

                              <button
                                type="button"
                                onClick={() => void submitOrder(order)}
                                disabled={busy}
                                title="Submit for approval"
                                className="rounded-md border border-green-300 px-2 py-1 text-xs font-semibold text-green-700 hover:bg-green-50 disabled:opacity-50"
                              >
                                Submit
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {formOpen && (
        <div className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-black/40 p-4 sm:items-center">
          <section className="my-4 w-full max-w-2xl rounded-xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b p-5">
              <div>
                <h2 className="text-lg font-bold">
                  {editingOrder
                    ? "Edit Draft Purchase Order"
                    : "New Draft Purchase Order"}
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Select a store, supplier and products.
                </p>
              </div>
              <button
                type="button"
                onClick={closeForm}
                disabled={busy}
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-5 p-5">
              {editingOrder && (
                <p className="rounded-lg bg-indigo-50 p-3 text-sm text-indigo-800">
                  Editing {editingOrder.order_number}
                </p>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-sm font-medium">
                  Store
                  <select
                    value={storeCode}
                    onChange={(event) => setStoreCode(event.target.value)}
                    className="mt-1.5 w-full rounded-lg border border-slate-300 p-2.5 font-normal"
                  >
                    {STORE_CODES.map((code) => (
                      <option key={code} value={code}>
                        {code}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block text-sm font-medium">
                  Supplier
                  <select
                    value={supplierId}
                    disabled={suppliersLoading || busy}
                    onChange={(event) => {
                      setSupplierId(event.target.value);
                      setLines([{ sku: "", quantity: 1 }]);
                    }}
                    className="mt-1.5 w-full rounded-lg border border-slate-300 p-2.5 font-normal"
                  >
                    <option value="">
                      {suppliersLoading ? "Loading suppliers..." : "Select supplier"}
                    </option>
                    {suppliers.map((supplier) => (
                      <option key={supplier.id} value={supplier.id}>
                        {supplier.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div>
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="font-semibold">Order items</h3>
                  <button
                    type="button"
                    onClick={addLine}
                    disabled={!activeSupplier || busy}
                    className="inline-flex items-center gap-1 text-sm font-semibold text-indigo-600 disabled:opacity-40"
                  >
                    <Plus className="h-4 w-4" /> Add item
                  </button>
                </div>

                {!activeSupplier ? (
                  <div className="rounded-lg border border-dashed p-6 text-center text-sm text-slate-500">
                    Choose a supplier to see its available products.
                  </div>
                ) : products.length === 0 ? (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                    No product coverage returned for this supplier.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {lines.map((line, index) => {
                      const product = products.find(
                        (item) => item.sku === line.sku,
                      );

                      return (
                        <div
                          key={index}
                          className="grid grid-cols-1 gap-3 rounded-lg border p-3 sm:grid-cols-[minmax(0,1fr)_100px_110px_36px] sm:items-end"
                        >
                          <label className="block text-sm font-medium">
                            Product
                            <select
                              value={line.sku}
                              disabled={busy}
                              onChange={(event) =>
                                changeLine(index, "sku", event.target.value)
                              }
                              className="mt-1.5 w-full rounded-lg border border-slate-300 p-2.5 font-normal"
                            >
                              <option value="">Select product</option>
                              {products.map((item) => (
                                <option key={item.sku} value={item.sku}>
                                  {item.sku} — {item.product_name}
                                </option>
                              ))}
                            </select>
                          </label>

                          <label className="block text-sm font-medium">
                            Quantity
                            <input
                              type="number"
                              min={1}
                              max={100000}
                              value={line.quantity}
                              disabled={busy}
                              onChange={(event) =>
                                changeLine(index, "quantity", event.target.value)
                              }
                              className="mt-1.5 w-full rounded-lg border border-slate-300 p-2.5 font-normal"
                            />
                          </label>

                          <div className="text-sm">
                            <p className="text-slate-500">Unit cost</p>
                            <p className="mt-2 font-semibold">
                              {product
                                ? currency(Number(product.unit_cost))
                                : "—"}
                            </p>
                          </div>

                          <button
                            type="button"
                            onClick={() => removeLine(index)}
                            disabled={lines.length === 1 || busy}
                            aria-label="Remove item"
                            className="mb-1 rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-25"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between rounded-lg bg-slate-50 p-4">
                <div>
                  <p className="text-sm text-slate-500">Estimated total</p>
                  <p className="text-xs text-slate-500">
                    Backend validates final costs.
                  </p>
                </div>
                <p className="text-xl font-bold">{currency(estimate)}</p>
              </div>
            </div>

            <div className="flex flex-col-reverse justify-end gap-2 border-t p-5 sm:flex-row">
              <button
                type="button"
                onClick={closeForm}
                disabled={busy}
                className="rounded-lg border px-4 py-2.5 text-sm font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void reviewForm()}
                disabled={busy || suppliersLoading || !activeSupplier}
                className="rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
              >
                {busy ? "Working..." : "Review order"}
              </button>
            </div>
          </section>
        </div>
      )}

      {reviewOpen && reviewPayload && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 sm:items-center">
          <section className="my-4 w-full max-w-lg rounded-xl bg-white shadow-xl">
            <div className="border-b p-5">
              <h2 className="text-lg font-bold">
                {editingOrder ? "Confirm draft changes" : "Confirm draft creation"}
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Review the details before saving.
              </p>
            </div>

            <div className="space-y-4 p-5">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-lg bg-slate-50 p-3">
                  <p className="text-slate-500">Store</p>
                  <p className="mt-1 font-semibold">{reviewPayload.store_code}</p>
                </div>
                <div className="rounded-lg bg-slate-50 p-3">
                  <p className="text-slate-500">Supplier</p>
                  <p className="mt-1 font-semibold">{activeSupplier?.name}</p>
                </div>
              </div>

              <div className="divide-y rounded-lg border">
                {reviewPayload.items.map((item) => {
                  const product = products.find((p) => p.sku === item.sku);

                  return (
                    <div
                      key={item.sku}
                      className="flex justify-between gap-3 p-3 text-sm"
                    >
                      <div>
                        <p className="font-medium">
                          {product?.product_name ?? item.sku}
                        </p>
                        <p className="text-slate-500">
                          {item.sku} · Qty {item.quantity}
                        </p>
                      </div>
                      <p className="font-semibold">
                        {product
                          ? currency(Number(product.unit_cost) * item.quantity)
                          : "—"}
                      </p>
                    </div>
                  );
                })}
              </div>

              <div className="flex justify-between">
                <span className="text-sm text-slate-500">Estimated total</span>
                <span className="text-lg font-bold">{currency(estimate)}</span>
              </div>

              <p className="text-xs text-slate-500">
                This saves a draft only; it does not submit or approve the order.
              </p>
            </div>

            <div className="flex flex-col-reverse justify-end gap-2 border-t p-5 sm:flex-row">
              <button
                type="button"
                onClick={() => {
                  setReviewOpen(false);
                  setConfirmationToken("");
                  setReviewPayload(null);
                }}
                disabled={busy}
                className="rounded-lg border px-4 py-2.5 text-sm font-semibold"
              >
                Back to edit
              </button>
              <button
                type="button"
                onClick={() => void confirmSave()}
                disabled={busy || (!editingOrder && !confirmationToken)}
                className="rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
              >
                {busy
                  ? "Saving..."
                  : editingOrder
                    ? "Confirm changes"
                    : "Confirm and create draft"}
              </button>
            </div>
          </section>
        </div>
      )}

      {selectedOrder && (
        <div className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-black/40 p-4 sm:items-center">
          <section className="my-4 w-full max-w-2xl rounded-xl bg-white shadow-xl">
            <div className="flex items-start justify-between border-b p-5">
              <div>
                <h2 className="text-lg font-bold">{selectedOrder.order_number}</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Created {dateLabel(selectedOrder.created_at)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedOrder(null)}
                aria-label="Close details"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid gap-3 p-5 sm:grid-cols-3">
              <div>
                <p className="text-xs text-slate-500">Supplier</p>
                <p className="mt-1 font-semibold">{selectedOrder.supplier_name}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Store</p>
                <p className="mt-1 font-semibold">{selectedOrder.store_code}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Status</p>
                <span
                  className={`mt-1 inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${statusClass(selectedOrder.status)}`}
                >
                  {selectedOrder.status}
                </span>
              </div>
            </div>

            <div className="px-5 pb-5">
              <h3 className="mb-3 font-semibold">Order items</h3>
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full min-w-[460px] text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                    <tr>
                      <th className="px-3 py-2.5">Product</th>
                      <th className="px-3 py-2.5 text-right">Qty</th>
                      <th className="px-3 py-2.5 text-right">Unit cost</th>
                      <th className="px-3 py-2.5 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {selectedOrder.items.map((item, index) => (
                      <tr key={`${item.sku}-${index}`}>
                        <td className="px-3 py-3">
                          <p className="font-medium">{item.product_name}</p>
                          <p className="text-xs text-slate-500">{item.sku}</p>
                        </td>
                        <td className="px-3 py-3 text-right">{item.quantity}</td>
                        <td className="px-3 py-3 text-right">
                          {currency(Number(item.unit_cost))}
                        </td>
                        <td className="px-3 py-3 text-right font-medium">
                          {currency(Number(item.unit_cost) * item.quantity)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-slate-50">
                    <tr>
                      <td colSpan={3} className="px-3 py-3 text-right font-semibold">
                        Order total
                      </td>
                      <td className="px-3 py-3 text-right font-bold">
                        {currency(totalFor(selectedOrder))}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            <div className="flex flex-wrap justify-end gap-2 border-t p-5">
              {selectedOrder.status.toLowerCase() === "draft" && (
                <>
                  <button
                    type="button"
                    onClick={() => openEdit(selectedOrder)}
                    className="inline-flex items-center gap-2 rounded-lg border border-indigo-200 px-4 py-2 text-sm font-semibold text-indigo-700"
                  >
                    <Pencil className="h-4 w-4" /> Edit draft
                  </button>
                  <button
                    type="button"
                    onClick={() => setCancelTarget(selectedOrder)}
                    className="inline-flex items-center gap-2 rounded-lg border border-red-200 px-4 py-2 text-sm font-semibold text-red-700"
                  >
                    <Ban className="h-4 w-4" /> Cancel draft
                  </button>
                  <button
                    type="button"
                    onClick={() => void submitOrder(selectedOrder)}
                    disabled={busy}
                    className="rounded-lg border border-green-300 px-4 py-2 text-sm font-semibold text-green-700 disabled:opacity-50"
                  >
                    Submit for approval
                  </button>
                </>
              )}
              <button
                type="button"
                onClick={() => setSelectedOrder(null)}
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
              >
                Close
              </button>
            </div>
          </section>
        </div>
      )}

      {cancelTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <section className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl">
            <h2 className="text-lg font-bold">Cancel draft order?</h2>
            <p className="mt-2 text-sm text-slate-600">
              Cancel {cancelTarget.order_number}? This changes its status to cancelled.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setCancelTarget(null)}
                disabled={busy}
                className="rounded-lg border px-4 py-2 text-sm font-semibold"
              >
                Keep draft
              </button>
              <button
                type="button"
                onClick={() => void confirmCancel()}
                disabled={busy}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {busy ? "Cancelling..." : "Confirm cancel"}
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
