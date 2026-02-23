/**
 * Value Object: Document
 *
 * Validação de CPF/CNPJ brasileiros
 */

export enum DocumentType {
  CPF = 'CPF',
  CNPJ = 'CNPJ',
}

/**
 * Remove caracteres não numéricos
 */
function stripNonDigits(value: string): string {
  return value.replace(/\D/g, '');
}

/**
 * Calcula dígito verificador do CPF
 */
function calculateCpfDigit(base: string): number {
  let sum = 0;
  let weight = base.length + 1;

  for (let i = 0; i < base.length; i++) {
    sum += parseInt(base[i]) * weight;
    weight--;
  }

  const remainder = sum % 11;
  return remainder < 2 ? 0 : 11 - remainder;
}

/**
 * Valida CPF
 */
function isValidCpf(cpf: string): boolean {
  // CPF deve ter 11 dígitos
  if (cpf.length !== 11) {
    return false;
  }

  // Verifica se todos os dígitos são iguais
  if (/^(\d)\1+$/.test(cpf)) {
    return false;
  }

  // Valida primeiro dígito
  const base = cpf.slice(0, 9);
  const digit1 = calculateCpfDigit(base);
  if (digit1 !== parseInt(cpf[9])) {
    return false;
  }

  // Valida segundo dígito
  const base2 = base + cpf[9];
  const digit2 = calculateCpfDigit(base2);
  if (digit2 !== parseInt(cpf[10])) {
    return false;
  }

  return true;
}

/**
 * Calcula dígito verificador do CNPJ
 */
function calculateCnpjDigit(base: string, weights: number[]): number {
  let sum = 0;

  for (let i = 0; i < base.length; i++) {
    sum += parseInt(base[i]) * weights[i];
  }

  const remainder = sum % 11;
  return remainder < 2 ? 0 : 11 - remainder;
}

/**
 * Valida CNPJ
 */
function isValidCnpj(cnpj: string): boolean {
  // CNPJ deve ter 14 dígitos
  if (cnpj.length !== 14) {
    return false;
  }

  // Verifica se todos os dígitos são iguais
  if (/^(\d)\1+$/.test(cnpj)) {
    return false;
  }

  // Valida primeiro dígito
  const weights1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const base1 = cnpj.slice(0, 12);
  const digit1 = calculateCnpjDigit(base1, weights1);
  if (digit1 !== parseInt(cnpj[12])) {
    return false;
  }

  // Valida segundo dígito
  const weights2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const base2 = base1 + cnpj[12];
  const digit2 = calculateCnpjDigit(base2, weights2);
  if (digit2 !== parseInt(cnpj[13])) {
    return false;
  }

  return true;
}

export class Document {
  private readonly _number: string;
  private readonly _type: DocumentType;

  constructor(document: string) {
    const clean = stripNonDigits(document);

    if (clean.length === 11) {
      if (!isValidCpf(clean)) {
        throw new Error('Invalid CPF');
      }
      this._type = DocumentType.CPF;
    } else if (clean.length === 14) {
      if (!isValidCnpj(clean)) {
        throw new Error('Invalid CNPJ');
      }
      this._type = DocumentType.CNPJ;
    } else {
      throw new Error('Document must have 11 digits (CPF) or 14 digits (CNPJ)');
    }

    this._number = clean;
  }

  get number(): string {
    return this._number;
  }

  get type(): DocumentType {
    return this._type;
  }

  /**
   * Retorna o documento formatado com pontuação
   */
  get formatted(): string {
    if (this._type === DocumentType.CPF) {
      return this._number.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
    } else {
      return this._number.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
    }
  }

  /**
   * Retorna apenas os dígitos
   */
  get digits(): string {
    return this._number;
  }

  /**
   * Verifica se é CPF
   */
  isCPF(): boolean {
    return this._type === DocumentType.CPF;
  }

  /**
   * Verifica se é CNPJ
   */
  isCNPJ(): boolean {
    return this._type === DocumentType.CNPJ;
  }

  equals(other: Document): boolean {
    return this._number === other._number && this._type === other._type;
  }

  toString(): string {
    return this.formatted;
  }

  toJSON(): { number: string; type: DocumentType; formatted: string } {
    return {
      number: this._number,
      type: this._type,
      formatted: this.formatted,
    };
  }
}
