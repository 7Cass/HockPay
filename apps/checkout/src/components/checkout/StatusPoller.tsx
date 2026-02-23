'use client';

import { useEffect, useRef } from 'react';
import { fetchCheckoutPayment } from '@/lib/api-client';
import { isTerminalStatus } from '@/types/checkout';
import type { CheckoutPayment, PaymentStatus } from '@/types/checkout';

interface StatusPollerProps {
  token: string;
  currentStatus: PaymentStatus;
  intervalMs?: number;
  onStatusChange: (payment: CheckoutPayment) => void;
}

export function StatusPoller({
  token,
  currentStatus,
  intervalMs = 3000,
  onStatusChange,
}: StatusPollerProps) {
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Don't poll if status is terminal
    if (isTerminalStatus(currentStatus)) {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
      return;
    }

    pollingRef.current = setInterval(async () => {
      const payment = await fetchCheckoutPayment(token);
      if (payment && payment.status !== currentStatus) {
        onStatusChange(payment);
      }
    }, intervalMs);

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
    };
  }, [token, currentStatus, intervalMs, onStatusChange]);

  return null;
}
