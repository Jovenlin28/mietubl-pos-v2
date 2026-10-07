import { Store } from "./Store";

export interface RoyaltyFeeAccount {
  id: string;
  mall: string;
  store: string;
  partner: string;
  status: string;
  createdOn: string;
}

export interface RoyaltyFee {
  id: number;
  transactionAmount: number;
  transactionDate: string;
  receiptNo: string;
  attachment: string;
  account?: RoyaltyFeeAccount;
}