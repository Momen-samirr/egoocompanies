/**
 * Redis Pub/Sub manager for multi-instance communication
 * Allows multiple socket server instances to share driver location updates
 */

class PubSubManager {
  constructor(redis, instanceId) {
    this.redis = redis;
    this.instanceId = instanceId || `instance-${Date.now()}`;
    this.subscriber = null;
    this.publisher = null;
    this.enabled = redis !== null;
    this.channels = {
      DRIVER_LOCATION_UPDATES: "driver-location-updates",
      DRIVER_STATUS_CHANGES: "driver-status-changes",
    };
  }

  /**
   * Initialize Pub/Sub connections
   */
  async initialize() {
    if (!this.enabled || !this.redis) {
      console.log("⚠️ Pub/Sub disabled - Redis not available");
      return;
    }

    try {
      // Create separate connections for pub/sub
      this.subscriber = this.redis.duplicate();
      this.publisher = this.redis.duplicate();

      // Set up subscriber
      this.subscriber.on("message", (channel, message) => {
        this.handleMessage(channel, message);
      });

      this.subscriber.on("error", (error) => {
        console.error("❌ Pub/Sub subscriber error:", error);
      });

      this.publisher.on("error", (error) => {
        console.error("❌ Pub/Sub publisher error:", error);
      });

      // Subscribe to channels
      await this.subscriber.subscribe(this.channels.DRIVER_LOCATION_UPDATES);
      await this.subscriber.subscribe(this.channels.DRIVER_STATUS_CHANGES);

      console.log(`✅ Pub/Sub initialized for instance ${this.instanceId}`);
    } catch (error) {
      console.error("❌ Error initializing Pub/Sub:", error);
      this.enabled = false;
    }
  }

  /**
   * Handle incoming Pub/Sub messages
   */
  handleMessage(channel, message) {
    try {
      const data = JSON.parse(message);

      // Ignore messages from this instance
      if (data.instanceId === this.instanceId) {
        return;
      }

      console.log(
        `📨 [Pub/Sub] Received message on channel ${channel} from instance ${data.instanceId}`
      );

      // Emit event for handlers to process
      if (this.onMessage) {
        this.onMessage(channel, data);
      }
    } catch (error) {
      console.error("❌ Error handling Pub/Sub message:", error);
    }
  }

  /**
   * Publish driver location update to other instances
   */
  async publishLocationUpdate(driverId, locationData) {
    if (!this.enabled || !this.publisher) {
      return;
    }

    try {
      const message = JSON.stringify({
        instanceId: this.instanceId,
        type: "locationUpdate",
        driverId,
        locationData,
        timestamp: new Date().toISOString(),
      });

      await this.publisher.publish(
        this.channels.DRIVER_LOCATION_UPDATES,
        message
      );
      console.log(
        `📤 [Pub/Sub] Published location update for driver ${driverId}`
      );
    } catch (error) {
      console.error("❌ Error publishing location update:", error);
    }
  }

  /**
   * Publish driver status change to other instances
   */
  async publishStatusChange(driverId, status) {
    if (!this.enabled || !this.publisher) {
      return;
    }

    try {
      const message = JSON.stringify({
        instanceId: this.instanceId,
        type: "statusChange",
        driverId,
        status,
        timestamp: new Date().toISOString(),
      });

      await this.publisher.publish(
        this.channels.DRIVER_STATUS_CHANGES,
        message
      );
      console.log(
        `📤 [Pub/Sub] Published status change for driver ${driverId}: ${status}`
      );
    } catch (error) {
      console.error("❌ Error publishing status change:", error);
    }
  }

  /**
   * Set message handler
   */
  setMessageHandler(handler) {
    this.onMessage = handler;
  }

  /**
   * Close Pub/Sub connections
   */
  async close() {
    if (this.subscriber) {
      await this.subscriber.unsubscribe();
      await this.subscriber.quit();
    }
    if (this.publisher) {
      await this.publisher.quit();
    }
    console.log("✅ Pub/Sub connections closed");
  }
}

module.exports = PubSubManager;
