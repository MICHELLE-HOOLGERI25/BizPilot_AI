import { useMemo, useState } from 'react';
import { AlertTriangle, ClipboardList, PackageCheck, Search, ShieldCheck, X } from 'lucide-react';
import { demoInventory, availableQty } from '../mocks/inventoryData';
import { initialSuppliers } from '../mocks/suppliersData';
import { initialPurchaseOrders, productCosts } from '../mocks/purchaseOrdersData';
import { demoDailyDemand, demoSafetyDays } from '../mocks/replenishmentData';
import type { PurchaseOrderDraftInput } from '../types/purchaseOrder';
import type { ReplenishmentRecommendation, StockRisk } from '../types/replenishment';

const euro = new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
const card = 'rounded-2xl border border-slate-200 bg-white p-5 shadow-sm';
const today = new Date().toISOString().slice(0, 10);

function recommended(row: typeof demoInventory[number], horizon: number): ReplenishmentRecommendation {
  const available = availableQty(row);
  const dailyDemand = demoDailyDemand[row.sku] ?? 0;
  const supplier = initialSuppliers.find(s => s.status === 'active' && s.productSkus.includes(row.sku));
  // Treat only in-transit orders as expected incoming supply in the demo; drafts are not commitments.
  // This is an illustrative SKU-wide quantity, not a store-specific allocation.
  const incoming = initialPurchaseOrders
    .filter(o => o.status === 'in_transit' && o.expectedDate >= today)
    .flatMap(o => o.lines)
    .filter(l => l.sku === row.sku)
    .reduce((sum, l) => sum + l.quantity, 0);
  const daysOfCover = dailyDemand > 0 ? available / dailyDemand : null;
  const risk: StockRisk = dailyDemand === 0 ? 'No Demand' : available === 0 ? 'Critical' : daysOfCover! <= horizon ? 'At Risk' : 'Covered';
  const leadTimeDays = supplier?.leadTimeDays ?? null;
  const targetDays = Math.max(horizon, leadTimeDays ?? horizon) + demoSafetyDays;
  const recommendedQuantity = supplier && dailyDemand > 0
    ? Math.max(0, Math.ceil(targetDays * dailyDemand - available - incoming)) : 0;
  return {
    inventoryId: row.id, sku: row.sku, product: row.product, store: row.store,
    available, dailyDemand, daysOfCover, supplierId: supplier?.id ?? null,
    supplierName: supplier?.name ?? 'No active supplier', leadTimeDays,
    incoming, reorderPoint: row.reorderPoint, recommendedQuantity, risk,
    unitCost: productCosts[row.sku]?.cost ?? 0,
  };
}

