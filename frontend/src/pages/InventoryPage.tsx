import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Boxes, CheckCircle2, PackageX, Search, SlidersHorizontal, X } from 'lucide-react';
import { availableQty, stockStatus, type InventoryRecord, type InventoryStatus } from '../mocks/inventoryData';
import { inventoryApi } from '../api/inventory';

type StatusFilter = 'All' | InventoryStatus;
type EditValues = { onHand: number; reserved: number; reorderPoint: number };

export default function InventoryPage() {
  const [records, setRecords] = useState<InventoryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  useEffect(() => {
    let cancelled = false;

    async function loadInventory() {
      setLoading(true);
      setLoadError('');

      try {
        const result = await inventoryApi.list();
        if (!cancelled) setRecords(result);
      } catch (error) {
        if (!cancelled) {
          setLoadError(
            error instanceof Error
              ? error.message
              : 'Unable to load inventory from the backend.'
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadInventory();
    return () => { cancelled = true; };
  }, [refreshKey]);

  const [search, setSearch] = useState('');
  const [store, setStore] = useState('All');
  const [status, setStatus] = useState<StatusFilter>('All');
  const [sort, setSort] = useState('available-asc');
  const [editing, setEditing] = useState<InventoryRecord | null>(null);
  const [values, setValues] = useState<EditValues>({ onHand: 0, reserved: 0, reorderPoint: 0 });
  const [formError, setFormError] = useState('');
  const [notice, setNotice] = useState('');
  const [saving, setSaving] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return records.filter(r =>
      (r.product.toLowerCase().includes(q) || r.sku.toLowerCase().includes(q)) &&
      (store === 'All' || r.store === store) &&
      (status === 'All' || stockStatus(r) === status)
    ).sort((a,b) => sort === 'available-asc' ? availableQty(a)-availableQty(b)
      : sort === 'available-desc' ? availableQty(b)-availableQty(a)
      : a.product.localeCompare(b.product));
  }, [records, search, store, status, sort]);

  const low = records.filter(r => stockStatus(r) === 'Low Stock').length;
  const out = records.filter(r => stockStatus(r) === 'Out of Stock').length;
  const healthy = records.filter(r => stockStatus(r) === 'Healthy').length;

  function edit(record: InventoryRecord) {
    setEditing(record);
    setValues({ onHand: record.onHand, reserved: record.reserved, reorderPoint: record.reorderPoint });
    setFormError('');
  }
  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editing || saving) return;

    if (values.reserved > values.onHand) {
      setFormError('Reserved quantity cannot exceed on-hand quantity.');
      return;
    }

    const reason = window.prompt('Reason for this stock adjustment:');
    if (!reason?.trim()) {
      setFormError('Please provide a reason for the adjustment.');
      return;
    }

    setSaving(true);
    setFormError('');

    try {
      await inventoryApi.adjust(editing.id, {
        ...values,
        expectedVersion: editing.version,
        reason: reason.trim(),
      });
      setEditing(null);
      setNotice('Inventory adjustment saved successfully.');
      setRefreshKey(k => k + 1);
    } catch (error) {
      setFormError(
        error instanceof Error
          ? error.message
          : 'Unable to save inventory adjustment. Please refresh and try again.'
      );
    } finally {
      setSaving(false);
    }
  }
  const statusStyle = (s: InventoryStatus) => s === 'Healthy' ? 'bg-emerald-50 text-emerald-700' : s === 'Low Stock' ? 'bg-amber-50 text-amber-800' : 'bg-red-50 text-red-700';

  return <div className="space-y-7">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <p className="text-xs font-semibold tracking-[0.2em] text-amber-700">VELORA / STOCK OPERATIONS</p>
        <h1 className="mt-2 text-3xl font-bold text-slate-900">Inventory Management</h1>
        <p className="mt-2 text-slate-500">Stock availability, reservations, and reorder thresholds across stores.</p>
      </div>
      <span className="rounded-full bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">Live Backend Data</span>
    </div>
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {[
        { label:'Inventory Records', value:records.length, Icon:Boxes },
        { label:'Healthy', value:healthy, Icon:CheckCircle2 },
        { label:'Low Stock', value:low, Icon:AlertTriangle },
        { label:'Out of Stock', value:out, Icon:PackageX },
      ].map(({label,value,Icon}) => <div key={label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between"><p className="text-sm text-slate-500">{label}</p><Icon size={20} className="text-amber-700"/></div>
        <p className="mt-4 text-3xl font-bold text-slate-900">{value}</p>
      </div>)}
    </div>
    {loading && <div role="status" className="rounded-xl bg-blue-50 px-4 py-3 text-sm text-blue-800">Loading inventory from the backend?</div>}
    {loadError && <div role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800"><p>Unable to load inventory: {loadError}</p><button type="button" onClick={() => setRefreshKey(k => k + 1)} className="mt-2 underline">Retry</button></div>}
    {notice && <div role="status" className="rounded-xl bg-blue-50 px-4 py-3 text-sm text-blue-800">{notice}</div>}
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 p-5">
        <div className="flex min-w-52 flex-1 items-center gap-2 rounded-xl border border-slate-200 px-3"><Search size={18} className="text-slate-400"/><input aria-label="Search inventory" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search name or SKU..." className="w-full bg-transparent py-3 text-sm outline-none"/></div>
        <select aria-label="Filter store" value={store} onChange={e=>setStore(e.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm"><option value="All">All Stores</option>{Array.from(new Set(records.map(r=>r.store))).map(s=><option key={s}>{s}</option>)}</select>
        <select aria-label="Filter stock status" value={status} onChange={e=>setStatus(e.target.value as StatusFilter)} className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm"><option>All</option><option>Healthy</option><option>Low Stock</option><option>Out of Stock</option></select>
        <select aria-label="Sort inventory" value={sort} onChange={e=>setSort(e.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm"><option value="available-asc">Available: Low to High</option><option value="available-desc">Available: High to Low</option><option value="name">Product Aâ€“Z</option></select>
      </div>
      <div className="overflow-x-auto"><table className="w-full min-w-[900px] text-left text-sm">
        <thead className="bg-slate-50 text-slate-500"><tr>{['Product / SKU','Store','On hand','Reserved','Available','Reorder at','Status','Actions'].map(h=><th key={h} className="p-4 font-semibold">{h}</th>)}</tr></thead>
        <tbody>{filtered.map(r=><tr key={r.id} className="border-t border-slate-100 hover:bg-slate-50">
          <td className="p-4"><p className="font-semibold text-slate-900">{r.product}</p><p className="text-xs text-slate-500">{r.sku}</p></td>
          <td className="p-4">{r.store}</td><td className="p-4">{r.onHand}</td><td className="p-4">{r.reserved}</td>
          <td className="p-4 font-semibold">{availableQty(r)}</td><td className="p-4">{r.reorderPoint}</td>
          <td className="p-4"><span className={`rounded-full px-3 py-1 text-xs font-medium ${statusStyle(stockStatus(r))}`}>{stockStatus(r)}</span></td>
          <td className="p-4"><button onClick={()=>edit(r)} disabled={saving} className="inline-flex items-center gap-1 rounded-lg px-3 py-2 text-slate-400" title="Backend stock adjustment is not available yet"><SlidersHorizontal size={15}/> Adjust</button></td>
        </tr>)}{filtered.length===0 && <tr><td colSpan={8} className="p-10 text-center text-slate-500">No matching inventory records.</td></tr>}</tbody>
      </table></div>
      <div className="border-t border-slate-100 px-5 py-3 text-xs text-slate-500">Showing {filtered.length} of {records.length} inventory records Â· Available = on hand âˆ’ reserved</div>
    </section>
    {editing && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
      <div role="dialog" aria-modal="true" aria-labelledby="inventory-edit-title" className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-3"><div><h2 id="inventory-edit-title" className="text-xl font-bold">Adjust Inventory</h2><p className="mt-1 text-sm text-slate-500">{editing.product} Â· {editing.store}</p></div><button onClick={()=>setEditing(null)} aria-label="Close dialog"><X size={21}/></button></div>

        <form onSubmit={save} className="mt-5 space-y-4">
          {([['onHand','On-hand quantity'],['reserved','Reserved quantity'],['reorderPoint','Reorder threshold']] as const).map(([field,label])=><label key={field} className="block text-sm font-medium">{label}<input type="number" min="0" step="1" required value={values[field]} onChange={e=>setValues(old=>({...old,[field]:Number(e.target.value)}))} className="mt-2 w-full rounded-xl border border-slate-200 p-3"/></label>)}
          {formError && <p role="alert" className="text-sm text-red-600">{formError}</p>}
          <div className="flex justify-end gap-3 pt-3"><button type="button" onClick={()=>setEditing(null)} className="rounded-xl border px-5 py-2.5">Cancel</button><button type="submit" disabled={saving} className="rounded-xl bg-slate-900 px-5 py-2.5 font-medium text-white disabled:cursor-not-allowed">{saving ? "Saving..." : "Save Adjustment"}</button></div>
        </form>
      </div>
    </div>}
  </div>;
}
