'use client';

import { useState } from 'react';
import { Play, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { simulatePayment } from '@/lib/api-client';
import { env } from '@/lib/env';
import type { CheckoutPayment } from '@/types/checkout';

interface DevSimulateButtonProps {
  paymentId: string;
  checkoutToken: string;
  onSimulated: (action: 'confirm' | 'expire' | 'fail', payment?: CheckoutPayment) => void;
}

export function DevSimulateButton({ paymentId, checkoutToken, onSimulated }: DevSimulateButtonProps) {
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!env.devMode) {
    return null;
  }

  const handleSimulate = async (action: 'confirm' | 'expire' | 'fail') => {
    setError(null);
    setLoading(action);
    try {
      const result = await simulatePayment(paymentId, checkoutToken, action);
      if (result.success) {
        onSimulated(action, result.payment);
      } else {
        setError(result.error || 'Erro ao simular pagamento.');
      }
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
      <p className="text-sm text-yellow-800 font-medium mb-3">
        Modo Desenvolvimento - Simular Pagamento ({paymentId})
      </p>
      {error && (
        <p className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
      <div className="flex gap-2 flex-wrap">
        <Button
          variant="primary"
          size="sm"
          onClick={() => handleSimulate('confirm')}
          disabled={loading !== null}
        >
          {loading === 'confirm' ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <>
              <Play className="w-4 h-4 mr-1" />
              Confirmar
            </>
          )}
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => handleSimulate('expire')}
          disabled={loading !== null}
        >
          {loading === 'expire' ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            'Expirar'
          )}
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => handleSimulate('fail')}
          disabled={loading !== null}
        >
          {loading === 'fail' ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            'Falhar'
          )}
        </Button>
      </div>
    </div>
  );
}
