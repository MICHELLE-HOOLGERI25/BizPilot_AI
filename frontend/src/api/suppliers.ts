import { apiClient } from "../lib/apiClient";
import { API_ENDPOINTS } from "./endpoints";

export type SupplierApiRow = {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  is_active: boolean;
  lead_time_days: number;
  on_time_delivery_rate: number;
  product_coverage: {
    sku: string;
    product_name: string;
    unit_cost: string;
  }[];
};

export type SupplierPayload = {
  name: string;
  email: string | null;
  phone: string | null;
  lead_time_days: number;
  on_time_delivery_rate: number;
  is_active: boolean;
};

type SupplierListResponse = {
  data_mode: string;
  total: number;
  data: SupplierApiRow[];
};

export const suppliersApi = {
  async list(): Promise<SupplierApiRow[]> {
    const response = await apiClient.get<SupplierListResponse>(
      API_ENDPOINTS.suppliers.list
    );
    return response.data.data;
  },

  async create(payload: SupplierPayload): Promise<SupplierApiRow> {
    const response = await apiClient.post<SupplierApiRow>(
      API_ENDPOINTS.suppliers.list,
      payload
    );
    return response.data;
  },

  async update(
    id: string | number,
    payload: Partial<SupplierPayload>
  ): Promise<SupplierApiRow> {
    const response = await apiClient.patch<SupplierApiRow>(
      `${API_ENDPOINTS.suppliers.list}/${encodeURIComponent(String(id))}`,
      payload
    );
    return response.data;
  },

  async delete(id: string | number): Promise<void> {
    await apiClient.delete(
      `${API_ENDPOINTS.suppliers.list}/${encodeURIComponent(String(id))}`
    );
  },
};