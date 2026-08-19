import { env } from './env';
import type { CheckoutSession, CheckoutPayment, PaymentLinkPublicSession } from '@/types/checkout';

export async function fetchCheckoutSession(token: string): Promise<CheckoutSession | null> {
  try {
    const response = await fetch(`${env.apiUrl}/checkout-sessions/${token}`, {
      cache: 'no-store'
    });

    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }
      throw new Error(`Failed to fetch checkout session: ${response.status}`);
    }

    return response.json();
  } catch (error) {
    console.error('Error fetching checkout session:', error);
    return null;
  }
}

export async function fetchPaymentLinkSession(token: string): Promise<PaymentLinkPublicSession | null> {
  try {
    const response = await fetch(`${env.apiUrl}/payment-links/public/${token}`, {
      cache: 'no-store'
    });

    if (!response.ok) {
      if (response.status === 404 || response.status === 422) {
        return null;
      }
      throw new Error(`Failed to fetch payment link: ${response.status}`);
    }

    return response.json();
  } catch (error) {
    console.error('Error fetching payment link:', error);
    return null;
  }
}

export async function simulatePaymentLink(
  token: string,
  action: 'pay' | 'fail',
  customer?: { document?: string; name?: string; email?: string },
): Promise<{ success: boolean; payment?: CheckoutPayment; error?: string }> {
  try {
    const response = await fetch(`${env.apiUrl}/payment-links/public/${token}/${action}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(action === 'pay' ? { customer } : {}),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      return { success: false, error: data?.error?.message || `Failed to simulate: ${response.status}` };
    }

    const data = await response.json();
    return { success: true, payment: data.payment };
  } catch (error) {
    console.error('Error simulating payment link:', error);
    return { success: false, error: 'Network error' };
  }
}

export async function fulfillCheckoutSession(
  token: string,
  customerData: { document?: string; name?: string; email?: string }
): Promise<{ success: boolean; error?: string }> {
  try {
    const customer = Object.fromEntries(
      Object.entries(customerData).filter(([, value]) => value !== undefined && value !== '')
    );

    const response = await fetch(`${env.apiUrl}/checkout-sessions/${token}/fulfill`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ customer }),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      return { success: false, error: data?.message || 'Failed to fulfill session' };
    }

    return { success: true };
  } catch (error) {
    console.error('Error fulfilling checkout session:', error);
    return { success: false, error: 'Network error' };
  }
}

export async function simulatePayment(
  paymentId: string,
  checkoutToken: string,
  action: 'confirm' | 'expire' | 'fail'
): Promise<{ success: boolean; payment?: CheckoutPayment; error?: string }> {
  try {
    const response = await fetch(`${env.apiUrl}/payments/${paymentId}/simulate/${action}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ checkoutToken }),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      if (response.status === 403) {
        return { success: false, error: 'Simulation is not allowed for LIVE payments' };
      }
      if (response.status === 404) {
        return { success: false, error: 'Payment not found' };
      }
      return { success: false, error: data?.error?.message || `Failed to simulate: ${response.status}` };
    }

    const data = await response.json();
    return { success: true, payment: data.payment };
  } catch (error) {
    console.error('Error simulating payment:', error);
    return { success: false, error: 'Network error' };
  }
}
