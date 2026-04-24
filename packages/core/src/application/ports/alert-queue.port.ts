export interface AlertJobData {
  eventId: string;
}

export interface IAlertQueuePort {
  enqueue(eventId: string, delay?: number): Promise<void>;
}
