import { DomainError } from "./domain-error";

export class CustomerDocumentRequiredError extends DomainError {
  constructor() {
    super(
      "Customer document is required for identified checkout sessions",
      "CUSTOMER_DOCUMENT_REQUIRED",
    );
  }
}
