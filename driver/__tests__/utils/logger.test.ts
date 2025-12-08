/**
 * Unit tests for logger utility
 */

import { logger } from "@/lib/logger";

describe("Logger", () => {
  beforeEach(() => {
    logger.clearBuffer();
  });

  test("should log debug messages in development", () => {
    const consoleSpy = jest.spyOn(console, "log");
    logger.debug("Test debug message");
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  test("should sanitize sensitive data", () => {
    const sensitiveData = {
      password: "secret123",
      accessToken: "token123",
      user: {
        email: "test@example.com",
      },
    };

    logger.info("Test message", sensitiveData);
    const buffer = logger.getLogBuffer();
    const lastEntry = buffer[buffer.length - 1];

    expect(lastEntry.data).toBeDefined();
    // Password and token should be redacted
    expect(JSON.stringify(lastEntry.data)).toContain("[REDACTED]");
  });

  test("should add entries to buffer", () => {
    logger.info("Test message");
    const buffer = logger.getLogBuffer();
    expect(buffer.length).toBeGreaterThan(0);
  });

  test("should limit buffer size", () => {
    // Add more than max buffer size entries
    for (let i = 0; i < 150; i++) {
      logger.info(`Message ${i}`);
    }

    const buffer = logger.getLogBuffer();
    expect(buffer.length).toBeLessThanOrEqual(100);
  });
});

