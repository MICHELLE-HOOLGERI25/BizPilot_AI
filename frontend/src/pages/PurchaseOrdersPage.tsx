import { useMemo, useState } from 'react';
import { ClipboardList, Plus, Search, X, Eye, Pencil, Ban, PackageCheck } from 'lucide-react';
import { initialSuppliers } from '../mocks/suppliersData';
import { initialPurchaseOrders, orderTotal, productCosts } from '../mocks/purchaseOrdersData';
import type { PurchaseOrder, PurchaseOrderDraftInput, PurchaseOrderStatus } from '../types/purchaseOrder';

const money = new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR' });
const styles = {
  input: 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-amber-600',
  card: 'rounded-2xl border border-slate-200 bg-white p-5 shadow-sm',
};
const statuses: PurchaseOrderStatus[] = ['draft', 'submitted', 'in_transit', 'received', 'cancelled'];
const names: Record<PurchaseOrderStatus, string> = {
  draft: 'Draft', submitted: 'Submitted', in_transit: 'In Transit', received: 'Received', cancelled: 'Cancelled',
};
const statusClasses: Record<PurchaseOrderStatus, string> = {
  draft: 'bg-amber-50 text-amber-800', submitted: 'bg-blue-50 text-blue-700',
  in_transit: 'bg-violet-50 text-violet-700', received: 'bg-emerald-50 text-emerald-700',
  cancelled: 'bg-slate-100 text-slate-500',
};
const blank = (): PurchaseOrderDraftInput => ({ supplierId: '', expectedDate: '', notes: '', lines: [] });

