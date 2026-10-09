/** Person 1 mock: compose fresh, validated report specs from existing demo fixtures.
 * This is deterministic intent matching, NOT a language model or backend analytics.
 */
import { mockSales, netRevenue } from './salesData';
import { demoInventory, availableQty, demoDailyDemand } from './inventoryData';
import { validateDynamicView, type DynamicView, type ViewWidget } from '../types/dynamicView';

const KEY = 'velora_generated_reports_v1';
const day = () => new Date().toISOString().slice(0, 10);
const total = (values: number[]) => values.reduce((s, v) => s + v, 0);

export function generateDemoReport(prompt: string): DynamicView {
  const text = prompt.toLowerCase();
  const needStock = /stock|inventory|reorder|risk|cover|available|warehouse/.test(text);
  const needSales = /sale|revenue|profit|selling|seller|orders|performance|trend/.test(text);
  const both = needStock && needSales;
  const widgets: ViewWidget[] = [];

  // Anchor at the newest fixture date, not at the user's current clock.
  const newest = mockSales.reduce((d, r) => r.date > d ? r.date : d, '');
  const from = new Date(`${newest}T00:00:00Z`);
  from.setUTCDate(from.getUTCDate() - 29);
  const cutoff = from.toISOString().slice(0, 10);
  const rows = mockSales.filter(r => r.date >= cutoff && r.date <= newest);

  const bySku = new Map<string, { sku: string; product: string; revenue: number; units: number }>();
  const byDay = new Map<string, { date: string; revenue: number }>();
  for (const sale of rows) {
    const item = bySku.get(sale.sku) ?? { sku: sale.sku, product: sale.productName, revenue: 0, units: 0 };
    item.revenue += netRevenue(sale);
    item.units += sale.units - sale.returnedUnits;
    bySku.set(sale.sku, item);
    const date = byDay.get(sale.date) ?? { date: sale.date, revenue: 0 };
    date.revenue += netRevenue(sale);
    byDay.set(sale.date, date);
  }
  const leaders = [...bySku.values()].sort((a, b) => b.revenue - a.revenue);
  const trend = [...byDay.values()].sort((a, b) => a.date.localeCompare(b.date));
  const stock = demoInventory.map(r => ({
    sku: r.sku, product: r.product, store: r.store,
    available: availableQty(r), reorderPoint: r.reorderPoint,
    daysCover: Math.round(10 * availableQty(r) / Math.max(demoDailyDemand[r.sku] ?? 1, .01)) / 10,
    sold: bySku.get(r.sku)?.units ?? 0,
    revenue: Math.round(bySku.get(r.sku)?.revenue ?? 0),
  }));
  const risk = stock.filter(r => r.available <= r.reorderPoint).sort((a, b) => a.daysCover - b.daysCover);

  if (needSales || !needStock) {
    widgets.push({ id: 'revenue', type: 'kpi', title: 'Last 30-Day Net Revenue', value: Math.round(total(rows.map(netRevenue))), format: 'currency', description: `${cutoff} to ${newest} · demo orders` });
    widgets.push({ id: 'trend', type: 'line', title: 'Daily Revenue Trend', xKey: 'date', yKey: 'revenue', format: 'currency', data: trend });
    widgets.push({ id: 'leaders', type: 'bar', title: 'Top Products by Units Sold', xKey: 'product', yKey: 'units', data: leaders.slice(0, 6).map(r => ({ product: r.product, units: r.units })) });
  }
  if (needStock) {
    widgets.push({ id: 'at-risk', type: 'kpi', title: 'Low-Stock Locations', value: risk.length, format: 'integer', description: 'Available quantity <= demo reorder point' });
    widgets.push({ id: 'stock-chart', type: 'bar', title: 'Available Units by Product', xKey: 'sku', yKey: 'available', data: stock.map(r => ({ sku: r.sku, available: r.available })) });
  }
  if (both) {
    widgets.push({ id: 'combined-table', type: 'table', title: 'Sales vs. Stock Risk', columns: [
      { key: 'sku', label: 'SKU' }, { key: 'product', label: 'Product' }, { key: 'sold', label: 'Units Sold' },
      { key: 'available', label: 'Available' }, { key: 'daysCover', label: 'Days Cover' }, { key: 'store', label: 'Store' },
    ], rows: stock.sort((a,b) => b.sold - a.sold).map(({ sku, product, sold, available, daysCover, store }) => ({ sku, product, sold, available, daysCover, store })) });
  } else if (needStock) {
    widgets.push({ id: 'stock-table', type: 'table', title: 'Reorder Priorities', columns: [
      { key: 'product', label: 'Product' }, { key: 'store', label: 'Store' }, { key: 'available', label: 'Available' },
      { key: 'reorderPoint', label: 'Reorder Point' }, { key: 'daysCover', label: 'Days Cover' },
    ], rows: risk.map(({ product, store, available, reorderPoint, daysCover }) => ({ product, store, available, reorderPoint, daysCover })) });
  } else {
    widgets.push({ id: 'sales-table', type: 'table', title: 'Product Performance', columns: [
      { key: 'sku', label: 'SKU' }, { key: 'product', label: 'Product' }, { key: 'revenue', label: 'Net Revenue' }, { key: 'units', label: 'Units' },
    ], rows: leaders.map(({ sku, product, revenue, units }) => ({ sku, product, revenue: Math.round(revenue), units })) });
  }
  const view: DynamicView = {
    id: `generated-${crypto.randomUUID()}`,
    title: both ? 'Sales & Stockout Intelligence' : needStock ? 'Inventory Risk Intelligence' : 'Sales Performance Intelligence',
    description: `Generated from mock fixtures for: “${prompt.slice(0, 150)}”. No live AI, database, or backend query was used.`,
    source: 'demo', createdAt: day(), widgets,
  };
  if (!validateDynamicView(view)) throw new Error('Mock report failed schema validation');
  return view;
}

export function readGeneratedReports(): DynamicView[] {
  try {
    const raw = sessionStorage.getItem(KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter(validateDynamicView).slice(-10) : [];
  } catch { return []; }
}

export function saveGeneratedReport(view: DynamicView): void {
  if (!validateDynamicView(view)) throw new Error('Invalid generated report');
  sessionStorage.setItem(KEY, JSON.stringify([...readGeneratedReports(), view].slice(-10)));
}
