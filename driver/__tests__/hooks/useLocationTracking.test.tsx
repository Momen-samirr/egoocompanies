/**
 * Integration tests for useLocationTracking hook
 */

import { renderHook, waitFor } from "@testing-library/react-native";
import { useLocationTracking } from "@/hooks/useLocationTracking";
import * as Location from "expo-location";

// Mock expo-location
jest.mock("expo-location", () => ({
  requestForegroundPermissionsAsync: jest.fn(),
  requestBackgroundPermissionsAsync: jest.fn(),
  watchPositionAsync: jest.fn(),
  Accuracy: {
    High: "high",
    Balanced: "balanced",
  },
}));

describe("useLocationTracking", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("should start tracking when isActive is true", async () => {
    (Location.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValue({
      status: "granted",
    });
    (Location.requestBackgroundPermissionsAsync as jest.Mock).mockResolvedValue({
      status: "granted",
    });
    (Location.watchPositionAsync as jest.Mock).mockResolvedValue({
      remove: jest.fn(),
    });

    const { result } = renderHook(() =>
      useLocationTracking({
        isActive: true,
      })
    );

    await waitFor(() => {
      expect(result.current.isTracking).toBe(true);
    });
  });

  test("should stop tracking when isActive is false", async () => {
    const mockRemove = jest.fn();
    (Location.watchPositionAsync as jest.Mock).mockResolvedValue({
      remove: mockRemove,
    });

    const { result, rerender } = renderHook(
      ({ isActive }) =>
        useLocationTracking({
          isActive,
        }),
      {
        initialProps: { isActive: true },
      }
    );

    await waitFor(() => {
      expect(result.current.isTracking).toBe(true);
    });

    rerender({ isActive: false });

    await waitFor(() => {
      expect(mockRemove).toHaveBeenCalled();
    });
  });
});