export default function PurchaseOrdersPage() {
  const [orders, setOrders] = useState<PurchaseOrder[]>(initialPurchaseOrders);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all');
  const [supplier, setSupplier] = useState('all');
  const [selected, setSelected] = useState<PurchaseOrder | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<PurchaseOrderDraftInput>(blank());
  const [sku, setSku] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [error, setError] = useState('');
  const [confirmCancel, setConfirmCancel] = useState<PurchaseOrder | null>(null);

  const supplierMap = useMemo(() => new Map(initialSuppliers.map(s => [s.id, s])), []);
  const visible = useMemo(() => orders.filter(o => {
    const supplierName = supplierMap.get(o.supplierId)?.name ?? '';
    const needle = query.trim().toLowerCase();
    return (status === 'all' || o.status === status)
      && (supplier === 'all' || o.supplierId === supplier)
      && (!needle || [o.id, supplierName, ...o.lines.flatMap(l => [l.sku, l.productName])].some(s => s.toLowerCase().includes(needle)));
  }).sort((a, b) => b.createdAt.localeCompare(a.createdAt)), [orders, status, supplier, query, supplierMap]);

  const activeSupplier = supplierMap.get(form.supplierId);
  const skuOptions = (activeSupplier?.productSkus ?? []).filter(s => !!productCosts[s]);

  function openCreate() {
    setEditId(null); setForm(blank()); setSku(''); setQuantity(1); setError(''); setFormOpen(true);
  }
  function openEdit(order: PurchaseOrder) {
    if (order.status !== 'draft') return;
    setEditId(order.id);
    setForm({ supplierId: order.supplierId, expectedDate: order.expectedDate, notes: order.notes, lines: order.lines.map(l => ({ ...l })) });
    setSku(''); setQuantity(1); setError(''); setFormOpen(true);
  }
  function selectSupplier(id: string) {
    setForm(old => ({ ...old, supplierId: id, lines: id === old.supplierId ? old.lines : [] }));
    setSku(''); setError('');
  }
  function addLine() {
    if (!activeSupplier || !activeSupplier.productSkus.includes(sku) || !productCosts[sku]) { setError('Select a product offered by this supplier.'); return; }
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 10000) { setError('Quantity must be a whole number between 1 and 10,000.'); return; }
    if (form.lines.some(l => l.sku === sku)) { setError('This SKU is already in the draft. Remove it before changing the quantity.'); return; }
    setForm(old => ({ ...old, lines: [...old.lines, { sku, productName: productCosts[sku].name, quantity, unitCost: productCosts[sku].cost }] }));
    setSku(''); setQuantity(1); setError('');
  }
  function saveDraft(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const target = supplierMap.get(form.supplierId);
    if (!target || target.status !== 'active') { setError('Choose an active supplier.'); return; }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(form.expectedDate) || form.expectedDate < new Date().toISOString().slice(0, 10)) { setError('Choose a valid expected delivery date that is not in the past.'); return; }
    if (!form.lines.length || form.lines.some(l => !target.productSkus.includes(l.sku) || l.quantity <= 0)) { setError('Include at least one valid product from this supplier.'); return; }
    if (editId) {
      setOrders(old => old.map(o => o.id === editId && o.status === 'draft' ? { ...o, ...form, lines: form.lines.map(l => ({ ...l })) } : o));
    } else {
      const order: PurchaseOrder = { ...form, id: `PO-DEMO-${crypto.randomUUID().slice(0, 8).toUpperCase()}`, status: 'draft', createdAt: new Date().toISOString().slice(0, 10), lines: form.lines.map(l => ({ ...l })) };
      setOrders(old => [order, ...old]);
    }
    setFormOpen(false); setError('');
  }
  function cancelDraft() {
    if (!confirmCancel || confirmCancel.status !== 'draft') return;
    setOrders(old => old.map(o => o.id === confirmCancel.id && o.status === 'draft' ? { ...o, status: 'cancelled' } : o));
    setSelected(old => old?.id === confirmCancel.id ? null : old);
    setConfirmCancel(null);
  }

  return <div className="space-y-7">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><p className="text-xs font-semibold tracking-[0.2em] text-amber-700">VELORA / PROCUREMENT</p>
        <h1 className="mt-2 text-3xl font-bold text-slate-900">Purchase Orders</h1>
        <p className="mt-2 text-slate-500">Manage supplier purchasing and prepare replenishment drafts.</p></div>
      <div className="flex items-center gap-2"><span className="rounded-full bg-amber-50 px-3 py-2 text-xs text-amber-800">Synthetic demo data</span>
        <button onClick={openCreate} className="flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-3 text-sm font-medium text-white hover:bg-slate-800"><Plus size={18}/> New Draft PO</button></div>
    </div>
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {[
        { label:'Total Orders', value:orders.length, icon:ClipboardList },
        { label:'Drafts', value:orders.filter(o => o.status === 'draft').length, icon:Pencil },
        { label:'In Transit', value:orders.filter(o => o.status === 'in_transit').length, icon:PackageCheck },
        { label:'Total Order Value', value:money.format(orders.filter(o => o.status !== 'cancelled').reduce((sum,o) => sum + orderTotal(o),0)), icon:ClipboardList },
      ].map(({label,value,icon:Icon}) => <div key={label} className={styles.card}><div className="flex items-center justify-between text-sm text-slate-500">{label}<Icon size={19} className="text-amber-700"/></div><p className="mt-4 text-2xl font-bold">{value}</p></div>)}
    </div>
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap gap-3 border-b border-slate-100 p-5">
        <label className="relative min-w-52 flex-1"><Search className="absolute left-3 top-3 text-slate-400" size={18}/><input aria-label="Search purchase orders" className={`${styles.input} pl-10`} placeholder="Search PO, supplier, or SKU..." value={query} onChange={e=>setQuery(e.target.value)}/></label>
        <select aria-label="Filter purchase order status" className={styles.input + ' w-auto'} value={status} onChange={e=>setStatus(e.target.value)}><option value="all">All statuses</option>{statuses.map(s=><option key={s} value={s}>{names[s]}</option>)}</select>
        <select aria-label="Filter purchase order supplier" className={styles.input + ' w-auto'} value={supplier} onChange={e=>setSupplier(e.target.value)}><option value="all">All suppliers</option>{initialSuppliers.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select>
      </div>
      <div className="overflow-x-auto"><table className="w-full min-w-[780px] text-left text-sm">
        <thead className="bg-slate-50 text-slate-500"><tr>{['PO Number','Supplier','Created','Expected','Lines','Value','Status','Actions'].map(c=><th key={c} className="p-4">{c}</th>)}</tr></thead>
        <tbody>{visible.map(o=><tr key={o.id} className="border-t border-slate-100 hover:bg-slate-50">
          <td className="p-4 font-semibold">{o.id}</td><td className="p-4">{supplierMap.get(o.supplierId)?.name ?? o.supplierId}</td><td className="p-4">{o.createdAt}</td><td className="p-4">{o.expectedDate}</td><td className="p-4">{o.lines.length}</td><td className="p-4 font-medium">{money.format(orderTotal(o))}</td>
          <td className="p-4"><span className={`rounded-full px-3 py-1 text-xs font-medium ${statusClasses[o.status]}`}>{names[o.status]}</span></td>
          <td className="p-4"><div className="flex items-center gap-2"><button onClick={()=>setSelected(o)} title="View order" aria-label={`View ${o.id}`} className="rounded-lg p-2 text-blue-700 hover:bg-blue-50"><Eye size={17}/></button>{o.status==='draft' && <><button onClick={()=>openEdit(o)} title="Edit draft" aria-label={`Edit ${o.id}`} className="rounded-lg p-2 text-amber-700 hover:bg-amber-50"><Pencil size={17}/></button><button onClick={()=>setConfirmCancel(o)} title="Cancel draft" aria-label={`Cancel ${o.id}`} className="rounded-lg p-2 text-red-600 hover:bg-red-50"><Ban size={17}/></button></>}</div></td>
        </tr>)}{visible.length===0 && <tr><td colSpan={8} className="p-10 text-center text-slate-500">No purchase orders match your filters.</td></tr>}</tbody>
      </table></div><p className="border-t border-slate-100 px-5 py-3 text-xs text-slate-500">Showing {visible.length} of {orders.length} orders · Demo state resets on refresh</p>
    </section>
    {selected && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4"><section role="dialog" aria-modal="true" aria-labelledby="po-detail-title" className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
      <div className="flex items-center justify-between"><h2 id="po-detail-title" className="text-xl font-bold">{selected.id}</h2><button aria-label="Close details" onClick={()=>setSelected(null)}><X/></button></div>
      <p className="mt-2 text-sm text-slate-500">{supplierMap.get(selected.supplierId)?.name} · {names[selected.status]} · Expected {selected.expectedDate}</p>
      <div className="mt-5 space-y-3">{selected.lines.map(l=><div key={l.sku} className="flex justify-between gap-3 border-b border-slate-100 pb-3 text-sm"><div><p className="font-semibold">{l.productName}</p><p className="text-slate-500">{l.sku} · {l.quantity} × {money.format(l.unitCost)}</p></div><span className="font-semibold">{money.format(l.unitCost*l.quantity)}</span></div>)}</div>
      <p className="mt-4 text-right text-lg font-bold">Total: {money.format(orderTotal(selected))}</p><p className="mt-3 text-sm text-slate-500">Notes: {selected.notes || 'None'}</p>
      <button onClick={()=>setSelected(null)} className="mt-5 rounded-xl bg-slate-950 px-5 py-2.5 text-white">Close</button>
    </section></div>}
    {formOpen && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4"><section role="dialog" aria-modal="true" aria-labelledby="po-form-title" className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
      <div className="flex items-center justify-between"><h2 id="po-form-title" className="text-xl font-bold">{editId?'Edit Draft Purchase Order':'New Draft Purchase Order'}</h2><button type="button" aria-label="Close draft form" onClick={()=>setFormOpen(false)}><X/></button></div>
      <p className="mt-2 text-xs text-amber-700">Demo only — saving does not submit an order to a supplier or affect inventory.</p>
      <form onSubmit={saveDraft} className="mt-5 space-y-4">
        <label className="block text-sm font-medium">Supplier<select required className={`mt-1 ${styles.input}`} value={form.supplierId} onChange={e=>selectSupplier(e.target.value)}><option value="">Choose active supplier</option>{initialSuppliers.filter(s=>s.status==='active').map(s=><option key={s.id} value={s.id}>{s.name} ({s.leadTimeDays}d lead time)</option>)}</select></label>
        <label className="block text-sm font-medium">Expected delivery date<input required type="date" min={new Date().toISOString().slice(0,10)} className={`mt-1 ${styles.input}`} value={form.expectedDate} onChange={e=>setForm(f=>({...f,expectedDate:e.target.value}))}/></label>
        <div className="rounded-xl bg-slate-50 p-4"><p className="mb-3 text-sm font-semibold">Order lines</p><div className="grid gap-2 sm:grid-cols-[1fr_100px_auto]">
          <select aria-label="Product SKU" className={styles.input} value={sku} onChange={e=>setSku(e.target.value)} disabled={!activeSupplier}><option value="">Select supplier product</option>{skuOptions.map(s=><option key={s} value={s}>{s} · {productCosts[s].name}</option>)}</select>
          <input aria-label="Quantity" className={styles.input} type="number" min="1" max="10000" step="1" value={quantity} onChange={e=>setQuantity(Number(e.target.value))}/>
          <button type="button" onClick={addLine} className="rounded-xl bg-amber-700 px-4 py-2 text-white disabled:opacity-50" disabled={!activeSupplier}>Add line</button>
        </div><div className="mt-3 space-y-2">{form.lines.map(l=><div className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white p-3 text-sm" key={l.sku}><span>{l.productName} ({l.sku}) · {l.quantity} × {money.format(l.unitCost)}</span><button type="button" className="text-red-600" aria-label={`Remove ${l.sku}`} onClick={()=>setForm(f=>({...f,lines:f.lines.filter(x=>x.sku!==l.sku)}))}><X size={17}/></button></div>)}{form.lines.length===0 && <p className="text-xs text-slate-500">No products added yet.</p>}</div><p className="mt-3 text-right text-sm font-bold">Draft total: {money.format(form.lines.reduce((sum,l)=>sum+l.unitCost*l.quantity,0))}</p></div>
        <label className="block text-sm font-medium">Notes<textarea rows={2} className={`mt-1 ${styles.input}`} value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} /></label>
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        <div className="flex justify-end gap-2"><button type="button" onClick={()=>setFormOpen(false)} className="rounded-xl border px-5 py-2.5">Cancel</button><button type="submit" className="rounded-xl bg-slate-950 px-5 py-2.5 text-white">Save Draft</button></div>
      </form>
    </section></div>}
    {confirmCancel && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4"><section role="alertdialog" aria-modal="true" aria-labelledby="cancel-title" className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"><h2 id="cancel-title" className="text-lg font-bold">Cancel draft {confirmCancel.id}?</h2><p className="mt-3 text-sm text-slate-600">This will mark the demo draft as cancelled. No real purchase order will be changed.</p><div className="mt-5 flex justify-end gap-3"><button onClick={()=>setConfirmCancel(null)} className="rounded-xl border px-4 py-2">Keep Draft</button><button onClick={cancelDraft} className="rounded-xl bg-red-600 px-4 py-2 text-white">Cancel Draft</button></div></section></div>}
  </div>;
}
