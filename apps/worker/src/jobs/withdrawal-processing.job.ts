import {
  Inject,
  Injectable,
  Logger,
  OnModuleInit,
  Optional,
} from "@nestjs/common";
import {
  CompleteWithdrawalUseCase,
  FailWithdrawalUseCase,
  IWithdrawalRepository,
  MarkWithdrawalProcessingUseCase,
  RecordWithdrawalProcessingErrorUseCase,
  WithdrawalObject,
} from "@hockpay/core";
import { createWorkerRequestId } from "../common/request-id";
import { runExclusiveCronJob } from "../common/cron-guard";
import { WorkerCronScheduler } from "../common/worker-cron-scheduler";

@Injectable()
export class WithdrawalProcessingJob implements OnModuleInit {
  private readonly logger = new Logger(WithdrawalProcessingJob.name);
  private readonly maxAttempts = 3;

  constructor(
    @Inject("IWithdrawalRepository")
    private readonly withdrawalRepository: IWithdrawalRepository,
    private readonly markProcessingUseCase: MarkWithdrawalProcessingUseCase,
    private readonly completeWithdrawalUseCase: CompleteWithdrawalUseCase,
    private readonly failWithdrawalUseCase: FailWithdrawalUseCase,
    private readonly recordProcessingErrorUseCase: RecordWithdrawalProcessingErrorUseCase,
    @Optional()
    private readonly cronScheduler?: WorkerCronScheduler,
  ) {}

  onModuleInit(): void {
    this.cronScheduler?.registerCronJob({
      name: WithdrawalProcessingJob.name,
      envName: "WORKER_CRON_WITHDRAWAL_PROCESSING",
      defaultExpression: "*/15 * * * * *",
      onTick: () => this.handleWithdrawals(),
    });
  }

  async handleWithdrawals(): Promise<void> {
    await runExclusiveCronJob(
      WithdrawalProcessingJob.name,
      this.logger,
      async () => {
        await this.processPendingWithdrawals();
      },
    );
  }

  async processPendingWithdrawals(limit = 50): Promise<void> {
    const withdrawals =
      await this.withdrawalRepository.findProcessablePending(limit);

    for (const withdrawal of withdrawals) {
      const requestId = createWorkerRequestId("withdrawal", withdrawal.id);
      try {
        await this.processWithdrawal(withdrawal.id, requestId);
      } catch (error) {
        this.logger.error(
          `Failed to process withdrawal ${withdrawal.id} requestId=${requestId}:`,
          error,
        );
      }
    }
  }

  async processWithdrawal(
    withdrawalId: string,
    requestId: string,
  ): Promise<void> {
    const processing = await this.markProcessingUseCase.execute({
      withdrawalId,
      requestId,
    });

    try {
      await this.simulatePayout(processing.withdrawal);
      await this.completeWithdrawalUseCase.execute({
        withdrawalId,
        requestId,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      if (processing.withdrawal.processingAttempts >= this.maxAttempts) {
        await this.failWithdrawalUseCase.execute({
          withdrawalId,
          requestId,
          reason: message,
        });
        return;
      }

      await this.recordProcessingErrorUseCase.execute({
        withdrawalId,
        error: message,
        nextProcessAt: this.nextRetryAt(
          processing.withdrawal.processingAttempts,
        ),
      });
    }
  }

  protected async simulatePayout(withdrawal: WithdrawalObject): Promise<void> {
    if (process.env.WITHDRAWAL_SIMULATOR_FORCE_FAILURE === "true") {
      throw new Error("Simulated withdrawal processor failure");
    }

    await Promise.resolve(withdrawal);
  }

  private nextRetryAt(attempt: number): Date {
    const delaysInSeconds = [30, 120, 300];
    const delay =
      delaysInSeconds[
        Math.min(Math.max(attempt - 1, 0), delaysInSeconds.length - 1)
      ];
    return new Date(Date.now() + delay * 1000);
  }
}
