import type { DynamicView } from '../types/dynamicView';

export const demoReports: DynamicView[] = [
  {
    id: 'regional-performance', title: 'Regional Performance',
    description: 'Revenue and order trends across Velora regions (illustrative figures).',
    source: 'demo', createdAt: '2026-10-09', widgets: [
      { id: 'total-revenue', type: 'kpi', title: 'Total Revenue', value: 128450, format: 'currency', description: 'Synthetic reporting period' },
      { id: 'orders', type: 'kpi', title: 'Orders', value: 1284, format: 'integer' },
      { id: 'margin', type: 'kpi', title: 'Gross Margin', value: 40.7, format: 'percent' },
      { id: 'regional-bar', type: 'bar', title: 'Revenue by Region', xKey: 'region', yKey: 'revenue', format: 'currency', data: [
        { region: 'North', revenue: 39400 }, { region: 'South', revenue: 32950 }, { region: 'East', revenue: 30100 }, { region: 'West', revenue: 26000 },
      ] },
      { id: 'regional-table', type: 'table', title: 'Regional Detail', columns: [{ key: 'region', label: 'Region' }, { key: 'orders', label: 'Orders' }, { key: 'revenue', label: 'Revenue (€)' }], rows: [
        { region: 'North', orders: 388, revenue: 39400 }, { region: 'South', orders: 333, revenue: 32950 }, { region: 'East', orders: 298, revenue: 30100 }, { region: 'West', orders: 265, revenue: 26000 },
      ] },
    ],
  },
  {
    id: 'category-trends', title: 'Category Trends',
    description: 'Illustrative monthly revenue performance by reporting month.', source: 'demo', createdAt: '2026-10-09', widgets: [
      { id: 'category-line', type: 'line', title: 'Monthly Revenue', xKey: 'month', yKey: 'revenue', format: 'currency', data: [
        { month: 'May', revenue: 82000 }, { month: 'Jun', revenue: 95000 }, { month: 'Jul', revenue: 88000 }, { month: 'Aug', revenue: 108000 }, { month: 'Sep', revenue: 114000 }, { month: 'Oct', revenue: 128450 },
      ] },
      { id: 'category-table', type: 'table', title: 'Category Comparison', columns: [{ key: 'category', label: 'Category' }, { key: 'revenue', label: 'Revenue (€)' }], rows: [
        { category: 'Fashion', revenue: 51400 }, { category: 'Accessories', revenue: 32100 }, { category: 'Beauty', revenue: 25700 }, { category: 'Lifestyle', revenue: 19250 },
      ] },
    ],
  },
  {
    id: 'revenue-profitability',
    title: 'Revenue & Profitability',
    description: 'Monthly net revenue, gross profit and margin for Velora (illustrative demo figures).',
    source: 'demo',
    createdAt: '2026-10-09',
    widgets: [
      { id: 'profit-revenue', type: 'kpi', title: 'Net Revenue', value: 128450, format: 'currency', description: 'Illustrative latest reporting month' },
      { id: 'profit-gross', type: 'kpi', title: 'Gross Profit', value: 52300, format: 'currency' },
      { id: 'profit-margin', type: 'kpi', title: 'Gross Margin', value: 40.7, format: 'percent' },
      { id: 'profit-trend', type: 'line', title: 'Net Revenue Trend', xKey: 'month', yKey: 'revenue', format: 'currency', data: [
        { month: 'May', revenue: 82000 }, { month: 'Jun', revenue: 95000 },
        { month: 'Jul', revenue: 88000 }, { month: 'Aug', revenue: 108000 },
        { month: 'Sep', revenue: 114000 }, { month: 'Oct', revenue: 128450 },
      ] },
      { id: 'profit-by-month', type: 'bar', title: 'Monthly Gross Profit', xKey: 'month', yKey: 'profit', format: 'currency', data: [
        { month: 'May', profit: 30800 }, { month: 'Jun', profit: 37050 },
        { month: 'Jul', profit: 34320 }, { month: 'Aug', profit: 43200 },
        { month: 'Sep', profit: 45600 }, { month: 'Oct', profit: 52300 },
      ] },
      { id: 'profit-detail', type: 'table', title: 'Profitability by Month', columns: [
        { key: 'month', label: 'Month' }, { key: 'revenue', label: 'Net Revenue (€)' },
        { key: 'profit', label: 'Gross Profit (€)' }, { key: 'margin', label: 'Gross Margin (%)' },
      ], rows: [
        { month: 'May', revenue: 82000, profit: 30800, margin: 37.6 },
        { month: 'Jun', revenue: 95000, profit: 37050, margin: 39.0 },
        { month: 'Jul', revenue: 88000, profit: 34320, margin: 39.0 },
        { month: 'Aug', revenue: 108000, profit: 43200, margin: 40.0 },
        { month: 'Sep', revenue: 114000, profit: 45600, margin: 40.0 },
        { month: 'Oct', revenue: 128450, profit: 52300, margin: 40.7 },
      ] },
    ],
  },
  {
    id: 'inventory-health',
    title: 'Inventory Health',
    description: 'Stock availability and replenishment priorities across sample Velora locations (illustrative snapshot).',
    source: 'demo',
    createdAt: '2026-10-09',
    widgets: [
      { id: 'inventory-skus', type: 'kpi', title: 'Products Monitored', value: 8, format: 'integer' },
      { id: 'inventory-out', type: 'kpi', title: 'Out of Stock', value: 1, format: 'integer' },
      { id: 'inventory-risk', type: 'kpi', title: 'At Risk Within 7 Days', value: 2, format: 'integer', description: 'Excludes the already out-of-stock product' },
      { id: 'inventory-cover', type: 'bar', title: 'Days of Stock Cover', xKey: 'sku', yKey: 'daysCover', format: 'integer', data: [
        { sku: 'VEL-412', daysCover: 0 }, { sku: 'VEL-201', daysCover: 1.4 },
        { sku: 'VEL-305', daysCover: 3.1 }, { sku: 'VEL-811', daysCover: 7.5 },
        { sku: 'VEL-609', daysCover: 23 }, { sku: 'VEL-710', daysCover: 25 },
        { sku: 'VEL-912', daysCover: 31.1 }, { sku: 'VEL-508', daysCover: 51.3 },
      ] },
      { id: 'inventory-available', type: 'bar', title: 'Available Units by SKU', xKey: 'sku', yKey: 'available', format: 'integer', data: [
        { sku: 'VEL-412', available: 0 }, { sku: 'VEL-201', available: 3 },
        { sku: 'VEL-305', available: 5 }, { sku: 'VEL-811', available: 9 },
        { sku: 'VEL-609', available: 23 }, { sku: 'VEL-710', available: 15 },
        { sku: 'VEL-912', available: 28 }, { sku: 'VEL-508', available: 41 },
      ] },
      { id: 'inventory-detail', type: 'table', title: 'Replenishment Priority Detail', columns: [
        { key: 'sku', label: 'SKU' }, { key: 'product', label: 'Product' },
        { key: 'store', label: 'Store' }, { key: 'available', label: 'Available' },
        { key: 'daysCover', label: 'Days Cover' }, { key: 'risk', label: 'Risk' },
      ], rows: [
        { sku: 'VEL-412', product: 'Premium Skincare Set', store: 'Paris Boutique', available: 0, daysCover: 0, risk: 'Out of stock' },
        { sku: 'VEL-201', product: 'Signature Leather Tote', store: 'Vienna Flagship', available: 3, daysCover: 1.4, risk: 'At risk' },
        { sku: 'VEL-305', product: 'Silk Evening Scarf', store: 'Vienna Flagship', available: 5, daysCover: 3.1, risk: 'At risk' },
        { sku: 'VEL-811', product: 'Classic Gold-Tone Watch', store: 'Vienna Flagship', available: 9, daysCover: 7.5, risk: 'Covered' },
        { sku: 'VEL-609', product: 'Cashmere Wrap', store: 'Paris Boutique', available: 23, daysCover: 23, risk: 'Covered' },
        { sku: 'VEL-710', product: 'Artisan Ceramic Collection', store: 'Milan Store', available: 15, daysCover: 25, risk: 'Covered' },
        { sku: 'VEL-912', product: 'Linen Summer Ensemble', store: 'Milan Store', available: 28, daysCover: 31.1, risk: 'Covered' },
        { sku: 'VEL-508', product: 'Velora Eau de Parfum', store: 'Milan Store', available: 41, daysCover: 51.3, risk: 'Covered' },
      ] },
    ],
  },
];
