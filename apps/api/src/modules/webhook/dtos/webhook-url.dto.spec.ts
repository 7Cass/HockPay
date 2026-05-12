import { validate } from 'class-validator';
import { CreateWebhookDto } from './create-webhook.dto';
import { UpdateWebhookDto } from './update-webhook.dto';

describe('Webhook URL DTO validation', () => {
  async function validateCreate(url: string) {
    const dto = Object.assign(new CreateWebhookDto(), {
      url,
      events: ['payment.confirmed'],
    });
    return validate(dto);
  }

  it.each([
    'https://hooks.example.com/hockpay',
    'http://localhost:3999/webhook',
    'http://127.0.0.1:3999/webhook',
  ])('accepts supported webhook URL %s', async (url) => {
    await expect(validateCreate(url)).resolves.toHaveLength(0);
  });

  it.each([
    'http://hooks.example.com/hockpay',
    'ftp://localhost:3999/webhook',
    'localhost:3999/webhook',
  ])('rejects unsupported webhook URL %s', async (url) => {
    const errors = await validateCreate(url);
    expect(errors.some((error) => error.property === 'url')).toBe(true);
  });

  it('applies the same localhost policy to webhook updates', async () => {
    const dto = Object.assign(new UpdateWebhookDto(), {
      url: 'http://localhost:3999/webhook',
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
  });
});
