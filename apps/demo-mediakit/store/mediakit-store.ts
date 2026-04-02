export interface MediaKitRecord {
  sessionId: string;
  status: "pending" | "ready";
  data: Record<string, unknown>;
  createdAt: Date;
}

const store = new Map<string, MediaKitRecord>();

export function saveMediaKit(record: MediaKitRecord): void {
  store.set(record.sessionId, record);
}

export function getMediaKit(sessionId: string): MediaKitRecord | undefined {
  return store.get(sessionId);
}

export function isMediaKitReady(sessionId: string): boolean {
  return store.get(sessionId)?.status === "ready";
}
