import type { PurchaseOrder } from '../types/purchaseOrder';

// Uses the same SUP-001…SUP-005 IDs and VEL SKUs as Suppliers Management.
export const productCosts: Record<string, { name: string; cost: number }> = {
  'VEL-201': { name: 'Signature Leather Tote', cost: 110 },
  'VEL-305': { name: 'Silk Evening Scarf', cost: 32 },
  'VEL-412': { name: 'Premium Skincare Set', cost: 58 },
  'VEL-508': { name: 'Velora Eau de Parfum', cost: 45 },
  'VEL-609': { name: 'Cashmere Wrap', cost: 155 },
  'VEL-710': { name: 'Artisan Ceramic Collection', cost: 72 },
  'VEL-811': { name: 'Classic Gold-Tone Watch', cost: 130 },
  'VEL-912': { name: 'Linen Summer Ensemble', cost: 75 },
};
export const initialPurchaseOrders: PurchaseOrder[] = [
  { id:'PO-1001', supplierId:'SUP-001', status:'draft', createdAt:'2026-10-06', expectedDate:'2026-10-22', notes:'Urgent leather accessories replenishment', lines:[{ sku:'VEL-201', productName:'Signature Leather Tote', quantity:30, unitCost:110 }] },
  { id:'PO-1002', supplierId:'SUP-002', status:'submitted', createdAt:'2026-10-02', expectedDate:'2026-10-17', notes:'Seasonal collection', lines:[{ sku:'VEL-305', productName:'Silk Evening Scarf', quantity:75, unitCost:32 },{ sku:'VEL-609', productName:'Cashmere Wrap', quantity:25, unitCost:155 }] },
  { id:'PO-1003', supplierId:'SUP-003', status:'in_transit', createdAt:'2026-09-29', expectedDate:'2026-10-12', notes:'Beauty line', lines:[{ sku:'VEL-412', productName:'Premium Skincare Set', quantity:40, unitCost:58 }] },
  { id:'PO-1004', supplierId:'SUP-004', status:'received', createdAt:'2026-09-08', expectedDate:'2026-09-28', notes:'Delivered — illustrative status only', lines:[{ sku:'VEL-710', productName:'Artisan Ceramic Collection', quantity:20, unitCost:72 }] },
];
export function orderTotal(order: PurchaseOrder): number {
  return order.lines.reduce((sum, line) => sum + line.quantity * line.unitCost, 0);
}
