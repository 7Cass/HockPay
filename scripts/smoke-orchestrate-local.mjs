#!/usr/bin/env node
import { spawn, execFile } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const COMPOSE_FILE = resolve(
  ROOT_DIR,
  "infrastructure/docker/docker-compose.smoke.yml",
);
const COMPOSE_PROJECT = "hockpay-smoke";
const DOCKER_ARGS = ["compose", "-p", COMPOSE_PROJECT, "-f", COMPOSE_FILE];
const INFRA_PORTS = [15432, 16379];
const DEFAULT_APP_PORTS = {
  api: 3000,
  worker: 3001,
  checkout: 3333,
  studycase: 3005,
  webhook: 3999,
};
const DEFAULT_SUITES = [
  "p0",
  "payment-link",
  "p3",
  "studycase",
  "system",
  "withdrawals",
];
const HEALTH_TIMEOUT_MS = Number(
  process.env.HOCKPAY_SMOKE_HEALTH_TIMEOUT_MS ?? 90000,
);
const HEALTH_INTERVAL_MS = 1000;
const HTTP_REQUEST_TIMEOUT_MS = Number(
  process.env.HOCKPAY_SMOKE_HTTP_REQUEST_TIMEOUT_MS ?? 5000,
);
const SMOKE_ARTIFACT_DIR = resolve(
  ROOT_DIR,
  process.env.HOCKPAY_SMOKE_ARTIFACT_DIR ?? "artifacts/smoke",
);

const suiteCommands = new Map([
  ["p0", ["pnpm", ["run", "smoke:p0"]]],
  ["payment-link", ["pnpm", ["run", "smoke:payment-link"]]],
  ["p3", ["pnpm", ["run", "smoke:p3:visual"]]],
  ["studycase", ["pnpm", ["run", "smoke:studycase:mediakit"]]],
  ["system", ["pnpm", ["run", "smoke:system"]]],
  ["withdrawals", ["pnpm", ["run", "smoke:withdrawals"]]],
  ["idempotency", ["pnpm", ["run", "smoke:idempotency"]]],
  [
    "idempotency-redis-unavailable",
    ["pnpm", ["run", "smoke:idempotency-redis-unavailable"]],
  ],
  ["db-concurrency", ["pnpm", ["run", "smoke:db-concurrency"]]],
]);

const children = new Set();

function log(message) {
  console.log(`[smoke:docker] ${message}`);
}

function randomSecret(bytes = 32) {
  return randomBytes(bytes).toString("base64url");
}

function randomHex(bytes) {
  return randomBytes(bytes).toString("hex");
}

function smokePorts() {
  return {
    api: readSmokePort("HOCKPAY_SMOKE_API_PORT", DEFAULT_APP_PORTS.api),
    worker: readSmokePort(
      "HOCKPAY_SMOKE_WORKER_PORT",
      DEFAULT_APP_PORTS.worker,
    ),
    checkout: readSmokePort(
      "HOCKPAY_SMOKE_CHECKOUT_PORT",
      DEFAULT_APP_PORTS.checkout,
    ),
    studycase: readSmokePort(
      "HOCKPAY_SMOKE_STUDYCASE_PORT",
      DEFAULT_APP_PORTS.studycase,
    ),
    webhook: readSmokePort(
      "HOCKPAY_SMOKE_WEBHOOK_PORT",
      DEFAULT_APP_PORTS.webhook,
    ),
  };
}

function readSmokePort(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined || raw === "") {
    return fallback;
  }

  const port = Number(raw);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`${name} must be an integer port between 1 and 65535.`);
  }

  return port;
}

