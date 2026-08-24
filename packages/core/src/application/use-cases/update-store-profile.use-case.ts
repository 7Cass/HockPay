import { StoreObject } from '../../domain/entities/store.entity';
import { StoreNotFoundError } from '../../domain/errors/store-not-found.error';
import { IStoreRepository } from '../../domain/repositories/store.repository.interface';

export interface IUpdateStoreProfileInput {
  storeId: string;
  merchantId: string;
  name: string;
  city?: string | null;
}

export interface IUpdateStoreProfileOutput {
  store: StoreObject;
}

export class UpdateStoreProfileUseCase {
  constructor(private readonly storeRepository: IStoreRepository) {}

  async execute(input: IUpdateStoreProfileInput): Promise<IUpdateStoreProfileOutput> {
    const store = await this.storeRepository.findByIdAndMerchantId(input.storeId, input.merchantId);
    if (!store) {
      throw new StoreNotFoundError(input.storeId);
    }

    store.updateProfile({
      name: input.name,
      city: input.city,
    });
    await this.storeRepository.update(store);

    return { store: store.toObject() };
  }
}
