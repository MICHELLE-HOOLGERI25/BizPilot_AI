import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import {
  Plus,
  Search,
  Pencil,
  Package,
  CheckCircle2,
  XCircle,
  AlertCircle,
  X,
  Trash2,
} from "lucide-react";

import { productsApi } from "../api/products";
import type { Product, ProductInput, ProductStatus } from "../types/product";

const categories = ["Fashion", "Accessories", "Beauty", "Lifestyle"];

const emptyForm: ProductInput = {
  sku: "",
  name: "",
  category: "Fashion",
  price: 0,
  cost: 0,
  status: "active",
};

const euro = new Intl.NumberFormat("en-IE", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
});

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);
  const [hiddenIds, setHiddenIds] = useState<string[]>([]);

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [status, setStatus] = useState("all");
  const [sort, setSort] = useState("name");

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ProductInput>({ ...emptyForm });

  async function loadProducts() {
    setLoading(true);
    try {
      setProducts(await productsApi.list());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load products.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadProducts();
  }, []);

  // Until the backend exposes an authorized DELETE endpoint, deletion is
  // an explicitly local preview. Hidden IDs are not persisted on refresh.
  const visibleProducts = useMemo(
    () => products.filter((product) => !hiddenIds.includes(product.id)),
    [products, hiddenIds]
  );

  const filteredProducts = useMemo(() => {
    const query = search.trim().toLowerCase();
    return visibleProducts
      .filter((product) =>
        (product.name.toLowerCase().includes(query) ||
          product.sku.toLowerCase().includes(query)) &&
        (category === "all" || product.category === category) &&
        (status === "all" || product.status === status)
      )
      .sort((a, b) => {
        if (sort === "price-asc") return a.price - b.price;
        if (sort === "price-desc") return b.price - a.price;
        return a.name.localeCompare(b.name);
      });
  }, [visibleProducts, search, category, status, sort]);

  const activeCount = visibleProducts.filter(
    (product) => product.status === "active"
  ).length;

  function openCreate() {
    setForm({ ...emptyForm });
    setEditingId(null);
    setError("");
    setModalOpen(true);
  }

  function openEdit(product: Product) {
    setForm({
      sku: product.sku,
      name: product.name,
      category: product.category,
      price: product.price,
      cost: product.cost,
      status: product.status,
    });
    setEditingId(product.id);
    setError("");
    setModalOpen(true);
  }

  function updateField<K extends keyof ProductInput>(field: K, value: ProductInput[K]) {
    setForm((previous) => ({ ...previous, [field]: value }));
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    const cleaned: ProductInput = {
      ...form,
      sku: form.sku.trim().toUpperCase(),
      name: form.name.trim(),
    };

    if (!cleaned.sku || !cleaned.name) {
      setError("SKU and product name are required.");
      return;
    }
    if (
      !Number.isFinite(cleaned.price) ||
      !Number.isFinite(cleaned.cost) ||
      cleaned.price < 0 ||
      cleaned.cost < 0
    ) {
      setError("Price and cost must be valid nonnegative numbers.");
      return;
    }
    if (visibleProducts.some((p) => p.sku.toLowerCase() === cleaned.sku.toLowerCase() && p.id !== editingId)) {
      setError("A product with this SKU already exists.");
      return;
    }

    setSaving(true);
    try {
      if (editingId) {
        await productsApi.update(editingId, cleaned);
      } else {
        await productsApi.create(cleaned);
      }
      await loadProducts();
      setModalOpen(false);
      setEditingId(null);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save product.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeactivate(product: Product) {
    if (product.status === "inactive") return;
    if (!window.confirm(`Deactivate ${product.name} (${product.sku})?\n\nThe product remains in the catalogue.`)) {
      return;
    }
    try {
      setError("");
      await productsApi.deactivate(product.id);
      await loadProducts();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to deactivate the product.");
    }
  }

  function handleConfirmDelete() {
    if (!productToDelete || deleting) return;
    setDeleting(true);
    // Frontend demo only: do not imply that any backend record is deleted.
    setHiddenIds((previous) => [...previous, productToDelete.id]);
    setProductToDelete(null);
    setDeleting(false);
  }

  const selectStyle =
    "rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-amber-500";

  return (
    <div className="space-y-7">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold tracking-[0.2em] text-amber-700">
            VELORA / CATALOGUE MANAGEMENT
          </p>
          <h1 className="mt-2 text-3xl font-bold text-slate-900">Products Management</h1>
          <p className="mt-2 text-slate-500">Manage your exclusive product collection.</p>
        </div>
        <button type="button" onClick={openCreate} className="flex items-center gap-2 rounded-xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800">
          <Plus size={18} /> Add Product
        </button>
      </div>

      <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
        Demo mode: Delete only hides a product in this browser session. Refreshing the page restores it. No backend deletion occurs.
      </p>

      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { label: "Total Products", value: visibleProducts.length, icon: Package },
          { label: "Active Products", value: activeCount, icon: CheckCircle2 },
          { label: "Inactive Products", value: visibleProducts.length - activeCount, icon: XCircle },
        ].map(({ label, value, icon: Icon }) => (
          <div key={label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-500">{label}</span>
              <Icon size={20} className="text-amber-700" />
            </div>
            <p className="mt-4 text-3xl font-bold text-slate-900">{value}</p>
          </div>
        ))}
      </div>

      {error && !modalOpen && (
        <div role="alert" className="flex items-center gap-2 rounded-xl bg-red-50 p-4 text-sm text-red-700">
          <AlertCircle size={18} /> {error}
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 p-5">
          <div className="flex min-w-48 flex-1 items-center gap-2 rounded-xl border border-slate-200 px-3">
            <Search size={18} className="text-slate-400" />
            <input aria-label="Search products" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search products or SKU..." className="w-full bg-transparent py-3 text-sm outline-none" />
          </div>
          <select aria-label="Filter category" value={category} onChange={(event) => setCategory(event.target.value)} className={selectStyle}>
            <option value="all">All Categories</option>
            {categories.map((item) => <option key={item}>{item}</option>)}
          </select>
          <select aria-label="Filter status" value={status} onChange={(event) => setStatus(event.target.value)} className={selectStyle}>
            <option value="all">All Statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
          <select aria-label="Sort products" value={sort} onChange={(event) => setSort(event.target.value)} className={selectStyle}>
            <option value="name">Name A–Z</option>
            <option value="price-asc">Price: Low to High</option>
            <option value="price-desc">Price: High to Low</option>
          </select>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="p-4">Product</th><th className="p-4">SKU</th><th className="p-4">Category</th>
                <th className="p-4">Price</th><th className="p-4">Cost</th><th className="p-4">Status</th><th className="p-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="p-8 text-center">Loading products...</td></tr>
              ) : filteredProducts.length === 0 ? (
                <tr><td colSpan={7} className="p-8 text-center text-slate-500">No products match your filters.</td></tr>
              ) : filteredProducts.map((product) => (
                <tr key={product.id} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="p-4 font-semibold text-slate-900">{product.name}</td>
                  <td className="p-4 text-slate-500">{product.sku}</td>
                  <td className="p-4">{product.category}</td>
                  <td className="p-4">{euro.format(product.price)}</td>
                  <td className="p-4">{euro.format(product.cost)}</td>
                  <td className="p-4">
                    <span className={`rounded-full px-3 py-1 text-xs font-medium ${product.status === "active" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
                      {product.status}
                    </span>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <button type="button" aria-label={`Edit ${product.name}`} title="Edit" onClick={() => openEdit(product)} className="text-blue-600 hover:text-blue-800">
                        <Pencil size={17} />
                      </button>
                      {product.status === "active" && (
                        <button type="button" aria-label={`Deactivate ${product.name}`} title="Deactivate" onClick={() => void handleDeactivate(product)} className="text-amber-600 hover:text-amber-800">
                          <XCircle size={17} />
                        </button>
                      )}
                      <button type="button" aria-label={`Delete ${product.name}`} title="Delete (demo only)" onClick={() => setProductToDelete(product)} className="text-red-600 hover:text-red-800">
                        <Trash2 size={17} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="border-t border-slate-100 px-5 py-3 text-xs text-slate-500">
          Showing {filteredProducts.length} of {visibleProducts.length} products · Demo catalogue
        </div>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
          <div role="dialog" aria-modal="true" aria-labelledby="product-dialog-title" className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
            <div className="mb-6 flex items-center justify-between">
              <h2 id="product-dialog-title" className="text-xl font-bold text-slate-900">{editingId ? "Edit Product" : "Add New Product"}</h2>
              <button type="button" aria-label="Close dialog" onClick={() => setModalOpen(false)}><X size={20} /></button>
            </div>
            <form onSubmit={handleSave} className="space-y-4">
              {([ ["name", "Product Name"], ["sku", "SKU"] ] as const).map(([field, label]) => (
                <label key={field} className="block text-sm font-medium">
                  {label}
                  <input required value={form[field]} onChange={(event) => updateField(field, event.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 p-3 outline-none focus:border-amber-500" />
                </label>
              ))}
              <label className="block text-sm font-medium">
                Category
                <select value={form.category} onChange={(event) => updateField("category", event.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 p-3">
                  {categories.map((item) => <option key={item}>{item}</option>)}
                </select>
              </label>
              <div className="grid grid-cols-2 gap-4">
                {([ ["price", "Selling Price (€)"], ["cost", "Cost (€)"] ] as const).map(([field, label]) => (
                  <label key={field} className="block text-sm font-medium">
                    {label}
                    <input type="number" min="0" step="0.01" required value={form[field]} onChange={(event) => updateField(field, Number(event.target.value))} className="mt-2 w-full rounded-xl border border-slate-200 p-3" />
                  </label>
                ))}
              </div>
              <label className="block text-sm font-medium">
                Status
                <select value={form.status} onChange={(event) => updateField("status", event.target.value as ProductStatus)} className="mt-2 w-full rounded-xl border border-slate-200 p-3">
                  <option value="active">Active</option><option value="inactive">Inactive</option>
                </select>
              </label>
              {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
              <div className="flex justify-end gap-3 pt-4">
                <button type="button" onClick={() => setModalOpen(false)} className="rounded-xl border border-slate-200 px-5 py-3 text-sm">Cancel</button>
                <button type="submit" disabled={saving} className="rounded-xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">
                  {saving ? "Saving..." : "Save Product"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {productToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
          <div role="alertdialog" aria-modal="true" aria-labelledby="delete-title" aria-describedby="delete-description" className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-50"><Trash2 size={24} className="text-red-600" /></div>
            <h2 id="delete-title" className="text-xl font-bold">Remove product from demo view?</h2>
            <p id="delete-description" className="mt-3 text-sm text-slate-600">
              Hide <strong>{productToDelete.name}</strong> ({productToDelete.sku}) from this catalogue until you refresh the page?
            </p>
            <p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
              This is a frontend-only demonstration. The backend record is not deleted. Final deletion will require server authorization, dependency checks and an audit trail.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" disabled={deleting} onClick={() => setProductToDelete(null)} className="rounded-lg border border-slate-200 px-5 py-2.5 text-sm">Cancel</button>
              <button type="button" disabled={deleting} onClick={handleConfirmDelete} className="rounded-lg bg-red-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50">
                {deleting ? "Removing..." : "Remove from View"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
