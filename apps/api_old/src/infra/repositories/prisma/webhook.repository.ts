import { Injectable } from '@nestjs/common';
import { OutboxEvent as OutboxEventEntity, Prisma } from '@hockpay/database';
import { OutboxEvent } from '../../../domain/entities/outbox-event.entity';
import { PrismaService } from '../../database/prisma.service';

/**
 * Implementação do WebhookRepository usando Prisma
 * Mantém apenas os métodos de OutboxEvent necessários para o funcionamento
 */
@Injectable()
export class WebhookRepository {
  constructor(private readonly prisma: PrismaService) {}

  // ============= OUTBOX =============

  async createOutboxEvent(event: OutboxEvent): Promise<OutboxEvent> {
    const data = event.toPersistence();

    const created = await this.prisma.outboxEvent.create({
      data: {
        id: data.id,
        aggregateType: data.aggregateType,
        aggregateId: data.aggregateId,
        eventType: data.eventType,
        payload: data.payload as Prisma.InputJsonValue,
        status: data.status as any,
        processedAt: data.processedAt,
        retryCount: data.retryCount,
        maxRetries: data.maxRetries,
        nextRetryAt: data.nextRetryAt,
        errorMessage: data.errorMessage,
        createdAt: data.createdAt,
      },
    });

    return this.toDomainOutbox(created);
  }

  async findPendingOutboxEvents(limit = 100): Promise<OutboxEvent[]> {
    const events = await this.prisma.outboxEvent.findMany({
      where: {
        status: 'PENDING',
        nextRetryAt: { lte: new Date() },
      },
      orderBy: { createdAt: 'asc' },
      take: limit,
    });

    return events.map(e => this.toDomainOutbox(e));
  }

  async markOutboxEventAsProcessed(eventId: string, processedAt: Date): Promise<OutboxEvent> {
    const updated = await this.prisma.outboxEvent.update({
      where: { id: eventId },
      data: {
        status: 'PROCESSED',
        processedAt,
      },
    });

    return this.toDomainOutbox(updated);
  }

  async markOutboxEventAsFailed(eventId: string, errorMessage: string, nextRetryAt: Date): Promise<OutboxEvent> {
    const updated = await this.prisma.outboxEvent.update({
      where: { id: eventId },
      data: {
        status: 'FAILED',
        errorMessage,
        nextRetryAt,
        retryCount: { increment: 1 },
      },
    });

    return this.toDomainOutbox(updated);
  }

  async incrementOutboxEventRetry(eventId: string): Promise<OutboxEvent> {
    const updated = await this.prisma.outboxEvent.update({
      where: { id: eventId },
      data: {
        retryCount: { increment: 1 },
      },
    });

    return this.toDomainOutbox(updated);
  }

  // ============= DOMAIN TO PRISMA MAPPERS =============

  private toDomainOutbox(prismaOutbox: OutboxEventEntity): OutboxEvent {
    return OutboxEvent.fromPersistence({
      id: prismaOutbox.id,
      aggregateType: prismaOutbox.aggregateType,
      aggregateId: prismaOutbox.aggregateId,
      eventType: prismaOutbox.eventType,
      payload: prismaOutbox.payload as Record<string, unknown>,
      status: prismaOutbox.status as any,
      processedAt: prismaOutbox.processedAt,
      retryCount: prismaOutbox.retryCount,
      maxRetries: prismaOutbox.maxRetries,
      nextRetryAt: prismaOutbox.nextRetryAt,
      errorMessage: prismaOutbox.errorMessage,
      createdAt: prismaOutbox.createdAt,
    });
  }
}
