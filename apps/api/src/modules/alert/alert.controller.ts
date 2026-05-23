import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import {
  AlertDeliveryStatus,
  CreateAlertConfigUseCase,
  DeleteAlertConfigUseCase,
  GetAlertConfigUseCase,
  ListAlertConfigsUseCase,
  ListAlertDeliveryLogsUseCase,
  RetryAlertDeliveryLogUseCase,
  TestAlertConfigUseCase,
  UpdateAlertConfigUseCase,
} from '@hockpay/core';
import { RequireStoreGuard } from '../auth/guards/require-store.guard';
import { CreateAlertDto } from './dtos/create-alert.dto';
import { UpdateAlertDto } from './dtos/update-alert.dto';
import { ListAlertLogsQueryDto } from './dtos/list-alert-logs.dto';
import {
  GetAlertResponseDto,
  ListAlertLogsResponseDto,
  ListAlertsResponseDto,
  RetryAlertLogResponseDto,
  TestAlertResponseDto,
  mapAlertConfigToDto,
  mapAlertDeliveryLogToDto,
} from './dtos/alert-response.dto';

@Controller('alerts')
@UseGuards(RequireStoreGuard)
export class AlertController {
  constructor(
    private readonly createAlertConfigUseCase: CreateAlertConfigUseCase,
    private readonly listAlertConfigsUseCase: ListAlertConfigsUseCase,
    private readonly getAlertConfigUseCase: GetAlertConfigUseCase,
    private readonly updateAlertConfigUseCase: UpdateAlertConfigUseCase,
    private readonly deleteAlertConfigUseCase: DeleteAlertConfigUseCase,
    private readonly testAlertConfigUseCase: TestAlertConfigUseCase,
    private readonly listAlertDeliveryLogsUseCase: ListAlertDeliveryLogsUseCase,
    private readonly retryAlertDeliveryLogUseCase: RetryAlertDeliveryLogUseCase,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() dto: CreateAlertDto,
    @Req() req: Request,
  ): Promise<GetAlertResponseDto> {
    const result = await this.createAlertConfigUseCase.execute({
      storeId: this.getStoreId(req),
      name: dto.name,
      channel: dto.channel,
      discord: dto.discord,
      events: dto.events,
      isActive: dto.isActive,
    });

    return {
      alert: mapAlertConfigToDto(result.alertConfig),
    };
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  async list(@Req() req: Request): Promise<ListAlertsResponseDto> {
    const result = await this.listAlertConfigsUseCase.execute({
      storeId: this.getStoreId(req),
    });

    return {
      alerts: result.alertConfigs.map((alert) =>
        mapAlertConfigToDto(alert.toPublicObject()),
      ),
    };
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  async get(
    @Param('id') id: string,
    @Req() req: Request,
  ): Promise<GetAlertResponseDto> {
    const result = await this.getAlertConfigUseCase.execute({
      storeId: this.getStoreId(req),
      configId: id,
    });

    return {
      alert: mapAlertConfigToDto(result.alertConfig.toPublicObject()),
    };
  }

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateAlertDto,
    @Req() req: Request,
  ): Promise<GetAlertResponseDto> {
    const result = await this.updateAlertConfigUseCase.execute({
      storeId: this.getStoreId(req),
      configId: id,
      name: dto.name,
      discord: dto.discord,
      events: dto.events,
      isActive: dto.isActive,
    });

    return {
      alert: mapAlertConfigToDto(result.alertConfig.toPublicObject()),
    };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@Param('id') id: string, @Req() req: Request): Promise<void> {
    await this.deleteAlertConfigUseCase.execute({
      storeId: this.getStoreId(req),
      configId: id,
    });
  }

  @Post(':id/test')
  @HttpCode(HttpStatus.OK)
  async test(
    @Param('id') id: string,
    @Req() req: Request,
  ): Promise<TestAlertResponseDto> {
    const result = await this.testAlertConfigUseCase.execute({
      storeId: this.getStoreId(req),
      configId: id,
    });

    return {
      success: result.success,
      statusCode: result.statusCode,
      responseBody: result.responseBody,
      error: result.error,
      alert: mapAlertConfigToDto(result.alertConfig.toPublicObject()),
      log: mapAlertDeliveryLogToDto(result.log.toObject()),
    };
  }

  @Get(':id/logs')
  @HttpCode(HttpStatus.OK)
  async listLogs(
    @Param('id') id: string,
    @Query() query: ListAlertLogsQueryDto,
    @Req() req: Request,
  ): Promise<ListAlertLogsResponseDto> {
    const result = await this.listAlertDeliveryLogsUseCase.execute({
      storeId: this.getStoreId(req),
      configId: id,
      page: query.page,
      limit: query.limit,
      status: query.status ? AlertDeliveryStatus[query.status] : undefined,
    });

    return {
      logs: result.logs.map((log) => mapAlertDeliveryLogToDto(log.toObject())),
      total: result.total,
      page: result.page,
      limit: result.limit,
    };
  }

  @Post(':id/logs/:logId/retry')
  @HttpCode(HttpStatus.OK)
  async retryLog(
    @Param('id') id: string,
    @Param('logId') logId: string,
    @Req() req: Request,
  ): Promise<RetryAlertLogResponseDto> {
    const result = await this.retryAlertDeliveryLogUseCase.execute({
      storeId: this.getStoreId(req),
      configId: id,
      logId,
    });

    return {
      success: result.success,
      statusCode: result.statusCode,
      responseBody: result.responseBody,
      error: result.error,
      log: mapAlertDeliveryLogToDto(result.log.toObject()),
    };
  }

  private getStoreId(req: Request): string {
    return (req as any).user.storeId;
  }
}