function smokeEnv(ports = smokePorts()) {
  const postgresUser = process.env.HOCKPAY_SMOKE_POSTGRES_USER ?? "hockpay";
  const generatedPostgresPassword =
    process.env.HOCKPAY_SMOKE_POSTGRES_PASSWORD === undefined;
  const postgresPassword =
    process.env.HOCKPAY_SMOKE_POSTGRES_PASSWORD ?? randomSecret(24);
  const postgresDb = process.env.HOCKPAY_SMOKE_POSTGRES_DB ?? "hockpay_smoke";

  return {
    ...process.env,
    NODE_ENV: "test",
    PORT: String(ports.api),
    HOCKPAY_SMOKE_POSTGRES_USER: postgresUser,
    HOCKPAY_SMOKE_POSTGRES_PASSWORD: postgresPassword,
    HOCKPAY_SMOKE_GENERATED_POSTGRES_PASSWORD: generatedPostgresPassword
      ? "true"
      : "false",
    HOCKPAY_SMOKE_POSTGRES_DB: postgresDb,
    DATABASE_URL: `postgresql://${encodeURIComponent(postgresUser)}:${encodeURIComponent(
      postgresPassword,
    )}@127.0.0.1:15432/${encodeURIComponent(postgresDb)}?schema=public`,
    REDIS_URL: "redis://127.0.0.1:16379",
    REDIS_HOST: "127.0.0.1",
    REDIS_PORT: "16379",
    JWT_SECRET: process.env.JWT_SECRET ?? `hockpay-smoke-${randomSecret(48)}`,
    ENCRYPTION_KEY: process.env.ENCRYPTION_KEY ?? randomHex(32),
    CHECKOUT_BASE_URL: `http://localhost:${ports.checkout}`,
    HOCKPAY_API_URL: `http://localhost:${ports.api}/api/v1`,
    HOCKPAY_CHECKOUT_URL: `http://localhost:${ports.checkout}`,
    HOCKPAY_WEB_URL: process.env.HOCKPAY_WEB_URL ?? "http://localhost:4200",
    HOCKPAY_STUDYCASE_DEMO_URL: `http://localhost:${ports.studycase}`,
    HOCKPAY_STUDYCASE_DEMO_PORT: String(ports.studycase),
    HOCKPAY_SMOKE_WEBHOOK_PORT: String(ports.webhook),
    NEXT_PUBLIC_API_URL: `http://localhost:${ports.api}/api/v1`,
    NEXT_PUBLIC_DEV_MODE: "true",
    CORS_ORIGIN: [
      "http://localhost:4200",
      `http://localhost:${ports.checkout}`,
      `http://localhost:${ports.api}`,
      `http://localhost:${ports.studycase}`,
    ].join(","),
    WORKER_CRON_WITHDRAWAL_PROCESSING:
      process.env.WORKER_CRON_WITHDRAWAL_PROCESSING ?? "0 0 0 1 1 *",
  };
}

function selectedSuites() {
  const raw = process.env.HOCKPAY_SMOKE_SUITE;
  const suites = raw
    ? raw
        .split(",")
        .map((suite) => suite.trim())
        .filter(Boolean)
    : DEFAULT_SUITES;

  for (const suite of suites) {
    if (!suiteCommands.has(suite)) {
      throw new Error(
        `Unknown HOCKPAY_SMOKE_SUITE entry "${suite}". Supported: ${[
          ...suiteCommands.keys(),
        ].join(", ")}`,
      );
    }
  }

  return suites;
}

async function assertPortsFree(ports = PORTS) {
  log(`Checking local ports: ${ports.join(", ")}`);
  for (const port of ports) {
    const free = await isPortFree(port);
    if (!free) {
      throw new Error(
        `Port ${port} is already in use. Stop the process using it before running smoke:docker.`,
      );
    }
  }
}

async function isPortFree(port) {
  for (const host of ["127.0.0.1", "::"]) {
    if (!(await isPortFreeOnHost(port, host))) {
      return false;
    }
  }
  return true;
}

function isPortFreeOnHost(port, host) {
  return new Promise((resolvePort, reject) => {
    const server = createServer();
    server.once("error", (error) => {
      if (error.code === "EADDRINUSE") {
        resolvePort(false);
        return;
      }
      if (error.code === "EAFNOSUPPORT" || error.code === "EADDRNOTAVAIL") {
        resolvePort(true);
        return;
      }
      reject(error);
    });
    server.listen({ host, port }, () => {
      server.close(() => resolvePort(true));
    });
  });
}

async function runDocker(args, options = {}) {
  await runCommand("docker", [...DOCKER_ARGS, ...args], {
    ...options,
    label: options.label ?? "docker",
  });
}

function execFileText(command, args, options = {}) {
  return new Promise((resolveExec, reject) => {
    execFile(
      command,
      args,
      { cwd: ROOT_DIR, env: options.env },
      (error, stdout, stderr) => {
        if (error) {
          error.stdout = stdout;
          error.stderr = stderr;
          reject(error);
          return;
        }
        resolveExec(String(stdout).trim());
      },
    );
  });
}

function execFileCombinedText(command, args, options = {}) {
  return new Promise((resolveExec) => {
    execFile(
      command,
      args,
      { cwd: ROOT_DIR, env: options.env },
      (error, stdout, stderr) => {
        const output = [
          `$ ${command} ${args.join(" ")}`,
          stdout,
          stderr,
          error
            ? `exit: ${error.code ?? error.signal ?? error.message}`
            : "exit: 0",
        ]
          .filter(Boolean)
          .join("\n");
        resolveExec(output);
      },
    );
  });
}

