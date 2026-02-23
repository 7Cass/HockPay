import { env } from './env';
import type { CheckoutPayment } from '@/types/checkout';

export async function fetchCheckoutPayment(token: string): Promise<CheckoutPayment | null> {
  try {
    const response = await fetch(`${env.apiUrl}/checkout/${token}`, {
      cache: 'no-store'
    });

    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }
      throw new Error(`Failed to fetch checkout: ${response.status}`);
    }

    return response.json();
  } catch (error) {
    console.error('Error fetching checkout payment:', error);
    return null;
  }
}

export async function simulatePayment(
  token: string,
  action: 'confirm' | 'expire' | 'fail'
): Promise<{ success: boolean; payment?: CheckoutPayment; error?: string }> {
  try {
    const response = await fetch(`${env.apiUrl}/checkout/${token}/simulate/${action}`, {
      method: 'POST',
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
