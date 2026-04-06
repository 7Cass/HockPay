import { IsString, IsOptional, IsInt, Min, MaxLength } from 'class-validator';

export class CreateRefundDto {
  @IsString()
  paymentId: string;

  @IsInt()
  @Min(1, { message: 'amount must be at least 1 cent' })
  amount: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