async function waitForContainerHealthy(containerName) {
  const deadline = Date.now() + HEALTH_TIMEOUT_MS;
  let lastStatus = "unknown";

  while (Date.now() < deadline) {
    try {
      lastStatus = await execFileText("docker", [
        "inspect",
        "--format",
        "{{.State.Health.Status}}",
        containerName,
      ]);
      if (lastStatus === "healthy") {
        log(`${containerName} is healthy`);
        return;
      }
    } catch (error) {
      lastStatus = error.stderr || error.message;
    }

    await sleep(HEALTH_INTERVAL_MS);
  }

  throw new Error(
    `${containerName} was not healthy within ${HEALTH_TIMEOUT_MS}ms. Last status: ${lastStatus}`,
  );
}

async function waitForHttp(url, label) {
  const deadline = Date.now() + HEALTH_TIMEOUT_MS;
  let lastError = "not requested";

  while (Date.now() < deadline) {
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      HTTP_REQUEST_TIMEOUT_MS,
    );
    try {
      const response = await fetch(url, { signal: controller.signal });
      const body = await response.text();
      if (response.ok) {
        log(`${label} is ready`);
        return;
      }
      lastError = `${response.status}: ${body}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    } finally {
      clearTimeout(timeout);
    }

    await sleep(HEALTH_INTERVAL_MS);
  }

  throw new Error(`${label} did not become ready. Last error: ${lastError}`);
}

async function runCommand(command, args, options = {}) {
  const label = options.label ?? command;
  log(`Running ${label}: ${command} ${args.join(" ")}`);

  await new Promise((resolveRun, reject) => {
    const child = spawn(command, args, {
      cwd: ROOT_DIR,
      env: options.env ?? process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });

    prefixStream(child.stdout, label);
    prefixStream(child.stderr, label);

    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (code === 0) {
        resolveRun();
        return;
      }
      reject(new Error(`${label} exited with ${signal ?? code}`));
    });
  });
}

function startProcess(label, command, args, env) {
  log(`Starting ${label}: ${command} ${args.join(" ")}`);
  const child = spawn(command, args, {
    cwd: ROOT_DIR,
    env,
    detached: true,
    stdio: ["ignore", "pipe", "pipe"],
  });
  children.add(child);
  prefixStream(child.stdout, label);
  prefixStream(child.stderr, label);
  child.once("exit", (code, signal) => {
    children.delete(child);
    log(`${label} exited with ${signal ?? code}`);
  });
  child.once("error", (error) => {
    log(`${label} failed to start: ${error.message}`);
  });
  return child;
}

function prefixStream(stream, label) {
  let buffered = "";
  stream.on("data", (chunk) => {
    buffered += chunk.toString();
    const lines = buffered.split(/\r?\n/);
    buffered = lines.pop() ?? "";
    for (const line of lines) {
      if (line.length > 0) {
        console.log(`[${label}] ${line}`);
      }
    }
  });
  stream.on("end", () => {
    if (buffered.length > 0) {
      console.log(`[${label}] ${buffered}`);
    }
  });
}

async function stopChildren() {
  if (children.size === 0) {
    return;
  }

  log("Stopping local Node services");
  const activeChildren = [...children];
  const exits = activeChildren.map((child) => waitForExit(child, 5000));
  for (const child of activeChildren) {
    signalProcessTree(child, "SIGTERM");
  }
  await Promise.allSettled(exits);
  for (const child of activeChildren) {
    signalProcessTree(child, "SIGKILL");
  }
  await Promise.allSettled(
    activeChildren.map((child) => waitForExit(child, 1000)),
  );
  children.clear();
}

async function collectSmokeDiagnostics(env, error) {
  log(`Collecting failure diagnostics in ${SMOKE_ARTIFACT_DIR}`);
  await mkdir(SMOKE_ARTIFACT_DIR, { recursive: true });
  await writeArtifact(
    "failure.txt",
    error instanceof Error ? (error.stack ?? error.message) : String(error),
  );
  await writeArtifact(
    "docker-compose-ps.txt",
    await execFileCombinedText("docker", [...DOCKER_ARGS, "ps", "-a"], { env }),
  );

  for (const containerName of [
    "hockpay-smoke-postgres",
    "hockpay-smoke-redis",
  ]) {
    await writeArtifact(
      `${containerName}.log`,
      await execFileCombinedText("docker", ["logs", containerName], { env }),
    );
  }
}

async function writeArtifact(name, contents) {
  await writeFile(resolve(SMOKE_ARTIFACT_DIR, name), `${contents}\n`);
}

function signalProcessTree(child, signal) {
  if (child.exitCode !== null || child.signalCode !== null) {
    return;
  }

  try {
    process.kill(-child.pid, signal);
  } catch {
    try {
      child.kill(signal);
    } catch {
      // The process may already have exited between checks.
    }
  }
}

function waitForExit(child, timeoutMs) {
  return new Promise((resolveExit) => {
    const timeout = setTimeout(resolveExit, timeoutMs);
    child.once("exit", () => {
      clearTimeout(timeout);
      resolveExit();
    });
  });
}

function waitForSignal() {
  log(
    "HOCKPAY_SMOKE_KEEP_ALIVE=true. Press Ctrl+C to stop services and containers.",
  );
  return new Promise((resolveSignal) => {
    process.once("SIGINT", resolveSignal);
    process.once("SIGTERM", resolveSignal);
  });
}

function sleep(ms) {
  return new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
}

async function main() {
  const ports = smokePorts();
  const env = smokeEnv(ports);
  const suites = selectedSuites();
  const apiOnlySuites = new Set([
    "idempotency",
    "idempotency-redis-unavailable",
    "db-concurrency",
  ]);
  const apiOnly = suites.every((suite) => apiOnlySuites.has(suite));
  const requiredPorts = apiOnly
    ? [...INFRA_PORTS, ports.api]
    : [
        ...INFRA_PORTS,
        ports.api,
        ports.worker,
        ports.checkout,
        ports.studycase,
        ports.webhook,
      ];
  const migrateMode = process.env.HOCKPAY_SMOKE_MIGRATE_MODE ?? "deploy";
  const cleanVolumes =
    process.env.HOCKPAY_SMOKE_CLEAN_VOLUMES === "true" ||
    env.HOCKPAY_SMOKE_GENERATED_POSTGRES_PASSWORD === "true";
  const keepAlive = process.env.HOCKPAY_SMOKE_KEEP_ALIVE === "true";

  if (!["deploy", "dev"].includes(migrateMode)) {
    throw new Error("HOCKPAY_SMOKE_MIGRATE_MODE must be deploy or dev.");
  }

  await assertPortsFree(requiredPorts);

  try {
    if (cleanVolumes) {
      log("Resetting Docker smoke volumes for generated database credentials");
      await runDocker(["down", "--remove-orphans", "-v"], {
        env,
        label: "docker:reset",
      });
    }

    log("Starting Docker smoke infrastructure");
    await runDocker(["up", "-d"], { env });
    await waitForContainerHealthy("hockpay-smoke-postgres");
    await waitForContainerHealthy("hockpay-smoke-redis");

    await runCommand("pnpm", ["run", "db:generate"], {
      env,
      label: "db:generate",
    });
    await runCommand(
      "pnpm",
      ["run", migrateMode === "deploy" ? "db:deploy" : "db:migrate"],
      {
        env,
        label: `db:${migrateMode}`,
      },
    );
    await runCommand("pnpm", ["--filter", "@hockpay/core", "build"], {
      env,
      label: "build:core",
    });
    await runCommand("pnpm", ["--filter", "@hockpay/database", "build"], {
      env,
      label: "build:database",
    });
    await runCommand("pnpm", ["--filter", "@hockpay/infrastructure", "build"], {
      env,
      label: "build:infrastructure",
    });

    const apiEnv = { ...env, PORT: String(ports.api) };
    const workerEnv = { ...env, PORT: String(ports.worker) };
    const checkoutEnv = { ...env, PORT: String(ports.checkout) };

    startProcess("api", "pnpm", ["--filter", "@hockpay/api", "start"], apiEnv);
    if (!apiOnly) {
      startProcess(
        "worker",
        "pnpm",
        ["--filter", "@hockpay/worker", "start"],
        workerEnv,
      );
      startProcess(
        "checkout",
        "pnpm",
        [
          "--filter",
          "@hockpay/checkout",
          "exec",
          "next",
          "dev",
          "-p",
          String(ports.checkout),
        ],
        checkoutEnv,
      );
    }

    await waitForHttp(
      `http://localhost:${ports.api}/api/v1/health/live`,
      "API liveness",
    );
    await waitForHttp(
      `http://localhost:${ports.api}/api/v1/health/ready`,
      "API readiness",
    );
    if (!apiOnly) {
      await waitForHttp(
        `http://localhost:${ports.worker}/health/live`,
        "Worker liveness",
      );
      await waitForHttp(
        `http://localhost:${ports.worker}/health/ready`,
        "Worker readiness",
      );
    }

    for (const suite of suites) {
      const [command, args] = suiteCommands.get(suite);
      await runCommand(command, args, { env, label: `smoke:${suite}` });
    }

    log(`Completed smoke suites: ${suites.join(", ")}`);

    if (keepAlive) {
      await waitForSignal();
    }
  } catch (error) {
    await collectSmokeDiagnostics(env, error);
    throw error;
  } finally {
    await stopChildren();
    const downArgs = ["down", "--remove-orphans"];
    if (cleanVolumes) {
      downArgs.push("-v");
    }
    await runDocker(downArgs, { env, label: "docker:down" });
  }
}

main().catch(async (error) => {
  console.error(
    `[smoke:docker] FAILED: ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exitCode = 1;
});
