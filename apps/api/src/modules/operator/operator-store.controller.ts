import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import {
  DecideLiveEnablementUseCase,
  IListStoresForOperatorOutput,
  ListStoresForOperatorUseCase,
  StoreLiveStatus,
} from '@hockpay/core';
import { OperatorRoute } from './decorators/operator-route.decorator';
import {
  CurrentOperator,
  type CurrentOperatorData,
} from './decorators/current-operator.decorator';
import { DecideLiveEnablementDto } from './dtos/operator-store.dto';
import { getRequestId } from '../../common/request-id';

/**
 * The desk's first real power: opening and closing LIVE for a store.
 *
 * Reading here is deliberately the queue and nothing else -- no ledger, no
 * payment, no secret. Cross-merchant investigation is a slice of its own.
 */
@Controller('operator/stores')
@OperatorRoute()
export class OperatorStoreController {
  constructor(
    private readonly listStoresForOperatorUseCase: ListStoresForOperatorUseCase,
    private readonly decideLiveEnablementUseCase: DecideLiveEnablementUseCase,
  ) {}

  /**
   * GET /operator/stores
   */
  @Get()
  async listStores(
    @Query('liveStatus') liveStatus?: StoreLiveStatus,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ): Promise<IListStoresForOperatorOutput> {
    return this.listStoresForOperatorUseCase.execute({
      liveStatus,
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
    });
  }

  /**
   * POST /operator/stores/:id/live-status
   */
  @Post(':id/live-status')
  @HttpCode(HttpStatus.OK)
  async decideLiveStatus(
    @Param('id') id: string,
    @Body() dto: DecideLiveEnablementDto,
    @CurrentOperator() operator: CurrentOperatorData,
    @Req() req?: Request,
  ) {
    const result = await this.decideLiveEnablementUseCase.execute({
      operatorId: operator.operatorId,
      storeId: id,
      decision: dto.decision,
      reason: dto.reason,
      requestId: getRequestId(req),
    });

    return { store: result.store };
  }
}
