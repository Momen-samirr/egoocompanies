function createMetricsService({ enabled }) {
  if (!enabled) {
    return null;
  }

  const collector = {
    updates: [],
    latencies: [],
    errors: 0,
    totalUpdates: 0,
  };

  function recordUpdate(latency) {
    const now = Date.now();
    collector.updates.push(now);
    collector.latencies.push(latency);
    collector.totalUpdates += 1;

    const oneMinuteAgo = now - 60000;
    collector.updates = collector.updates.filter((t) => t > oneMinuteAgo);
    collector.latencies = collector.latencies.slice(-100);
  }

  function recordError() {
    collector.errors += 1;
  }

  function getMetrics() {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    const recentUpdates = collector.updates.filter((t) => t > oneMinuteAgo);
    const updatesPerSecond = recentUpdates.length / 60;
    const averageLatency =
      collector.latencies.length > 0
        ? collector.latencies.reduce((a, b) => a + b, 0) /
          collector.latencies.length
        : 0;
    const errorRate =
      collector.totalUpdates > 0 ? collector.errors / collector.totalUpdates : 0;

    return {
      updatesPerSecond: Math.round(updatesPerSecond * 100) / 100,
      averageLatency: Math.round(averageLatency * 100) / 100,
      errorRate: Math.round(errorRate * 10000) / 100,
      totalUpdates: collector.totalUpdates,
      totalErrors: collector.errors,
    };
  }

  return {
    recordUpdate,
    recordError,
    getMetrics,
  };
}

module.exports = {
  createMetricsService,
};
