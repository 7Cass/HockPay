const API_KEY = process.env.HOCKPAY_API_KEY;
const BASE_URL = process.env.HOCKPAY_BASE_URL || "http://localhost:3000";

export async function createCheckoutSession(input: {
  amount: number;
  description?: string;
  successUrl: string;
  cancelUrl: string;
  metadata: Record<string, unknown>;
}): Promise<{ checkoutUrl: string }> {
  const res = await fetch(`${BASE_URL}/api/v1/checkout-sessions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify(input),
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(
      error?.message || `Failed to create session: ${res.status}`,
    );
  }

  return res.json();
}

export async function simulatePayment(
  paymentId: string,
  action: "confirm" | "expire" | "fail" = "confirm",
): Promise<void> {
  const res = await fetch(`${BASE_URL}/api/v1/dev/simulate/${paymentId}/${action}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${API_KEY}`,
    },
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error?.message || `Failed to simulate: ${res.status}`);
  }
}
