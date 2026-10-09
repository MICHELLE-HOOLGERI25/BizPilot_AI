/** Reproducible, fictional retail sales records for the Person 1 UI. */
export type SalesChannel = "Online" | "In-store";
export type SalesCategory = "Fashion" | "Accessories" | "Beauty" | "Lifestyle";

export interface SaleRecord {
  id: string;
  date: string; // YYYY-MM-DD, UTC date for repeatable demo aggregation
  sku: string;
  productName: string;
  category: SalesCategory;
  channel: SalesChannel;
  region: "North" | "South" | "East" | "West";
  units: number;
  unitPrice: number;
  unitCost: number;
  discountAmount: number;
  returnedUnits: number;
}

const catalogue = [
  { sku: "VEL-201", name: "Signature Leather Tote", category: "Accessories", price: 249, cost: 110 },
  { sku: "VEL-305", name: "Silk Evening Scarf", category: "Fashion", price: 89, cost: 32 },
  { sku: "VEL-412", name: "Premium Skincare Set", category: "Beauty", price: 135, cost: 58 },
  { sku: "VEL-508", name: "Velora Eau de Parfum", category: "Beauty", price: 125, cost: 45 },
  { sku: "VEL-609", name: "Cashmere Wrap", category: "Fashion", price: 320, cost: 155 },
  { sku: "VEL-710", name: "Artisan Ceramic Collection", category: "Lifestyle", price: 175, cost: 72 },
  { sku: "VEL-811", name: "Classic Gold-Tone Watch", category: "Accessories", price: 295, cost: 130 },
  { sku: "VEL-912", name: "Linen Summer Ensemble", category: "Fashion", price: 185, cost: 75 },
] as const;

function asDate(date: Date): string { return date.toISOString().slice(0, 10); }
function subtractDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() - days);
  return result;
}

// Generate records once per app load. No randomness or external calls.
const today = new Date();
const anchor = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));

export const mockSales: SaleRecord[] = Array.from({ length: 220 }, (_, day) => {
  const date = asDate(subtractDays(anchor, day));
  const ordersForDay = 4 + ((day * 7 + Math.floor(day / 3)) % 9);

  return Array.from({ length: ordersForDay }, (_, line) => { 
    const index = (day * 3 + line * 5) % catalogue.length;
    const item = catalogue[index];
    const units = 1 + ((day + line * 7) % 6);
    const discountAmount = (day + line) % 9 === 0 ? item.price * units * 0.1 : 0;
    return {
      id: `SALE-${day.toString().padStart(3, "0")}-${line}`,
      date,
      sku: item.sku,
      productName: item.name,
      category: item.category,
      channel: (day + line) % 3 === 0 ? "In-store" : "Online",
      region: (["North", "South", "East", "West"] as const)[(day + line) % 4],
      units,
      unitPrice: item.price,
      unitCost: item.cost,
      discountAmount,
      returnedUnits: (day * 7 + line) % 41 === 0 ? 1 : 0,
    } satisfies SaleRecord;
  });
}).flat();

export function netRevenue(row: SaleRecord): number {
  return row.units * row.unitPrice - row.discountAmount - row.returnedUnits * row.unitPrice;
}
export function grossProfit(row: SaleRecord): number {
  return netRevenue(row) - (row.units - row.returnedUnits) * row.unitCost;
}
export function dateBefore(date: string, days: number): string {
  return asDate(subtractDays(new Date(`${date}T00:00:00Z`), days));
}
export const mockToday = asDate(anchor);
