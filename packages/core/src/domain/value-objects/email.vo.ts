import { InvalidEmailError } from '../errors/invalid-email.error';

/**
 * Value Object: Email
 *
 * Represents a valid email address with validation.
 * Email addresses are stored in lowercase.
 */
export class Email {
  private readonly value: string;

  constructor(email: string) {
    if (!Email.isValid(email)) {
      throw new InvalidEmailError(email);
    }
    this.value = email.toLowerCase().trim();
  }

  /**
   * Validates an email address using a simple regex pattern.
   * This is a basic validation - for production, consider using a more robust library.
   */
  private static isValid(email: string): boolean {
    if (!email || typeof email !== 'string') {
      return false;
    }
    const trimmed = email.trim();
    if (trimmed.length === 0 || trimmed.length > 254) {
      return false;
    }
    // Basic email regex - matches user@domain.tld
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(trimmed);
  }

  /**
   * Gets the string value of the email.
   */
  toString(): string {
    return this.value;
  }

  /**
   * Checks if two emails are equal.
   */
  equals(other: Email): boolean {
    return this.value === other.value;
  }

  /**
   * Creates an Email instance from a string.
   * Returns null if the email is invalid.
   */
  static create(email: string): Email | null {
    try {
      return new Email(email);
    } catch {
      return null;
    }
  }
}
