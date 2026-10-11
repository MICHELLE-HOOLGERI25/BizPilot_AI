import { apiClient } from "../lib/apiClient";
import { API_ENDPOINTS } from "./endpoints";
import type { InventoryRecord, Store } from "../mocks/inventoryData";

type InventoryApiRow = {
  inventory_id: number;
  sku: string;
  product_name: string;
  store_name: string;
  on_hand: number;
  reserved: number;
  reorder_point: number;
  version: number;
};

type InventoryApiResponse = {
  data: InventoryApiRow[];
  total: number;
};

const knownStores = ["Vienna Flagship", "Paris Boutique", "Milan Store"] as const;

function mapInventoryRow(row: InventoryApiRow): InventoryRecord {
  const store: Store = knownStores.includes(row.store_name as Store)
    ? (row.store_name as Store)
    : (row.store_name as Store);

  return {
    id: String(row.inventory_id),
    sku: row.sku,
    product: row.product_name,
    category: "Uncategorized",
    store,
    onHand: row.on_hand,
    reserved: row.reserved,
    reorderPoint: row.reorder_point,
    updatedAt: "",
    version: row.version,
  };
}

export const inventoryApi = {
  async list(): Promise<InventoryRecord[]> {
    const response = await apiClient.get<InventoryApiResponse>(
      API_ENDPOINTS.inventory.list
    );
    return response.data.data.map(mapInventoryRow);
  },

  async adjust(
    id: string,
    values: {
      onHand: number;
      reserved: number;
      reorderPoint: number;
      expectedVersion: number;
      reason: string;
    }
  ): Promise<void> {
    await apiClient.patch(`/api/v1/inventory/${encodeURIComponent(id)}`, {
      on_hand: values.onHand,
      reserved: values.reserved,
      reorder_point: values.reorderPoint,
      expected_version: values.expectedVersion,
      reason: values.reason,
    });
  },
};
