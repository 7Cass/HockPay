import 'reflect-metadata';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CreateWebhookDto } from './create-webhook.dto';
import { ListWebhookLogsQueryDto } from './list-webhook-logs.dto';
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
    'https://localhost/hockpay',
    'https://10.0.0.1/hockpay',
    'https://172.16.0.1/hockpay',
    'https://192.168.1.10/hockpay',
    'https://169.254.169.254/latest/meta-data',
    'https://[::1]/hockpay',
    'https://[fd00::1]/hockpay',
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

  it('treats status=undefined as an absent webhook-log filter', async () => {
    const dto = plainToInstance(ListWebhookLogsQueryDto, {
      limit: '50',
      status: 'undefined',
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
    expect(dto.status).toBeUndefined();
  });
});
