
import type { Product } from "../types/product";

/**
 * Canonical fictional product catalogue for the Velora demo.
 *
 * SKU, product name, category, price and cost are aligned
 * with salesData.ts and purchaseOrdersData.ts.
 *
 * Person 2 will replace this with database-backed records.
 */
export const initialProducts: Product[] = [
  {
    id: "1",
    sku: "VEL-201",
    name: "Signature Leather Tote",
    category: "Accessories",
    price: 249,
    cost: 110,
    status: "active",
  },
  {
    id: "2",
    sku: "VEL-305",
    name: "Silk Evening Scarf",
    category: "Fashion",
    price: 89,
    cost: 32,
    status: "active",
  },
  {
    id: "3",
    sku: "VEL-412",
    name: "Premium Skincare Set",
    category: "Beauty",
    price: 135,
    cost: 58,
    status: "active",
  },
  {
    id: "4",
    sku: "VEL-508",
    name: "Velora Eau de Parfum",
    category: "Beauty",
    price: 125,
    cost: 45,
    status: "active",
  },
  {
    id: "5",
    sku: "VEL-609",
    name: "Cashmere Wrap",
    category: "Fashion",
    price: 320,
    cost: 155,
    status: "active",
  },
  {
    id: "6",
    sku: "VEL-710",
    name: "Artisan Ceramic Collection",
    category: "Lifestyle",
    price: 175,
    cost: 72,
    status: "active",
  },
  {
    id: "7",
    sku: "VEL-811",
    name: "Classic Gold-Tone Watch",
    category: "Accessories",
    price: 295,
    cost: 130,
    status: "active",
  },
  {
    id: "8",
    sku: "VEL-912",
    name: "Linen Summer Ensemble",
    category: "Fashion",
    price: 185,
    cost: 75,
    status: "inactive",
  },
];
