
export type ProductStatus = "active" | "inactive";

export interface Product {
  id: string;
  sku: string;
  name: string;
  category: string;
  price: number;
  cost: number;
  status: ProductStatus;
}

export type ProductInput = Omit<Product, "id">;
