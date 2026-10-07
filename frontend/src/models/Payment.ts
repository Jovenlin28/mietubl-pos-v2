export interface Payment {
  id: string;
  amount: number;
  purchaseOrderNumber: string;
  paymentChannel?: string;
  description?: string;
  paymentDate?: string;
  attachment?: string;
  referenceNo?: string;
}