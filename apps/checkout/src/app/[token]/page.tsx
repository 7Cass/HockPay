import { notFound } from 'next/navigation';
import { fetchCheckoutPayment } from '@/lib/api-client';
import { CheckoutPage } from '@/components/checkout/CheckoutPage';

interface PageProps {
  params: {
    token: string;
  };
}

export default async function Page({ params }: PageProps) {
  const { token } = params;
  const payment = await fetchCheckoutPayment(token);

  if (!payment) {
    notFound();
  }

  return <CheckoutPage initialPayment={payment} token={token} />;
}
