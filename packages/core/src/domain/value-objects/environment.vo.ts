/**
 * Environment enum for API keys.
 *
 * This enum defines the possible environments for API keys.
 * It mirrors the Prisma enum to maintain Clean Architecture principles
 * (domain layer should not depend on infrastructure).
 */
export enum Environment {
  TEST = 'TEST',
  LIVE = 'LIVE',
}
