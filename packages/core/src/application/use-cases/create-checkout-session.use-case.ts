import {
  CheckoutSession,
  CustomerCollectionMode,
  CheckoutSessionPrefillCustomer,
} from '../../domain/entities/checkout-session.entity';
import { CreateLineItemInput } from '../../domain/entities/line-item.entity';
import { ICheckoutSessionRepository } from '../../domain/repositories/checkout-session.repository.interface';
import { IStoreRepository } from '../../domain/repositories/store.repository.interface';
import { ITokenGeneratorPort } from '../ports/token-generator.port';
import { Environment } from '../../domain/value-objects/environment.vo';
import { StoreNotFoundError } from '../../domain/errors/store-not-found.error';
import { StoreInactiveError } from '../../domain/errors/store-inactive.error';
import { StoreNotApprovedError } from '../../domain/errors/store-not-approved.error';
import { InvalidLineItemsError } from '../../domain/errors/invalid-line-items.error';
import { LineItemResolverService } from '../services/line-item-resolver.service';

export interface ICreateCheckoutSessionInput {
  storeId: string;
  environment?: Environment;
  amount?: number;
  items?: CreateLineItemInput[];
  description?: string;
  customerCollectionMode?: CustomerCollectionMode;
  prefillCustomer?: CheckoutSessionPrefillCustomer;
  successUrl?: string;
  cancelUrl?: string;
  metadata?: Record<string, unknown>;
  expiresInSeconds?: number;
}

export interface ICreateCheckoutSessionOutput {
  id: string;
  checkoutToken: string;
  checkoutUrl: string;
  customerCollectionMode: CustomerCollectionMode;
  prefillCustomer: CheckoutSessionPrefillCustomer | null;
}

export class CreateCheckoutSessionUseCase {
  constructor(
    private readonly sessionRepository: ICheckoutSessionRepository,
    private readonly storeRepository: IStoreRepository,
    private readonly tokenGenerator: ITokenGeneratorPort,
    private readonly checkoutBaseUrl: string,
    private readonly lineItemResolver?: LineItemResolverService,
  ) { }

  async execute(input: ICreateCheckoutSessionInput): Promise<ICreateCheckoutSessionOutput> {
    const store = await this.storeRepository.findById(input.storeId);

    if (!store) throw new StoreNotFoundError(input.storeId);
    if (!store.isActive) throw new StoreInactiveError(store.id);
    if (!store.isApproved) throw new StoreNotApprovedError(store.id);

    const checkoutToken = this.tokenGenerator.generateBase64(32);
    const environment = input.environment ?? Environment.TEST;
    const resolvedItems = await this.resolveLineItems({
      storeId: input.storeId,
      environment,
      amount: input.amount,
      items: input.items,
    });
    
    // Default expiration: 30 minutes
    const expirationSeconds = input.expiresInSeconds ?? 30 * 60;
    const expiresAt = new Date(Date.now() + expirationSeconds * 1000);

    const session = CheckoutSession.create({
      storeId: input.storeId,
      amount: resolvedItems.amount,
      environment,
      description: input.description,
      customerCollectionMode:
        input.customerCollectionMode ?? CustomerCollectionMode.IDENTIFIED,
      prefillCustomer: input.prefillCustomer,
      checkoutToken,
      successUrl: input.successUrl,
      cancelUrl: input.cancelUrl,
      metadata: input.metadata,
      items: resolvedItems.items,
      expiresAt,
    });

    await this.sessionRepository.save(session);

    return {
      id: session.id,
      checkoutToken,
      checkoutUrl: `${this.checkoutBaseUrl}/${checkoutToken}`,
      customerCollectionMode: session.customerCollectionMode,
      prefillCustomer: session.prefillCustomer,
    };
  }

  private async resolveLineItems(input: {
    storeId: string;
    environment: Environment;
    amount?: number;
    items?: CreateLineItemInput[];
  }) {
    if (this.lineItemResolver) return this.lineItemResolver.resolve(input);

    if (input.items?.length) {
      throw new InvalidLineItemsError("Line item resolver is not configured");
    }
    if (!Number.isInteger(input.amount) || (input.amount ?? 0) < 1) {
      throw new InvalidLineItemsError("Amount must be at least 1 cent");
    }
    return { amount: input.amount!, items: [] };
  }
}
