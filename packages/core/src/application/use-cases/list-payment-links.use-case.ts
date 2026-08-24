import {
  IPaymentLinkRepository,
  ListPaymentLinksOptions,
  ListPaymentLinksResult,
} from '../../domain/repositories/payment-link.repository.interface';

export class ListPaymentLinksUseCase {
  constructor(private readonly repository: IPaymentLinkRepository) {}

  execute(input: ListPaymentLinksOptions): Promise<ListPaymentLinksResult> {
    return this.repository.list(input);
  }
}
