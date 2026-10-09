export type SupplierStatus = 'active' | 'inactive';
export type SupplierCategory = 'Fashion' | 'Accessories' | 'Beauty' | 'Lifestyle';
export interface Supplier {
  id: string;
  name: string;
  contactName: string;
  email: string;
  phone: string;
  country: string;
  categories: SupplierCategory[];
  leadTimeDays: number;
  onTimeDeliveryRate: number; // percentage, 0–100; historical synthetic demo metric
  status: SupplierStatus;
  productSkus: string[];
}
export type SupplierInput = Omit<Supplier, 'id'>;
