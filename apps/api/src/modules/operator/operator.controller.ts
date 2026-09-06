import { Controller, Get, Query } from '@nestjs/common';
import {
  GetOperatorUseCase,
  IListOperatorAuditLogsOutput,
  ListOperatorAuditLogsUseCase,
} from '@hockpay/core';
import { OperatorRoute } from './decorators/operator-route.decorator';
import {
  CurrentOperator,
  type CurrentOperatorData,
} from './decorators/current-operator.decorator';
import { OperatorDto } from './dtos/operator-auth.dto';

/**
 * Operator surface.
 *
 * Session and trail. The power over a store's LIVE enablement lives in
 * OperatorStoreController; what this controller has is the trail, readable by
 * the desk itself -- a trail that only exists in the database is a log.
 */
@Controller('operator')
@OperatorRoute()
export class OperatorController {
  constructor(
    private readonly getOperatorUseCase: GetOperatorUseCase,
    private readonly listOperatorAuditLogsUseCase: ListOperatorAuditLogsUseCase,
  ) {}

  /**
   * GET /operator/me
   */
  @Get('me')
  async me(
    @CurrentOperator() operator: CurrentOperatorData,
  ): Promise<OperatorDto> {
    return this.getOperatorUseCase.execute({ operatorId: operator.operatorId });
  }

  /**
   * GET /operator/audit-logs
   */
  @Get('audit-logs')
  async auditLogs(
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('operatorId') operatorId?: string,
  ): Promise<IListOperatorAuditLogsOutput> {
    return this.listOperatorAuditLogsUseCase.execute({
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
      operatorId,
    });
  }
}
