import {
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsDefined,
  IsIn,
  IsOptional,
  IsString,
  IsUrl,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ALLOWED_ALERT_EVENTS } from '@hockpay/core';

export class DiscordAlertConfigDto {
  @IsUrl({ protocols: ['https'], require_protocol: true })
  webhookUrl: string;
}

export class CreateAlertDto {
  @IsString()
  @MinLength(3)
  name: string;

  @IsIn(['discord'])
  channel: 'discord';

  @IsDefined()
  @ValidateNested()
  @Type(() => DiscordAlertConfigDto)
  discord: DiscordAlertConfigDto;

  @IsArray()
  @ArrayNotEmpty()
  @IsIn(ALLOWED_ALERT_EVENTS, { each: true })
  events: string[];

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
