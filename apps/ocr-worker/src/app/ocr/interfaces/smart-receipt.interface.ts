
export interface SmartReceiptResult {
  merchant: {
    name: string;
    address: string | null;
    city: string | null;
    country_code: string | null;
  };
  receipt: {
    totalAmount: number;
    currencyCode: string;
    purchaseDate: string;
  };
  items: Array<{
    name: string;
    amount: number;
    quantity: number;
    suggestedCategory: 'Groceries' | 'Electronics' | 'Restaurant' | 'Transport' | 'Other';
  }>;
  rawText?: string;
}
