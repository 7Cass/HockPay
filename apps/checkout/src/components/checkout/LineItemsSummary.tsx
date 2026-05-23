import type { CheckoutLineItem } from '@/types/checkout';

interface LineItemsSummaryProps {
  items?: CheckoutLineItem[];
  currency: string;
}

export function LineItemsSummary({ items = [], currency }: LineItemsSummaryProps) {
  if (items.length === 0) return null;

  return (
    <div className="mb-5 overflow-hidden rounded-lg border border-gray-200 bg-gray-50">
      <div className="divide-y divide-gray-200 bg-white">
        {items.map((item, index) => (
          <div key={item.id ?? `${item.name}-${index}`} className="flex gap-3 px-4 py-3">
            {item.imageUrl ? (
              <img src={item.imageUrl} alt="" className="h-12 w-12 rounded-md border border-gray-200 object-cover" />
            ) : (
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md border border-gray-200 bg-gray-50 text-xs font-semibold text-gray-500">
                {currency}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-gray-900">{item.name}</p>
              {item.description ? (
                <p className="mt-0.5 line-clamp-2 text-xs text-gray-500">{item.description}</p>
              ) : null}
              <p className="mt-1 text-xs text-gray-500">
                {item.quantity} x {formatMoney(item.unitPrice, currency)}
              </p>
            </div>
            <div className="shrink-0 text-right text-sm font-semibold text-gray-900">
              {formatMoney(item.totalPrice, currency)}
            </div>
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between px-4 py-3 text-sm font-semibold text-gray-900">
        <span>Total</span>
        <span>{formatMoney(items.reduce((sum, item) => sum + item.totalPrice, 0), currency)}</span>
      </div>
    </div>
  );
}

function formatMoney(amountInCents: number, currency: string): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency,
  }).format(amountInCents / 100);
}
