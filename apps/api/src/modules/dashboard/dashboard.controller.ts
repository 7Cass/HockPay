import {
  Controller,
  Get,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import {
  DashboardMetricsDto,
  DashboardOverviewDto,
  Environment,
  GetDashboardMetricsUseCase,
  GetDashboardOverviewUseCase,
} from '@hockpay/core';
import { CombinedAuthGuard } from '../auth/guards/combined-auth.guard';
import { CurrentStore } from '../auth/decorators/current-store.decorator';
import { CurrentEnvironment } from '../auth/decorators/current-environment.decorator';

import { IsOptional, IsString } from 'class-validator';

class GetMetricsQueryDto {
  @IsOptional()
  @IsString()
  startDate?: string;

  @IsOptional()
  @IsString()
  endDate?: string;
}

@Controller({
  path: 'dashboard',
  version: '1',
})
@UseGuards(CombinedAuthGuard)
export class DashboardController {
  constructor(
    private readonly getDashboardMetricsUseCase: GetDashboardMetricsUseCase,
    private readonly getDashboardOverviewUseCase: GetDashboardOverviewUseCase,
  ) {}

  @Get('metrics')
  @HttpCode(HttpStatus.OK)
  async getMetrics(
    @CurrentStore() storeId: string,
    @CurrentEnvironment() environment: Environment,
    @Query() query: GetMetricsQueryDto,
  ): Promise<DashboardMetricsDto> {
    const { startDate, endDate } = this.parseDateRange(query);

    return this.getDashboardMetricsUseCase.execute(
      storeId,
      environment,
      startDate,
      endDate,
    );
  }

  @Get('overview')
  @HttpCode(HttpStatus.OK)
  async getOverview(
    @CurrentStore() storeId: string,
    @Query() query: GetMetricsQueryDto,
    @CurrentEnvironment() environment: Environment,
  ): Promise<DashboardOverviewDto> {
    const { startDate, endDate } = this.parseDateRange(query);

    return this.getDashboardOverviewUseCase.execute({
      storeId,
      startDate,
      endDate,
      environment,
    });
  }

  private parseDateRange(query: GetMetricsQueryDto): {
    startDate: Date;
    endDate: Date;
  } {
    const endDate = query.endDate ? new Date(query.endDate) : new Date();

    // Default to 30 days ago if no start date provided
    const defaultStartDate = new Date();
    defaultStartDate.setDate(defaultStartDate.getDate() - 30);
    const startDate = query.startDate
      ? new Date(query.startDate)
      : defaultStartDate;

    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
      throw new BadRequestException(
        'Invalid date format provided for metrics filter. Use strict ISO or valid string dates.',
      );
    }

    return { startDate, endDate };
  }
}
