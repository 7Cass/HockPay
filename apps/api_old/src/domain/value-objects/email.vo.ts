/**
 * Value Object: Email
 *
 * Validação e normalização de endereços de e-mail
 */
const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
const MAX_LENGTH = 254;

export class Email {
  private readonly _value: string;

  constructor(email: string) {
    const normalized = this.normalize(email);
    this.validate(normalized);
    this._value = normalized;
  }

  get value(): string {
    return this._value;
  }

  private normalize(email: string): string {
    return email.trim().toLowerCase();
  }

  private validate(email: string): void {
    if (!email) {
      throw new Error('Email is required');
    }

    if (email.length > MAX_LENGTH) {
      throw new Error(`Email exceeds maximum length of ${MAX_LENGTH} characters`);
    }

    if (!EMAIL_REGEX.test(email)) {
      throw new Error('Email is invalid');
    }
  }

  /**
   * Retorna a parte local do email (antes do @)
   */
  get localPart(): string {
    return this._value.split('@')[0];
  }

  /**
   * Retorna o domínio do email (depois do @)
   */
  get domain(): string {
    return this._value.split('@')[1];
  }

  /**
   * Verifica se o email é de um domínio específico
   */
  isFromDomain(domain: string): boolean {
    return this.domain === domain.toLowerCase();
  }

  equals(other: Email): boolean {
    return this._value === other._value;
  }

  toString(): string {
    return this._value;
  }

  toJSON(): string {
    return this._value;
  }
}
