import { useEffect, useRef } from "react";
import * as KeepAwake from "expo-keep-awake";
import { logger } from "@/lib/logger";

/**
 * Custom hook to prevent screen from sleeping
 *
 * @param shouldKeepAwake - Boolean to control whether to keep screen awake
 *
 * @example
 * ```tsx
 * const shouldKeepAwake = orderStatus === "Processing" || orderStatus === "Ongoing";
 * useKeepAwake(shouldKeepAwake);
 * ```
 */
export function useKeepAwake(shouldKeepAwake: boolean): void {
  const isActiveRef = useRef(false);

  useEffect(() => {
    // Only activate/deactivate if state actually changed
    if (shouldKeepAwake && !isActiveRef.current) {
      try {
        KeepAwake.activateKeepAwake();
        isActiveRef.current = true;
        logger.info("Keep-awake activated - screen will not lock during trip");
      } catch (error: any) {
        logger.warn("Failed to activate keep-awake", {
          error: error.message || String(error),
        });
        // Don't throw - allow app to continue even if keep-awake fails
      }
    } else if (!shouldKeepAwake && isActiveRef.current) {
      try {
        KeepAwake.deactivateKeepAwake();
        isActiveRef.current = false;
        logger.info("Keep-awake deactivated - screen can now lock normally");
      } catch (error: any) {
        logger.warn("Failed to deactivate keep-awake", {
          error: error.message || String(error),
        });
        // Don't throw - allow app to continue
      }
    }

    // Cleanup: Always deactivate on unmount
    return () => {
      if (isActiveRef.current) {
        try {
          KeepAwake.deactivateKeepAwake();
          isActiveRef.current = false;
          logger.debug("Keep-awake deactivated on unmount");
        } catch (error: any) {
          logger.warn("Error deactivating keep-awake on unmount", {
            error: error.message || String(error),
          });
        }
      }
    };
  }, [shouldKeepAwake]);
}