export default function ReplenishmentPage() {
  const [horizon, setHorizon] = useState(7);
  const [store, setStore] = useState('All');
  const [risk, setRisk] = useState('All');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [draftPreview, setDraftPreview] = useState<{ supplier: string; payload: PurchaseOrderDraftInput }[] | null>(null);
  const [copied, setCopied] = useState(false);

  const rows = useMemo(() => demoInventory.map(row => recommended(row, horizon)), [horizon]);
  const visible = useMemo(() => rows.filter(row =>
    (store === 'All' || row.store === store) &&
    (risk === 'All' || row.risk === risk) &&
    (row.product.toLowerCase().includes(query.toLowerCase()) || row.sku.toLowerCase().includes(query.toLowerCase()))
  ).sort((a,b) => (a.daysOfCover ?? Number.POSITIVE_INFINITY) - (b.daysOfCover ?? Number.POSITIVE_INFINITY)), [rows, store, risk, query]);

  const critical = rows.filter(r => r.risk === 'Critical').length;
  const atRisk = rows.filter(r => r.risk === 'At Risk').length;
  const selectedRows = rows.filter(r => selected.includes(r.inventoryId) && r.supplierId && r.recommendedQuantity > 0);

  function buildPreview() {
    const groups = new Map<string, ReplenishmentRecommendation[]>();
    for (const r of selectedRows) groups.set(r.supplierId!, [...(groups.get(r.supplierId!) ?? []), r]);
    const results = [...groups.entries()].map(([supplierId, items]) => {
      const supplier = initialSuppliers.find(s => s.id === supplierId)!;
      // Multiple store needs for a SKU combine into one proposed supplier line (demo assumption).
      const bySku = new Map<string, {sku:string; productName:string; quantity:number; unitCost:number}>();
      for (const r of items) {
        const prior = bySku.get(r.sku);
        bySku.set(r.sku, { sku:r.sku, productName:r.product, unitCost:r.unitCost, quantity:(prior?.quantity ?? 0)+r.recommendedQuantity });
      }
      const delivery = new Date();
      delivery.setUTCDate(delivery.getUTCDate()+supplier.leadTimeDays);
      return { supplier: supplier.name, payload: {
        supplierId, expectedDate:delivery.toISOString().slice(0,10),
        notes:`Demo replenishment recommendation (${horizon}-day risk horizon). Review before saving.`,
        lines:[...bySku.values()],
      }};
    });
    setCopied(false);
    setDraftPreview(results);
  }

  async function copyPreview() {
    if (!draftPreview) return;
    try { await navigator.clipboard.writeText(JSON.stringify(draftPreview.map(x=>x.payload), null, 2)); setCopied(true); }
    catch { setCopied(false); }
  }

  return <div className="space-y-6">
    <div className="flex flex-wrap items-start justify-between gap-4"><div>
      <p className="text-xs font-semibold tracking-[0.2em] text-amber-700">VELORA / INVENTORY INTELLIGENCE</p>
      <h1 className="mt-2 text-3xl font-bold text-slate-900">Replenishment</h1>
      <p className="mt-2 text-slate-500">Review stockout risks and prepare purchase order recommendations.</p>
    </div><span className="rounded-full bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">Synthetic demo data</span></div>
    <div className="grid gap-4 sm:grid-cols-3">
      {[
        {label:'Out of Stock',value:critical,icon:AlertTriangle},
        {label:`At Risk in ${horizon} Days`,value:atRisk,icon:ShieldCheck},
        {label:'Eligible Reorder Lines',value:rows.filter(r=>r.recommendedQuantity>0).length,icon:PackageCheck},
      ].map(({label,value,icon:Icon})=><div className={card} key={label}><div className="flex items-center justify-between"><p className="text-sm text-slate-500">{label}</p><Icon size={20} className="text-amber-700"/></div><p className="mt-4 text-3xl font-bold">{value}</p></div>)}
    </div>
    <div className={`${card} flex flex-wrap items-end gap-3`}>
      <label className="flex flex-col gap-1 text-sm">Risk horizon<select aria-label="Risk horizon" className="rounded-lg border px-3 py-2" value={horizon} onChange={e=>{setHorizon(Number(e.target.value));setSelected([]);}}><option value={7}>7 days</option><option value={14}>14 days</option><option value={30}>30 days</option></select></label>
      <label className="flex flex-col gap-1 text-sm">Store<select aria-label="Store" className="rounded-lg border px-3 py-2" value={store} onChange={e=>setStore(e.target.value)}><option>All</option>{[...new Set(demoInventory.map(r=>r.store))].map(s=><option key={s}>{s}</option>)}</select></label>
      <label className="flex flex-col gap-1 text-sm">Risk<select aria-label="Risk" className="rounded-lg border px-3 py-2" value={risk} onChange={e=>setRisk(e.target.value)}><option>All</option><option>Critical</option><option>At Risk</option><option>Covered</option><option>No Demand</option></select></label>
      <label className="flex flex-1 items-center gap-2 rounded-lg border px-3"><Search size={16} className="text-slate-400"/><input aria-label="Search products" className="w-full py-2 outline-none" placeholder="Search product / SKU" value={query} onChange={e=>setQuery(e.target.value)}/></label>
      <button className="rounded-lg bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40" disabled={!selectedRows.length} onClick={buildPreview}><ClipboardList size={16} className="mr-2 inline"/>Prepare Drafts ({selectedRows.length})</button>
    </div>
    <section className={`${card} overflow-x-auto p-0`}>
      <table className="w-full min-w-[1050px] text-left text-sm"><thead className="bg-slate-50 text-slate-500"><tr><th className="p-4">Select</th><th className="p-4">Product / Store</th><th className="p-4">Available</th><th className="p-4">Daily Demand</th><th className="p-4">Days Cover</th><th className="p-4">Risk</th><th className="p-4">Incoming*</th><th className="p-4">Supplier</th><th className="p-4">Reorder Qty</th><th className="p-4">Est. Cost</th></tr></thead>
      <tbody>{visible.map(r=><tr key={r.inventoryId} className="border-t border-slate-100"><td className="p-4"><input type="checkbox" aria-label={`Select ${r.product} at ${r.store}`} disabled={!r.supplierId || r.recommendedQuantity===0} checked={selected.includes(r.inventoryId)} onChange={e=>setSelected(prev=>e.target.checked?[...prev,r.inventoryId]:prev.filter(x=>x!==r.inventoryId))}/></td><td className="p-4"><p className="font-medium">{r.product}</p><p className="text-xs text-slate-500">{r.sku} · {r.store}</p></td><td className="p-4">{r.available}</td><td className="p-4">{r.dailyDemand.toFixed(1)}</td><td className="p-4">{r.daysOfCover===null?'—':r.daysOfCover.toFixed(1)}</td><td className="p-4"><span className={`rounded-full px-2 py-1 text-xs ${r.risk==='Critical'?'bg-red-50 text-red-700':r.risk==='At Risk'?'bg-amber-50 text-amber-800':'bg-emerald-50 text-emerald-700'}`}>{r.risk}</span></td><td className="p-4">{r.incoming}</td><td className="p-4"><p>{r.supplierName}</p>{r.leadTimeDays!==null&&<p className="text-xs text-slate-500">{r.leadTimeDays}d lead time</p>}</td><td className="p-4 font-semibold">{r.recommendedQuantity}</td><td className="p-4">{euro.format(r.recommendedQuantity*r.unitCost)}</td></tr>)}{visible.length===0&&<tr><td colSpan={10} className="p-8 text-center text-slate-500">No matching inventory records</td></tr>}</tbody></table>
    </section>
    <p className="text-xs text-slate-500">*Incoming values count demo in-transit purchase orders by SKU, without store allocation; the same SKU-wide incoming amount may appear across locations. Days cover = available / daily demand. Reorder quantity = max(0, ceil((max(risk horizon, supplier lead time) + {demoSafetyDays} safety days) × daily demand − available − incoming)). Demo-only assumptions; Person 2 will calculate and validate actual recommendations.</p>
    <div className="text-xs text-slate-500">Select eligible rows to prepare a reviewable draft payload. No purchase order is saved or sent in this frontend-only workflow.</div>
    {draftPreview&&<div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4"><div role="dialog" aria-modal="true" aria-labelledby="draft-preview-title" className="max-h-[90vh] w-full max-w-2xl overflow-auto rounded-2xl bg-white p-6 shadow-xl"><div className="flex items-center justify-between"><h2 id="draft-preview-title" className="text-xl font-bold">Review Draft PO Proposals</h2><button aria-label="Close preview" onClick={()=>setDraftPreview(null)}><X size={20}/></button></div><p className="my-3 text-sm text-slate-500">These are proposals only; not persisted purchase orders.</p>{draftPreview.map(group=><div key={group.payload.supplierId} className="my-3 rounded-xl border p-4"><p className="font-semibold">{group.supplier} · {group.payload.supplierId}</p><p className="text-xs text-slate-500">Expected date: {group.payload.expectedDate}</p>{group.payload.lines.map(line=><div key={line.sku} className="flex justify-between gap-3 border-t py-2 text-sm"><span>{line.productName} · {line.sku}</span><span>{line.quantity} × {euro.format(line.unitCost)}</span></div>)}</div>)}<div className="flex flex-wrap justify-end gap-3"><button className="rounded-lg border px-4 py-2" onClick={()=>setDraftPreview(null)}>Close</button><button className="rounded-lg bg-slate-950 px-4 py-2 text-white" onClick={()=>void copyPreview()}>{copied?'Copied JSON':'Copy Draft JSON'}</button></div></div></div>}
  </div>;
}
