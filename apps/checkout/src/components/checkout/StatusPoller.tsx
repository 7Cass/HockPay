'use client';

import { useEffect, useRef } from 'react';
import { fetchCheckoutSession } from '@/lib/api-client';
import type { CheckoutSession } from '@/types/checkout';
import { isTerminalStatus } from '@/types/checkout';

interface StatusPollerProps {
  token: string;
  session: CheckoutSession;
  intervalMs?: number;
  onSessionChange: (session: CheckoutSession) => void;
}

export function StatusPoller({
  token,
  session,
  intervalMs = 3000,
  onSessionChange,
}: StatusPollerProps) {
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Stop polling if session is EXPIRED
    // Or if payment is terminal
    const paymentCompleted = session.status === 'COMPLETED' && session.payment && isTerminalStatus(session.payment.status);
    const stopPolling = session.status === 'EXPIRED' || paymentCompleted;

    if (stopPolling) {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
      return;
    }

    pollingRef.current = setInterval(async () => {
      const s = await fetchCheckoutSession(token);
      if (s) {
        // Just trigger change, parent can handle pure state replacement
        onSessionChange(s);
      }
    }, intervalMs);

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
    };
  }, [token, session.status, session.payment?.status, intervalMs, onSessionChange]);

  return null;
}
