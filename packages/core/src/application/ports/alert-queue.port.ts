export interface AlertJobData {
  eventId: string;
  requestId?: string;
}

export interface IAlertQueuePort {
  enqueue(eventId: string, delay?: number, requestId?: string): Promise<void>;
}
