export enum AnomalyType {
  HIGH_VOLUME = 'HIGH_VOLUME',
  RAPID_TRANSACTIONS = 'RAPID_TRANSACTIONS',
  UNUSUAL_AMOUNT = 'UNUSUAL_AMOUNT',
  HIGH_FAILURE_RATE = 'HIGH_FAILURE_RATE',
}

export interface DetectedAnomaly {
  type: AnomalyType;
  storeId: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
  details: Record<string, unknown>;
  detectedAt: Date;
}

export interface IDetectAnomaliesInput {
  timeWindowHours?: number;
  volumeThreshold?: number;
  failureRateThreshold?: number;
}

export interface IDetectAnomaliesOutput {
  anomalies: DetectedAnomaly[];
  scannedPayments: number;
  stub: true;
}

export class DetectAnomaliesUseCase {
  async execute(
    _input: IDetectAnomaliesInput = {},
  ): Promise<IDetectAnomaliesOutput> {
    return {
      anomalies: [],
      scannedPayments: 0,
      stub: true,
    };
  }
}
