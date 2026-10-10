
export type InventoryStatus =
  | "Healthy"
  | "Low Stock"
  | "Out of Stock";

export type Store =
  | "Vienna Flagship"
  | "Paris Boutique"
  | "Milan Store";

export type InventoryRecord = {
  id: string;
  sku: string;
  product: string;
  category: string;
  store: Store;
  onHand: number;
  reserved: number;
  reorderPoint: number;
  updatedAt: string;
  version: number;
};

export const demoInventory: InventoryRecord[] = [
  {
    id: "i01",
    sku: "VEL-201",
    product: "Signature Leather Tote",
    category: "Accessories",
    store: "Vienna Flagship",
    onHand: 5,
    reserved: 2,
    reorderPoint: 10,
    updatedAt: "2026-10-09",
    version: 1,
  },
  {
    id: "i02",
    sku: "VEL-305",
    product: "Silk Evening Scarf",
    category: "Fashion",
    store: "Vienna Flagship",
    onHand: 8,
    reserved: 3,
    reorderPoint: 15,
    updatedAt: "2026-10-09",
    version: 1,
  },
  {
    id: "i03",
    sku: "VEL-412",
    product: "Premium Skincare Set",
    category: "Beauty",
    store: "Paris Boutique",
    onHand: 2,
    reserved: 2,
    reorderPoint: 8,
    updatedAt: "2026-10-08",
    version: 1,
  },
  {
    id: "i04",
    sku: "VEL-508",
    product: "Velora Eau de Parfum",
    category: "Beauty",
    store: "Milan Store",
    onHand: 45,
    reserved: 4,
    reorderPoint: 12,
    updatedAt: "2026-10-09",
    version: 1,
  },
  {
    id: "i05",
    sku: "VEL-609",
    product: "Cashmere Wrap",
    category: "Fashion",
    store: "Paris Boutique",
    onHand: 24,
    reserved: 1,
    reorderPoint: 9,
    updatedAt: "2026-10-07",
    version: 1,
  },
  {
    id: "i06",
    sku: "VEL-710",
    product: "Artisan Ceramic Collection",
    category: "Lifestyle",
    store: "Milan Store",
    onHand: 18,
    reserved: 3,
    reorderPoint: 7,
    updatedAt: "2026-10-09",
    version: 1,
  },
  {
    id: "i07",
    sku: "VEL-811",
    product: "Classic Gold-Tone Watch",
    category: "Accessories",
    store: "Vienna Flagship",
    onHand: 12,
    reserved: 3,
    reorderPoint: 10,
    updatedAt: "2026-10-08",
    version: 1,
  },
  {
    id: "i08",
    sku: "VEL-912",
    product: "Linen Summer Ensemble",
    category: "Fashion",
    store: "Milan Store",
    onHand: 32,
    reserved: 4,
    reorderPoint: 12,
    updatedAt: "2026-10-06",
    version: 1,
  },
];

export const availableQty = (
  record: InventoryRecord
): number => Math.max(0, record.onHand - record.reserved);

export function stockStatus(
  record: InventoryRecord
): InventoryStatus {
  const available = availableQty(record);

  if (available === 0) return "Out of Stock";
  if (available <= record.reorderPoint) return "Low Stock";

  return "Healthy";
}

/**
 * Deterministic demo demand estimates.
 * Person 2 will replace these with backend calculations.
 */
export const demoDailyDemand: Record<string, number> = {
  "VEL-201": 2.1,
  "VEL-305": 1.6,
  "VEL-412": 1.8,
  "VEL-508": 0.8,
  "VEL-609": 1.0,
  "VEL-710": 0.6,
  "VEL-811": 1.2,
  "VEL-912": 0.9,
};

export const demoSafetyDays = 3;
