import React, { Component, ErrorInfo, ReactNode } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from "react-native";
import { errorTracker } from "@/lib/errorTracking";
import { spacing } from "@/styles/design-system";
import { fontSizes } from "@/themes/app.constant";
import fonts from "@/themes/app.fonts";
import color from "@/themes/app.colors";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  screenName?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

/**
 * Error Boundary component to catch and display React errors
 * Prevents the entire app from crashing when a component throws an error
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Log error to tracking service
    errorTracker.logError(error, {
      screen: this.props.screenName || "Unknown",
      action: "component_error",
      additionalData: {
        componentStack: errorInfo.componentStack,
      },
    });

    this.setState({
      error,
      errorInfo,
    });

    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  handleReset = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default error UI
      return (
        <View style={styles.container}>
          <ScrollView contentContainerStyle={styles.scrollContent}>
            <View style={styles.errorContainer}>
              <Text style={styles.emoji}>😕</Text>
              <Text style={styles.title}>Something went wrong</Text>
              <Text style={styles.message}>
                We're sorry, but something unexpected happened. Please try again.
              </Text>

              {__DEV__ && this.state.error && (
                <View style={styles.debugContainer}>
                  <Text style={styles.debugTitle}>Error Details (Dev Only):</Text>
                  <Text style={styles.debugText}>{this.state.error.toString()}</Text>
                  {this.state.errorInfo && (
                    <Text style={styles.debugText}>
                      {this.state.errorInfo.componentStack}
                    </Text>
                  )}
                </View>
              )}

              <TouchableOpacity
                style={styles.button}
                onPress={this.handleReset}
                activeOpacity={0.7}
              >
                <Text style={styles.buttonText}>Try Again</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.lg,
  },
  errorContainer: {
    alignItems: "center",
    maxWidth: 400,
  },
  emoji: {
    fontSize: 64,
    marginBottom: spacing.md,
  },
  title: {
    fontSize: fontSizes.FONT24,
    fontFamily: fonts.bold,
    fontWeight: "600",
    color: color.text.primary,
    marginBottom: spacing.sm,
    textAlign: "center",
  },
  message: {
    fontSize: fontSizes.FONT16,
    fontFamily: fonts.regular,
    color: color.text.secondary,
    textAlign: "center",
    marginBottom: spacing.lg,
    lineHeight: 24,
  },
  debugContainer: {
    width: "100%",
    backgroundColor: color.lightGray,
    padding: spacing.md,
    borderRadius: 8,
    marginBottom: spacing.lg,
  },
  debugTitle: {
    fontSize: fontSizes.FONT14,
    fontFamily: fonts.bold,
    color: color.text.primary,
    marginBottom: spacing.xs,
  },
  debugText: {
    fontSize: fontSizes.FONT12,
    fontFamily: fonts.regular,
    color: color.text.secondary,
    fontFamily: "monospace",
  },
  button: {
    backgroundColor: color.primary,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: 8,
    minWidth: 150,
  },
  buttonText: {
    fontSize: fontSizes.FONT16,
    fontFamily: fonts.bold,
    color: "#fff",
    textAlign: "center",
  },
});

