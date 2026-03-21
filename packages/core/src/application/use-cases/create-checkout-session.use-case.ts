import { CheckoutSession } from '../../domain/entities/checkout-session.entity';
import { ICheckoutSessionRepository } from '../../domain/repositories/checkout-session.repository.interface';
import { IStoreRepository } from '../../domain/repositories/store.repository.interface';
import { ITokenGeneratorPort } from '../ports/token-generator.port';
import { StoreNotFoundError } from '../../domain/errors/store-not-found.error';
import { StoreInactiveError } from '../../domain/errors/store-inactive.error';
import { StoreNotApprovedError } from '../../domain/errors/store-not-approved.error';

export interface ICreateCheckoutSessionInput {
  storeId: string;
  amount: number;
  description?: string;
  successUrl?: string;
  cancelUrl?: string;
  metadata?: Record<string, unknown>;
  expiresInSeconds?: number;
}

export interface ICreateCheckoutSessionOutput {
  id: string;
  checkoutToken: string;
  checkoutUrl: string;
}

export class CreateCheckoutSessionUseCase {
  constructor(
    private readonly sessionRepository: ICheckoutSessionRepository,
    private readonly storeRepository: IStoreRepository,
    private readonly tokenGenerator: ITokenGeneratorPort,
    private readonly checkoutBaseUrl: string,
  ) { }

  async execute(input: ICreateCheckoutSessionInput): Promise<ICreateCheckoutSessionOutput> {
    const store = await this.storeRepository.findById(input.storeId);

    if (!store) throw new StoreNotFoundError(input.storeId);
    if (!store.isActive) throw new StoreInactiveError(store.id);
    if (!store.isApproved) throw new StoreNotApprovedError(store.id);

    const checkoutToken = this.tokenGenerator.generateBase64(32);
    
    // Default expiration: 30 minutes
    const expirationSeconds = input.expiresInSeconds ?? 30 * 60;
    const expiresAt = new Date(Date.now() + expirationSeconds * 1000);

    const session = CheckoutSession.create({
      storeId: input.storeId,
      amount: input.amount,
      description: input.description,
      checkoutToken,
      successUrl: input.successUrl,
      cancelUrl: input.cancelUrl,
      metadata: input.metadata,
      expiresAt,
    });

    await this.sessionRepository.save(session);

    return {
      id: session.id,
      checkoutToken,
      checkoutUrl: `${this.checkoutBaseUrl}/${checkoutToken}`,
    };
  }
}
