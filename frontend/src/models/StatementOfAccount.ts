import { Account } from "./Account";

export interface StatementOfAccount {
  id: number;
  referenceNo: string;
  description: string;
  amountToPay: number;
  amountPaid: number;
  attachment?: string;
  periodStart?: string;
  periodEnd?: string;
  createdOn: string;
  account?: Account
}