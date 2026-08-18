import { ICheckoutSessionRepository } from '../../domain/repositories/checkout-session.repository.interface';
import {
  CheckoutSession,
  CustomerCollectionMode,
  CheckoutSessionPrefillCustomer,
} from '../../domain/entities/checkout-session.entity';
import { IStoreRepository } from '../../domain/repositories/store.repository.interface';
import { IPaymentRepository } from '../../domain/repositories/payment.repository.interface';
import { PaymentObject } from '../../domain/entities/payment.entity';
import { CheckoutSessionNotFoundError } from '../../domain/errors/checkout-session-not-found.error';
import { StoreNotFoundError } from '../../domain/errors/store-not-found.error';
import { LineItemObject } from '../../domain/entities/line-item.entity';

export interface CheckoutSessionCustomerInputState {
  hasDocument: boolean;
  hasName: boolean;
  hasEmail: boolean;
  maskedDocument?: string;
  maskedName?: string;
  maskedEmail?: string;
}

export interface IGetCheckoutSessionOutput {
  id: string;
  amount: number;
  currency: string;
  description: string | null;
  items: PublicLineItem[];
  customerCollectionMode: CustomerCollectionMode;
  customerInputState: CheckoutSessionCustomerInputState;
  status: string;
  expiresAt: Date;
  store: {
    name: string;
  };
  paymentId: string | null;
  payment?: PaymentObject;
  successUrl: string | null;
  cancelUrl: string | null;
}

export class GetCheckoutSessionUseCase {
  constructor(
    private readonly sessionRepository: ICheckoutSessionRepository,
    private readonly storeRepository: IStoreRepository,
    private readonly paymentRepository: IPaymentRepository,
  ) { }

  async execute(token: string): Promise<IGetCheckoutSessionOutput> {
    const session = await this.sessionRepository.findByToken(token);

    if (!session) {
      throw new CheckoutSessionNotFoundError(token);
    }

    const store = await this.storeRepository.findById(session.storeId);
    if (!store) {
      throw new StoreNotFoundError(session.storeId);
    }

    // Lazy expiration check
    if (session.status === 'OPEN' && new Date() > session.expiresAt) {
      session.expire();
      await this.sessionRepository.save(session);
    }

    let paymentObj: PaymentObject | undefined;
    if (session.paymentId) {
      const payment = await this.paymentRepository.findById(session.paymentId);
      if (payment) {
        paymentObj = toPublicPaymentObject(payment.toObject());
      }
    }

    return {
      id: session.id,
      amount: session.amount,
      currency: session.currency,
      description: session.description,
      items: session.items.map(toPublicLineItem),
      customerCollectionMode: session.customerCollectionMode,
      customerInputState: buildCustomerInputState(session.prefillCustomer),
      status: session.status,
      expiresAt: session.expiresAt,
      store: {
        name: store.name,
      },
      paymentId: session.paymentId,
      payment: paymentObj,
      successUrl: session.successUrl,
      cancelUrl: session.cancelUrl,
    };
  }
}

type PublicLineItem = Pick<
  LineItemObject,
  "id" | "name" | "description" | "quantity" | "unitPrice" | "totalPrice" | "imageUrl"
>;

function toPublicLineItem(item: LineItemObject): PublicLineItem {
  return {
    id: item.id,
    name: item.name,
    description: item.description,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    totalPrice: item.totalPrice,
    imageUrl: item.imageUrl,
  };
}

function toPublicPaymentObject(payment: PaymentObject): PaymentObject {
  return {
    ...payment,
    metadata: undefined,
    items: (payment.items ?? []).map((item) => ({
      ...toPublicLineItem(item),
    })),
  };
}

function buildCustomerInputState(
  prefillCustomer: CheckoutSessionPrefillCustomer | null,
): CheckoutSessionCustomerInputState {
  return {
    hasDocument: Boolean(prefillCustomer?.document),
    hasName: Boolean(prefillCustomer?.name),
    hasEmail: Boolean(prefillCustomer?.email),
    maskedDocument: prefillCustomer?.document
      ? maskDocument(prefillCustomer.document)
      : undefined,
    maskedName: prefillCustomer?.name
      ? maskName(prefillCustomer.name)
      : undefined,
    maskedEmail: prefillCustomer?.email
      ? maskEmail(prefillCustomer.email)
      : undefined,
  };
}

function maskDocument(document: string): string {
  const digits = document.replace(/\D/g, '');

  if (digits.length <= 4) {
    return '*'.repeat(digits.length);
  }

  return `${digits.slice(0, 3)}***${digits.slice(-2)}`;
}

function maskName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);

  if (parts.length === 0) return '';

  return parts
    .map((part) => `${part[0]}${'*'.repeat(Math.max(part.length - 1, 1))}`)
    .join(' ');
}

function maskEmail(email: string): string {
  const [localPart = '', domain = ''] = email.split('@');

  if (!domain) return `${localPart[0] ?? '*'}***`;

  return `${localPart[0] ?? '*'}***@${domain}`;
}
