import { describe, expect, it } from "vitest";
import { parseRedisEnv } from "./redis-env";

describe("parseRedisEnv", () => {
  it("accepts REDIS_URL only", () => {
    expect(parseRedisEnv({ REDIS_URL: "redis://redis.test:6380/2" })).toEqual({
      url: "redis://redis.test:6380/2",
      host: "redis.test",
      port: 6380,
      displayName: "redis.test:6380",
      connection: {
        host: "redis.test",
        port: 6380,
        db: 2,
      },
    });
  });

  it("accepts REDIS_HOST and REDIS_PORT only", () => {
    expect(
      parseRedisEnv({ REDIS_HOST: "redis.local", REDIS_PORT: "6381" }),
    ).toMatchObject({
      url: "redis://redis.local:6381",
      host: "redis.local",
      port: 6381,
      connection: {
        host: "redis.local",
        port: 6381,
      },
    });
  });

  it("accepts matching REDIS_URL and host/port values", () => {
    expect(
      parseRedisEnv({
        REDIS_URL: "redis://redis.local:6381",
        REDIS_HOST: "redis.local",
        REDIS_PORT: "6381",
      }),
    ).toMatchObject({
      host: "redis.local",
      port: 6381,
    });
  });

  it("rejects mismatched Redis hosts", () => {
    expect(() =>
      parseRedisEnv({
        REDIS_URL: "redis://redis-a:6379",
        REDIS_HOST: "redis-b",
      }),
    ).toThrow('REDIS_URL host "redis-a" does not match REDIS_HOST "redis-b"');
  });

  it("rejects mismatched Redis ports", () => {
    expect(() =>
      parseRedisEnv({
        REDIS_URL: "redis://redis.local:6379",
        REDIS_HOST: "redis.local",
        REDIS_PORT: "6380",
      }),
    ).toThrow("REDIS_URL port 6379 does not match REDIS_PORT 6380");
  });

  it("defaults to localhost:6379 when Redis env is absent", () => {
    expect(parseRedisEnv({})).toMatchObject({
      url: "redis://localhost:6379",
      host: "localhost",
      port: 6379,
      connection: {
        host: "localhost",
        port: 6379,
      },
    });
  });
});
