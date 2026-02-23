import { formatCurrency } from '@/lib/formatters';

interface AmountDisplayProps {
  amountInCents: number;
  currency?: string;
}

export function AmountDisplay({ amountInCents, currency = 'BRL' }: AmountDisplayProps) {
  return (
    <div className="text-center">
      <p className="text-sm text-gray-500 mb-1">Valor a pagar</p>
      <p className="text-4xl font-bold text-gray-900">
        {formatCurrency(amountInCents, currency)}
      </p>
    </div>
  );
}
