import { DomainError } from "./domain-error";

export class InvalidWebhookUrlError extends DomainError {
  constructor(message: string) {
    super(message, "INVALID_WEBHOOK_URL");
  }
}
