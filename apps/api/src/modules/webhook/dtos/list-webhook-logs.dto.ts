import { IsOptional, IsInt, Min, Max, IsIn } from 'class-validator';
import { Transform, Type } from 'class-transformer';

/**
 * Query DTO for listing webhook logs.
 */
export class ListWebhookLogsQueryDto {
  @IsOptional()
  @Type(() => String)
  configId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 50;

  @IsOptional()
  @Transform(({ value }) =>
    value === undefined ||
    value === null ||
    value === '' ||
    value === 'undefined'
      ? undefined
      : value,
  )
  @IsIn(['pending', 'delivered', 'failed'])
  status?: 'pending' | 'delivered' | 'failed';
}
