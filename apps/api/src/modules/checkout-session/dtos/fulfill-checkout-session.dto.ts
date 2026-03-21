import { IsObject, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { PaymentCustomerDto } from '../../payment/dtos/create-payment.dto';

export class FulfillCheckoutSessionDto {
  @IsObject()
  @ValidateNested()
  @Type(() => PaymentCustomerDto)
  customer: PaymentCustomerDto;
}
