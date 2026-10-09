
import type { Product, ProductInput } from "../types/product";
import { initialProducts } from "../mocks/productsData";

const STORAGE_KEY = "velora-demo-products-v1";

function readProducts(): Product[] {
  const stored = localStorage.getItem(STORAGE_KEY);

  if (!stored) {
    return initialProducts.map((product) => ({ ...product }));
  }

  try {
    const parsed: unknown = JSON.parse(stored);
    if (!Array.isArray(parsed)) throw new Error("Invalid data");

    // Demo-only persistence. Real API data will be validated
    // using backend schemas.
    return parsed as Product[];
  } catch {
    return initialProducts.map((product) => ({ ...product }));
  }
}

function saveProducts(products: Product[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(products));
}

export const productsApi = {
  async list(): Promise<Product[]> {
    return readProducts();
  },

  async create(input: ProductInput): Promise<Product> {
    const products = readProducts();

    if (
      products.some(
        (p) => p.sku.toLowerCase() === input.sku.toLowerCase()
      )
    ) {
      throw new Error("A product with this SKU already exists.");
    }

    const product: Product = {
      ...input,
      id: crypto.randomUUID(),
    };

    saveProducts([...products, product]);
    return product;
  },

  async update(
    id: string,
    input: ProductInput
  ): Promise<Product> {
    const products = readProducts();
    const index = products.findIndex((p) => p.id === id);

    if (index === -1) throw new Error("Product not found.");

    if (
      products.some(
        (p) =>
          p.id !== id &&
          p.sku.toLowerCase() === input.sku.toLowerCase()
      )
    ) {
      throw new Error("A product with this SKU already exists.");
    }

    const updated = { ...input, id };
    products[index] = updated;
    saveProducts(products);

    return updated;
  },

  async deactivate(id: string): Promise<Product> {
    const products = readProducts();
    const index = products.findIndex((p) => p.id === id);

    if (index === -1) throw new Error("Product not found.");

    products[index] = {
      ...products[index],
      status: "inactive",
    };

    saveProducts(products);
    return products[index];
  },
};
