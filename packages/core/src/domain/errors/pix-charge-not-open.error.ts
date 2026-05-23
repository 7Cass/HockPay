import { DomainError } from "./domain-error";
import { PixChargeStatus } from "../entities/pix-charge.entity";

export class PixChargeNotOpenError extends DomainError {
  constructor(
    pixChargeId: string,
    status?: PixChargeStatus | string,
  ) {
    super(
      status
        ? `Pix charge ${pixChargeId} is not open: ${status}`
        : `Pix charge ${pixChargeId} is not open`,
      "PIX_CHARGE_NOT_OPEN",
    );
  }
}
