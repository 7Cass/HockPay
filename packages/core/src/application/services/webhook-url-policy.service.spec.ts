import { describe, expect, it } from 'vitest';
import {
  getWebhookUrlPolicyOptionsForNodeEnv,
  validateWebhookResolvedAddress,
  validateWebhookUrl,
} from './webhook-url-policy.service';

describe('webhook URL policy', () => {
  it.each(['https://hooks.example.com/hockpay', 'https://api.partner.example/webhooks/hockpay'])(
    'accepts public HTTPS URL %s',
    (url) => {
      expect(validateWebhookUrl(url).valid).toBe(true);
    },
  );

  it.each(['http://localhost:3999/webhook', 'http://127.0.0.1:3999/webhook'])(
    'accepts local HTTP only when local HTTP is enabled: %s',
    (url) => {
      expect(validateWebhookUrl(url, { allowLocalHttp: true }).valid).toBe(true);
      expect(validateWebhookUrl(url, { allowLocalHttp: false }).valid).toBe(false);
    },
  );

  it.each([
    'ftp://hooks.example.com/webhook',
    'http://hooks.example.com/webhook',
    'https://localhost/webhook',
    'https://127.0.0.1/webhook',
    'https://10.0.0.1/webhook',
    'https://172.16.0.1/webhook',
    'https://192.168.1.10/webhook',
    'https://169.254.169.254/latest/meta-data',
    'https://[::1]/webhook',
    'https://[fe80::1]/webhook',
    'https://[fd00::1]/webhook',
    'https://[::ffff:127.0.0.1]/webhook',
  ])('rejects SSRF-sensitive webhook URL %s', (url) => {
    expect(validateWebhookUrl(url, { allowLocalHttp: true }).valid).toBe(false);
  });

  it('enables local HTTP only for local-like node environments', () => {
    expect(getWebhookUrlPolicyOptionsForNodeEnv(undefined)).toEqual({
      allowLocalHttp: false,
    });
    expect(getWebhookUrlPolicyOptionsForNodeEnv('development')).toEqual({
      allowLocalHttp: true,
    });
    expect(getWebhookUrlPolicyOptionsForNodeEnv('local')).toEqual({
      allowLocalHttp: true,
    });
    expect(getWebhookUrlPolicyOptionsForNodeEnv('test')).toEqual({
      allowLocalHttp: true,
    });
    expect(getWebhookUrlPolicyOptionsForNodeEnv('production')).toEqual({
      allowLocalHttp: false,
    });
  });

  it('rejects localhost HTTP when NODE_ENV is unset', () => {
    expect(
      validateWebhookUrl(
        'http://localhost:3999/webhook',
        getWebhookUrlPolicyOptionsForNodeEnv(undefined),
      ).valid,
    ).toBe(false);
  });

  it('rejects resolved private and reserved addresses', () => {
    expect(validateWebhookResolvedAddress({ address: '127.0.0.1' }).valid).toBe(false);
    expect(validateWebhookResolvedAddress({ address: '169.254.169.254' }).valid).toBe(false);
    expect(validateWebhookResolvedAddress({ address: '93.184.216.34' }).valid).toBe(true);
  });
});
