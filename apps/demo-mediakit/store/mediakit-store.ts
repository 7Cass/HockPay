export interface MediaKitRecord {
  sessionId: string;
  status: "pending" | "ready" | "failed" | "expired";
  data: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
  failureReason?: string;
}

export interface MediaKitStore {
  save(record: MediaKitRecord): void;
  get(sessionId: string): MediaKitRecord | undefined;
  upsertPending(
    sessionId: string,
    data: Record<string, unknown>,
  ): MediaKitRecord;
  markReady(sessionId: string, data: Record<string, unknown>): MediaKitRecord;
  markFailed(
    sessionId: string,
    data: Record<string, unknown>,
    failureReason?: string,
  ): MediaKitRecord;
  markExpired(
    sessionId: string,
    data: Record<string, unknown>,
    failureReason?: string,
  ): MediaKitRecord;
}

class MemoryMediaKitStore implements MediaKitStore {
  private readonly records = new Map<string, MediaKitRecord>();

  save(record: MediaKitRecord): void {
    this.records.set(record.sessionId, {
      ...record,
      updatedAt: record.updatedAt ?? new Date(),
    });
  }

  get(sessionId: string): MediaKitRecord | undefined {
    return this.records.get(sessionId);
  }

  upsertPending(
    sessionId: string,
    data: Record<string, unknown>,
  ): MediaKitRecord {
    const existing = this.records.get(sessionId);
    const now = new Date();
    const record: MediaKitRecord = {
      sessionId,
      status: existing?.status ?? "pending",
      data: {
        ...(existing?.data ?? {}),
        ...data,
      },
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      failureReason: existing?.failureReason,
    };

    this.records.set(sessionId, record);
    return record;
  }

  markReady(sessionId: string, data: Record<string, unknown>): MediaKitRecord {
    return this.transition(sessionId, "ready", data);
  }

  markFailed(
    sessionId: string,
    data: Record<string, unknown>,
    failureReason = "payment.failed",
  ): MediaKitRecord {
    return this.transition(sessionId, "failed", data, failureReason);
  }

  markExpired(
    sessionId: string,
    data: Record<string, unknown>,
    failureReason = "payment.expired",
  ): MediaKitRecord {
    return this.transition(sessionId, "expired", data, failureReason);
  }

  private transition(
    sessionId: string,
    status: MediaKitRecord["status"],
    data: Record<string, unknown>,
    failureReason?: string,
  ): MediaKitRecord {
    const existing = this.records.get(sessionId);
    const now = new Date();
    const record: MediaKitRecord = {
      sessionId,
      status,
      data: {
        ...(existing?.data ?? {}),
        ...data,
      },
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      failureReason,
    };

    this.records.set(sessionId, record);
    return record;
  }
}

const store: MediaKitStore = new MemoryMediaKitStore();

export function saveMediaKit(record: MediaKitRecord): void {
  store.save(record);
}

export function getMediaKit(sessionId: string): MediaKitRecord | undefined {
  return store.get(sessionId);
}

export function isMediaKitReady(sessionId: string): boolean {
  return store.get(sessionId)?.status === "ready";
}

export function upsertPendingMediaKit(
  sessionId: string,
  data: Record<string, unknown>,
): MediaKitRecord {
  return store.upsertPending(sessionId, data);
}

export function markMediaKitReady(
  sessionId: string,
  data: Record<string, unknown>,
): MediaKitRecord {
  return store.markReady(sessionId, data);
}

export function markMediaKitFailed(
  sessionId: string,
  data: Record<string, unknown>,
  failureReason = "payment.failed",
): MediaKitRecord {
  return store.markFailed(sessionId, data, failureReason);
}

export function markMediaKitExpired(
  sessionId: string,
  data: Record<string, unknown>,
  failureReason = "payment.expired",
): MediaKitRecord {
  return store.markExpired(sessionId, data, failureReason);
}
