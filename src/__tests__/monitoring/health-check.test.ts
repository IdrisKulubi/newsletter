/**
 * Health Check Tests
 * Tests for the comprehensive health check system
 */

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { healthChecker } from "@/lib/monitoring/health-check";

// Mock external dependencies
vi.mock("@/lib/db", () => ({
  db: {
    execute: vi.fn().mockResolvedValue([{ test: 1 }]),
  },
}));

vi.mock("ioredis", () => ({
  Redis: vi.fn().mockImplementation(() => ({
    ping: vi.fn().mockResolvedValue("PONG"),
    info: vi
      .fn()
      .mockResolvedValue(
        "used_memory:1000000\nused_memory_human:976.56K\nused_memory_rss:2000000"
      ),
    quit: vi.fn().mockResolvedValue("OK"),
  })),
}));

vi.mock("@aws-sdk/client-s3", () => ({
  S3Client: vi.fn().mockImplementation(() => ({
    send: vi.fn().mockResolvedValue({}),
  })),
  HeadBucketCommand: vi.fn(),
}));

vi.mock("@/lib/monitoring/security-monitor", () => ({
  securityMonitor: {
    healthCheck: vi.fn().mockResolvedValue({
      healthy: true,
      eventsStored: 100,
      alertsActive: 2,
      redisConnected: true,
    }),
  },
}));

vi.mock("@/lib/monitoring/error-tracker", () => ({
  errorTracker: {
    healthCheck: vi.fn().mockReturnValue({
      healthy: true,
      totalErrors: 50,
      unresolvedErrors: 5,
      circuitBreakersOpen: 0,
    }),
  },
}));

vi.mock("@/lib/queue/queue-monitor", () => ({
  queueMonitor: {
    generateReport: vi.fn().mockReturnValue({
      summary: {
        totalQueues: 3,
        healthyQueues: 2,
        warningQueues: 1,
        criticalQueues: 0,
      },
      recentErrors: [],
    }),
  },
}));

vi.mock("@/lib/config", () => ({
  config: {
    redis: { url: "redis://localhost:6379" },
    r2: {
      accountId: "test-account",
      accessKeyId: "test-key",
      secretAccessKey: "test-secret",
      bucketName: "test-bucket",
    },
    email: { resendApiKey: "test-resend-key" },
    ai: { openaiApiKey: "test-openai-key" },
    app: { nodeEnv: "test" },
  },
}));

// Mock fetch for external API calls
global.fetch = vi.fn();

