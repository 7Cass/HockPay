import {
    Controller,
    Get,
    Query,
    UseGuards,
    HttpCode,
    HttpStatus,
    BadRequestException,
} from '@nestjs/common';
import { GetDashboardMetricsUseCase, DashboardMetricsDto } from '@hockpay/core';
import { CombinedAuthGuard } from '../auth/guards/combined-auth.guard';
import { CurrentStore } from '../auth/decorators/current-store.decorator';

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
    constructor(private readonly getDashboardMetricsUseCase: GetDashboardMetricsUseCase) { }

    @Get('metrics')
    @HttpCode(HttpStatus.OK)
    async getMetrics(
        @CurrentStore() storeId: string,
        @Query() query: GetMetricsQueryDto,
    ): Promise<DashboardMetricsDto> {
        const endDate = query.endDate ? new Date(query.endDate) : new Date();

        // Default to 30 days ago if no start date provided
        const defaultStartDate = new Date();
        defaultStartDate.setDate(defaultStartDate.getDate() - 30);
        const startDate = query.startDate ? new Date(query.startDate) : defaultStartDate;

        if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
            throw new BadRequestException('Invalid date format provided for metrics filter. Use strict ISO or valid string dates.');
        }

        return this.getDashboardMetricsUseCase.execute(storeId, startDate, endDate);
    }
}
