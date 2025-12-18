/**
 * Metrics collection for location tracking system
 * Tracks performance metrics like updates per second, latency, error rate
 */

interface LocationMetrics {
  updatesPerSecond: number;
  averageLatency: number;
  errorRate: number;
  activeDrivers: number;
  connectedAdmins: number;
  totalUpdates: number;
  totalErrors: number;
}

class MetricsCollector {
  private updates: number[] = [];
  private latencies: number[] = [];
  private errors: number = 0;
  private totalUpdates: number = 0;
  private startTime: number = Date.now();

  /**
   * Record a location update with latency
   */
  recordUpdate(latency: number): void {
    const now = Date.now();
    this.updates.push(now);
    this.latencies.push(latency);
    this.totalUpdates++;

    // Keep only last minute of updates
    const oneMinuteAgo = now - 60000;
    this.updates = this.updates.filter((t) => t > oneMinuteAgo);
    this.latencies = this.latencies.slice(-100); // Keep last 100 latencies
  }

  /**
   * Record an error
   */
  recordError(): void {
    this.errors++;
  }

  /**
   * Get current metrics
   */
  getMetrics(): LocationMetrics {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    const recentUpdates = this.updates.filter((t) => t > oneMinuteAgo);
    const updatesPerSecond = recentUpdates.length / 60;

    const averageLatency =
      this.latencies.length > 0
        ? this.latencies.reduce((a, b) => a + b, 0) / this.latencies.length
        : 0;

    const errorRate =
      this.totalUpdates > 0 ? this.errors / this.totalUpdates : 0;

    return {
      updatesPerSecond: Math.round(updatesPerSecond * 100) / 100,
      averageLatency: Math.round(averageLatency * 100) / 100,
      errorRate: Math.round(errorRate * 10000) / 100, // Percentage with 2 decimals
      activeDrivers: 0, // Will be set by caller
      connectedAdmins: 0, // Will be set by caller
      totalUpdates: this.totalUpdates,
      totalErrors: this.errors,
    };
  }

  /**
   * Reset metrics
   */
  reset(): void {
    this.updates = [];
    this.latencies = [];
    this.errors = 0;
    this.totalUpdates = 0;
    this.startTime = Date.now();
  }

  /**
   * Get uptime in seconds
   */
  getUptime(): number {
    return Math.floor((Date.now() - this.startTime) / 1000);
  }
}

// Export singleton instance
export const metricsCollector = new MetricsCollector();
