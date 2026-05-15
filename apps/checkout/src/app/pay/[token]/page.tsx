import { notFound } from 'next/navigation';
import { fetchPaymentLinkSession } from '@/lib/api-client';
import { PaymentLinkPage } from '@/components/checkout/PaymentLinkPage';

interface PageProps {
  params: {
    token: string;
  };
}

export default async function Page({ params }: PageProps) {
  const { token } = params;
  const session = await fetchPaymentLinkSession(token);

  if (!session) {
    notFound();
  }

  return <PaymentLinkPage initialSession={session} token={token} />;
}
