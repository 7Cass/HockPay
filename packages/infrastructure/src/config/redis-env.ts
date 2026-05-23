export interface RedisEnvInput {
  [key: string]: string | number | null | undefined;
  REDIS_URL?: string | null;
  REDIS_HOST?: string | null;
  REDIS_PORT?: string | number | null;
}

export interface RedisConnectionOptions {
  host: string;
  port: number;
  username?: string;
  password?: string;
  db?: number;
  tls?: Record<string, never>;
}

export interface ParsedRedisEnv {
  url: string;
  host: string;
  port: number;
  connection: RedisConnectionOptions;
  displayName: string;
}

const DEFAULT_REDIS_HOST = "localhost";
const DEFAULT_REDIS_PORT = 6379;

export function parseRedisEnv(
  env: RedisEnvInput = process.env,
): ParsedRedisEnv {
  const redisUrl = clean(env.REDIS_URL);
  const redisHost = clean(env.REDIS_HOST);
  const redisPort = env.REDIS_PORT;
  const hasHostPort = redisHost !== undefined || hasValue(redisPort);

  if (redisUrl !== undefined) {
    const parsedUrl = parseRedisUrl(redisUrl);

    if (hasHostPort) {
      const configuredHost = redisHost;
      const configuredPort = hasValue(redisPort)
        ? parseRedisPort(redisPort, "REDIS_PORT")
        : DEFAULT_REDIS_PORT;

      if (configuredHost !== undefined && configuredHost !== parsedUrl.host) {
        throw new Error(
          `Conflicting Redis configuration: REDIS_URL host "${parsedUrl.host}" does not match REDIS_HOST "${configuredHost}".`,
        );
      }

      if (configuredPort !== parsedUrl.port) {
        throw new Error(
          `Conflicting Redis configuration: REDIS_URL port ${parsedUrl.port} does not match REDIS_PORT ${configuredPort}.`,
        );
      }
    }

    return parsedUrl;
  }

  const host = redisHost ?? DEFAULT_REDIS_HOST;
  const port = hasValue(redisPort)
    ? parseRedisPort(redisPort, "REDIS_PORT")
    : DEFAULT_REDIS_PORT;

  return buildParsedRedisEnv({
    host,
    port,
    protocol: "redis:",
  });
}

function parseRedisUrl(value: string): ParsedRedisEnv {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`Invalid REDIS_URL "${value}".`);
  }

  if (url.protocol !== "redis:" && url.protocol !== "rediss:") {
    throw new Error(
      `Invalid REDIS_URL protocol "${url.protocol}". Use redis:// or rediss://.`,
    );
  }

  if (!url.hostname) {
    throw new Error("REDIS_URL must include a host.");
  }

  const port = url.port
    ? parseRedisPort(url.port, "REDIS_URL port")
    : DEFAULT_REDIS_PORT;
  const db = parseRedisDb(url.pathname);

  return buildParsedRedisEnv({
    host: url.hostname,
    port,
    protocol: url.protocol,
    username: url.username ? decodeURIComponent(url.username) : undefined,
    password: url.password ? decodeURIComponent(url.password) : undefined,
    db,
  });
}

function buildParsedRedisEnv(input: {
  host: string;
  port: number;
  protocol: "redis:" | "rediss:";
  username?: string;
  password?: string;
  db?: number;
}): ParsedRedisEnv {
  const auth =
    input.username || input.password
      ? `${encodeURIComponent(input.username ?? "")}:${encodeURIComponent(
          input.password ?? "",
        )}@`
      : "";
  const dbPath = input.db === undefined ? "" : `/${input.db}`;
  const url = `${input.protocol}//${auth}${input.host}:${input.port}${dbPath}`;
  const connection: RedisConnectionOptions = {
    host: input.host,
    port: input.port,
  };

  if (input.username) {
    connection.username = input.username;
  }
  if (input.password) {
    connection.password = input.password;
  }
  if (input.db !== undefined) {
    connection.db = input.db;
  }
  if (input.protocol === "rediss:") {
    connection.tls = {};
  }

  return {
    url,
    host: input.host,
    port: input.port,
    connection,
    displayName: `${input.host}:${input.port}`,
  };
}

function parseRedisPort(value: string | number, label: string): number {
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`${label} must be an integer port between 1 and 65535.`);
  }
  return port;
}

function parseRedisDb(pathname: string): number | undefined {
  const raw = pathname.replace(/^\//, "");
  if (raw === "") {
    return undefined;
  }

  const db = Number(raw);
  if (!Number.isInteger(db) || db < 0) {
    throw new Error("REDIS_URL database must be a non-negative integer.");
  }
  return db;
}

function clean(value: string | null | undefined): string | undefined {
  if (value === null || value === undefined) {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
}

function hasValue(
  value: string | number | null | undefined,
): value is string | number {
  return value !== null && value !== undefined && String(value).trim() !== "";
}
