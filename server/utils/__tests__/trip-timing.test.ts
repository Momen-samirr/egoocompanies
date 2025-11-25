/**
 * Unit tests for trip-timing utility functions
 * 
 * Run with: npx ts-node utils/__tests__/trip-timing.test.ts
 */

import { calculateTimingDifference, formatTimingMessage, TimingResult } from '../trip-timing';

// Mock console methods to capture logs
const originalLog = console.log;
const originalWarn = console.warn;
const originalError = console.error;

let logOutput: string[] = [];
let warnOutput: string[] = [];
let errorOutput: string[] = [];

beforeEach(() => {
  logOutput = [];
  warnOutput = [];
  errorOutput = [];
  console.log = (...args: any[]) => logOutput.push(args.join(' '));
  console.warn = (...args: any[]) => warnOutput.push(args.join(' '));
  console.error = (...args: any[]) => errorOutput.push(args.join(' '));
});

afterEach(() => {
  console.log = originalLog;
  console.warn = originalWarn;
  console.error = originalError;
});

function beforeEach(fn: () => void) {
  fn();
}

function afterEach(fn: () => void) {
  fn();
}

// Test helper to create dates
function createDate(year: number, month: number, day: number, hours: number, minutes: number, seconds: number = 0): Date {
  return new Date(year, month - 1, day, hours, minutes, seconds);
}

// Test helper to create UTC dates (for consistent testing)
function createUTCDate(year: number, month: number, day: number, hours: number, minutes: number, seconds: number = 0): Date {
  return new Date(Date.UTC(year, month - 1, day, hours, minutes, seconds));
}

// Test runner
function runTest(name: string, fn: () => void): boolean {
  try {
    beforeEach(() => {});
    fn();
    afterEach(() => {});
    console.log(`✓ ${name}`);
    return true;
  } catch (error: any) {
    console.error(`✗ ${name}: ${error.message}`);
    if (error.stack) {
      console.error(error.stack);
    }
    return false;
  }
}

function expect(actual: any) {
  return {
    toBe: (expected: any) => {
      if (actual !== expected) {
        throw new Error(`Expected ${expected}, but got ${actual}`);
      }
    },
    toEqual: (expected: any) => {
      if (JSON.stringify(actual) !== JSON.stringify(expected)) {
        throw new Error(`Expected ${JSON.stringify(expected)}, but got ${JSON.stringify(actual)}`);
      }
    },
    toBeNull: () => {
      if (actual !== null) {
        throw new Error(`Expected null, but got ${actual}`);
      }
    },
    toBeTruthy: () => {
      if (!actual) {
        throw new Error(`Expected truthy value, but got ${actual}`);
      }
    },
    toBeFalsy: () => {
      if (actual) {
        throw new Error(`Expected falsy value, but got ${actual}`);
      }
    },
    toBeGreaterThan: (expected: number) => {
      if (actual <= expected) {
        throw new Error(`Expected ${actual} to be greater than ${expected}`);
      }
    },
    toBeLessThan: (expected: number) => {
      if (actual < expected) {
        throw new Error(`Expected ${actual} to be less than ${expected}`);
      }
    }
  };
}

// Test cases
const tests: Array<{ name: string; fn: () => void }> = [];

// Test 1: Same timezone, on time
tests.push({
  name: 'Same timezone, on time (within 1 minute)',
  fn: () => {
    const expected = createDate(2025, 11, 25, 22, 10, 0);
    const reached = createDate(2025, 11, 25, 22, 10, 30); // 30 seconds later
    const result = calculateTimingDifference(expected, reached);
    
    expect(result).toBeTruthy();
    expect(result?.status).toBe('on-time');
    expect(result?.minutes).toBe(0);
  }
});

// Test 2: Same timezone, 3 minutes late
tests.push({
  name: 'Same timezone, 3 minutes late',
  fn: () => {
    const expected = createDate(2025, 11, 25, 22, 10, 0);
    const reached = createDate(2025, 11, 25, 22, 13, 13); // 3 minutes 13 seconds later
    const result = calculateTimingDifference(expected, reached);
    
    expect(result).toBeTruthy();
    expect(result?.status).toBe('late');
    expect(result?.minutes).toBe(3);
    expect(result?.isEarly).toBe(false);
  }
});

// Test 3: Same timezone, 5 minutes early
tests.push({
  name: 'Same timezone, 5 minutes early',
  fn: () => {
    const expected = createDate(2025, 11, 25, 22, 10, 0);
    const reached = createDate(2025, 11, 25, 22, 5, 0); // 5 minutes earlier
    const result = calculateTimingDifference(expected, reached);
    
    expect(result).toBeTruthy();
    expect(result?.status).toBe('early');
    expect(result?.minutes).toBe(5);
    expect(result?.isEarly).toBe(true);
  }
});

