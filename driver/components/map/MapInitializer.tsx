import React, { useState, useEffect } from "react";
import { View, StyleSheet, ActivityIndicator, Text } from "react-native";
import { useTheme } from "@react-navigation/native";
import MapView, { MapViewProps } from "react-native-maps";
import { runMapDiagnostics, logMapDiagnostics } from "@/utils/mapDiagnostics";
import GooglePlayServicesCheck from "./GooglePlayServicesCheck";
import MapErrorBoundary from "./MapErrorBoundary";
import color from "@/themes/app.colors";
import { spacing } from "@/styles/design-system";
import fonts from "@/themes/app.fonts";
import { fontSizes } from "@/themes/app.constant";

interface MapInitializerProps extends MapViewProps {
  children?: React.ReactNode;
  showDiagnostics?: boolean;
}

/**
 * Wrapper component for MapView that handles initialization, error checking, and fallback UI
 */
export default function MapInitializer({
  children,
  showDiagnostics = false,
  ...mapViewProps
}: MapInitializerProps) {
  const { colors } = useTheme();
  const [isInitialized, setIsInitialized] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [diagnostics, setDiagnostics] = useState<any>(null);

  useEffect(() => {
    const initializeMap = async () => {
      try {
        const diag = await runMapDiagnostics();
        setDiagnostics(diag);
        
        if (showDiagnostics) {
          logMapDiagnostics(diag);
        }

        if (diag.errors.length > 0) {
          setErrorMessage(diag.errors.join(", "));
          setHasError(true);
        } else {
          setIsInitialized(true);
        }
      } catch (error: any) {
        console.error("Error initializing map:", error);
        setErrorMessage(error.message || "Failed to initialize map");
        setHasError(true);
      }
    };

    initializeMap();
  }, [showDiagnostics]);

  const handleMapReady = () => {
    console.log("✅ Map initialized and ready");
    setIsInitialized(true);
    setHasError(false);
    
    if (mapViewProps.onMapReady) {
      mapViewProps.onMapReady();
    }
  };

  const handleMapError = (error: any) => {
    console.error("❌ Map error in MapInitializer:", error);
    setHasError(true);
    setErrorMessage(error.message || "Map error occurred");
    
    if (mapViewProps.onError) {
      mapViewProps.onError(error);
    }
  };

  const handleMapLoadFailure = (error: any) => {
    console.error("❌ Map failed to load in MapInitializer:", error);
    setHasError(true);
    setErrorMessage(`Failed to load map: ${error.message || "Unknown error"}`);
    
    if (mapViewProps.onDidFailLoadingMap) {
      mapViewProps.onDidFailLoadingMap(error);
    }
  };

  if (hasError && errorMessage) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.errorContainer, { backgroundColor: colors.card }]}>
          <Text style={[styles.errorIcon]}>🗺️</Text>
          <Text style={[styles.errorTitle, { color: colors.text }]}>
            Map Unavailable
          </Text>
          <Text style={[styles.errorMessage, { color: colors.text }]}>
            {errorMessage}
          </Text>
          <GooglePlayServicesCheck showWarning={true} />
        </View>
      </View>
    );
  }

  return (
    <MapErrorBoundary>
      <View style={styles.container}>
        <GooglePlayServicesCheck showWarning={true} />
        
        {!isInitialized && (
          <View style={[styles.loadingOverlay, { backgroundColor: colors.background }]}>
            <ActivityIndicator size="large" color={color.primary} />
            <Text style={[styles.loadingText, { color: colors.text }]}>
              Initializing map...
            </Text>
          </View>
        )}

        <MapView
          {...mapViewProps}
          onMapReady={handleMapReady}
          onError={handleMapError}
          onDidFailLoadingMap={handleMapLoadFailure}
        >
          {children}
        </MapView>
      </View>
    </MapErrorBoundary>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    position: "relative",
  },
  loadingOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1000,
    backgroundColor: "rgba(255, 255, 255, 0.9)",
  },
  loadingText: {
    marginTop: spacing.md,
    fontSize: fontSizes.FONT14,
    fontFamily: fonts.regular,
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.xl,
  },
  errorIcon: {
    fontSize: 48,
    marginBottom: spacing.md,
  },
  errorTitle: {
    fontSize: fontSizes.FONT20,
    fontFamily: fonts.bold,
    marginBottom: spacing.sm,
    textAlign: "center",
  },
  errorMessage: {
    fontSize: fontSizes.FONT14,
    fontFamily: fonts.regular,
    marginBottom: spacing.lg,
    textAlign: "center",
    lineHeight: 20,
  },
});

