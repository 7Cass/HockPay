import { IsInt, IsString, Max, Min } from 'class-validator';

export class CreateWithdrawalDto {
  @IsString()
  bankAccountId: string;

  @IsInt()
  @Min(1000)
  @Max(500000)
  amount: number;
}
