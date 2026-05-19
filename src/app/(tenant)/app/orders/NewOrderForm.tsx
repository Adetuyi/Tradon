'use client';
import { buttonClass } from '@/components/ui/Button';

export function NewOrderForm(_props: {
  customers: { id: string; full_name: string }[];
  distributors: { id: string; business_name: string }[];
  products: { id: string; name: string; selling_price: string; cost_price: string }[];
}) {
  return <span className={buttonClass('primary')}>+ New order</span>;
}
