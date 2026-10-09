export type StockRisk = 'Critical' | 'At Risk' | 'Covered' | 'No Demand';
export interface ReplenishmentRecommendation {
  inventoryId: string;
  sku: string;
  product: string;
  store: string;
  available: number;
  dailyDemand: number;
  daysOfCover: number | null;
  supplierId: string | null;
  supplierName: string;
  leadTimeDays: number | null;
  incoming: number;
  reorderPoint: number;
  recommendedQuantity: number;
  risk: StockRisk;
  unitCost: number;
}
