import { DomainError } from "./domain-error";

export class InvalidSimulationActionError extends DomainError {
  constructor(action: string) {
    super(`Invalid simulation action: ${action}`, "INVALID_SIMULATION_ACTION");
  }
}
