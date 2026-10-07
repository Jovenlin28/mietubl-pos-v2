export interface Expense {
  id: number;
  purchaseDate: string;
  expenseCategory: string;
  itemDescription: string;
  totalCost: string;
  status: string;
  receiptNo?: string;
  vendorName?: string;
  tinNo?: string;
  businessAddress?: string;
  /** Optional: where the expense was funded from */
  sourceOfFund?: string;
  createdOn?: string;
  attachment?: string;
}