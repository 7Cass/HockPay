import { StoreObject } from '../../domain/entities/store.entity';
import { StoreNotFoundError } from '../../domain/errors/store-not-found.error';
import { IUnitOfWork } from '../../domain/repositories/unit-of-work.interface';

export interface IRequestLiveEnablementInput {
  storeId: string;
  merchantId: string;
}

export interface IRequestLiveEnablementOutput {
  store: StoreObject;
}

/**
 * Use Case: Merchant asks the desk for LIVE enablement.
 *
 * This does not write to the operator audit trail: `operatorId` is required
 * there, and there is no operator in a merchant's request. Forcing a synthetic
 * id would turn the desk's trail into a timeline of anyone. The request is
 * recorded by the store's own `liveStatusChangedAt`.
 */
export class RequestLiveEnablementUseCase {
  constructor(private readonly unitOfWork: IUnitOfWork) {}

  async execute(input: IRequestLiveEnablementInput): Promise<IRequestLiveEnablementOutput> {
    return this.unitOfWork.execute(async (repos) => {
      const owned = await repos.storeRepository.findByIdAndMerchantId(
        input.storeId,
        input.merchantId,
      );

      if (!owned) {
        throw new StoreNotFoundError(input.storeId);
      }

      const store = await repos.storeRepository.findByIdForUpdate(input.storeId);

      if (!store) {
        throw new StoreNotFoundError(input.storeId);
      }

      store.requestLive();
      await repos.storeRepository.update(store);

      return { store: store.toObject() };
    });
  }
}
