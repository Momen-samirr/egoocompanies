function registerRuntimeJobs({ wss, services, driverStore, env }) {
  const jobs = [];

  const pingInterval = setInterval(() => {
    wss.clients.forEach((ws) => {
      if (ws.isAlive === false) {
        ws.terminate();
        return;
      }

      ws.isAlive = false;
      try {
        ws.ping(() => {});
      } catch (_error) {
        ws.terminate();
      }
    });
  }, 30000);
  jobs.push(pingInterval);

  const cleanupInterval = setInterval(async () => {
    const removed = await services.driver.cleanupStaleDrivers(300000);
    if (removed > 0) {
      console.log(`🧹 Cleanup completed: removed ${removed} stale driver(s)`);
    }
  }, 60000);
  jobs.push(cleanupInterval);

  if (env.enableMetrics && services.metrics) {
    const metricsInterval = setInterval(() => {
      const metrics = services.metrics.getMetrics();
      const adminClients = Array.from(wss.clients).filter((client) => client.isAdmin)
        .length;
      driverStore.getDriverCount().then((driverCount) => {
        console.log("📊 [Metrics]", {
          updatesPerSecond: metrics.updatesPerSecond,
          averageLatency: `${metrics.averageLatency}ms`,
          errorRate: `${metrics.errorRate}%`,
          activeDrivers: driverCount,
          connectedAdmins: adminClients,
          totalUpdates: metrics.totalUpdates,
          totalErrors: metrics.totalErrors,
        });
      });
    }, 60000);
    jobs.push(metricsInterval);
  }

  return function stopRuntimeJobs() {
    jobs.forEach((job) => clearInterval(job));
  };
}

module.exports = {
  registerRuntimeJobs,
};
