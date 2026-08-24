import { PixCharge } from '../entities/pix-charge.entity';

export interface IPixChargeRepository {
  save(charge: PixCharge): Promise<void>;
  update(charge: PixCharge): Promise<void>;
  findById(id: string): Promise<PixCharge | null>;
  findByIdAndStoreId(id: string, storeId: string): Promise<PixCharge | null>;
  findByIdAndStoreIdForUpdate(id: string, storeId: string): Promise<PixCharge | null>;
  findByPixTxId(pixTxId: string): Promise<PixCharge | null>;
}
