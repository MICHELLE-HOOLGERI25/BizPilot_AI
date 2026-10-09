export type PurchaseOrderStatus = 'draft' | 'submitted' | 'in_transit' | 'received' | 'cancelled';
export interface PurchaseOrderLine { sku: string; productName: string; quantity: number; unitCost: number; }
export interface PurchaseOrder {
  id: string;
  supplierId: string;
  status: PurchaseOrderStatus;
  createdAt: string; // YYYY-MM-DD
  expectedDate: string;
  lines: PurchaseOrderLine[];
  notes: string;
}
export type PurchaseOrderDraftInput = Pick<PurchaseOrder, 'supplierId' | 'expectedDate' | 'lines' | 'notes'>;
