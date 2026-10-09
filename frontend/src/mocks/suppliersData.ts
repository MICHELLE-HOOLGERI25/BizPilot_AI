import type { Supplier, SupplierInput } from "../types/supplier";

// Shared IDs and SKU coverage for future Purchase Orders/Replenishment integration.
export const initialSuppliers: Supplier[] = [
  { id:'SUP-001', name:'Atelier Firenze', contactName:'Giulia Rossi', email:'orders@atelier-firenze.example', phone:'+39 055 000 1001', country:'Italy', categories:['Accessories'], leadTimeDays:14, onTimeDeliveryRate:96, status:'active', productSkus:['VEL-201','VEL-811'] },
  { id:'SUP-002', name:'Maison Soie', contactName:'Claire Dubois', email:'trade@maison-soie.example', phone:'+33 1 00 00 1002', country:'France', categories:['Fashion'], leadTimeDays:12, onTimeDeliveryRate:91, status:'active', productSkus:['VEL-305','VEL-609'] },
  { id:'SUP-003', name:'Lumina Laboratories', contactName:'Elena Bauer', email:'supply@lumina-labs.example', phone:'+43 1 000 1003', country:'Austria', categories:['Beauty'], leadTimeDays:9, onTimeDeliveryRate:98, status:'active', productSkus:['VEL-412','VEL-508'] },
  { id:'SUP-004', name:'Nordic Form Studio', contactName:'Erik Lind', email:'sales@nordic-form.example', phone:'+46 8 000 1004', country:'Sweden', categories:['Lifestyle'], leadTimeDays:20, onTimeDeliveryRate:84, status:'active', productSkus:['VEL-710'] },
  { id:'SUP-005', name:'Linen & Loom', contactName:'Isabel Costa', email:'hello@linen-loom.example', phone:'+351 21 000 1005', country:'Portugal', categories:['Fashion'], leadTimeDays:16, onTimeDeliveryRate:89, status:'inactive', productSkus:['VEL-912'] },
];

export const emptySupplierForm: SupplierInput = {
  name: '', contactName: '', email: '', phone: '', country: '', categories: ['Fashion'],
  leadTimeDays: 7, onTimeDeliveryRate: 100, status: 'active', productSkus: [],
};

export const supplierCategories = ['Fashion','Accessories','Beauty','Lifestyle'] as const;