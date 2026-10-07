import { Brand } from "./Brand";
import { Category } from "./Category";
import { Store } from "./Store";
import { Warehouse } from "./Warehouse";

export interface ProductImage {
  url: string;
}

export interface Product {
  id: string;
  sku: string;
  name: string;
  category_id: number;
  brand_id: number;
  price: number;
  unit: "Box" | "Piece";
  sellingType: "Retail" | "Wholesale";
  qty: number;
  createdBy: string;
  createdOn: string;
  description?: string;
  discountType?: "Fixed" | "Percentage";
  discountValue?: number;
  tax?: number;
  category: Category;
  brand: Brand;
  store: Store;
  warehouse: Warehouse
  imageUrl?: string;
  costingPrice?: string;
  images: ProductImage[];
}