import { notFound } from 'next/navigation';
import { fetchCheckoutSession } from '@/lib/api-client';
import { CheckoutPage } from '@/components/checkout/CheckoutPage';

interface PageProps {
  params: {
    token: string;
  };
}

export default async function Page({ params }: PageProps) {
  const { token } = params;
  const session = await fetchCheckoutSession(token);

  if (!session) {
    notFound();
  }

  return <CheckoutPage initialSession={session} token={token} />;
}