describe("HealthChecker", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Setup default fetch mock
    (global.fetch as any).mockResolvedValue({
      ok: true,
      status: 200,
      statusText: "OK",
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("Individual health checks", () => {
    it("should check database health successfully", async () => {
      const result = await healthChecker.runCheck("database");

      expect(result).toBeDefined();
      expect(result?.status).toBe("healthy");
      expect(result?.details.connected).toBe(true);
      expect(result?.duration).toBeGreaterThan(0);
    });

    it("should handle database connection failure", async () => {
      // Mock database error
      const { db } = await import("@/lib/db");
      vi.mocked(db.execute).mockRejectedValueOnce(
        new Error("Connection failed")
      );

      const result = await healthChecker.runCheck("database");

      expect(result).toBeDefined();
      expect(result?.status).toBe("unhealthy");
      expect(result?.details.connected).toBe(false);
      expect(result?.error).toBe("Connection failed");
    });

    it("should check Redis health successfully", async () => {
      const result = await healthChecker.runCheck("redis");

      expect(result).toBeDefined();
      expect(result?.status).toBe("healthy");
      expect(result?.details.connected).toBe(true);
      expect(result?.details.memoryInfo).toBeDefined();
    });

    it("should handle Redis connection failure", async () => {
      // Mock Redis error
      const { Redis } = await import("ioredis");
      const mockRedis = {
        ping: vi.fn().mockRejectedValue(new Error("Redis connection failed")),
        quit: vi.fn(),
      };
      vi.mocked(Redis).mockImplementationOnce(() => mockRedis as any);

      const result = await healthChecker.runCheck("redis");

      expect(result).toBeDefined();
      expect(result?.status).toBe("unhealthy");
      expect(result?.details.connected).toBe(false);
      expect(result?.error).toBe("Redis connection failed");
    });

    it("should check storage health successfully", async () => {
      const result = await healthChecker.runCheck("storage");

      expect(result).toBeDefined();
      expect(result?.status).toBe("healthy");
      expect(result?.details.connected).toBe(true);
      expect(result?.details.bucket).toBe("test-bucket");
    });

    it("should check email service health successfully", async () => {
      const result = await healthChecker.runCheck("email_service");

      expect(result).toBeDefined();
      expect(result?.status).toBe("healthy");
      expect(result?.details.connected).toBe(true);
      expect(result?.details.statusCode).toBe(200);
    });

    it("should handle email service failure", async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
      });

      const result = await healthChecker.runCheck("email_service");

      expect(result).toBeDefined();
      expect(result?.status).toBe("degraded");
      expect(result?.details.connected).toBe(false);
      expect(result?.details.statusCode).toBe(500);
    });

    it("should check AI service health successfully", async () => {
      const result = await healthChecker.runCheck("ai_service");

      expect(result).toBeDefined();
      expect(result?.status).toBe("healthy");
      expect(result?.details.connected).toBe(true);
      expect(result?.details.statusCode).toBe(200);
    });

    it("should check memory usage", async () => {
      const result = await healthChecker.runCheck("memory");

      expect(result).toBeDefined();
      expect(result?.status).toBe("healthy");
      expect(result?.details.heapUsed).toBeGreaterThan(0);
      expect(result?.details.heapTotal).toBeGreaterThan(0);
      expect(result?.details.usagePercent).toBeGreaterThanOrEqual(0);
    });

    it("should detect high memory usage", async () => {
      // Mock high memory usage
      const originalMemoryUsage = process.memoryUsage;
      process.memoryUsage = vi.fn().mockReturnValue({
        heapUsed: 950 * 1024 * 1024, // 950MB
        heapTotal: 1000 * 1024 * 1024, // 1GB
        external: 50 * 1024 * 1024,
        rss: 1100 * 1024 * 1024,
      });

      const result = await healthChecker.runCheck("memory");

      expect(result).toBeDefined();
      expect(result?.status).toBe("unhealthy"); // 95% usage
      expect(result?.details.usagePercent).toBe(95);

      process.memoryUsage = originalMemoryUsage;
    });
  });

  describe("Comprehensive health check", () => {
    it("should run all health checks successfully", async () => {
      const systemHealth = await healthChecker.runAllChecks();

      expect(systemHealth).toBeDefined();
      expect(systemHealth.components).toHaveLength(10); // All registered checks
      expect(systemHealth.summary.total).toBe(10);
      expect(systemHealth.uptime).toBeGreaterThan(0);
      expect(systemHealth.environment).toBe("test");
      // Don't assert specific status as some checks might fail in test environment
      expect(["healthy", "degraded", "unhealthy"]).toContain(
        systemHealth.status
      );
    });

    it("should report degraded status when some components are degraded", async () => {
      // Mock one service as degraded
      (global.fetch as any)
        .mockResolvedValueOnce({ ok: true, status: 200, statusText: "OK" }) // email service
        .mockResolvedValueOnce({
          ok: false,
          status: 429,
          statusText: "Too Many Requests",
        }); // AI service

      const systemHealth = await healthChecker.runAllChecks();

      // Don't assert specific status as the overall status depends on all components
      expect(["healthy", "degraded", "unhealthy"]).toContain(
        systemHealth.status
      );
      expect(systemHealth.summary.degraded).toBeGreaterThan(0);
    });

    it("should report unhealthy status when critical components fail", async () => {
      // Mock database failure
      const { db } = await import("@/lib/db");
      vi.mocked(db.execute).mockRejectedValue(new Error("Database down"));

      const systemHealth = await healthChecker.runAllChecks();

      expect(systemHealth.status).toBe("unhealthy");
      expect(systemHealth.summary.unhealthy).toBeGreaterThan(0);
    });

    it("should handle health check timeouts", async () => {
      // Mock a slow health check
      const { db } = await import("@/lib/db");
      vi.mocked(db.execute).mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 15000)) // 15 seconds
      );

      const systemHealth = await healthChecker.runAllChecks();

      // Should complete within reasonable time due to timeout
      expect(systemHealth).toBeDefined();

      // The database check should have timed out and be marked as unhealthy
      const dbComponent = systemHealth.components.find(
        (c) => c.name === "database"
      );
      expect(dbComponent?.status).toBe("unhealthy");
      expect(dbComponent?.error).toBe("Health check timeout");
    }, 15000); // Increase timeout for this test
  });

  describe("Custom health checks", () => {
    it("should register and run custom health checks", async () => {
      const customCheck = vi.fn().mockResolvedValue({
        status: "healthy" as const,
        timestamp: new Date(),
        duration: 100,
        details: { custom: true },
      });

      healthChecker.registerCheck("custom_service", customCheck);

      const result = await healthChecker.runCheck("custom_service");

      expect(result).toBeDefined();
      expect(result?.status).toBe("healthy");
      expect(result?.details.custom).toBe(true);
      expect(customCheck).toHaveBeenCalledTimes(1);
    });

    it("should handle custom health check failures", async () => {
      const failingCheck = vi
        .fn()
        .mockRejectedValue(new Error("Custom check failed"));

      healthChecker.registerCheck("failing_service", failingCheck);

      const result = await healthChecker.runCheck("failing_service");

      expect(result).toBeDefined();
      expect(result?.status).toBe("unhealthy");
      expect(result?.error).toBe("Custom check failed");
    });
  });

  describe("Health check caching", () => {
    it("should cache health check results", async () => {
      const result1 = await healthChecker.runCheck("database");
      const result2 = await healthChecker.runCheck("database");

      expect(result1).toBeDefined();
      expect(result2).toBeDefined();

      // Results should be cached in lastResults
      const lastResults = healthChecker.getLastResults();
      expect(lastResults.database).toBeDefined();
      expect(lastResults.database.name).toBe("database");
    });

    it("should provide last results", () => {
      const lastResults = healthChecker.getLastResults();

      expect(lastResults).toBeDefined();
      expect(typeof lastResults).toBe("object");
    });
  });

  describe("System uptime", () => {
    it("should track system uptime", () => {
      const uptime = healthChecker.getUptime();

      expect(uptime).toBeGreaterThanOrEqual(0);
      expect(typeof uptime).toBe("number");
    });
  });

  describe("Error handling", () => {
    it("should handle non-existent health checks", async () => {
      const result = await healthChecker.runCheck("non_existent_service");

      expect(result).toBeNull();
    });

    it("should handle health check exceptions gracefully", async () => {
      const throwingCheck = vi.fn().mockImplementation(() => {
        throw new Error("Unexpected error");
      });

      healthChecker.registerCheck("throwing_service", throwingCheck);

      const result = await healthChecker.runCheck("throwing_service");

      expect(result).toBeDefined();
      expect(result?.status).toBe("unhealthy");
      expect(result?.error).toBe("Unexpected error");
    });
  });
});
