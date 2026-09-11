import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { Reveal } from '../../../../shared/directives/reveal';

const CHARGE_ID = 'pay_3f8Ka92LmQ';

interface Token {
  readonly text: string;
  readonly kind: 'plain' | 'str' | 'comment';
}

/** Just enough highlighting for a landing: comments dim, string literals lit. */
function tokenize(line: string): readonly Token[] {
  if (/^\s*(#|\/\/)/.test(line)) return [{ text: line, kind: 'comment' }];
  return line
    .split(/("[^"]*"|`[^`]*`)/)
    .filter(Boolean)
    .map((text) => ({ text, kind: /^["`]/.test(text) ? 'str' : 'plain' }));
}

/**
 * "Integração": the pitch on the left, the request on the right. Switching
 * tabs slides the underline over and re-types the code line by line.
 */
@Component({
  selector: 'app-api-showcase',
  imports: [Reveal],
  templateUrl: './api-showcase.html',
  styleUrl: './api-showcase.css',
})
export class ApiShowcase {
  private readonly timers = new Set<ReturnType<typeof setTimeout>>();

  protected readonly checks = [
    'Idempotency-Key nativo em toda escrita',
    'Webhooks assinados com HMAC, retry e backoff',
    'Chaves TEST e LIVE isoladas por loja',
  ];

  protected readonly tabs = [
    {
      id: 'curl',
      label: 'cURL',
      code: `curl -X POST https://api.hockpay.dev/api/v1/payments \\
  -H "Authorization: Bearer hk_test_9f2c…" \\
  -H "Content-Type: application/json" \\
  -H "Idempotency-Key: order_1042" \\
  -d '{
    "amount": 25000,
    "paymentMethod": "PIX",
    "customer": { "document": "12345678909" }
  }'

# você decide o final:
curl -X POST .../payments/${CHARGE_ID}/simulate/confirm`,
    },
    {
      id: 'node',
      label: 'Node',
      code: `const res = await fetch(\`\${base}/payments\`, {
  method: "POST",
  headers: {
    Authorization: \`Bearer \${process.env.HOCKPAY_TEST_KEY}\`,
    "Content-Type": "application/json",
    "Idempotency-Key": "order_1042",
  },
  body: JSON.stringify({
    amount: 25_000,
    paymentMethod: "PIX",
    customer: { document: "12345678909" },
  }),
});

// confirm | fail | expire — o desfecho é seu
await fetch(\`\${base}/payments/\${payment.id}/simulate/fail\`, {
  method: "POST",
});`,
    },
    {
      id: 'webhook',
      label: 'Webhook',
      code: `POST /webhooks/hockpay
X-Hockpay-Signature: t=1771027200,v1=8b41c…
Content-Type: application/json

{
  "event": "payment.confirmed",
  "data": {
    "id": "${CHARGE_ID}",
    "status": "CONFIRMED",
    "amount": 25000,
    "fee": 150,
    "net": 24850
  }
}

// assinado com HMAC, com retry e backoff — igual produção`,
    },
  ];

  protected readonly activeTab = signal(this.tabs[0].id);
  protected readonly copied = signal(false);

  protected readonly tabIndex = computed(() =>
    this.tabs.findIndex((tab) => tab.id === this.activeTab()),
  );
  private readonly activeCode = computed(() => this.tabs[this.tabIndex()]?.code ?? '');
  protected readonly activeLines = computed(() => this.activeCode().split('\n').map(tokenize));

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      for (const id of this.timers) clearTimeout(id);
    });
  }

  protected selectTab(id: string): void {
    this.activeTab.set(id);
    this.copied.set(false);
  }

  protected async copyCode(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.activeCode());
      this.copied.set(true);
      const id = setTimeout(() => {
        this.timers.delete(id);
        this.copied.set(false);
      }, 1800);
      this.timers.add(id);
    } catch {
      this.copied.set(false);
    }
  }
}
