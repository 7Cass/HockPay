#!/usr/bin/env node
import { spawn, execFile } from "node:child_process";
import { randomBytes } from "node:crypto";
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
const PORTS = [15432, 16379, 3000, 3001, 3333, 3005, 3999];
const DEFAULT_SUITES = ["p0", "payment-link", "p3", "studycase", "system", "withdrawals"];
const HEALTH_TIMEOUT_MS = Number(
  process.env.HOCKPAY_SMOKE_HEALTH_TIMEOUT_MS ?? 90000,
);
const HEALTH_INTERVAL_MS = 1000;
const HTTP_REQUEST_TIMEOUT_MS = Number(
  process.env.HOCKPAY_SMOKE_HTTP_REQUEST_TIMEOUT_MS ?? 5000,
);

const suiteCommands = new Map([
  ["p0", ["pnpm", ["run", "smoke:p0"]]],
  ["payment-link", ["pnpm", ["run", "smoke:payment-link"]]],
  ["p3", ["pnpm", ["run", "smoke:p3:visual"]]],
  ["studycase", ["pnpm", ["run", "smoke:studycase:mediakit"]]],
  ["system", ["pnpm", ["run", "smoke:system"]]],
  ["withdrawals", ["pnpm", ["run", "smoke:withdrawals"]]],
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

function smokeEnv() {
  const postgresUser = process.env.HOCKPAY_SMOKE_POSTGRES_USER ?? "hockpay";
  const generatedPostgresPassword =
    process.env.HOCKPAY_SMOKE_POSTGRES_PASSWORD === undefined;
  const postgresPassword =
    process.env.HOCKPAY_SMOKE_POSTGRES_PASSWORD ?? randomSecret(24);
  const postgresDb =
    process.env.HOCKPAY_SMOKE_POSTGRES_DB ?? "hockpay_smoke";

  return {
    ...process.env,
    NODE_ENV: "test",
    PORT: "3000",
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
    JWT_SECRET:
      process.env.JWT_SECRET ?? `hockpay-smoke-${randomSecret(48)}`,
    ENCRYPTION_KEY: process.env.ENCRYPTION_KEY ?? randomHex(32),
    CHECKOUT_BASE_URL: "http://localhost:3333",
    HOCKPAY_API_URL: "http://localhost:3000/api/v1",
    HOCKPAY_CHECKOUT_URL: "http://localhost:3333",
    HOCKPAY_WEB_URL: process.env.HOCKPAY_WEB_URL ?? "http://localhost:4200",
    HOCKPAY_STUDYCASE_DEMO_URL: "http://localhost:3005",
    HOCKPAY_STUDYCASE_DEMO_PORT: "3005",
    HOCKPAY_SMOKE_WEBHOOK_PORT: "3999",
    NEXT_PUBLIC_API_URL: "http://localhost:3000/api/v1",
    NEXT_PUBLIC_DEV_MODE: "true",
    CORS_ORIGIN: [
      "http://localhost:4200",
      "http://localhost:3333",
      "http://localhost:3000",
      "http://localhost:3005",
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

async function assertPortsFree() {
  log(`Checking local ports: ${PORTS.join(", ")}`);
  for (const port of PORTS) {
    const free = await isPortFree(port);
    if (!free) {
      throw new Error(
        `Port ${port} is already in use. Stop the process using it before running smoke:docker.`,
      );
    }
  }
}

function isPortFree(port) {
  return new Promise((resolvePort, reject) => {
    const server = createServer();
    server.once("error", (error) => {
      if (error.code === "EADDRINUSE") {
        resolvePort(false);
        return;
      }
      reject(error);
    });
    server.listen({ host: "127.0.0.1", port }, () => {
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
  const env = smokeEnv();
  const suites = selectedSuites();
  const migrateMode = process.env.HOCKPAY_SMOKE_MIGRATE_MODE ?? "deploy";
  const cleanVolumes =
    process.env.HOCKPAY_SMOKE_CLEAN_VOLUMES === "true" ||
    env.HOCKPAY_SMOKE_GENERATED_POSTGRES_PASSWORD === "true";
  const keepAlive = process.env.HOCKPAY_SMOKE_KEEP_ALIVE === "true";

  if (!["deploy", "dev"].includes(migrateMode)) {
    throw new Error("HOCKPAY_SMOKE_MIGRATE_MODE must be deploy or dev.");
  }

  await assertPortsFree();

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

    const apiEnv = { ...env, PORT: "3000" };
    const workerEnv = { ...env, PORT: "3001" };
    const checkoutEnv = { ...env, PORT: "3333" };

    startProcess("api", "pnpm", ["--filter", "@hockpay/api", "start"], apiEnv);
    startProcess(
      "worker",
      "pnpm",
      ["--filter", "@hockpay/worker", "start"],
      workerEnv,
    );
    startProcess(
      "checkout",
      "pnpm",
      ["--filter", "@hockpay/checkout", "dev"],
      checkoutEnv,
    );

    await waitForHttp(
      "http://localhost:3000/api/v1/health/live",
      "API liveness",
    );
    await waitForHttp(
      "http://localhost:3000/api/v1/health/ready",
      "API readiness",
    );

    for (const suite of suites) {
      const [command, args] = suiteCommands.get(suite);
      await runCommand(command, args, { env, label: `smoke:${suite}` });
    }

    log(`Completed smoke suites: ${suites.join(", ")}`);

    if (keepAlive) {
      await waitForSignal();
    }
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
