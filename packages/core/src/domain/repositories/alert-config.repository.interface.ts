import { AlertConfig } from '../entities/alert-config.entity';

export interface IAlertConfigRepository {
  save(config: AlertConfig): Promise<void>;
  update(config: AlertConfig): Promise<void>;
  findById(id: string): Promise<AlertConfig | null>;
  findByStoreId(storeId: string): Promise<AlertConfig[]>;
  findActiveForEvent(storeId: string, eventType: string): Promise<AlertConfig[]>;
  delete(id: string): Promise<void>;
}
