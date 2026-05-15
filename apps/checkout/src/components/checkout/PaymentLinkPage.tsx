'use client';

import { useEffect, useState } from 'react';
import { CheckCircle, Clock, Loader2, Play, XCircle } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { StatusBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AmountDisplay } from './AmountDisplay';
import { CopyPasteButton } from './CopyPasteButton';
import { QRCodeDisplay } from './QRCodeDisplay';
import { Timer } from './Timer';
import { fetchPaymentLinkSession, simulatePaymentLink } from '@/lib/api-client';
import { env } from '@/lib/env';
import type { PaymentLinkPublicSession } from '@/types/checkout';

interface PaymentLinkPageProps {
  initialSession: PaymentLinkPublicSession;
  token: string;
}

export function PaymentLinkPage({ initialSession, token }: PaymentLinkPageProps) {
  const [session, setSession] = useState(initialSession);
  const [loadingAction, setLoadingAction] = useState<'pay' | 'fail' | null>(null);
  const payment = session.lastPayment;
  const isPaid = session.paymentLink.status === 'PAID' || payment?.status === 'CONFIRMED' || payment?.status === 'RELEASED';
  const isUnavailable = session.paymentLink.status === 'EXPIRED' || session.paymentLink.status === 'CANCELLED';

  useEffect(() => {
    if (isPaid || isUnavailable) return;

    const interval = setInterval(async () => {
      const updated = await fetchPaymentLinkSession(token);
      if (updated) setSession(updated);
    }, 5000);

    return () => clearInterval(interval);
  }, [isPaid, isUnavailable, token]);

  const handleSimulate = async (action: 'pay' | 'fail') => {
    setLoadingAction(action);
    try {
      const result = await simulatePaymentLink(token, action);
      if (!result.success) {
        alert(result.error || 'Erro ao simular pagamento.');
        return;
      }

      const updated = await fetchPaymentLinkSession(token);
      if (updated) {
        setSession({ ...updated, lastPayment: result.payment ?? updated.lastPayment });
      }
    } finally {
      setLoadingAction(null);
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">Link de pagamento</h1>
        <StatusBadge status={session.paymentLink.status} />
      </CardHeader>
      <CardContent>
        <div className="mb-6">
          <AmountDisplay amountInCents={session.paymentLink.amount} currency={session.paymentLink.currency} />
        </div>

        {(session.paymentLink.description || session.paymentLink.title) && (
          <p className="text-center text-gray-600 mb-4">
            {session.paymentLink.description || session.paymentLink.title}
          </p>
        )}

        {isPaid && (
          <div className="flex flex-col items-center py-8 text-center">
            <CheckCircle className="w-16 h-16 text-green-500 mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Pagamento confirmado</h2>
            <p className="text-gray-600">Obrigado. O pagamento já foi registrado.</p>
          </div>
        )}

        {!isPaid && isUnavailable && (
          <div className="flex flex-col items-center py-8 text-center">
            <Clock className="w-16 h-16 text-gray-400 mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Link indisponível</h2>
            <p className="text-gray-600">Este link expirou ou foi cancelado.</p>
          </div>
        )}

        {!isPaid && !isUnavailable && (
          <>
            <div className="flex justify-center mb-4">
              <Timer
                expiresAt={session.pixCharge.expiresAt}
                onExpire={() => setSession({
                  ...session,
                  paymentLink: { ...session.paymentLink, status: 'EXPIRED' },
                  pixCharge: { ...session.pixCharge, status: 'EXPIRED' },
                })}
              />
            </div>
            <div className="flex justify-center mb-6">
              <QRCodeDisplay qrCodeBase64={session.pixCharge.pixQrCode} />
            </div>
            <div className="max-w-md mx-auto">
              <CopyPasteButton pixCopyPaste={session.pixCharge.pixCopyPaste} />
            </div>

            {payment?.status === 'FAILED' && (
              <div className="mt-4 flex items-center justify-center gap-2 text-sm text-red-600">
                <XCircle className="h-4 w-4" />
                A última tentativa falhou. Você pode tentar novamente com o mesmo Pix.
              </div>
            )}

            {env.devMode && (
              <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-sm text-yellow-800 font-medium mb-3">
                  Modo Desenvolvimento - Simular Link
                </p>
                <div className="flex gap-2 flex-wrap">
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => handleSimulate('pay')}
                    disabled={loadingAction !== null}
                  >
                    {loadingAction === 'pay' ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <Play className="w-4 h-4 mr-1" />
                        Pagar
                      </>
                    )}
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handleSimulate('fail')}
                    disabled={loadingAction !== null}
                  >
                    {loadingAction === 'fail' ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      'Falhar'
                    )}
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
