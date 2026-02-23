'use client';

import { useState, useCallback } from 'react';
import { CheckCircle, XCircle, Clock } from 'lucide-react';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { StatusBadge } from '@/components/ui/badge';
import { QRCodeDisplay } from './QRCodeDisplay';
import { CopyPasteButton } from './CopyPasteButton';
import { Timer } from './Timer';
import { AmountDisplay } from './AmountDisplay';
import { DevSimulateButton } from './DevSimulateButton';
import { StatusPoller } from './StatusPoller';
import type { CheckoutPayment, PaymentStatus } from '@/types/checkout';

interface CheckoutPageProps {
  initialPayment: CheckoutPayment;
  token: string;
}

export function CheckoutPage({ initialPayment, token }: CheckoutPageProps) {
  const [payment, setPayment] = useState(initialPayment);

  const handleStatusChange = useCallback((updated: CheckoutPayment) => {
    setPayment(updated);
  }, []);

  const renderStatusContent = () => {
    switch (payment.status) {
      case 'CONFIRMED':
      case 'RELEASED':
        return (
          <div className="flex flex-col items-center py-8 text-center">
            <CheckCircle className="w-16 h-16 text-green-500 mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Pagamento Confirmado!</h2>
            <p className="text-gray-600">Obrigado por pagar. Você receberá uma confirmação em breve.</p>
          </div>
        );

      case 'EXPIRED':
        return (
          <div className="flex flex-col items-center py-8 text-center">
            <Clock className="w-16 h-16 text-gray-400 mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Pagamento Expirado</h2>
            <p className="text-gray-600">O tempo para pagamento esgotou. Por favor, tente novamente.</p>
          </div>
        );

      case 'FAILED':
        return (
          <div className="flex flex-col items-center py-8 text-center">
            <XCircle className="w-16 h-16 text-red-500 mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Pagamento Falhou</h2>
            <p className="text-gray-600">Houve um problema com o pagamento. Por favor, tente novamente.</p>
          </div>
        );

      case 'PENDING':
      default:
        return (
          <>
            <div className="mb-6">
              <AmountDisplay amountInCents={payment.amount} currency={payment.currency} />
            </div>

            {payment.description && (
              <p className="text-center text-gray-600 mb-4">{payment.description}</p>
            )}

            <div className="flex justify-center mb-4">
              <Timer expiresAt={payment.expiresAt} onExpire={() => handleStatusChange({ ...payment, status: 'EXPIRED' as PaymentStatus })} />
            </div>

            <div className="flex justify-center mb-6">
              <QRCodeDisplay qrCodeBase64={payment.pixQrCode} />
            </div>

            <div className="max-w-md mx-auto">
              <CopyPasteButton pixCopyPaste={payment.pixCopyPaste} />
            </div>

            <DevSimulateButton token={token} onSimulated={() => {
              // Force a refetch by updating status temporarily
              handleStatusChange({ ...payment, status: 'CONFIRMED' as PaymentStatus });
            }} />
          </>
        );
    }
  };

  return (
    <>
      <StatusPoller
        token={token}
        currentStatus={payment.status}
        onStatusChange={handleStatusChange}
      />

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <h1 className="text-xl font-semibold text-gray-900">Pagamento Pix</h1>
          <StatusBadge status={payment.status} />
        </CardHeader>
        <CardContent>
          {renderStatusContent()}
        </CardContent>
      </Card>
    </>
  );
}
