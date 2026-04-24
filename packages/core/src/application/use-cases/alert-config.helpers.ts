import {
  AlertChannel,
  AlertConfigPreview,
  AlertEncryptedConfig,
} from '../../domain/entities/alert-config.entity';
import { getInvalidAlertEvents } from '../../domain/constants/alert-events';
import { IEncryptionPort } from '../ports/encryption.port';
import { InvalidAlertChannelError } from '../../domain/errors/invalid-alert-channel.error';
import { InvalidAlertConfigError } from '../../domain/errors/invalid-alert-config.error';
import { InvalidAlertEventsError } from '../../domain/errors/invalid-alert-events.error';

const SUPPORTED_CHANNELS: AlertChannel[] = ['discord'];

export function validateAlertChannel(channel: string): asserts channel is AlertChannel {
  if (!SUPPORTED_CHANNELS.includes(channel as AlertChannel)) {
    throw new InvalidAlertChannelError(channel);
  }
}

export function validateAlertEvents(events: string[]): void {
  const invalidEvents = getInvalidAlertEvents(events);
  if (invalidEvents.length > 0) {
    throw new InvalidAlertEventsError(invalidEvents);
  }
}

export function buildDiscordAlertConfig(
  webhookUrl: string,
  encryption: IEncryptionPort,
): { encryptedConfig: AlertEncryptedConfig; configPreview: AlertConfigPreview } {
  validateDiscordWebhookUrl(webhookUrl);

  return {
    encryptedConfig: {
      discord: {
        webhookUrl: encryption.encrypt(webhookUrl),
      },
    },
    configPreview: {
      webhookUrl: maskDiscordWebhookUrl(webhookUrl),
    },
  };
}

export function decryptAlertConfig(
  encryptedConfig: AlertEncryptedConfig,
  encryption: IEncryptionPort,
): AlertEncryptedConfig {
  return {
    discord: {
      webhookUrl: encryption.decrypt(encryptedConfig.discord.webhookUrl),
    },
  };
}

export function validateDiscordWebhookUrl(webhookUrl: string): void {
  let parsed: URL;

  try {
    parsed = new URL(webhookUrl);
  } catch {
    throw new InvalidAlertConfigError('Invalid Discord webhook URL');
  }

  const allowedHosts = new Set([
    'discord.com',
    'www.discord.com',
    'discordapp.com',
    'www.discordapp.com',
  ]);

  if (parsed.protocol !== 'https:' || !allowedHosts.has(parsed.hostname)) {
    throw new InvalidAlertConfigError('Discord webhook URL must use HTTPS and a Discord host');
  }

  const parts = parsed.pathname.split('/').filter(Boolean);
  if (parts.length < 4 || parts[0] !== 'api' || parts[1] !== 'webhooks') {
    throw new InvalidAlertConfigError('Discord webhook URL must use /api/webhooks/{id}/{token}');
  }
}

function maskDiscordWebhookUrl(webhookUrl: string): string {
  const parsed = new URL(webhookUrl);
  const parts = parsed.pathname.split('/').filter(Boolean);
  const webhookId = parts[2] ?? '';
  const token = parts[3] ?? '';
  const idPreview = webhookId.length > 6 ? `${webhookId.slice(0, 6)}...` : webhookId;
  const tokenPreview = token.length > 6 ? `...${token.slice(-6)}` : '...';
  return `${parsed.origin}/api/webhooks/${idPreview}/${tokenPreview}`;
}
