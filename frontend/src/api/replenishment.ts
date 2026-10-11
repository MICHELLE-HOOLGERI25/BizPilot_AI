import { apiClient } from "../lib/apiClient";
import { API_ENDPOINTS } from "./endpoints";

export type ReplenishmentApiRow = {
  sku: string;
  product_name: string;
  store_code: string;
  store_name: string;
  available_qty: number;
  daily_demand: number | null;
  days_of_cover: number | null;
  demand_status: "calculated" | "insufficient_sales_history" | "no_active_supplier";
  net_units_sold: number;
  confirmed_inbound_qty: number;
  lead_time_days: number | null;
  safety_stock_days: number;
  target_stock: number | null;
  suggested_qty: number | null;
  supplier_id: number | null;
  supplier_name: string | null;
  supplier_available: boolean;
  inventory_version: number;
};

export const replenishmentApi = {
  async list(maxDaysOfCover = 7): Promise<ReplenishmentApiRow[]> {
    const response = await apiClient.get<{ data: ReplenishmentApiRow[] }>(
      API_ENDPOINTS.replenishment.recommendations,
      { params: { max_days_of_cover: maxDaysOfCover } }
    );
    return response.data.data;
  },
};
