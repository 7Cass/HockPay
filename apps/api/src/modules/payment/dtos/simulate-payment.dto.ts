import { IsNotEmpty, IsString } from 'class-validator';

export class SimulatePaymentDto {
  @IsString()
  @IsNotEmpty()
  checkoutToken!: string;
}
