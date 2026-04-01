export * from './receipt/create-receipt.dto';
export * from './receipt/create-receipt-manual.dto';
export * from './auth/register.dto';
export * from './auth/login.dto';
export * from './receipt/update-receipt.dto';
export * from './receipt/receipt-filter.dto';
export * from './analytics/analytics-filter.dto';
export * from './user/update-user.dto';
export * from './category/create-category.dto';
export function dto(): string {
  return 'dto';
}
