import React, { Component, ErrorInfo, ReactNode } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useTheme } from "@react-navigation/native";
import color from "@/themes/app.colors";
import { spacing } from "@/styles/design-system";
import fonts from "@/themes/app.fonts";
import { fontSizes } from "@/themes/app.constant";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

/**
 * Error boundary component specifically for map-related errors
 * Catches JavaScript errors in map components and displays a fallback UI
 */
export default class MapErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("🗺️ MapErrorBoundary caught an error:", error);
    console.error("🗺️ Error info:", errorInfo);
    
    this.setState({
      error,
      errorInfo,
    });

    // Call optional error handler
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  handleRetry = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render() {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default error UI
      return <MapErrorFallback error={this.state.error} onRetry={this.handleRetry} />;
    }

    return this.props.children;
  }
}

/**
 * Default fallback UI for map errors
 */
function MapErrorFallback({ 
  error, 
  onRetry 
}: { 
  error: Error | null; 
  onRetry: () => void;
}) {
  const { colors } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.errorCard, { backgroundColor: colors.card }]}>
        <Text style={[styles.errorIcon]}>🗺️</Text>
        <Text style={[styles.errorTitle, { color: colors.text }]}>
          Map Failed to Load
        </Text>
        <Text style={[styles.errorMessage, { color: colors.text }]}>
          {error?.message || "An unexpected error occurred while loading the map."}
        </Text>
        
        <View style={styles.suggestionsContainer}>
          <Text style={[styles.suggestionsTitle, { color: colors.text }]}>
            Possible solutions:
          </Text>
          <Text style={[styles.suggestion, { color: colors.text }]}>
            • Check your internet connection
          </Text>
          <Text style={[styles.suggestion, { color: colors.text }]}>
            • Ensure location permissions are granted
          </Text>
          <Text style={[styles.suggestion, { color: colors.text }]}>
            • Update Google Play Services (Android)
          </Text>
          <Text style={[styles.suggestion, { color: colors.text }]}>
            • Restart the app
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.retryButton, { backgroundColor: color.primary }]}
          onPress={onRetry}
          activeOpacity={0.7}
        >
          <Text style={styles.retryButtonText}>Try Again</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.lg,
  },
  errorCard: {
    borderRadius: 12,
    padding: spacing.xl,
    width: "100%",
    maxWidth: 400,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
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
  suggestionsContainer: {
    width: "100%",
    marginBottom: spacing.lg,
    padding: spacing.md,
    backgroundColor: "rgba(0, 0, 0, 0.05)",
    borderRadius: 8,
  },
  suggestionsTitle: {
    fontSize: fontSizes.FONT14,
    fontFamily: fonts.bold,
    marginBottom: spacing.sm,
  },
  suggestion: {
    fontSize: fontSizes.FONT12,
    fontFamily: fonts.regular,
    marginBottom: spacing.xs,
    lineHeight: 18,
  },
  retryButton: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: 8,
    minWidth: 120,
  },
  retryButtonText: {
    color: "white",
    fontSize: fontSizes.FONT16,
    fontFamily: fonts.bold,
    textAlign: "center",
  },
});

