import { describe, expect, it } from 'vitest';
import { AlertConfig, IAlertConfigRepository, IEncryptionPort } from '../..';
import { CreateAlertConfigUseCase } from './create-alert-config.use-case';
import { InvalidAlertConfigError } from '../../domain/errors/invalid-alert-config.error';
import { InvalidAlertEventsError } from '../../domain/errors/invalid-alert-events.error';

class InMemoryAlertConfigRepository implements IAlertConfigRepository {
  readonly configs: AlertConfig[] = [];

  async save(config: AlertConfig): Promise<void> {
    this.configs.push(config);
  }

  async update(config: AlertConfig): Promise<void> {
    const index = this.configs.findIndex((item) => item.id === config.id);
    if (index >= 0) this.configs[index] = config;
  }

  async findById(id: string): Promise<AlertConfig | null> {
    return this.configs.find((config) => config.id === id) ?? null;
  }

  async findByStoreId(storeId: string): Promise<AlertConfig[]> {
    return this.configs.filter((config) => config.storeId === storeId);
  }

  async findActiveForEvent(storeId: string, eventType: string): Promise<AlertConfig[]> {
    return this.configs.filter((config) => config.storeId === storeId && config.shouldReceiveEvent(eventType));
  }

  async delete(id: string): Promise<void> {
    const index = this.configs.findIndex((config) => config.id === id);
    if (index >= 0) this.configs.splice(index, 1);
  }
}

class FakeEncryption implements IEncryptionPort {
  encrypt(value: string): string {
    return `encrypted:${value}`;
  }

  decrypt(value: string): string {
    return value.replace(/^encrypted:/, '');
  }
}

describe('CreateAlertConfigUseCase', () => {
  it('creates a Discord alert with encrypted URL and safe preview', async () => {
    const repository = new InMemoryAlertConfigRepository();
    const useCase = new CreateAlertConfigUseCase(repository, new FakeEncryption());

    const result = await useCase.execute({
      storeId: 'store-1',
      name: 'Vendas aprovadas',
      channel: 'discord',
      discord: {
        webhookUrl: 'https://discord.com/api/webhooks/1234567890/abcdefghijklmnopqrstuvwxyz',
      },
      events: ['payment.confirmed'],
      isActive: true,
    });

    expect(repository.configs).toHaveLength(1);
    expect(result.alertConfig.encryptedConfig.discord.webhookUrl).toContain('encrypted:');
    expect(result.alertConfig.configPreview.webhookUrl).toBe(
      'https://discord.com/api/webhooks/123456.../...uvwxyz',
    );
    expect(result.alertConfig.configPreview.webhookUrl).not.toContain('abcdefghijklmnopqrstuvwxyz');
  });

  it('rejects non Discord webhook URLs', async () => {
    const useCase = new CreateAlertConfigUseCase(
      new InMemoryAlertConfigRepository(),
      new FakeEncryption(),
    );

    await expect(
      useCase.execute({
        storeId: 'store-1',
        name: 'Invalid',
        channel: 'discord',
        discord: {
          webhookUrl: 'https://example.com/api/webhooks/123/token',
        },
        events: ['payment.confirmed'],
      }),
    ).rejects.toBeInstanceOf(InvalidAlertConfigError);
  });

  it('rejects invalid alert events', async () => {
    const useCase = new CreateAlertConfigUseCase(
      new InMemoryAlertConfigRepository(),
      new FakeEncryption(),
    );

    await expect(
      useCase.execute({
        storeId: 'store-1',
        name: 'Invalid',
        channel: 'discord',
        discord: {
          webhookUrl: 'https://discord.com/api/webhooks/123/token',
        },
        events: ['customer.created'],
      }),
    ).rejects.toBeInstanceOf(InvalidAlertEventsError);
  });
});
