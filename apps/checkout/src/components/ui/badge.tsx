import { cn } from '@/lib/utils';
import type { PaymentStatus, SessionStatus } from '@/types/checkout';

interface BadgeProps {
  status: PaymentStatus | SessionStatus;
  className?: string;
}

const statusConfig: Record<PaymentStatus | SessionStatus, { label: string; className: string }> = {
  PENDING: {
    label: 'Aguardando',
    className: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  },
  CONFIRMED: {
    label: 'Confirmado',
    className: 'bg-green-100 text-green-800 border-green-200',
  },
  RELEASED: {
    label: 'Liberado',
    className: 'bg-blue-100 text-blue-800 border-blue-200',
  },
  EXPIRED: {
    label: 'Expirado',
    className: 'bg-gray-100 text-gray-800 border-gray-200',
  },
  FAILED: {
    label: 'Falhou',
    className: 'bg-red-100 text-red-800 border-red-200',
  },
  OPEN: {
    label: 'Dados Pendentes',
    className: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  },
  COMPLETED: {
    label: 'Processando',
    className: 'bg-blue-100 text-blue-800 border-blue-200',
  }
};

export function StatusBadge({ status, className }: BadgeProps) {
  const config = statusConfig[status];

  return (
    <span
      className={cn(
        'inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border',
        config.className,
        className
      )}
    >
      {config.label}
    </span>
  );
}
