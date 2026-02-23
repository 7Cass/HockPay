/**
 * Response DTO for a single customer.
 */
export class CustomerResponseDto {
  id: string;
  storeId: string;
  externalId?: string;
  name?: string;
  email?: string;
  document: string;
  formattedDocument: string;
  documentType: 'CPF' | 'CNPJ';
  phone?: string;
  street?: string;
  number?: string;
  complement?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  country?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Response DTO for get customer endpoint.
 */
export class GetCustomerResponseDto {
  customer: CustomerResponseDto;
}
