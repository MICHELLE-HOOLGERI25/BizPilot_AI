import { useMemo, useState, type FormEvent } from 'react';

import { Building2, CheckCircle2, Clock3, Pencil, Plus, Search, Truck, X, XCircle, Trash2 } from 'lucide-react';

import { emptySupplierForm, initialSuppliers, supplierCategories } from '../mocks/suppliersData';

import type { Supplier, SupplierCategory, SupplierInput, SupplierStatus } from '../types/supplier';

// Person 1 demo only: data resets on refresh. Person 2 will own persistence,

// permission checks and audited mutations through the backend API.

const surface = 'rounded-2xl border border-slate-200 bg-white shadow-sm';

const inputClass = 'mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-amber-600';

export default function SuppliersPage() {

  const [suppliers, setSuppliers] = useState<Supplier[]>(initialSuppliers);

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

  const visible = useMemo(() => {

    const q = search.trim().toLowerCase();

    return suppliers.filter(s =>

      (!q || [s.id, s.name, s.country, s.contactName, ...s.productSkus].some(v => v.toLowerCase().includes(q))) &&

      (categoryFilter === 'all' || s.categories.includes(categoryFilter as SupplierCategory)) &&

      (statusFilter === 'all' || s.status === statusFilter)

    ).sort((a,b) => sortBy === 'lead' ? a.leadTimeDays-b.leadTimeDays : sortBy === 'delivery' ? b.onTimeDeliveryRate-a.onTimeDeliveryRate : a.name.localeCompare(b.name));

  }, [suppliers, search, categoryFilter, statusFilter, sortBy]);

  const active = suppliers.filter(s=>s.status==='active').length;

  const averageLead = active ? Math.round(suppliers.filter(s=>s.status==='active').reduce((n,s)=>n+s.leadTimeDays,0)/active) : 0;

  const avgDelivery = active ? (suppliers.filter(s=>s.status==='active').reduce((n,s)=>n+s.onTimeDeliveryRate,0)/active).toFixed(1) : '0.0';

  function openCreate() { setEditingId(null); setForm({ ...emptySupplierForm, categories:[...emptySupplierForm.categories], productSkus:[] }); setFormError(''); setModalOpen(true); }

  function openEdit(s: Supplier) { setEditingId(s.id); setForm({name:s.name, contactName:s.contactName, email:s.email, phone:s.phone, country:s.country, categories:[...s.categories], leadTimeDays:s.leadTimeDays, onTimeDeliveryRate:s.onTimeDeliveryRate, status:s.status, productSkus:[...s.productSkus]}); setFormError(''); setModalOpen(true); }

  function save(event: FormEvent<HTMLFormElement>) {

    event.preventDefault(); setFormError('');

    const cleaned: SupplierInput = { ...form, name: form.name.trim(), contactName:form.contactName.trim(), email:form.email.trim(), phone:form.phone.trim(), country:form.country.trim(), productSkus:[...new Set(form.productSkus.map(x=>x.trim().toUpperCase()).filter(Boolean))] };

    if (!cleaned.name || !cleaned.email || !cleaned.contactName || !cleaned.country) {setFormError('Please complete all required fields.');return;}

    if (!Number.isInteger(cleaned.leadTimeDays) || cleaned.leadTimeDays<1 || !Number.isFinite(cleaned.onTimeDeliveryRate) || cleaned.onTimeDeliveryRate<0 || cleaned.onTimeDeliveryRate>100) {setFormError('Lead time must be a whole number of days greater than 0; on-time rate must be between 0 and 100.');return;}

    if (cleaned.categories.length===0) {setFormError('Select at least one category.');return;}

    if (suppliers.some(s=>s.name.toLowerCase()===cleaned.name.toLowerCase() && s.id!==editingId)) {setFormError('Supplier name already exists.');return;}

    if (editingId) setSuppliers(prev=>prev.map(s=>s.id===editingId?{...s,...cleaned}:s));

    else setSuppliers(prev=>[...prev,{...cleaned,id:`SUP-${crypto.randomUUID().slice(0,8).toUpperCase()}`}]);

    setModalOpen(false);

  }

  function deactivate() {

    if (!confirmInactive) return;

    setSuppliers(prev=>prev.map(s=>s.id===confirmInactive.id?{...s,status:'inactive'}:s));

    setConfirmInactive(null);

  }

  function toggleCategory(category: SupplierCategory) {

    setForm(prev=>({...prev,categories:prev.categories.includes(category)?prev.categories.filter(x=>x!==category):[...prev.categories,category]}));

  }

  function handleDeleteSupplier() {

  if (!supplierToDelete) return;

  setSuppliers((previous) =>

    previous.filter(

      (supplier) => supplier.id !== supplierToDelete.id

    )

  );

  setSupplierToDelete(null);

  }

  return <div className="space-y-6">

    <div className="flex flex-wrap items-start justify-between gap-4">

      <div><p className="text-xs font-semibold tracking-[.2em] text-amber-700">VELORA / PARTNER NETWORK</p><h1 className="mt-2 text-3xl font-bold text-slate-900">Suppliers Management</h1><p className="mt-2 text-slate-500">Monitor sourcing partnerships and delivery performance.</p></div>

      <div className="flex items-center gap-3"><span className="rounded-full bg-amber-50 px-3 py-2 text-xs text-amber-800">Synthetic demo data</span><button onClick={openCreate} className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"><Plus size={17}/> Add Supplier</button></div>

    </div>

    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">

      {[["Total Suppliers",suppliers.length,Building2],["Active Partners",active,CheckCircle2],["Average Lead Time",`${averageLead} days`,Clock3],["On-time Delivery",`${avgDelivery}%`,Truck]].map(([label,value,Icon])=>{

        const IconComponent=Icon as typeof Building2;

        return <div key={String(label)} className={`${surface} p-5`}><div className="flex justify-between"><span className="text-sm text-slate-500">{String(label)}</span><IconComponent className="text-amber-700" size={20}/></div><p className="mt-4 text-2xl font-bold">{value as string | number}</p></div>;

      })}

    </div>

    <section className={`${surface} overflow-hidden`}>

      <div className="flex flex-wrap gap-3 border-b border-slate-100 p-5">

        <div className="flex min-w-52 flex-1 items-center gap-2 rounded-xl border border-slate-200 px-3"><Search size={17} className="text-slate-400"/><input aria-label="Search suppliers" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search supplier, contact, SKU..." className="w-full py-2.5 text-sm outline-none"/></div>

        <select aria-label="Filter supplier category" value={categoryFilter} onChange={e=>setCategoryFilter(e.target.value)} className={inputClass.replace('mt-1 ', '')}><option value="all">All Categories</option>{supplierCategories.map(c=><option key={c}>{c}</option>)}</select>

        <select aria-label="Filter supplier status" value={statusFilter} onChange={e=>setStatusFilter(e.target.value)} className={inputClass.replace('mt-1 ', '')}><option value="all">All Statuses</option><option value="active">Active</option><option value="inactive">Inactive</option></select>

        <select aria-label="Sort suppliers" value={sortBy} onChange={e=>setSortBy(e.target.value)} className={inputClass.replace('mt-1 ', '')}><option value="name">Name A–Z</option><option value="lead">Shortest Lead Time</option><option value="delivery">Best On-time Rate</option></select>

      </div>

      <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-slate-50 text-slate-500"><tr>{['Supplier','Category','Country','Lead Time','On-time Rate','Status','Actions'].map(c=><th key={c} className="whitespace-nowrap p-4">{c}</th>)}</tr></thead><tbody>{visible.map(s=><tr key={s.id} className="border-t border-slate-100 hover:bg-slate-50"><td className="p-4"><button onClick={()=>setSelectedSupplier(s)} className="text-left font-semibold text-slate-900 hover:text-amber-700">{s.name}</button><p className="text-xs text-slate-500">{s.id}</p></td><td className="p-4">{s.categories.join(', ')}</td><td className="p-4">{s.country}</td><td className="p-4">{s.leadTimeDays} days</td><td className="p-4"><span className={s.onTimeDeliveryRate<90?'font-semibold text-amber-700':'text-slate-700'}>{s.onTimeDeliveryRate}%</span></td><td className="p-4"><span className={`rounded-full px-3 py-1 text-xs font-medium ${s.status==='active'?'bg-emerald-50 text-emerald-700':'bg-slate-100 text-slate-600'}`}>{s.status}</span></td><td className="p-4"><div className="flex items-center gap-3"><button aria-label={`Edit ${s.name}`} title="Edit" onClick={()=>openEdit(s)} className="text-blue-600 hover:text-blue-800"><Pencil size={17}/></button>{s.status==='active'&&<button aria-label={`Deactivate ${s.name}`} title="Deactivate" onClick={()=>setConfirmInactive(s)} className="text-red-500 hover:text-red-700"><XCircle size={17}/></button>}<button type="button" aria-label={`Delete ${s.name}`} title="Delete" onClick={() => setSupplierToDelete(s)} className="text-red-600 hover:text-red-800"><Trash2 size={17}/></button></div></td></tr>)}{visible.length===0&&<tr><td colSpan={7} className="p-8 text-center text-slate-500">No suppliers match your filters.</td></tr>}</tbody></table></div>

      <p className="border-t border-slate-100 px-5 py-3 text-xs text-slate-500">Showing {visible.length} of {suppliers.length} suppliers · Demo changes reset on refresh</p>

    </section>

    {selectedSupplier&&<div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/60 p-4"><div role="dialog" aria-modal="true" aria-labelledby="supplier-detail-title" className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl"><div className="flex justify-between gap-3"><div><h2 id="supplier-detail-title" className="text-xl font-bold">{selectedSupplier.name}</h2><p className="text-xs text-slate-500">{selectedSupplier.id} · {selectedSupplier.country}</p></div><button aria-label="Close supplier details" onClick={()=>setSelectedSupplier(null)}><X size={20}/></button></div><dl className="mt-5 grid grid-cols-2 gap-4 text-sm">{[['Contact',selectedSupplier.contactName],['Email',selectedSupplier.email],['Phone',selectedSupplier.phone],['Lead Time',`${selectedSupplier.leadTimeDays} days`],['On-time Delivery',`${selectedSupplier.onTimeDeliveryRate}%`],['Status',selectedSupplier.status],['Product SKUs',selectedSupplier.productSkus.join(', ')||'None'],['Categories',selectedSupplier.categories.join(', ')]].map(([label,value])=><div key={label}><dt className="text-slate-500">{label}</dt><dd className="mt-1 break-words font-medium">{value}</dd></div>)}</dl><button onClick={()=>setSelectedSupplier(null)} className="mt-6 rounded-lg border px-4 py-2 text-sm">Close</button></div></div>}

    {modalOpen&&<div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4"><div role="dialog" aria-modal="true" aria-labelledby="supplier-form-title" className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl"><div className="mb-5 flex justify-between"><h2 id="supplier-form-title" className="text-xl font-bold">{editingId?'Edit Supplier':'Add Supplier'}</h2><button aria-label="Close form" onClick={()=>setModalOpen(false)}><X size={20}/></button></div><form onSubmit={save} className="space-y-4"><div className="grid gap-4 sm:grid-cols-2">{([['name','Supplier Name'],['contactName','Contact Person'],['email','Email Address'],['phone','Phone Number'],['country','Country']] as const).map(([field,label])=><label key={field} className="block text-sm font-medium">{label}<input type={field==='email'?'email':'text'} required={field!=='phone'} value={form[field]} onChange={e=>setForm(p=>({...p,[field]:e.target.value}))} className={inputClass}/></label>)}<label className="block text-sm font-medium">Lead Time (days)<input type="number" min="1" step="1" required value={form.leadTimeDays} onChange={e=>setForm(p=>({...p,leadTimeDays:Number(e.target.value)}))} className={inputClass}/></label><label className="block text-sm font-medium">On-time Delivery (%)<input type="number" min="0" max="100" step="0.1" required value={form.onTimeDeliveryRate} onChange={e=>setForm(p=>({...p,onTimeDeliveryRate:Number(e.target.value)}))} className={inputClass}/></label><label className="block text-sm font-medium">Status<select value={form.status} onChange={e=>setForm(p=>({...p,status:e.target.value as SupplierStatus}))} className={inputClass}><option value="active">Active</option><option value="inactive">Inactive</option></select></label></div><fieldset><legend className="mb-2 text-sm font-medium">Categories</legend><div className="flex flex-wrap gap-3">{supplierCategories.map(c=><label key={c} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.categories.includes(c)} onChange={()=>toggleCategory(c)}/>{c}</label>)}</div></fieldset><label className="block text-sm font-medium">Supplied Product SKUs (comma separated)<input value={form.productSkus.join(', ')} onChange={e=>setForm(p=>({...p,productSkus:e.target.value.split(',')}))} placeholder="VEL-201, VEL-305" className={inputClass}/></label>{formError&&<p role="alert" className="text-sm text-red-600">{formError}</p>}<div className="flex justify-end gap-3 pt-2"><button type="button" onClick={()=>setModalOpen(false)} className="rounded-xl border px-5 py-2.5 text-sm">Cancel</button><button type="submit" className="rounded-xl bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white">{editingId?'Save Changes':'Create Supplier'}</button></div></form></div></div>}

    {confirmInactive&&<div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4"><div role="alertdialog" aria-modal="true" aria-labelledby="deactivate-supplier-title" className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"><h2 id="deactivate-supplier-title" className="text-xl font-bold">Deactivate Supplier?</h2><p className="mt-3 text-sm text-slate-600">Deactivate <strong>{confirmInactive.name}</strong> ({confirmInactive.id})? Future draft purchasing should exclude inactive suppliers. Existing records should be preserved.</p><p className="mt-2 text-xs text-amber-700">Demo only: no backend mutation occurs.</p><div className="mt-6 flex justify-end gap-3"><button onClick={()=>setConfirmInactive(null)} className="rounded-lg border px-4 py-2 text-sm">Cancel</button><button onClick={deactivate} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white">Deactivate</button></div></div></div>}

    {supplierToDelete && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
        <div role="alertdialog" aria-modal="true" aria-labelledby="delete-supplier-title" aria-describedby="delete-supplier-description" className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-50">
            <Trash2 size={24} className="text-red-600" />
          </div>
          <h2 id="delete-supplier-title" className="text-xl font-bold text-slate-900">Delete Supplier?</h2>
          <p id="delete-supplier-description" className="mt-3 text-sm text-slate-600">
            Are you sure you want to remove <strong>{supplierToDelete.name}</strong> ({supplierToDelete.id}) from this demo catalogue?
          </p>
          <p className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">
            This removes the supplier from the current page only. It does not delete database records or update existing purchase orders. The backend must validate dependencies and authorization before real deletion.
          </p>
          <div className="mt-6 flex justify-end gap-3">
            <button type="button" onClick={() => setSupplierToDelete(null)} className="rounded-lg border border-slate-200 px-5 py-2.5 text-sm font-medium">Cancel</button>
            <button type="button" onClick={handleDeleteSupplier} className="rounded-lg bg-red-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-red-700">Yes, Delete</button>
          </div>
        </div>
      </div>
    )}
  </div>;

}