// Test 4: UTC dates comparison
tests.push({
  name: 'UTC dates comparison, 2 minutes late',
  fn: () => {
    const expected = createUTCDate(2025, 11, 25, 22, 10, 0);
    const reached = createUTCDate(2025, 11, 25, 22, 12, 0);
    const result = calculateTimingDifference(expected, reached);
    
    expect(result).toBeTruthy();
    expect(result?.status).toBe('late');
    expect(result?.minutes).toBe(2);
  }
});

// Test 5: Null expected time
tests.push({
  name: 'Null expected time returns null',
  fn: () => {
    const reached = new Date();
    const result = calculateTimingDifference(null, reached);
    expect(result).toBeNull();
  }
});

// Test 6: Null reached time
tests.push({
  name: 'Null reached time returns null',
  fn: () => {
    const expected = new Date();
    const result = calculateTimingDifference(expected, null);
    expect(result).toBeNull();
  }
});

// Test 7: Invalid dates
tests.push({
  name: 'Invalid dates return null',
  fn: () => {
    const invalidDate = new Date('invalid');
    const validDate = new Date();
    const result = calculateTimingDifference(invalidDate, validDate);
    expect(result).toBeNull();
    expect(errorOutput.length).toBeGreaterThan(0);
  }
});

// Test 8: Large difference detection (should warn)
tests.push({
  name: 'Large difference (>24 hours) triggers warning',
  fn: () => {
    const expected = createDate(2025, 11, 25, 22, 10, 0);
    const reached = createDate(2025, 11, 26, 23, 10, 0); // 25 hours later
    const result = calculateTimingDifference(expected, reached);
    
    expect(result).toBeTruthy();
    expect(warnOutput.length).toBeGreaterThan(0);
    expect(warnOutput.some(msg => msg.includes('Unusually large time difference'))).toBeTruthy();
  }
});

// Test 9: Exactly 1 minute early (should be "early", not "on-time")
tests.push({
  name: 'Exactly 1 minute early',
  fn: () => {
    const expected = createDate(2025, 11, 25, 22, 10, 0);
    const reached = createDate(2025, 11, 25, 22, 9, 0); // Exactly 1 minute earlier
    const result = calculateTimingDifference(expected, reached);
    
    expect(result).toBeTruthy();
    expect(result?.status).toBe('early');
    expect(result?.minutes).toBe(1);
  }
});

// Test 10: Format timing message
tests.push({
  name: 'Format timing message - on time',
  fn: () => {
    const timing: TimingResult = { isEarly: false, minutes: 0, status: 'on-time' };
    const message = formatTimingMessage(timing);
    expect(message).toBe('You arrived on time');
  }
});

// Test 11: Format timing message - early
tests.push({
  name: 'Format timing message - early (singular)',
  fn: () => {
    const timing: TimingResult = { isEarly: true, minutes: 1, status: 'early' };
    const message = formatTimingMessage(timing);
    expect(message).toBe('You arrived 1 minute early');
  }
});

// Test 12: Format timing message - late (plural)
tests.push({
  name: 'Format timing message - late (plural)',
  fn: () => {
    const timing: TimingResult = { isEarly: false, minutes: 3, status: 'late' };
    const message = formatTimingMessage(timing);
    expect(message).toBe('You arrived 3 minutes late');
  }
});

// Test 13: Format timing message - null
tests.push({
  name: 'Format timing message - null',
  fn: () => {
    const message = formatTimingMessage(null);
    expect(message).toBeNull();
  }
});

// Test 14: Real-world scenario from bug report
tests.push({
  name: 'Real-world bug scenario: 10:10 PM expected, 10:13:13 reached (should be 3 min late)',
  fn: () => {
    // Simulate the bug scenario
    // Expected: 2025-11-25T22:10:00 (10:10 PM local, stored without Z)
    // Reached: 2025-11-25T22:13:13 (10:13:13 local)
    const expected = createDate(2025, 11, 25, 22, 10, 0);
    const reached = createDate(2025, 11, 25, 22, 13, 13);
    const result = calculateTimingDifference(expected, reached);
    
    expect(result).toBeTruthy();
    expect(result?.status).toBe('late');
    expect(result?.minutes).toBe(3); // Should be 3 minutes late, not 117 minutes early
  }
});

// Run all tests
console.log('Running trip-timing tests...\n');

let passed = 0;
let failed = 0;

tests.forEach(test => {
  if (runTest(test.name, test.fn)) {
    passed++;
  } else {
    failed++;
  }
});

console.log(`\nTest Results: ${passed} passed, ${failed} failed`);

if (failed > 0) {
  process.exit(1);
} else {
  console.log('All tests passed! ✓');
  process.exit(0);
}

