/**
 * Reads a required environment variable.
 *
 * Throws at wiring time (module construction) instead of failing later with an
 * undefined value, so a missing secret surfaces on boot and not on first use.
 */
export function getRequiredEnv(
  name: string,
  env: NodeJS.ProcessEnv = process.env,
): string {
  const value = env[name];
  if (!value) {
    throw new Error(`${name} environment variable is required`);
  }
  return value;
}
