require("dotenv").config();

const http = require("http");
const { WebSocketServer } = require("ws");
const Redis = require("ioredis");

const { createApp } = require("./app");
const { getEnvConfig } = require("./config/env");
const { createRuntimeState } = require("./state/runtimeState");
const { createSubscriptionsState } = require("./state/subscriptions");
const { createDebugIngest } = require("./utils/debugIngest");
const RedisDriverStore = require("./utils/redisDriverStore");
const PubSubManager = require("./utils/pubsubManager");
const ConnectionManager = require("./utils/connectionManager");

const { createMetricsService } = require("./services/metrics.service");
const { createBroadcastService } = require("./services/broadcast.service");
const { createDriverService } = require("./services/driver.service");
const { createRideService } = require("./services/ride.service");
const { createSubscriptionService } = require("./services/subscription.service");
const { registerRuntimeJobs } = require("./services/runtimeJobs.service");

const { createBackendApiClient } = require("./integrations/backendApiClient");
const { createMessageRouter } = require("./handlers/messageRouter");
const {
  createVerifyClient,
  createConnectionHandler,
} = require("./handlers/connection.handler");
const { createHttpBridgeController } = require("./controllers/httpBridge.controller");
const { createHttpRoutes } = require("./routes/http.routes");

const env = getEnvConfig();
const app = createApp(env);
const server = http.createServer(app);
const runtimeState = createRuntimeState();
const subscriptionsState = createSubscriptionsState();
const debugIngest = createDebugIngest();

let redis = null;
if (env.enableRedis) {
  try {
    redis = new Redis(env.redisUrl, {
      password: env.redisPassword,
      retryStrategy: (times) => Math.min(times * 50, 2000),
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      enableOfflineQueue: true,
    });
    redis.on("connect", () => console.log("✅ Redis connected successfully"));
    redis.on("ready", () => console.log("✅ Redis ready to accept commands"));
    redis.on("error", (err) => console.error("❌ Redis error:", err.message));
    redis.on("close", () => console.log("⚠️ Redis connection closed"));
    redis.on("reconnecting", () => console.log("🔄 Redis reconnecting..."));
  } catch (error) {
    console.error("❌ Failed to initialize Redis:", error.message);
    redis = null;
  }
} else {
  console.log("ℹ️ Redis disabled (ENABLE_REDIS=false), using in-memory storage");
}

const driverStore = new RedisDriverStore(redis, runtimeState.drivers);
const pubsubManager = new PubSubManager(redis, env.instanceId);
const connectionManager = new ConnectionManager();
const backendApiClient = createBackendApiClient({ env, state: runtimeState });
const metricsService = createMetricsService({ enabled: env.enableMetrics });

const wss = new WebSocketServer({
  server,
  verifyClient: createVerifyClient(env),
});

const services = {};
services.broadcast = createBroadcastService({
  wss,
  connectionManager,
  subscriptionsState,
  debugIngest,
});
services.driver = createDriverService({
  driverStore,
  state: runtimeState,
  pubsubManager,
  metricsService,
  broadcastService: services.broadcast,
});
services.ride = createRideService({
  state: runtimeState,
  broadcastService: services.broadcast,
});
services.subscription = createSubscriptionService({
  subscriptionsState,
  connectionManager,
  broadcastService: services.broadcast,
  backendApiClient,
});
services.metrics = metricsService;

const messageRouter = createMessageRouter({
  state: runtimeState,
  connectionManager,
  driverStore,
  services,
  debugIngest,
});

wss.on(
  "connection",
  createConnectionHandler({
    env,
    state: runtimeState,
    connectionManager,
    driverStore,
    services,
    backendApiClient,
    messageRouter,
    debugIngest,
  })
);
wss.on("listening", () =>
  console.log(`✅ WebSocket server ready on port ${env.port}`)
);
wss.on("error", (error) => console.error("WebSocket server error:", error));

pubsubManager.setMessageHandler((_, data) => {
  if (data.type === "locationUpdate") {
    services.driver
      .updateDriverLocationAndBroadcast(data.driverId, data.locationData)
      .catch((error) =>
        console.error("Error processing Pub/Sub location update:", error)
      );
  } else if (data.type === "statusChange" && data.status === "inactive") {
    services.driver.removeDriver(data.driverId).catch((error) => {
      console.error("Error processing Pub/Sub status update:", error);
    });
  }
});

if (env.enableRedis && redis) {
  pubsubManager
    .initialize()
    .catch((error) => console.error("Error initializing Pub/Sub:", error));
}

const httpController = createHttpBridgeController({
  env,
  redis,
  driverStore,
  connectionManager,
  wss,
  state: runtimeState,
  services,
});
app.use("/api", createHttpRoutes(httpController));

const stopRuntimeJobs = registerRuntimeJobs({
  wss,
  services,
  driverStore,
  env,
});

server
  .listen(env.port, async () => {
    console.log(`🚀 Server started on port ${env.port}`);
    console.log(`✅ HTTP API server is running`);
    console.log(`✅ WebSocket server is ready`);
    console.log(`\n📡 Connect WebSocket to: ws://localhost:${env.port}?role=admin`);
    console.log(`🌐 HTTP API available at: http://localhost:${env.port}/api\n`);

    try {
      const loadedDrivers = await services.driver.loadDriversOnStartup();
      console.log(
        `✅ Loaded ${Object.keys(loadedDrivers).length} drivers from Redis/store on startup`
      );
    } catch (error) {
      console.error("❌ Error loading drivers on startup:", error);
    }
  })
  .on("error", (error) => {
    if (error.code === "EADDRINUSE") {
      console.error(`❌ Port ${env.port} is already in use!`);
      process.exit(1);
    }
    throw error;
  });

process.on("SIGINT", async () => {
  stopRuntimeJobs();
  await pubsubManager.close().catch(() => {});
  if (redis) {
    await redis.quit().catch(() => {});
  }
  process.exit(0);
});
