import { useEffect, useRef, useState, useCallback } from "react";
import { getWebSocketUrl } from "@/configs/constants";

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
}

/**
 * Custom hook for WebSocket connection management
 * Handles connection, reconnection, and message sending
 */
export function useWebSocket(options: UseWebSocketOptions = {}): UseWebSocketReturn {
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

  const connectWebSocket = useCallback(() => {
    const wsUrl = getWebSocketUrl();
    console.log(
      `🔌 Attempting to connect to WebSocket: ${wsUrl} (Attempt ${reconnectAttemptsRef.current + 1})`
    );

    try {
      ws.current = new WebSocket(wsUrl);

      ws.current.onopen = () => {
        console.log("✅ Connected to WebSocket server successfully");
        setConnected(true);
        reconnectAttemptsRef.current = 0; // Reset reconnect attempts
        isManualDisconnectRef.current = false;

        if (onOpen) {
          onOpen();
        }
      };

      ws.current.onmessage = (e) => {
        try {
          if (typeof e.data === "string") {
            const message = JSON.parse(e.data);
            console.log("📨 Received WebSocket message:", message);

            if (onMessage) {
              onMessage(message);
            }
          } else {
            // Binary data - likely a ping/pong frame
            console.log("🏓 Received ping/pong frame");
          }
        } catch (error) {
          console.error("❌ Error parsing WebSocket message:", error);
        }
      };

      ws.current.onerror = (e: any) => {
        const errorMsg = e.message || "Unknown error";
        console.error(`❌ WebSocket error: ${errorMsg}`);
        setConnected(false);

        if (onError) {
          onError(e);
        }
      };

      ws.current.onclose = (e) => {
        const wasClean = e.wasClean !== undefined ? e.wasClean : false;
        console.log(
          `🔌 WebSocket closed: code=${e.code}, reason="${e.reason || "No reason provided"}", wasClean=${wasClean}`
        );
        setConnected(false);

        if (onClose) {
          onClose();
        }

        // Attempt to reconnect if auto-reconnect is enabled and not manually disconnected
        if (
          autoReconnect &&
          !isManualDisconnectRef.current &&
          !wasClean &&
          e.code !== 1000 &&
          e.code !== 1001 &&
          reconnectAttemptsRef.current < maxReconnectAttempts
        ) {
          reconnectAttemptsRef.current++;
          console.log(
            `🔄 Will attempt to reconnect in ${reconnectDelay / 1000} seconds... (${reconnectAttemptsRef.current}/${maxReconnectAttempts})`
          );

          reconnectTimeoutRef.current = setTimeout(() => {
            console.log(
              `🔄 Attempting reconnection ${reconnectAttemptsRef.current}/${maxReconnectAttempts}...`
            );
            connectWebSocket();
          }, reconnectDelay);
        } else if (reconnectAttemptsRef.current >= maxReconnectAttempts) {
          console.error(
            `❌ Max reconnection attempts (${maxReconnectAttempts}) reached. Please check WebSocket server.`
          );
        } else if (wasClean) {
          console.log(`ℹ️ Connection closed cleanly (code ${e.code}). Not reconnecting.`);
        }
      };
    } catch (error: any) {
      console.error("❌ Failed to create WebSocket:", error);
      setConnected(false);

      // Retry connection
      if (autoReconnect && reconnectAttemptsRef.current < maxReconnectAttempts) {
        reconnectAttemptsRef.current++;
        reconnectTimeoutRef.current = setTimeout(() => {
          connectWebSocket();
        }, reconnectDelay);
      }
    }
  }, [onMessage, onOpen, onClose, onError, autoReconnect, maxReconnectAttempts, reconnectDelay]);

  const sendMessage = useCallback(
    (message: WebSocketMessage): boolean => {
      if (!ws.current || ws.current.readyState !== WebSocket.OPEN) {
        console.warn("⚠️ WebSocket not connected - cannot send message");
        return false;
      }

      try {
        const messageString = JSON.stringify(message);
        ws.current.send(messageString);
        console.log("✅ WebSocket message sent:", message);
        return true;
      } catch (error) {
        console.error("❌ Error sending WebSocket message:", error);
        return false;
      }
    },
    []
  );

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

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (ws.current) {
      console.log("🧹 Manually disconnecting WebSocket");
      ws.current.close();
      ws.current = null;
    }

    setConnected(false);
  }, []);

  // Initial connection
  useEffect(() => {
    connectWebSocket();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (ws.current) {
        console.log("🧹 Cleaning up WebSocket connection");
        disconnect();
      }
    };
  }, [connectWebSocket, disconnect]);

  return {
    ws,
    connected,
    sendMessage,
    reconnect,
    disconnect,
  };
}

