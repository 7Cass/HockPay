import { InvalidDocumentError } from '../errors/invalid-document.error';

/**
 * Value Object: Document (CPF/CNPJ)
 *
 * Represents a Brazilian tax identification number (CPF for individuals, CNPJ for companies).
 * Includes validation logic for both document types.
 */
export class Document {
  private readonly _value: string;
  private readonly _type: 'CPF' | 'CNPJ';

  constructor(document: string) {
    const normalized = Document.normalize(document);
    const type = Document.detectType(normalized);

    if (!Document.isValid(normalized, type)) {
      throw new InvalidDocumentError(document);
    }

    this._value = normalized;
    this._type = type;
  }

  /**
   * Normalizes a document by removing non-digit characters.
   */
  private static normalize(document: string): string {
    return document.replace(/\D/g, '');
  }

  /**
   * Detects whether the document is a CPF or CNPJ based on length.
   */
  private static detectType(document: string): 'CPF' | 'CNPJ' {
    return document.length === 11 ? 'CPF' : 'CNPJ';
  }

  /**
   * Validates a CPF document.
   */
  private static isValidCPF(cpf: string): boolean {
    if (cpf.length !== 11) return false;
    if (/^(\d)\1+$/.test(cpf)) return false; // All same digits

    // Validate CPF check digits
    const digits = cpf.split('').map(Number);
    const checkDigits = digits.slice(9);

    // First check digit
    let sum = 0;
    for (let i = 0; i < 9; i++) {
      sum += digits[i] * (10 - i);
    }
    let remainder = sum % 11;
    const digit1 = remainder < 2 ? 0 : 11 - remainder;

    if (digit1 !== checkDigits[0]) return false;

    // Second check digit
    sum = 0;
    for (let i = 0; i < 10; i++) {
      sum += digits[i] * (11 - i);
    }
    remainder = sum % 11;
    const digit2 = remainder < 2 ? 0 : 11 - remainder;

    return digit2 === checkDigits[1];
  }

  /**
   * Validates a CNPJ document.
   */
  private static isValidCNPJ(cnpj: string): boolean {
    if (cnpj.length !== 14) return false;
    if (/^(\d)\1+$/.test(cnpj)) return false; // All same digits

    // Validate CNPJ check digits
    const digits = cnpj.split('').map(Number);
    const checkDigits = digits.slice(12);

    // First check digit
    let sum = 0;
    let weight = 5;
    for (let i = 0; i < 12; i++) {
      sum += digits[i] * weight;
      weight = weight === 2 ? 9 : weight - 1;
    }
    let remainder = sum % 11;
    const digit1 = remainder < 2 ? 0 : 11 - remainder;

    if (digit1 !== checkDigits[0]) return false;

    // Second check digit
    sum = 0;
    weight = 6;
    for (let i = 0; i < 13; i++) {
      sum += digits[i] * weight;
      weight = weight === 2 ? 9 : weight - 1;
    }
    remainder = sum % 11;
    const digit2 = remainder < 2 ? 0 : 11 - remainder;

    return digit2 === checkDigits[1];
  }

  /**
   * Validates a document based on its type.
   */
  private static isValid(document: string, type: 'CPF' | 'CNPJ'): boolean {
    if (type === 'CPF') {
      return Document.isValidCPF(document);
    }
    return Document.isValidCNPJ(document);
  }

  /**
   * Gets the raw string value of the document.
   */
  get value(): string {
    return this._value;
  }

  /**
   * Gets the formatted string value of the document with masks.
   */
  get formatted(): string {
    if (this._type === 'CPF') {
      return this._value.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
    }
    return this._value.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
  }

  /**
   * Gets the document type (CPF or CNPJ).
   */
  get type(): 'CPF' | 'CNPJ' {
    return this._type;
  }

  /**
   * Checks if two documents are equal.
   */
  equals(other: Document): boolean {
    return this._value === other._value;
  }

  /**
   * Creates a Document instance from a string.
   * Returns null if the document is invalid.
   */
  static create(document: string): Document | null {
    try {
      return new Document(document);
    } catch {
      return null;
    }
  }
}
