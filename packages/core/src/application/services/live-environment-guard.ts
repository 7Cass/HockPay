import { LiveEnvironmentNotAllowedError } from "../../domain/errors/live-environment-not-allowed.error";
import { Environment } from "../../domain/value-objects/environment.vo";

export function assertNotLiveEnvironment(
  environment: Environment | undefined,
): void {
  if (environment === Environment.LIVE) {
    throw new LiveEnvironmentNotAllowedError();
  }
}

export function assertCallerCanMutateEnvironment(
  aggregateEnvironment: Environment | undefined,
  callerEnvironment: Environment = Environment.TEST,
): void {
  if (
    aggregateEnvironment === Environment.LIVE &&
    callerEnvironment !== Environment.LIVE
  ) {
    throw new LiveEnvironmentNotAllowedError();
  }
}
