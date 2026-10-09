
export type DashboardPeriod = "7d" | "30d" | "90d";

export interface DashboardData {
  revenue: number;
  orders: number;
  grossProfit: number;
  lowStockCount: number;
  salesTrend: {
    date: string;
    revenue: number;
  }[];
  categories: {
    name: string;
    revenue: number;
  }[];
}

export const dashboardMockData: Record<
  DashboardPeriod,
  DashboardData
> = {
  "7d": {
    revenue: 32850,
    orders: 326,
    grossProfit: 13980,
    lowStockCount: 12,
    salesTrend: [
      { date: "Mon", revenue: 3800 },
      { date: "Tue", revenue: 4400 },
      { date: "Wed", revenue: 4100 },
      { date: "Thu", revenue: 4900 },
      { date: "Fri", revenue: 5300 },
      { date: "Sat", revenue: 6100 },
      { date: "Sun", revenue: 4250 },
    ],
    categories: [
      { name: "Fashion", revenue: 13200 },
      { name: "Accessories", revenue: 8000 },
      { name: "Beauty", revenue: 6700 },
      { name: "Lifestyle", revenue: 4950 },
    ],
  },
  "30d": {
    revenue: 128450,
    orders: 1284,
    grossProfit: 52300,
    lowStockCount: 12,
    salesTrend: [
      { date: "Week 1", revenue: 26000 },
      { date: "Week 2", revenue: 31000 },
      { date: "Week 3", revenue: 33450 },
      { date: "Week 4", revenue: 38000 },
    ],
    categories: [
      { name: "Fashion", revenue: 51400 },
      { name: "Accessories", revenue: 32100 },
      { name: "Beauty", revenue: 25700 },
      { name: "Lifestyle", revenue: 19250 },
    ],
  },
  "90d": {
    revenue: 368700,
    orders: 3620,
    grossProfit: 151800,
    lowStockCount: 12,
    salesTrend: [
      { date: "Month 1", revenue: 112000 },
      { date: "Month 2", revenue: 128250 },
      { date: "Month 3", revenue: 128450 },
    ],
    categories: [
      { name: "Fashion", revenue: 149000 },
      { name: "Accessories", revenue: 94000 },
      { name: "Beauty", revenue: 72600 },
      { name: "Lifestyle", revenue: 53100 },
    ],
  },
};

export const recentOrders = [
  {
    id: "VEL-1042",
    customer: "Sophia Martin",
    total: 425.0,
    status: "Completed",
  },
  {
    id: "VEL-1041",
    customer: "Daniel Weber",
    total: 189.5,
    status: "Processing",
  },
  {
    id: "VEL-1040",
    customer: "Emma Laurent",
    total: 760.0,
    status: "Completed",
  },
  {
    id: "VEL-1039",
    customer: "Lucas Meyer",
    total: 125.0,
    status: "Pending",
  },
];

export const inventoryAlerts = [
  {
    sku: "VEL-201",
    product: "Signature Leather Tote",
    available: 3,
    reorderPoint: 10,
  },
  {
    sku: "VEL-305",
    product: "Silk Evening Scarf",
    available: 5,
    reorderPoint: 15,
  },
  {
    sku: "VEL-412",
    product: "Premium Skincare Set",
    available: 2,
    reorderPoint: 8,
  },
];
