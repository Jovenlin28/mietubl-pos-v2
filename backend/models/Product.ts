export interface Product {
  id: string;
  sku: string;
  name: string;
  category_id: number;
  brand_id: number;
  store_id: number;
  warehouse_id: number;
  price: number;
  unit: "Box" | "Piece";
  sellingType: "Retail" | "Wholesale";
  qty: number;
  createdBy: string;
  createdOn: string;
  description?: string;
  discountType?: "Fixed" | "Percentage";
  discountValue?: number;
  costingPrice?: number;
}