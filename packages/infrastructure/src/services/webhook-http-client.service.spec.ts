import { afterEach, describe, expect, it, vi } from 'vitest';
import { WebhookHttpClientService } from './webhook-http-client.service';

describe('WebhookHttpClientService', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('blocks SSRF-sensitive webhook targets before calling fetch', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('ok'));
    const client = new WebhookHttpClientService();

    const response = await client.send(
      'https://169.254.169.254/latest/meta-data',
      { test: true },
      { 'Content-Type': 'application/json' },
    );

    expect(response.success).toBe(false);
    expect(response.statusCode).toBe(0);
    expect(response.body).toContain('public remote host');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('allows local HTTP when the caller opts into local development policy', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response('ok', { status: 200 }));
    const client = new WebhookHttpClientService({
      webhookUrlPolicyOptions: { allowLocalHttp: true },
    });

    const response = await client.send(
      'http://127.0.0.1:3999/webhook',
      { test: true },
      { 'Content-Type': 'application/json' },
    );

    expect(response.success).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('blocks when DNS changes between policy check and connect', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response('ok', { status: 200 }));
    let lookups = 0;
    const client = new WebhookHttpClientService({
      dnsLookup: async () => {
        lookups += 1;
        return lookups === 1
          ? [{ address: '93.184.216.34', family: 4 }]
          : [{ address: '127.0.0.1', family: 4 }];
      },
    });

    const response = await client.send(
      'https://hooks.example.com/webhook',
      { test: true },
      { 'Content-Type': 'application/json' },
    );

    expect(response.success).toBe(false);
    expect(response.body).toMatch(/different address|non-public address/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('blocks a public-looking HTTPS hostname that resolves to localhost', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response('ok', { status: 200 }));
    const client = new WebhookHttpClientService({
      dnsLookup: async () => [{ address: '127.0.0.1', family: 4 }],
    });

    const response = await client.send(
      'https://hooks.example.com/webhook',
      { test: true },
      { 'Content-Type': 'application/json' },
    );

    expect(response.success).toBe(false);
    expect(response.statusCode).toBe(0);
    expect(response.body).toContain('non-public address');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each(['http://localhost:3999/webhook', 'https://169.254.169.254/latest/meta-data'])(
    'blocks a redirect hop to SSRF-sensitive target %s',
    async (location) => {
      const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response('', {
          status: 302,
          headers: { Location: location },
        }),
      );
      const client = new WebhookHttpClientService({
        dnsLookup: async () => [{ address: '93.184.216.34', family: 4 }],
      });

      const response = await client.send(
        'https://hooks.example.com/webhook',
        { test: true },
        { 'Content-Type': 'application/json' },
      );

      expect(response.success).toBe(false);
      expect(response.statusCode).toBe(0);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    },
  );

  it('pins fetch to the validated public IP with original Host and SNI', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response('ok', { status: 200 }));
    const client = new WebhookHttpClientService({
      dnsLookup: async () => [{ address: '93.184.216.34', family: 4 }],
    });

    const response = await client.send(
      'https://hooks.example.com/webhook',
      { test: true },
      { 'Content-Type': 'application/json' },
    );

    expect(response.success).toBe(true);
    expect(response.statusCode).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://93.184.216.34/webhook',
      expect.objectContaining({
        redirect: 'manual',
        headers: expect.objectContaining({
          Host: 'hooks.example.com',
          'Content-Type': 'application/json',
        }),
      }),
    );
    expect(fetchMock.mock.calls[0]?.[1]).toEqual(
      expect.objectContaining({
        dispatcher: expect.objectContaining({
          closed: expect.anything(),
        }),
      }),
    );
  });

  it('pins IPv6 destinations with a bracketed URL and original Host', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response('ok', { status: 200 }));
    const client = new WebhookHttpClientService({
      dnsLookup: async () => [{ address: '2606:2800:220:1:248:1893:25c8:1946', family: 6 }],
    });

    const response = await client.send(
      'https://hooks.example.com/webhook',
      { test: true },
      { 'Content-Type': 'application/json' },
    );

    expect(response.success).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://[2606:2800:220:1:248:1893:25c8:1946]/webhook',
      expect.objectContaining({
        headers: expect.objectContaining({
          Host: 'hooks.example.com',
        }),
      }),
    );
  });
});
