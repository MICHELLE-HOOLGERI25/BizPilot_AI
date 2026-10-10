import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';

import {
  Building2,
  CheckCircle2,
  Clock3,
  Pencil,
  Plus,
  Search,
  Truck,
  X,
  XCircle,
  Trash2,
  RefreshCw,
} from 'lucide-react';

import { emptySupplierForm, supplierCategories } from '../mocks/suppliersData';
import { suppliersApi, type SupplierApiRow } from '../api/suppliers';

import type {
  Supplier,
  SupplierCategory,
  SupplierInput,
  SupplierStatus,
} from '../types/supplier';

const surface = 'rounded-2xl border border-slate-200 bg-white shadow-sm';

const inputClass =
  'mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-amber-600';

function mapSupplier(row: SupplierApiRow): Supplier {
  return {
    id: String(row.id),
    name: row.name,
    contactName: 'Not provided by API',
    email: row.email ?? '',
    phone: row.phone ?? '',
    country: 'Not provided by API',
    categories: [],
    leadTimeDays: row.lead_time_days,
    onTimeDeliveryRate: row.on_time_delivery_rate,
    status: row.is_active ? 'active' : 'inactive',
    productSkus: row.product_coverage.map((product) => product.sku),
  };
}

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loadingSuppliers, setLoadingSuppliers] = useState(true);
  const [saving, setSaving] = useState(false);
  const [supplierLoadError, setSupplierLoadError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState('name');

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<SupplierInput>({ ...emptySupplierForm });
  const [formError, setFormError] = useState('');

  const [confirmInactive, setConfirmInactive] = useState<Supplier | null>(null);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [supplierToDelete, setSupplierToDelete] = useState<Supplier | null>(null);

  const loadSuppliers = useCallback(async (showLoading = true) => {
    if (showLoading) setLoadingSuppliers(true);

    try {
      const rows = await suppliersApi.list();
      setSuppliers(rows.map(mapSupplier));
      setSupplierLoadError('');
    } catch (error) {
      console.error('Failed to load suppliers:', error);
      setSupplierLoadError(
        'Could not load suppliers from the backend. Check the backend server and your permissions.',
      );
    } finally {
      if (showLoading) setLoadingSuppliers(false);
    }
  }, []);

  useEffect(() => {
    void loadSuppliers();
  }, [loadSuppliers]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();

    return suppliers
      .filter(
        (supplier) =>
          (!q ||
            [
              supplier.id,
              supplier.name,
              supplier.country,
              supplier.contactName,
              ...supplier.productSkus,
            ].some((value) => value.toLowerCase().includes(q))) &&
          (categoryFilter === 'all' ||
            supplier.categories.includes(categoryFilter as SupplierCategory)) &&
          (statusFilter === 'all' || supplier.status === statusFilter),
      )
      .sort((a, b) =>
        sortBy === 'lead'
          ? a.leadTimeDays - b.leadTimeDays
          : sortBy === 'delivery'
            ? b.onTimeDeliveryRate - a.onTimeDeliveryRate
            : a.name.localeCompare(b.name),
      );
  }, [suppliers, search, categoryFilter, statusFilter, sortBy]);

  const active = suppliers.filter((supplier) => supplier.status === 'active').length;

  const averageLead = active
    ? Math.round(
        suppliers
          .filter((supplier) => supplier.status === 'active')
          .reduce((total, supplier) => total + supplier.leadTimeDays, 0) / active,
      )
    : 0;

  const avgDelivery = active
    ? (
        suppliers
          .filter((supplier) => supplier.status === 'active')
          .reduce((total, supplier) => total + supplier.onTimeDeliveryRate, 0) /
        active
      ).toFixed(1)
    : '0.0';

  function openCreate() {
    setEditingId(null);
    setForm({
      ...emptySupplierForm,
      categories: [...emptySupplierForm.categories],
      productSkus: [],
    });
    setFormError('');
    setSuccessMessage('');
    setModalOpen(true);
  }

  function openEdit(supplier: Supplier) {
    setEditingId(supplier.id);

    setForm({
      ...emptySupplierForm,
      ...supplier,
      categories: [...supplier.categories],
      productSkus: [...supplier.productSkus],
    });

    setFormError('');
    setSuccessMessage('');
    setModalOpen(true);
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (saving) return;

    setFormError('');
    setSuccessMessage('');

    const cleaned = {
      ...form,
      name: form.name.trim(),
      email: form.email.trim(),
      phone: form.phone.trim(),
    };

    if (!cleaned.name) {
      setFormError('Supplier name is required.');
      return;
    }

    if (
      !Number.isInteger(cleaned.leadTimeDays) ||
      cleaned.leadTimeDays < 0
    ) {
      setFormError('Lead time must be a non-negative whole number.');
      return;
    }

    if (
      !Number.isFinite(cleaned.onTimeDeliveryRate) ||
      cleaned.onTimeDeliveryRate < 0 ||
      cleaned.onTimeDeliveryRate > 100
    ) {
      setFormError('On-time delivery rate must be between 0 and 100.');
      return;
    }

    if (
      suppliers.some(
        (supplier) =>
          supplier.name.toLowerCase() === cleaned.name.toLowerCase() &&
          supplier.id !== editingId,
      )
    ) {
      setFormError('A supplier with that name already exists.');
      return;
    }

    setSaving(true);

    try {
      const payload = {
        name: cleaned.name,
        email: cleaned.email || null,
        phone: cleaned.phone || null,
        lead_time_days: cleaned.leadTimeDays,
        on_time_delivery_rate: Math.round(cleaned.onTimeDeliveryRate),
        is_active: cleaned.status === 'active',
      };

      if (editingId !== null) {
        await suppliersApi.update(editingId, payload);
      } else {
        await suppliersApi.create(payload);
      }

      await loadSuppliers(false);

      setModalOpen(false);
      setSuccessMessage(
        editingId !== null
          ? 'Supplier updated successfully.'
          : 'Supplier created successfully.',
      );
    } catch (error) {
      console.error('Failed to save supplier:', error);
      setFormError(
        'Could not save supplier. Verify your permissions and backend response, then try again.',
      );
    } finally {
      setSaving(false);
    }
  }

  async function deactivate() {
    if (!confirmInactive || saving) return;

    const supplier = confirmInactive;
    setSaving(true);
    setSupplierLoadError('');
    setSuccessMessage('');

    try {
      await suppliersApi.update(supplier.id, { is_active: false });
      await loadSuppliers(false);

      setConfirmInactive(null);
      setSuccessMessage(`${supplier.name} was deactivated.`);
    } catch (error) {
      console.error('Failed to deactivate supplier:', error);
      setSupplierLoadError(
        'Could not deactivate supplier. Check backend permissions and try again.',
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteSupplier() {
    if (!supplierToDelete || saving) return;

    const supplier = supplierToDelete;
    setSaving(true);
    setSupplierLoadError('');
    setSuccessMessage('');

    try {
      const result = await suppliersApi.delete(supplier.id);

      await loadSuppliers(false);

      setSupplierToDelete(null);

      setSuccessMessage(
        `${supplier.name}: deletion request completed. Refresh the list to verify its current status.`,
      );

      console.info('Supplier deletion result:', result);
    } catch (error) {
      console.error('Failed to delete supplier:', error);
      setSupplierLoadError(
        'Could not delete supplier. It may have linked products or purchase orders, or your account may lack permission.',
      );
      setSupplierToDelete(null);
    } finally {
      setSaving(false);
    }
  }

  function toggleCategory(category: SupplierCategory) {
    setForm((previous) => ({
      ...previous,
      categories: previous.categories.includes(category)
        ? previous.categories.filter((value) => value !== category)
        : [...previous.categories, category],
    }));
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold tracking-[.2em] text-amber-700">
            VELORA / PARTNER NETWORK
          </p>
          <h1 className="mt-2 text-3xl font-bold text-slate-900">
            Suppliers Management
          </h1>
          <p className="mt-2 text-slate-500">
            Monitor sourcing partnerships and delivery performance.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <span className="rounded-full bg-amber-50 px-3 py-2 text-xs text-amber-800">
            Live backend data
          </span>

          <button
            type="button"
            onClick={() => void loadSuppliers()}
            disabled={loadingSuppliers || saving}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2.5 text-sm hover:bg-slate-50 disabled:opacity-50"
            title="Refresh suppliers"
          >
            <RefreshCw size={16} />
            Refresh
          </button>

          <button
            type="button"
            onClick={openCreate}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
          >
            <Plus size={17} />
            Add Supplier
          </button>
        </div>
      </div>

      {loadingSuppliers && (
        <div
          role="status"
          className="rounded-lg border border-slate-200 bg-white p-3 text-sm"
        >
          Loading suppliers from backend…
        </div>
      )}

      {supplierLoadError && (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
        >
          {supplierLoadError}
        </div>
      )}

      {successMessage && (
        <div
          role="status"
          className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800"
        >
          {successMessage}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ['Total Suppliers', suppliers.length, Building2],
          ['Active Partners', active, CheckCircle2],
          ['Average Lead Time', `${averageLead} days`, Clock3],
          ['On-time Delivery', `${avgDelivery}%`, Truck],
        ].map(([label, value, Icon]) => {
          const IconComponent = Icon as typeof Building2;

          return (
            <div key={String(label)} className={`${surface} p-5`}>
              <div className="flex justify-between">
                <span className="text-sm text-slate-500">{String(label)}</span>
                <IconComponent className="text-amber-700" size={20} />
              </div>
              <p className="mt-4 text-2xl font-bold">
                {value as string | number}
              </p>
            </div>
          );
        })}
      </div>

      <section className={`${surface} overflow-hidden`}>
        <div className="flex flex-wrap gap-3 border-b border-slate-100 p-5">
          <div className="flex min-w-52 flex-1 items-center gap-2 rounded-xl border border-slate-200 px-3">
            <Search size={17} className="text-slate-400" />
            <input
              aria-label="Search suppliers"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search supplier, contact, SKU..."
              className="w-full py-2.5 text-sm outline-none"
            />
          </div>

          <select
            aria-label="Filter supplier category"
            value={categoryFilter}
            onChange={(event) => setCategoryFilter(event.target.value)}
            className={inputClass.replace('mt-1 ', '')}
          >
            <option value="all">All Categories</option>
            {supplierCategories.map((category) => (
              <option key={category}>{category}</option>
            ))}
          </select>

          <select
            aria-label="Filter supplier status"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className={inputClass.replace('mt-1 ', '')}
          >
            <option value="all">All Statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>

          <select
            aria-label="Sort suppliers"
            value={sortBy}
            onChange={(event) => setSortBy(event.target.value)}
            className={inputClass.replace('mt-1 ', '')}
          >
            <option value="name">Name A–Z</option>
            <option value="lead">Shortest Lead Time</option>
            <option value="delivery">Best On-time Rate</option>
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                {[
                  'Supplier',
                  'Category',
                  'Country',
                  'Lead Time',
                  'On-time Rate',
                  'Status',
                  'Actions',
                ].map((column) => (
                  <th key={column} className="whitespace-nowrap p-4">
                    {column}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {visible.map((supplier) => (
                <tr
                  key={supplier.id}
                  className="border-t border-slate-100 hover:bg-slate-50"
                >
                  <td className="p-4">
                    <button
                      type="button"
                      onClick={() => setSelectedSupplier(supplier)}
                      className="text-left font-semibold text-slate-900 hover:text-amber-700"
                    >
                      {supplier.name}
                    </button>
                    <p className="text-xs text-slate-500">{supplier.id}</p>
                  </td>

                  <td className="p-4">
                    {supplier.categories.length
                      ? supplier.categories.join(', ')
                      : 'Not provided'}
                  </td>

                  <td className="p-4">{supplier.country}</td>

                  <td className="p-4">{supplier.leadTimeDays} days</td>

                  <td className="p-4">
                    <span
                      className={
                        supplier.onTimeDeliveryRate < 90
                          ? 'font-semibold text-amber-700'
                          : 'text-slate-700'
                      }
                    >
                      {supplier.onTimeDeliveryRate}%
                    </span>
                  </td>

                  <td className="p-4">
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-medium ${
                        supplier.status === 'active'
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {supplier.status}
                    </span>
                  </td>

                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        aria-label={`Edit ${supplier.name}`}
                        title="Edit"
                        onClick={() => openEdit(supplier)}
                        disabled={saving}
                        className="text-blue-600 hover:text-blue-800 disabled:opacity-50"
                      >
                        <Pencil size={17} />
                      </button>

                      {supplier.status === 'active' && (
                        <button
                          type="button"
                          aria-label={`Deactivate ${supplier.name}`}
                          title="Deactivate"
                          onClick={() => setConfirmInactive(supplier)}
                          disabled={saving}
                          className="text-red-500 hover:text-red-700 disabled:opacity-50"
                        >
                          <XCircle size={17} />
                        </button>
                      )}

                      <button
                        type="button"
                        aria-label={`Delete ${supplier.name}`}
                        title="Delete"
                        onClick={() => setSupplierToDelete(supplier)}
                        disabled={saving}
                        className="text-red-600 hover:text-red-800 disabled:opacity-50"
                      >
                        <Trash2 size={17} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {!loadingSuppliers && visible.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-500">
                    No suppliers match your filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <p className="border-t border-slate-100 px-5 py-3 text-xs text-slate-500">
          Showing {visible.length} of {suppliers.length} suppliers · Supplier
          information is loaded from the backend
        </p>
      </section>

      {selectedSupplier && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/60 p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="supplier-detail-title"
            className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl"
          >
            <div className="flex justify-between gap-3">
              <div>
                <h2 id="supplier-detail-title" className="text-xl font-bold">
                  {selectedSupplier.name}
                </h2>
                <p className="text-xs text-slate-500">
                  {selectedSupplier.id} · {selectedSupplier.country}
                </p>
              </div>

              <button
                type="button"
                aria-label="Close supplier details"
                onClick={() => setSelectedSupplier(null)}
              >
                <X size={20} />
              </button>
            </div>

            <dl className="mt-5 grid grid-cols-2 gap-4 text-sm">
              {[
                ['Contact', selectedSupplier.contactName],
                ['Email', selectedSupplier.email],
                ['Phone', selectedSupplier.phone],
                ['Lead Time', `${selectedSupplier.leadTimeDays} days`],
                ['On-time Delivery', `${selectedSupplier.onTimeDeliveryRate}%`],
                ['Status', selectedSupplier.status],
                ['Product SKUs', selectedSupplier.productSkus.join(', ') || 'None'],
                ['Categories', selectedSupplier.categories.join(', ') || 'Not provided'],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt className="text-slate-500">{label}</dt>
                  <dd className="mt-1 break-words font-medium">{value}</dd>
                </div>
              ))}
            </dl>

            <button
              type="button"
              onClick={() => setSelectedSupplier(null)}
              className="mt-6 rounded-lg border px-4 py-2 text-sm"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="supplier-form-title"
            className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl"
          >
            <div className="mb-5 flex justify-between">
              <div>
                <h2 id="supplier-form-title" className="text-xl font-bold">
                  {editingId ? 'Edit Supplier' : 'Add Supplier'}
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  Contact name, country, categories, and SKU assignments are not
                  supported by the current supplier API.
                </p>
              </div>

              <button
                type="button"
                aria-label="Close form"
                onClick={() => setModalOpen(false)}
                disabled={saving}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={save} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                {(
                  [
                    ['name', 'Supplier Name'],
                    ['contactName', 'Contact Person'],
                    ['email', 'Email Address'],
                    ['phone', 'Phone Number'],
                    ['country', 'Country'],
                  ] as const
                ).map(([field, label]) => {
                  const apiSupportsField = [
                    'name',
                    'email',
                    'phone',
                  ].includes(field);

                  return (
                    <label key={field} className="block text-sm font-medium">
                      {label}
                      <input
                        type={field === 'email' ? 'email' : 'text'}
                        required={field === 'name'}
                        disabled={!apiSupportsField || saving}
                        value={form[field]}
                        onChange={(event) =>
                          setForm((previous) => ({
                            ...previous,
                            [field]: event.target.value,
                          }))
                        }
                        className={`${inputClass} ${
                          !apiSupportsField ? 'bg-slate-100 text-slate-500' : ''
                        }`}
                      />
                    </label>
                  );
                })}

                <label className="block text-sm font-medium">
                  Lead Time (days)
                  <input
                    type="number"
                    min="0"
                    step="1"
                    required
                    value={form.leadTimeDays}
                    disabled={saving}
                    onChange={(event) =>
                      setForm((previous) => ({
                        ...previous,
                        leadTimeDays: Number(event.target.value),
                      }))
                    }
                    className={inputClass}
                  />
                </label>

                <label className="block text-sm font-medium">
                  On-time Delivery (%)
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="1"
                    required
                    value={form.onTimeDeliveryRate}
                    disabled={saving}
                    onChange={(event) =>
                      setForm((previous) => ({
                        ...previous,
                        onTimeDeliveryRate: Number(event.target.value),
                      }))
                    }
                    className={inputClass}
                  />
                </label>

                <label className="block text-sm font-medium">
                  Status
                  <select
                    value={form.status}
                    disabled={saving}
                    onChange={(event) =>
                      setForm((previous) => ({
                        ...previous,
                        status: event.target.value as SupplierStatus,
                      }))
                    }
                    className={inputClass}
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </label>
              </div>

              <fieldset>
                <legend className="mb-2 text-sm font-medium">
                  Categories — not currently saved by API
                </legend>

                <div className="flex flex-wrap gap-3">
                  {supplierCategories.map((category) => (
                    <label
                      key={category}
                      className="flex items-center gap-2 text-sm"
                    >
                      <input
                        type="checkbox"
                        disabled
                        checked={form.categories.includes(category)}
                        onChange={() => toggleCategory(category)}
                      />
                      {category}
                    </label>
                  ))}
                </div>
              </fieldset>

              <label className="block text-sm font-medium">
                Supplied Product SKUs — not currently saved by API
                <input
                  disabled
                  value={form.productSkus.join(', ')}
                  placeholder="SKU assignments require a separate API"
                  className={`${inputClass} bg-slate-100 text-slate-500`}
                />
              </label>

              {formError && (
                <p role="alert" className="text-sm text-red-600">
                  {formError}
                </p>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  disabled={saving}
                  className="rounded-xl border px-5 py-2.5 text-sm"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-xl bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {saving
                    ? 'Saving…'
                    : editingId
                      ? 'Save Changes'
                      : 'Create Supplier'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {confirmInactive && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="deactivate-supplier-title"
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
          >
            <h2 id="deactivate-supplier-title" className="text-xl font-bold">
              Deactivate Supplier?
            </h2>

            <p className="mt-3 text-sm text-slate-600">
              Deactivate <strong>{confirmInactive.name}</strong> (
              {confirmInactive.id})? This update will be saved to the backend.
            </p>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setConfirmInactive(null)}
                disabled={saving}
                className="rounded-lg border px-4 py-2 text-sm"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={() => void deactivate()}
                disabled={saving}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                {saving ? 'Working…' : 'Deactivate'}
              </button>
            </div>
          </div>
        </div>
      )}

      {supplierToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-supplier-title"
            aria-describedby="delete-supplier-description"
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
          >
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-50">
              <Trash2 size={24} className="text-red-600" />
            </div>

            <h2 id="delete-supplier-title" className="text-xl font-bold text-slate-900">
              Delete Supplier?
            </h2>

            <p id="delete-supplier-description" className="mt-3 text-sm text-slate-600">
              Delete <strong>{supplierToDelete.name}</strong> (
              {supplierToDelete.id})?
            </p>

            <p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
              The backend may deactivate this supplier instead of deleting it
              when linked product or purchase-order records exist.
            </p>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setSupplierToDelete(null)}
                disabled={saving}
                className="rounded-lg border border-slate-200 px-5 py-2.5 text-sm font-medium"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={() => void handleDeleteSupplier()}
                disabled={saving}
                className="rounded-lg bg-red-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {saving ? 'Working…' : 'Confirm Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}