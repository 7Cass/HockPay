import { IsEnum } from 'class-validator';
import { Environment } from '@hockpay/core';

/**
 * Body of `POST /auth/switch-environment`.
 *
 * Anything outside `TEST | LIVE` is a 400 of DTO validation -- the environment
 * decides which ledger the session reads, and there is no third answer to fall
 * back to.
 */
export class SwitchEnvironmentRequestDto {
  @IsEnum(Environment, { message: 'environment must be TEST or LIVE' })
  environment: Environment;
}
