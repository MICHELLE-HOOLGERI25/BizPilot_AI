import type { AxiosError } from "axios";
import { apiClient } from "../lib/apiClient";
import { API_ENDPOINTS } from "./endpoints";
import type { Product, ProductInput } from "../types/product";

interface BackendProduct {
  id: number;
  sku: string;
  name: string;
  description?: string | null;
  category: string | null;
  retail_price: number | string;
  cost_price: number | string;
  is_active: boolean;
}

interface BackendProductList {
  data: BackendProduct[];
  page: number;
  page_size: number;
  total: number;
}

function toFrontendProduct(product: BackendProduct): Product {
  return {
    id: String(product.id),
    sku: product.sku,
    name: product.name,
    category: product.category ?? "",
    price: Number(product.retail_price),
    cost: Number(product.cost_price),
    status: product.is_active ? "active" : "inactive",
  };
}

function toBackendCreate(input: ProductInput) {
  return {
    sku: input.sku,
    name: input.name,
    category: input.category,
    retail_price: input.price,
    cost_price: input.cost,
    is_active: input.status === "active",
  };
}

function toBackendUpdate(input: ProductInput) {
  return {
    name: input.name,
    category: input.category,
    retail_price: input.price,
    cost_price: input.cost,
    is_active: input.status === "active",
  };
}

function getErrorMessage(error: unknown): string {
  const axiosError = error as AxiosError<{ detail?: unknown }>;
  const detail = axiosError.response?.data?.detail;

  if (typeof detail === "string") {
    return detail;
  }

  if (Array.isArray(detail)) {
    return detail
      .map((item) =>
        typeof item?.msg === "string" ? item.msg : "Invalid request"
      )
      .join("; ");
  }

  if (axiosError.response?.status === 401) {
    return "Authentication is required to access products.";
  }

  if (axiosError.response?.status === 403) {
    return "You do not have permission to perform this operation.";
  }

  if (axiosError.response) {
    return `Product request failed (${axiosError.response.status}).`;
  }

  return "Unable to connect to the backend. Check that the API server is running.";
}

function rethrowApiError(error: unknown): never {
  throw new Error(getErrorMessage(error));
}

async function findProductById(id: string): Promise<Product> {
  const products = await productsApi.list();
  const product = products.find((item) => item.id === id);

  if (!product) {
    throw new Error("Product not found.");
  }

  return product;
}

export const productsApi = {
  async list(): Promise<Product[]> {
    try {
      const response = await apiClient.get<BackendProductList>(
        API_ENDPOINTS.products.list,
        {
          params: {
            page: 1,
            page_size: 100,
          },
        }
      );

      return response.data.data.map(toFrontendProduct);
    } catch (error) {
      return rethrowApiError(error);
    }
  },

  async create(input: ProductInput): Promise<Product> {
    try {
      const response = await apiClient.post<BackendProduct>(
        API_ENDPOINTS.products.create,
        toBackendCreate(input)
      );

      return toFrontendProduct(response.data);
    } catch (error) {
      return rethrowApiError(error);
    }
  },

  async update(id: string, input: ProductInput): Promise<Product> {
    try {
      const currentProduct = await findProductById(id);

      const response = await apiClient.patch<BackendProduct>(
        API_ENDPOINTS.products.update(currentProduct.sku),
        toBackendUpdate(input)
      );

      return toFrontendProduct(response.data);
    } catch (error) {
      if (
        error instanceof Error &&
        !("isAxiosError" in error) &&
        error.message === "Product not found."
      ) {
        throw error;
      }

      return rethrowApiError(error);
    }
  },


  async delete(id: string): Promise<void> {
    try {
      const currentProduct = await findProductById(id);
      await apiClient.delete(
        API_ENDPOINTS.products.delete(currentProduct.sku)
      );
    } catch (error) {
      if (
        error instanceof Error &&
        !("isAxiosError" in error) &&
        error.message === "Product not found."
      ) {
        throw error;
      }

      return rethrowApiError(error);
    }
  },
  async deactivate(id: string): Promise<Product> {
    try {
      const currentProduct = await findProductById(id);

      const response = await apiClient.patch<BackendProduct>(
        API_ENDPOINTS.products.update(currentProduct.sku),
        {
          is_active: false,
        }
      );

      return toFrontendProduct(response.data);
    } catch (error) {
      if (
        error instanceof Error &&
        !("isAxiosError" in error) &&
        error.message === "Product not found."
      ) {
        throw error;
      }

      return rethrowApiError(error);
    }
  },
};