import {
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  IsUrl,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ALLOWED_ALERT_EVENTS } from '@hockpay/core';

export class UpdateDiscordAlertConfigDto {
  @IsOptional()
  @IsUrl({ protocols: ['https'], require_protocol: true })
  webhookUrl?: string;
}

export class UpdateAlertDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  name?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => UpdateDiscordAlertConfigDto)
  discord?: UpdateDiscordAlertConfigDto;

  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @IsIn(ALLOWED_ALERT_EVENTS, { each: true })
  events?: string[];

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
