import { AlertDeliveryLog, AlertDeliveryStatus } from '../entities/alert-delivery-log.entity';

export interface IAlertDeliveryLogRepository {
  save(log: AlertDeliveryLog): Promise<void>;
  update(log: AlertDeliveryLog): Promise<void>;
  findById(id: string): Promise<AlertDeliveryLog | null>;
  findByAlertConfigId(alertConfigId: string, limit?: number): Promise<AlertDeliveryLog[]>;
  findByAlertConfigIdAndOutboxEventId(alertConfigId: string, outboxEventId: string): Promise<AlertDeliveryLog | null>;
  countByAlertConfigId(alertConfigId: string, status?: AlertDeliveryStatus): Promise<number>;
}
