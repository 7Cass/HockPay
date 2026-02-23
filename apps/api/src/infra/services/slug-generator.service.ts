import { Injectable } from '@nestjs/common';
import type { ISlugGeneratorPort } from '@hockpay/core';
import { StoreRepository } from '../repositories/store.repository.impl';

/**
 * Infrastructure implementation of ISlugGeneratorPort.
 *
 * This service handles slug generation and validation.
 */
@Injectable()
export class SlugGeneratorService implements ISlugGeneratorPort {
  private static readonly SLUG_REGEX =
    /^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/;
  private static readonly MIN_LENGTH = 3;
  private static readonly MAX_LENGTH = 50;

  constructor(private readonly storeRepository: StoreRepository) {}

  validateFormat(slug: string): boolean {
    if (slug.length < SlugGeneratorService.MIN_LENGTH) {
      return false;
    }

    if (slug.length > SlugGeneratorService.MAX_LENGTH) {
      return false;
    }

    return SlugGeneratorService.SLUG_REGEX.test(slug);
  }

  generateFromName(name: string): string {
    let slug = name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remove accents
      .replace(/[^a-z0-9\s-]/g, '') // Remove special characters
      .trim()
      .replace(/\s+/g, '-') // Replace spaces with hyphens
      .replace(/-+/g, '-') // Replace multiple hyphens with single
      .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens

    // Ensure minimum length
    if (slug.length < SlugGeneratorService.MIN_LENGTH) {
      slug = slug + '-store';
    }

    // Ensure maximum length
    if (slug.length > SlugGeneratorService.MAX_LENGTH) {
      slug = slug.substring(0, SlugGeneratorService.MAX_LENGTH);
      // Remove trailing hyphen if truncated
      slug = slug.replace(/-$/, '');
    }

    return slug;
  }

  async isAvailable(slug: string): Promise<boolean> {
    const existingStore = await this.storeRepository.findBySlug(slug);
    return existingStore === null;
  }

  async generateUnique(baseSlug: string): Promise<string> {
    const slug = baseSlug;
    let suffix = '';
    let attempts = 0;
    const maxAttempts = 10;

    while (attempts < maxAttempts) {
      const candidateSlug = suffix ? `${baseSlug}-${suffix}` : slug;

      if (await this.isAvailable(candidateSlug)) {
        return candidateSlug;
      }

      attempts++;
      suffix = this.generateRandomSuffix(6);
    }

    // Fallback: use timestamp-based suffix
    const timestampSuffix = Date.now().toString(36);
    return `${baseSlug}-${timestampSuffix}`;
  }

  /**
   * Generate a random alphanumeric suffix.
   */
  private generateRandomSuffix(length: number): string {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }
}
