import { Controller, Get, Param, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import {
  GetAccountUseCase,
  GetPaymentTimelineUseCase,
  GetStoreForOperatorUseCase,
  ListBankAccountsUseCase,
  ListPaymentsUseCase,
  ListTransactionsUseCase,
  ListWebhookConfigsUseCase,
  ListWebhookLogsUseCase,
} from '@hockpay/core';
import { OperatorRoute } from './decorators/operator-route.decorator';
import {
  CurrentOperator,
  type CurrentOperatorData,
} from './decorators/current-operator.decorator';
import {
  OperatorEnvironmentQueryDto,
  OperatorListPaymentsQueryDto,
  OperatorListTransactionsQueryDto,
  OperatorListWebhookLogsQueryDto,
} from './dtos/operator-store-read.dto';
import { BankAccountResponseDto } from '../bank-account/dtos/bank-account-response.dto';
import { getRequestId } from '../../common/request-id';

/**
 * Reading a merchant's data to investigate a support case.
 *
 * Two properties hold this controller together, and both are structural rather
 * than a matter of care:
 *
 * 1. **There is no operator read use case.** Every route below reuses the one
 *    the merchant surface already calls, with the store id coming from the path
 *    instead of the session. A parallel read path, with its own notion of what
 *    to return, would be a second place where a leak can be born.
 * 2. **Credentials do not come out of here.** There is no route for API keys --
 *    it is not filtered, it does not exist -- and webhook configs are
 *    serialized through `toPublicObject()`, which keeps the identifying prefix
 *    and drops the secret. `operator-read-no-secrets.spec.ts` sweeps every
 *    route registered on this module and fails if that ever stops being true.
 */
@Controller('operator/stores')
@OperatorRoute()
export class OperatorStoreReadController {
  constructor(
    private readonly getStoreForOperatorUseCase: GetStoreForOperatorUseCase,
    private readonly listPaymentsUseCase: ListPaymentsUseCase,
    private readonly getPaymentTimelineUseCase: GetPaymentTimelineUseCase,
    private readonly getAccountUseCase: GetAccountUseCase,
    private readonly listTransactionsUseCase: ListTransactionsUseCase,
    private readonly listBankAccountsUseCase: ListBankAccountsUseCase,
    private readonly listWebhookConfigsUseCase: ListWebhookConfigsUseCase,
    private readonly listWebhookLogsUseCase: ListWebhookLogsUseCase,
  ) {}

  /**
   * GET /operator/stores/:id
   *
   * The entry point of an investigation, and the only read here that writes:
   * it records `store.investigated` on the trail. The sub-reads below stay
   * pure. See `GetStoreForOperatorUseCase` for why the write lives on a GET.
   */
  @Get(':id')
  async getStore(
    @Param('id') id: string,
    @CurrentOperator() operator: CurrentOperatorData,
    @Req() req?: Request,
  ) {
    return this.getStoreForOperatorUseCase.execute({
      operatorId: operator.operatorId,
      storeId: id,
      requestId: getRequestId(req),
    });
  }

  /**
   * GET /operator/stores/:id/payments
   */
  @Get(':id/payments')
  async listPayments(
    @Param('id') id: string,
    @Query() query: OperatorListPaymentsQueryDto,
  ) {
    return this.listPaymentsUseCase.execute({
      storeId: id,
      environment: query.environment,
      page: query.page,
      limit: query.limit,
      status: query.status,
      externalId: query.externalId,
    });
  }

  /**
   * GET /operator/stores/:id/payments/:paymentId/timeline
   */
  @Get(':id/payments/:paymentId/timeline')
  async getPaymentTimeline(
    @Param('id') id: string,
    @Param('paymentId') paymentId: string,
    @Query() query: OperatorEnvironmentQueryDto,
  ) {
    return this.getPaymentTimelineUseCase.execute({
      storeId: id,
      paymentId,
      environment: query.environment,
    });
  }

  /**
   * GET /operator/stores/:id/account
   */
  @Get(':id/account')
  async getAccount(
    @Param('id') id: string,
    @Query() query: OperatorEnvironmentQueryDto,
  ) {
    return this.getAccountUseCase.execute({
      storeId: id,
      environment: query.environment,
    });
  }

  /**
   * GET /operator/stores/:id/transactions
   */
  @Get(':id/transactions')
  async listTransactions(
    @Param('id') id: string,
    @Query() query: OperatorListTransactionsQueryDto,
  ) {
    return this.listTransactionsUseCase.execute({
      storeId: id,
      environment: query.environment,
      page: query.page,
      limit: query.limit,
      type: query.type,
    });
  }

  /**
   * GET /operator/stores/:id/bank-accounts
   *
   * The Pix destinations a withdrawal by the desk can go to. Without this read,
   * withdrawing for a store would mean pasting a destination id found somewhere
   * else -- which is `curl` with a button.
   *
   * No `environment`, for the reason the webhook routes below give: a
   * destination belongs to the store, not to a ledger. Each item is the
   * merchant's own response shape, so the desk sees what the merchant sees.
   * The Pix key and the holder document are where money goes, not a credential,
   * and choosing a destination without them would be choosing blind.
   */
  @Get(':id/bank-accounts')
  async listBankAccounts(@Param('id') id: string) {
    const bankAccounts = await this.listBankAccountsUseCase.execute(id);

    return {
      bankAccounts: BankAccountResponseDto.fromUsageList(bankAccounts),
    };
  }

  /**
   * GET /operator/stores/:id/webhooks
   *
   * No `environment`: webhook configs are store-scoped, and asking for a
   * parameter the route then ignores would be its own small lie.
   */
  @Get(':id/webhooks')
  async listWebhookConfigs(@Param('id') id: string) {
    const result = await this.listWebhookConfigsUseCase.execute({
      storeId: id,
    });

    return {
      webhooks: result.webhookConfigs.map((config) => ({
        ...config.toPublicObject(),
        circuit: result.circuits[config.id],
      })),
    };
  }

  /**
   * GET /operator/stores/:id/webhooks/logs
   *
   * The delivery attempts themselves. The HMAC signature travels here as a
   * request header, which is not the secret and does not let anyone derive it.
   */
  @Get(':id/webhooks/logs')
  async listWebhookLogs(
    @Param('id') id: string,
    @Query() query: OperatorListWebhookLogsQueryDto,
  ) {
    const result = await this.listWebhookLogsUseCase.execute({
      storeId: id,
      configId: query.configId,
      page: query.page,
      limit: query.limit,
      status: query.status,
    });

    return {
      logs: result.logs.map((log) => log.toObject()),
      total: result.total,
      page: result.page,
      limit: result.limit,
    };
  }
}
