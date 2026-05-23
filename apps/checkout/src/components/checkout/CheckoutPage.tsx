'use client';

import { useState, useCallback, useEffect } from 'react';
import { CheckCircle, XCircle, Clock, Loader2 } from 'lucide-react';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { StatusBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { QRCodeDisplay } from './QRCodeDisplay';
import { CopyPasteButton } from './CopyPasteButton';
import { Timer } from './Timer';
import { AmountDisplay } from './AmountDisplay';
import { DevSimulateButton } from './DevSimulateButton';
import { LineItemsSummary } from './LineItemsSummary';
import { StatusPoller } from './StatusPoller';
import { fulfillCheckoutSession } from '@/lib/api-client';
import type { CheckoutSession, PaymentStatus } from '@/types/checkout';

interface CheckoutPageProps {
  initialSession: CheckoutSession;
  token: string;
}

export function CheckoutPage({ initialSession, token }: CheckoutPageProps) {
  const [session, setSession] = useState(initialSession);
  const [document, setDocument] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [isFulfilling, setIsFulfilling] = useState(false);
  const [isRedirecting, setIsRedirecting] = useState(false);

  const payment = session.payment;
  const requiresDocument =
    session.customerCollectionMode === 'IDENTIFIED' &&
    !session.customerInputState.hasDocument;
  const showDocumentField = !session.customerInputState.hasDocument;
  const showNameField = !session.customerInputState.hasName;
  const showEmailField = !session.customerInputState.hasEmail;
  const hasMerchantProvidedData =
    session.customerInputState.hasDocument ||
    session.customerInputState.hasName ||
    session.customerInputState.hasEmail;

  const handleSessionChange = useCallback((updated: CheckoutSession) => {
    setSession(updated);
  }, []);

  useEffect(() => {
    let redirectUrl: string | undefined;

    if (payment) {
      if (payment.status === 'CONFIRMED' || payment.status === 'RELEASED') {
        redirectUrl = session.successUrl ?? undefined;
      } else if (payment.status === 'EXPIRED' || payment.status === 'FAILED') {
        redirectUrl = session.cancelUrl ?? undefined;
      }
    } else if (session.status === 'EXPIRED') {
      redirectUrl = session.cancelUrl ?? undefined;
    }

    if (redirectUrl) {
      setIsRedirecting(true);
      const timer = setTimeout(() => {
        window.location.assign(redirectUrl as string);
      }, 3000);

      return () => clearTimeout(timer);
    }
  }, [session.status, payment?.status, session.successUrl, session.cancelUrl]);

  const handleFulfill = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsFulfilling(true);
    const result = await fulfillCheckoutSession(token, {
      document: document.trim() || undefined,
      name: name.trim() || undefined,
      email: email.trim() || undefined,
    });
    if (!result.success) {
      alert(result.error);
      setIsFulfilling(false);
    }
    // If success, StatusPoller will automatically pull the updated session with Payment object
  };

  const renderSessionOpen = () => (
    <form onSubmit={handleFulfill} className="space-y-4">
      <div className="mb-6">
        <AmountDisplay amountInCents={session.amount} currency={session.currency} />
      </div>

      {session.description && (
        <p className="text-center text-gray-600 mb-4">{session.description}</p>
      )}

      <LineItemsSummary items={session.items} currency={session.currency} />

      <div className="flex justify-center mb-4">
        <Timer expiresAt={session.expiresAt} onExpire={() => handleSessionChange({ ...session, status: 'EXPIRED' })} />
      </div>

      <div className="space-y-4">
        {hasMerchantProvidedData && (
          <div className="rounded-lg border border-blue-100 bg-blue-50 p-4 text-sm text-blue-900">
            <p className="font-medium">Dados do pagador informados pela loja</p>
            <div className="mt-2 space-y-1 text-blue-800">
              {session.customerInputState.maskedDocument && (
                <p>CPF / CNPJ: {session.customerInputState.maskedDocument}</p>
              )}
              {session.customerInputState.maskedName && (
                <p>Nome: {session.customerInputState.maskedName}</p>
              )}
              {session.customerInputState.maskedEmail && (
                <p>E-mail: {session.customerInputState.maskedEmail}</p>
              )}
            </div>
          </div>
        )}

        {showDocumentField && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              CPF / CNPJ {requiresDocument ? '' : '(Opcional)'}
            </label>
            <input
              type="text"
              required={requiresDocument}
              value={document}
              onChange={(e) => setDocument(e.target.value)}
              className="w-full h-10 px-3 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="Apenas números"
            />
          </div>
        )}

        {showNameField && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nome Completo (Opcional)</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full h-10 px-3 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        )}

        {showEmailField && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">E-mail (Opcional)</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full h-10 px-3 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        )}

        <Button type="submit" className="w-full" disabled={isFulfilling}>
          {isFulfilling ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : null}
          {isFulfilling ? 'Processando...' : 'Gerar Pix'}
        </Button>
      </div>
    </form>
  );

  const renderPayment = () => {
    if (!payment) return null;

    switch (payment.status) {
      case 'CONFIRMED':
      case 'RELEASED':
        return (
          <div className="flex flex-col items-center py-8 text-center">
            <CheckCircle className="w-16 h-16 text-green-500 mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Pagamento Confirmado!</h2>
            <p className="text-gray-600 mb-4">Obrigado por pagar. Você receberá uma confirmação em breve.</p>
            {isRedirecting && (
              <p className="text-sm text-blue-600 font-medium animate-pulse">Redirecionando de volta à loja...</p>
            )}
          </div>
        );

      case 'EXPIRED':
        return (
          <div className="flex flex-col items-center py-8 text-center">
            <Clock className="w-16 h-16 text-gray-400 mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Pagamento Expirado</h2>
            <p className="text-gray-600 mb-4">O tempo para pagamento esgotou. Por favor, tente novamente.</p>
            {isRedirecting && (
              <p className="text-sm text-blue-600 font-medium animate-pulse">Redirecionando de volta à loja...</p>
            )}
          </div>
        );

      case 'FAILED':
        return (
          <div className="flex flex-col items-center py-8 text-center">
            <XCircle className="w-16 h-16 text-red-500 mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Pagamento Falhou</h2>
            <p className="text-gray-600 mb-4">Houve um problema com o pagamento. Por favor, tente novamente.</p>
            {isRedirecting && (
              <p className="text-sm text-blue-600 font-medium animate-pulse">Redirecionando de volta à loja...</p>
            )}
          </div>
        );

      case 'PENDING':
      default:
        return (
          <>
            <div className="mb-6">
              <AmountDisplay amountInCents={session.amount} currency={session.currency} />
            </div>

            {session.description && (
              <p className="text-center text-gray-600 mb-4">{session.description}</p>
            )}

            <LineItemsSummary items={payment.items ?? session.items} currency={session.currency} />

            <div className="flex justify-center mb-4">
              <Timer expiresAt={payment.expiresAt} onExpire={() => handleSessionChange({ ...session, payment: { ...payment, status: 'EXPIRED' } })} />
            </div>

            <div className="flex justify-center mb-6">
              <QRCodeDisplay qrCodeBase64={payment.pixCharge?.pixQrCode ?? ''} />
            </div>

            <div className="max-w-md mx-auto">
              <CopyPasteButton pixCopyPaste={payment.pixCharge?.pixCopyPaste ?? ''} />
            </div>

            <DevSimulateButton paymentId={payment.id} checkoutToken={token} onSimulated={(action, updatedPayment) => {
              if (updatedPayment) {
                handleSessionChange({ ...session, payment: updatedPayment });
              } else {
                const statusMap = {
                  confirm: 'CONFIRMED',
                  expire: 'EXPIRED',
                  fail: 'FAILED'
                } as const;
                handleSessionChange({ ...session, payment: { ...payment, status: statusMap[action] as PaymentStatus } });
              }
            }} />
          </>
        );
    }
  };

  return (
    <>
      <StatusPoller
        token={token}
        session={session}
        onSessionChange={handleSessionChange}
      />

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <h1 className="text-xl font-semibold text-gray-900">Checkout Hospedado</h1>
          <StatusBadge status={payment ? payment.status : session.status} />
        </CardHeader>
        <CardContent>
          {session.status === 'EXPIRED' && !payment ? (
            <div className="flex flex-col items-center py-8 text-center">
              <Clock className="w-16 h-16 text-gray-400 mb-4" />
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Sessão Expirada</h2>
              <p className="text-gray-600 mb-4">O tempo para preencher os dados esgotou. Por favor, reinicie a compra.</p>
              {isRedirecting && (
                <p className="text-sm text-blue-600 font-medium animate-pulse">Redirecionando de volta à loja...</p>
              )}
            </div>
          ) : session.status === 'OPEN' ? (
            renderSessionOpen()
          ) : session.status === 'COMPLETED' && payment ? (
            renderPayment()
          ) : (
            <div className="flex flex-col items-center justify-center p-8">
              <Loader2 className="w-10 h-10 animate-spin text-gray-400" />
              <p className="mt-4 text-gray-500">Aguardando geração do QR Code...</p>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}
