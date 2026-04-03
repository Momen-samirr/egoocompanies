const DEFAULT_ALLOWED_ORIGINS = [
  "https://dashapp.egoobus.com",
  "http://localhost:3000",
  "http://localhost:3001",
];

function getEnvConfig() {
  const port = Number(process.env.PORT || 8080);

  return {
    port,
    nodeEnv: process.env.NODE_ENV || "development",
    serverUrl: process.env.SERVER_URL || "http://localhost:8000",
    accessTokenSecret: process.env.ACCESS_TOKEN_SECRET,
    instanceId: process.env.INSTANCE_ID || `instance-${Date.now()}`,
    enableRedis: process.env.ENABLE_REDIS !== "false",
    enableMetrics: process.env.ENABLE_METRICS !== "false",
    redisUrl: process.env.REDIS_URL || "redis://localhost:6379",
    redisPassword: process.env.REDIS_PASSWORD || null,
    allowedOrigins: DEFAULT_ALLOWED_ORIGINS,
  };
}

module.exports = {
  getEnvConfig,
};
