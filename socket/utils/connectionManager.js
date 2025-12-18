/**
 * Connection manager for WebSocket connections
 * Tracks connections by type and metadata for better management
 */

class ConnectionManager {
  constructor() {
    this.connections = new Map();
    this.driverConnections = new Map(); // driverId -> connectionId
    this.adminConnections = new Set();
    this.userConnections = new Map(); // userId -> connectionId
  }

  /**
   * Generate unique connection ID
   */
  generateId() {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Add connection
   */
  addConnection(ws, type, metadata = {}) {
    const id = this.generateId();
    this.connections.set(id, {
      id,
      ws,
      type,
      metadata,
      connectedAt: Date.now(),
    });

    if (type === "driver" && metadata.driverId) {
      this.driverConnections.set(metadata.driverId, id);
    } else if (type === "admin") {
      this.adminConnections.add(id);
    } else if (type === "user" && metadata.userId) {
      this.userConnections.set(metadata.userId, id);
    }

    return id;
  }

  /**
   * Remove connection
   */
  removeConnection(id) {
    const conn = this.connections.get(id);
    if (!conn) {
      return false;
    }

    if (conn.type === "driver" && conn.metadata.driverId) {
      this.driverConnections.delete(conn.metadata.driverId);
    } else if (conn.type === "admin") {
      this.adminConnections.delete(id);
    } else if (conn.type === "user" && conn.metadata.userId) {
      this.userConnections.delete(conn.metadata.userId);
    }

    this.connections.delete(id);
    return true;
  }

  /**
   * Get connection by ID
   */
  getConnection(id) {
    return this.connections.get(id);
  }

  /**
   * Get driver connection
   */
  getDriverConnection(driverId) {
    const connId = this.driverConnections.get(driverId);
    return connId ? this.connections.get(connId) : null;
  }

  /**
   * Get user connection
   */
  getUserConnection(userId) {
    const connId = this.userConnections.get(userId);
    return connId ? this.connections.get(connId) : null;
  }

  /**
   * Broadcast to all connections of a type
   */
  broadcastToType(type, data) {
    let count = 0;
    this.connections.forEach((conn) => {
      if (conn.type === type && conn.ws.readyState === 1) {
        try {
          conn.ws.send(JSON.stringify(data));
          count++;
        } catch (error) {
          console.error(`Error sending to ${type} connection:`, error);
        }
      }
    });
    return count;
  }

  /**
   * Broadcast to all admin connections
   */
  broadcastToAdmins(data) {
    return this.broadcastToType("admin", data);
  }

  /**
   * Get connection metrics
   */
  getMetrics() {
    return {
      total: this.connections.size,
      drivers: this.driverConnections.size,
      admins: this.adminConnections.size,
      users: this.userConnections.size,
      byType: {
        driver: Array.from(this.connections.values()).filter(
          (c) => c.type === "driver"
        ).length,
        admin: Array.from(this.connections.values()).filter(
          (c) => c.type === "admin"
        ).length,
        user: Array.from(this.connections.values()).filter(
          (c) => c.type === "user"
        ).length,
      },
    };
  }

  /**
   * Clean up dead connections
   */
  cleanupDeadConnections() {
    const deadConnections = [];
    this.connections.forEach((conn, id) => {
      if (conn.ws.readyState !== 1 && conn.ws.readyState !== 0) {
        // Not OPEN or CONNECTING
        deadConnections.push(id);
      }
    });

    deadConnections.forEach((id) => {
      this.removeConnection(id);
    });

    return deadConnections.length;
  }

  /**
   * Get all connections
   */
  getAllConnections() {
    return Array.from(this.connections.values());
  }
}

module.exports = ConnectionManager;
