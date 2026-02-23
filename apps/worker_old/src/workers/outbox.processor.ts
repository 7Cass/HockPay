import * as crypto from 'crypto';
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../infra/database/prisma.service';

/**
 * OutboxProcessor
 *
 * Processa eventos do outbox e envia webhooks
 * Roda a cada 10 segundos
 */
@Injectable()
export class OutboxProcessor {
  private readonly logger = new Logger(OutboxProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Processa eventos pendentes do outbox
   * Roda a cada 10 segundos
   */
  @Cron(CronExpression.EVERY_10_SECONDS)
  async handlePendingEvents(): Promise<void> {
    await this.processPendingEvents();
  }

  /**
   * Processa eventos pendentes do outbox
   */
  async processPendingEvents(): Promise<void> {
    this.logger.debug('Processing pending outbox events...');

    // Busca eventos pendentes
    const events = await this.prisma.outboxEvent.findMany({
      where: {
        status: 'PENDING',
        nextRetryAt: { lte: new Date() },
      },
      orderBy: { createdAt: 'asc' },
      take: 100,
    });

    if (events.length === 0) {
      return;
    }

    this.logger.log(`Processing ${events.length} pending outbox events`);

    for (const event of events) {
      await this.processEvent(event);
    }
  }

  /**
   * Processa um único evento do outbox
   */
  private async processEvent(event: any): Promise<void> {
    try {
      this.logger.debug(`Processing outbox event: ${event.id}`);

      // Marca como FAILED temporariamente (para evitar reprocessamento)
      await this.prisma.outboxEvent.update({
        where: { id: event.id },
        data: { status: 'FAILED' },
      });

      // Busca as configurações de webhook para o aggregate
      const payload = event.payload as any;
      const storeId = payload.storeId;

      if (!storeId) {
        // Nenhum webhook configurado, marca como processado
        await this.prisma.outboxEvent.update({
          where: { id: event.id },
          data: { status: 'PROCESSED', processedAt: new Date() },
        });
        return;
      }

      const webhookConfigs = await this.prisma.webhookConfig.findMany({
        where: {
          storeId,
          isActive: true,
          events: { has: event.eventType },
        },
      });

      if (webhookConfigs.length === 0) {
        // Nenhum webhook configurado, marca como processado
        await this.prisma.outboxEvent.update({
          where: { id: event.id },
          data: { status: 'PROCESSED', processedAt: new Date() },
        });
        return;
      }

      // Envia para cada configuração de webhook
      let success = false;
      for (const config of webhookConfigs) {
        try {
          await this.sendWebhook(config, event);
          success = true;
        } catch (error) {
          this.logger.error(`Failed to send webhook to ${config.url}`, error);
        }
      }

      if (success) {
        // Marca como processado
        await this.prisma.outboxEvent.update({
          where: { id: event.id },
          data: { status: 'PROCESSED', processedAt: new Date() },
        });
      } else {
        // Marca para retry
        const retryCount = event.retryCount + 1;
        const maxRetries = event.maxRetries;

        if (retryCount >= maxRetries) {
          await this.prisma.outboxEvent.update({
            where: { id: event.id },
            data: {
              status: 'FAILED',
              errorMessage: 'Max retries exceeded',
              retryCount,
            },
          });
        } else {
          const nextRetryAt = this.calculateNextRetry(retryCount);
          await this.prisma.outboxEvent.update({
            where: { id: event.id },
            data: {
              status: 'PENDING',
              retryCount,
              nextRetryAt,
            },
          });
        }
      }
    } catch (error) {
      this.logger.error(`Error processing outbox event ${event.id}`, error);

      // Marca para retry
      const nextRetryAt = this.calculateNextRetry(event.retryCount + 1);
      await this.prisma.outboxEvent.update({
        where: { id: event.id },
        data: {
          status: 'PENDING',
          nextRetryAt,
          errorMessage: String(error),
        },
      });
    }
  }

  /**
   * Envia um webhook
   */
  private async sendWebhook(config: any, event: any): Promise<void> {
    const payload = event.payload;
    const timestamp = Date.now();
    const webhookId = crypto.randomUUID();

    // Gera assinatura HMAC-SHA256
    const signature = this.generateSignature(config.secret, payload, timestamp);

    const response = await fetch(config.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Hockpay-Signature': signature,
        'X-Hockpay-Timestamp': String(timestamp),
        'X-Hockpay-Webhook-Id': webhookId,
        'User-Agent': 'Hockpay-Worker/1.0',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Webhook returned ${response.status}: ${response.statusText}`);
    }

    this.logger.debug(`Webhook sent successfully to ${config.url}`);
  }

  /**
   * Gera assinatura HMAC-SHA256
   */
  private generateSignature(secret: string, payload: any, timestamp: number): string {
    // Cria uma string assinável
    const payloadString = JSON.stringify(payload);
    const signatureBase = `${secret}${timestamp}${payloadString}`;

    // Usar crypto.createHmac para HMAC-SHA256 (Node.js)
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(signatureBase);
    const hash = hmac.digest('hex');
    return 'sha256=' + hash;
  }

  /**
   * Calcula o próximo momento de retry (exponential backoff)
   */
  private calculateNextRetry(retryCount: number): Date {
    // Exponential backoff: 10s, 1min, 5min, 30min, 2h
    const delays = [10, 60, 300, 1800, 7200]; // em segundos
    const index = Math.min(retryCount - 1, delays.length - 1);
    const delaySeconds = delays[index];
    return new Date(Date.now() + delaySeconds * 1000);
  }
}
