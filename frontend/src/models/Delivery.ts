export interface Delivery {
  id: string;
  purchaseOrderNumber: string;
  status: string;
  method: string
  createdOn: string;
  processedAttachment?: string;
  pickedUpAttachment?: string;
  deliveredAttachment?: string;
  processedDate?: string;
  pickedUpDate?: string;
  deliveredDate?: string;
}