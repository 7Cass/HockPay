import {
  ValidateBy,
  type ValidationArguments,
  type ValidationOptions,
} from 'class-validator';
import {
  getWebhookUrlPolicyOptionsForNodeEnv,
  validateWebhookUrl,
} from '@hockpay/core';

export function IsWebhookUrl(
  validationOptions?: ValidationOptions,
): PropertyDecorator {
  return ValidateBy(
    {
      name: 'isWebhookUrl',
      validator: {
        validate(value: unknown): boolean {
          if (typeof value !== 'string') {
            return false;
          }

          return validateWebhookUrl(
            value,
            getWebhookUrlPolicyOptionsForNodeEnv(process.env.NODE_ENV),
          ).valid;
        },
        defaultMessage(args: ValidationArguments): string {
          if (typeof args.value !== 'string') {
            return 'url must be a string';
          }

          return (
            validateWebhookUrl(
              args.value,
              getWebhookUrlPolicyOptionsForNodeEnv(process.env.NODE_ENV),
            ).message ?? 'url must be an allowed webhook URL'
          );
        },
      },
    },
    validationOptions,
  );
}
