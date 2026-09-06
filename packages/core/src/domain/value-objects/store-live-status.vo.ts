/**
 * Live enablement state of a store.
 *
 * Mirrors the Prisma enum, kept in the domain so the layer does not depend on
 * infrastructure. TEST works in every one of these states -- the enum gates
 * LIVE and nothing else.
 */
export enum StoreLiveStatus {
  NOT_REQUESTED = 'NOT_REQUESTED',
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  SUSPENDED = 'SUSPENDED',
}
