export interface CreditCardTransactionAccount {
  id: string;
  store: string;
  status: string;
  createdOn: string;
}

export interface CreditCardTransaction {
  id: number;
  transactionAmount: number;
  transactionDate: string;
  receiptNo: string;
  attachment: string;
  account?: CreditCardTransactionAccount;
}