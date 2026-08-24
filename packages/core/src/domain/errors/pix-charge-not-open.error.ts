import { DomainError } from './domain-error';

export class PixChargeNotOpenError extends DomainError {
  constructor(pixChargeId: string, status?: string) {
    super(
      status
        ? `Pix charge ${pixChargeId} is not open: ${status}`
        : `Pix charge ${pixChargeId} is not open`,
      'PIX_CHARGE_NOT_OPEN',
    );
  }
}
