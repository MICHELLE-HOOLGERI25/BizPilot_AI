
import { apiClient } from "../lib/apiClient";
import { API_ENDPOINTS } from "./endpoints";

export type PurchaseOrderItemApi = {
  product_id: number;
  sku: string;
  product_name: string;
  quantity: number;
  unit_cost: number | string;
};

export type PurchaseOrderApi = {
  id: number;
  order_number: string;
  supplier_id: number;
  supplier_name: string;
  store_id: number;
  store_code: string;
  status: string;
  created_at: string;
  items: PurchaseOrderItemApi[];
};

export type PurchaseOrderListApi = {
  data: PurchaseOrderApi[];
  total: number;
};

export type PurchaseOrderCreatePayload = {
  supplier_id: number;
  store_code: string;
  items: { sku: string; quantity: number }[];
};

export type PurchaseOrderConfirmation = {
  confirmation_token: string;
  expires_at: string;
  payload_hash: string;
};

export const purchaseOrdersApi = {
  async list(): Promise<PurchaseOrderListApi> {
    const response = await apiClient.get<PurchaseOrderListApi>(
      API_ENDPOINTS.purchaseOrders.list,
    );
    return response.data;
  },

  async detail(id: string | number): Promise<PurchaseOrderApi> {
    const response = await apiClient.get<PurchaseOrderApi>(
      API_ENDPOINTS.purchaseOrders.detail(id),
    );
    return response.data;
  },

  async requestConfirmation(
    payload: PurchaseOrderCreatePayload,
  ): Promise<PurchaseOrderConfirmation> {
    const response = await apiClient.post<PurchaseOrderConfirmation>(
      API_ENDPOINTS.purchaseOrders.confirmations,
      payload,
    );
    return response.data;
  },

  async create(
    payload: PurchaseOrderCreatePayload,
    confirmationToken: string,
    idempotencyKey: string,
  ): Promise<PurchaseOrderApi> {
    const response = await apiClient.post<PurchaseOrderApi>(
      API_ENDPOINTS.purchaseOrders.create,
      payload,
      {
        headers: {
          "X-Confirmation-Token": confirmationToken,
          "Idempotency-Key": idempotencyKey,
        },
      },
    );
    return response.data;
  },

  async updateDraft(
    id: string | number,
    payload: PurchaseOrderCreatePayload,
  ): Promise<PurchaseOrderApi> {
    const response = await apiClient.patch<PurchaseOrderApi>(
      API_ENDPOINTS.purchaseOrders.detail(id),
      payload,
    );
    return response.data;
  },

  async cancelDraft(id: string | number): Promise<PurchaseOrderApi> {
    const response = await apiClient.post<PurchaseOrderApi>(
      `${API_ENDPOINTS.purchaseOrders.detail(id)}/cancel`,
    );
    return response.data;
  },

  async submitDraft(id: string | number): Promise<PurchaseOrderApi> {
    const response = await apiClient.post<PurchaseOrderApi>(
      `${API_ENDPOINTS.purchaseOrders.detail(id)}/submit`,
    );
    return response.data;
  },
};
