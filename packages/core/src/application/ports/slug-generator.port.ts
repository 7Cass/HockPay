/**
 * Port interface for Slug Generator service.
 *
 * This port defines the contract for slug generation and validation.
 * The infrastructure layer should provide an implementation.
 */
export interface ISlugGeneratorPort {
  /**
   * Validate if a slug has a valid format.
   *
   * Rules:
   * - Only lowercase letters, numbers, and hyphens
   * - Cannot start or end with hyphen
   * - Length: 3-50 characters
   *
   * @param slug - The slug to validate
   * @returns true if valid, false otherwise
   */
  validateFormat(slug: string): boolean;

  /**
   * Generate a slug from a store name.
   *
   * - Converts to lowercase
   * - Removes accents
   * - Replaces spaces with hyphens
   * - Removes special characters
   *
   * @param name - The store name
   * @returns A slug generated from the name
   */
  generateFromName(name: string): string;

  /**
   * Check if a slug is available (not already in use).
   *
   * @param slug - The slug to check
   * @returns true if available, false if already in use
   */
  isAvailable(slug: string): Promise<boolean>;

  /**
   * Generate a unique slug, adding a suffix if necessary.
   *
   * @param baseSlug - The base slug (can be from name or custom)
   * @returns A unique slug that is available
   */
  generateUnique(baseSlug: string): Promise<string>;
}
