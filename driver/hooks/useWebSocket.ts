import { useEffect, useRef, useState, useCallback } from "react";
import { getWebSocketUrl } from "@/configs/constants";
import { logger } from "@/lib/logger";

export interface WebSocketMessage {
  type: string;
  data?: any;
  role?: string;
  driver?: string;
  [key: string]: any;
}

export interface UseWebSocketOptions {
  onMessage?: (message: WebSocketMessage) => void;
  onOpen?: () => void;
  onClose?: () => void;
  onError?: (error: Event) => void;
  autoReconnect?: boolean;
  maxReconnectAttempts?: number;
  reconnectDelay?: number;
}

export interface UseWebSocketReturn {
  ws: React.MutableRefObject<WebSocket | null>;
  connected: boolean;
  sendMessage: (message: WebSocketMessage) => boolean;
  reconnect: () => void;
  disconnect: () => void;
  queueSize: number;
}

/**
 * Custom hook for WebSocket connection management
 * Handles connection, reconnection, and message sending
 */
export function useWebSocket(
  options: UseWebSocketOptions = {}
): UseWebSocketReturn {
  const {
    onMessage,
    onOpen,
    onClose,
    onError,
    autoReconnect = true,
    maxReconnectAttempts = 10,
    reconnectDelay = 3000,
  } = options;

  const ws = useRef<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const isManualDisconnectRef = useRef(false);
  const messageQueueRef = useRef<WebSocketMessage[]>([]);
  const pingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastPongRef = useRef<number>(Date.now());
  const healthCheckInterval = 30000; // 30 seconds

  // Calculate exponential backoff delay
  const getReconnectDelay = useCallback(
    (attempt: number): number => {
      const baseDelay = reconnectDelay;
      const maxDelay = 60000; // Max 60 seconds
      const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
      return delay;
    },
    [reconnectDelay]
  );

  // Send ping to check connection health
  const sendPing = useCallback(() => {
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      try {
        ws.current.send(
          JSON.stringify({ type: "ping", timestamp: Date.now() })
        );
        logger.debug("WebSocket ping sent");
      } catch (error) {
        logger.error("Error sending WebSocket ping", error);
      }
    }
  }, []);

  // Start health check pings
  const startHealthCheck = useCallback(() => {
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
    }

    pingIntervalRef.current = setInterval(() => {
      const timeSinceLastPong = Date.now() - lastPongRef.current;

      // If no pong received in 60 seconds, consider connection dead
      if (timeSinceLastPong > 60000) {
        logger.warn(
          "WebSocket health check failed - no pong received, reconnecting"
        );
        if (ws.current) {
          ws.current.close();
        }
        return;
      }

      sendPing();
    }, healthCheckInterval);
  }, [sendPing]);

  // Stop health check
  const stopHealthCheck = useCallback(() => {
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = null;
    }
  }, []);

  // Process queued messages
  const processMessageQueue = useCallback(() => {
    if (!ws.current || ws.current.readyState !== WebSocket.OPEN) {
      return;
    }

    while (messageQueueRef.current.length > 0) {
      const message = messageQueueRef.current.shift();
      if (message) {
        try {
          const messageString = JSON.stringify(message);
          ws.current.send(messageString);
          logger.debug("Queued message sent", { type: message.type });
        } catch (error) {
          logger.error("Error sending queued message", error);
          // Put message back at front of queue
          messageQueueRef.current.unshift(message);
          break;
        }
      }
    }
  }, []);

  const connectWebSocket = useCallback(() => {
    const wsUrl = getWebSocketUrl();
    logger.info(`Attempting to connect to WebSocket: ${wsUrl}`, {
      attempt: reconnectAttemptsRef.current + 1,
    });

    try {
      ws.current = new WebSocket(wsUrl);

      ws.current.onopen = () => {
        logger.info("Connected to WebSocket server successfully");
        setConnected(true);
        reconnectAttemptsRef.current = 0; // Reset reconnect attempts
        isManualDisconnectRef.current = false;
        lastPongRef.current = Date.now();

        // Start health check
        startHealthCheck();

        // Process queued messages
        processMessageQueue();

        if (onOpen) {
          onOpen();
        }
      };

      ws.current.onmessage = (e) => {
        try {
          if (typeof e.data === "string") {
            const message = JSON.parse(e.data);

            // Handle pong response
            if (message.type === "pong") {
              lastPongRef.current = Date.now();
              logger.debug("WebSocket pong received");
              return;
            }

            logger.debug("Received WebSocket message", { type: message.type });

            if (onMessage) {
              onMessage(message);
            }
          } else {
            // Binary data - likely a ping/pong frame
            logger.debug("Received ping/pong frame (binary)");
            lastPongRef.current = Date.now();
          }
        } catch (error) {
          logger.error("Error parsing WebSocket message", error);
        }
      };

      ws.current.onerror = (e: any) => {
        const errorMsg = e.message || "Unknown error";
        logger.error(`WebSocket error: ${errorMsg}`, e);
        setConnected(false);
        stopHealthCheck();

        if (onError) {
          onError(e);
        }
      };

      ws.current.onclose = (e) => {
        const wasClean = e.wasClean !== undefined ? e.wasClean : false;
        logger.info("WebSocket closed", {
          code: e.code,
          reason: e.reason || "No reason provided",
          wasClean,
        });
        setConnected(false);
        stopHealthCheck();

        if (onClose) {
          onClose();
        }

        // Handle code 1006 (abnormal closure) - expected when app goes to background
        if (e.code === 1006) {
          logger.info(
            "WebSocket disconnected with code 1006 (expected when app backgrounds) - will reconnect when app returns to foreground"
          );
          // Don't attempt to reconnect in background - wait for app to return to foreground
          return;
        }

        // Only reconnect if app is in foreground (active state)
        // Code 1006 is handled above and doesn't reconnect
        const AppState = require("react-native").AppState;
        const isAppActive = AppState.currentState === "active";

        // Attempt to reconnect if auto-reconnect is enabled, app is active, and not manually disconnected
        if (
          autoReconnect &&
          isAppActive &&
          !isManualDisconnectRef.current &&
          !wasClean &&
          e.code !== 1000 &&
          e.code !== 1001 &&
          e.code !== 1006 && // Don't reconnect for 1006 - handled above
          reconnectAttemptsRef.current < maxReconnectAttempts
        ) {
          reconnectAttemptsRef.current++;
          const delay = getReconnectDelay(reconnectAttemptsRef.current - 1);

          logger.info(`Will attempt to reconnect in ${delay / 1000} seconds`, {
            attempt: reconnectAttemptsRef.current,
            maxAttempts: maxReconnectAttempts,
            delay,
          });

          reconnectTimeoutRef.current = setTimeout(() => {
            logger.debug(
              `Attempting reconnection ${reconnectAttemptsRef.current}/${maxReconnectAttempts}`
            );
            connectWebSocket();
          }, delay);
        } else if (reconnectAttemptsRef.current >= maxReconnectAttempts) {
          logger.error(
            `Max reconnection attempts (${maxReconnectAttempts}) reached. Please check WebSocket server.`
          );
        } else if (wasClean) {
          logger.info(
            `Connection closed cleanly (code ${e.code}). Not reconnecting.`
          );
        }
      };
    } catch (error: any) {
      logger.error("Failed to create WebSocket", error);
      setConnected(false);

      // Retry connection with exponential backoff
      if (
        autoReconnect &&
        reconnectAttemptsRef.current < maxReconnectAttempts
      ) {
        reconnectAttemptsRef.current++;
        const delay = getReconnectDelay(reconnectAttemptsRef.current - 1);
        reconnectTimeoutRef.current = setTimeout(() => {
          connectWebSocket();
        }, delay);
      }
    }
  }, [
    onMessage,
    onOpen,
    onClose,
    onError,
    autoReconnect,
    maxReconnectAttempts,
    getReconnectDelay,
    startHealthCheck,
    processMessageQueue,
  ]);

  const sendMessage = useCallback((message: WebSocketMessage): boolean => {
    if (!ws.current || ws.current.readyState !== WebSocket.OPEN) {
      // Queue message for later if offline
      logger.debug("WebSocket not connected - queueing message", {
        type: message.type,
      });
      messageQueueRef.current.push(message);

      // Limit queue size
      if (messageQueueRef.current.length > 100) {
        messageQueueRef.current.shift(); // Remove oldest message
      }

      return false;
    }

    try {
      const messageString = JSON.stringify(message);
      ws.current.send(messageString);
      logger.debug("WebSocket message sent", { type: message.type });
      return true;
    } catch (error) {
      logger.error("Error sending WebSocket message", error);
      // Queue message for retry
      messageQueueRef.current.push(message);
      return false;
    }
  }, []);

  const reconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    reconnectAttemptsRef.current = 0;
    isManualDisconnectRef.current = false;

    if (ws.current) {
      ws.current.close();
      ws.current = null;
    }

    connectWebSocket();
  }, [connectWebSocket]);

  const disconnect = useCallback(() => {
    isManualDisconnectRef.current = true;
    stopHealthCheck();

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (ws.current) {
      logger.debug("Manually disconnecting WebSocket");
      ws.current.close();
      ws.current = null;
    }

    setConnected(false);
  }, [stopHealthCheck]);

  // Initial connection
  useEffect(() => {
    connectWebSocket();

    return () => {
      stopHealthCheck();
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (ws.current) {
        logger.debug("Cleaning up WebSocket connection");
        disconnect();
      }
    };
  }, [connectWebSocket, disconnect, stopHealthCheck]);

  return {
    ws,
    connected,
    sendMessage,
    reconnect,
    disconnect,
    queueSize: messageQueueRef.current.length,
  };
}
