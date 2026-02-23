import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DetectAnomaliesUseCase } from '@hockpay/core';

/**
 * Anti-Fraud Job
 *
 * Detects suspicious activity and anomalies.
 * Runs every hour.
 */
@Injectable()
export class AntiFraudJob {
  private readonly logger = new Logger(AntiFraudJob.name);

  constructor(private readonly detectAnomaliesUseCase: DetectAnomaliesUseCase) {}

  @Cron(CronExpression.EVERY_HOUR)
  async handleAntiFraud(): Promise<void> {
    this.logger.log('Starting anti-fraud scan...');
    await this.runAntiFraudScan();
  }

  async runAntiFraudScan(): Promise<void> {
    try {
      const result = await this.detectAnomaliesUseCase.execute({
        timeWindowHours: 1,
        volumeThreshold: 100,
        failureRateThreshold: 0.5,
      });

      if (result.anomalies.length > 0) {
        this.logger.warn(`Detected ${result.anomalies.length} anomalies`);
        result.anomalies.forEach((anomaly) => {
          this.logger.warn(
            `Anomaly: ${anomaly.type} - Store: ${anomaly.storeId} - Severity: ${anomaly.severity}`,
          );
        });
      } else {
        this.logger.log('Anti-fraud scan completed: no anomalies detected');
      }
    } catch (error) {
      this.logger.error('Anti-fraud scan failed:', error);
    }
  }
}
