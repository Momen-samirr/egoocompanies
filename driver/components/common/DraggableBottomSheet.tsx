import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  PanResponder,
  PanResponderGestureState,
  PanResponderInstance,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from "react-native";

interface DraggableBottomSheetProps {
  collapsedHeight: number;
  expandedHeight: number;
  initialState?: "collapsed" | "expanded";
  onDismiss?: () => void;
  children: React.ReactNode;
  sheetStyle?: StyleProp<ViewStyle>;
  contentContainerStyle?: StyleProp<ViewStyle>;
  showsVerticalScrollIndicator?: boolean;
}

const DRAG_THRESHOLD = 4;
const DISMISS_DRAG_DISTANCE = 90;

export default function DraggableBottomSheet({
  collapsedHeight,
  expandedHeight,
  initialState = "collapsed",
  onDismiss,
  children,
  sheetStyle,
  contentContainerStyle,
  showsVerticalScrollIndicator = false,
}: DraggableBottomSheetProps) {
  const safeExpandedHeight = Math.max(expandedHeight, collapsedHeight + 1);
  const collapsedTranslateY = safeExpandedHeight - collapsedHeight;
  const expandedTranslateY = 0;
  const initialTranslateY =
    initialState === "expanded" ? expandedTranslateY : collapsedTranslateY;

  const translateY = useRef(new Animated.Value(initialTranslateY)).current;
  const currentTranslateY = useRef(initialTranslateY);
  const dragStartTranslateY = useRef(initialTranslateY);
  const scrollOffsetY = useRef(0);
  const isExpandedRef = useRef(initialState === "expanded");

  const [scrollEnabled, setScrollEnabled] = useState(
    initialState === "expanded"
  );

  useEffect(() => {
    const listenerId = translateY.addListener(({ value }) => {
      currentTranslateY.current = value;
    });
    return () => {
      translateY.removeListener(listenerId);
    };
  }, [translateY]);

  const clampTranslateY = (value: number): number => {
    return Math.max(expandedTranslateY, Math.min(collapsedTranslateY, value));
  };

  const snapTo = (target: number, velocity = 0) => {
    Animated.spring(translateY, {
      toValue: target,
      velocity,
      tension: 90,
      friction: 14,
      useNativeDriver: true,
    }).start(() => {
      const expanded = target === expandedTranslateY;
      isExpandedRef.current = expanded;
      setScrollEnabled(expanded);
    });
  };

  const shouldCapturePan = (gestureState: PanResponderGestureState): boolean => {
    const absDx = Math.abs(gestureState.dx);
    const absDy = Math.abs(gestureState.dy);

    if (absDy < DRAG_THRESHOLD || absDy < absDx) {
      return false;
    }

    if (gestureState.dy < 0) {
      // Dragging up: allow when not fully expanded.
      return currentTranslateY.current > expandedTranslateY + 0.5;
    }

    // Dragging down:
    // If the sheet content is scrolled, let content scroll first.
    // When at top, sheet handles the drag.
    return scrollOffsetY.current <= 0.5;
  };

  const panResponder = useMemo<PanResponderInstance>(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gestureState) =>
          shouldCapturePan(gestureState),
        onMoveShouldSetPanResponderCapture: (_, gestureState) =>
          shouldCapturePan(gestureState),
        onPanResponderGrant: () => {
          dragStartTranslateY.current = currentTranslateY.current;
          setScrollEnabled(false);
        },
        onPanResponderMove: (_, gestureState) => {
          const nextValue = clampTranslateY(
            dragStartTranslateY.current + gestureState.dy
          );
          translateY.setValue(nextValue);
        },
        onPanResponderRelease: (_, gestureState) => {
          const projectedValue = clampTranslateY(
            currentTranslateY.current + gestureState.vy * 60
          );
          const midpoint = (collapsedTranslateY + expandedTranslateY) / 2;

          const shouldDismiss =
            !!onDismiss &&
            !isExpandedRef.current &&
            gestureState.dy > DISMISS_DRAG_DISTANCE;

          if (shouldDismiss) {
            onDismiss();
            snapTo(collapsedTranslateY, gestureState.vy);
            return;
          }

          if (gestureState.vy > 1.1) {
            snapTo(collapsedTranslateY, gestureState.vy);
            return;
          }

          if (gestureState.vy < -1.1) {
            snapTo(expandedTranslateY, gestureState.vy);
            return;
          }

          if (projectedValue <= midpoint) {
            snapTo(expandedTranslateY, gestureState.vy);
          } else {
            snapTo(collapsedTranslateY, gestureState.vy);
          }
        },
        onPanResponderTerminate: (_, gestureState) => {
          const midpoint = (collapsedTranslateY + expandedTranslateY) / 2;
          if (currentTranslateY.current <= midpoint || gestureState.vy < -0.3) {
            snapTo(expandedTranslateY, gestureState.vy);
          } else {
            snapTo(collapsedTranslateY, gestureState.vy);
          }
        },
      }),
    [collapsedTranslateY, expandedTranslateY, onDismiss]
  );

  return (
    <Animated.View
      style={[
        styles.sheet,
        { height: safeExpandedHeight, transform: [{ translateY }] },
        sheetStyle,
      ]}
      {...panResponder.panHandlers}
    >
      <View style={styles.handleContainer}>
        <View style={styles.handle} />
      </View>
      <Animated.ScrollView
        scrollEnabled={scrollEnabled}
        nestedScrollEnabled
        bounces={scrollEnabled}
        overScrollMode={scrollEnabled ? "always" : "never"}
        showsVerticalScrollIndicator={showsVerticalScrollIndicator}
        onScroll={(event) => {
          scrollOffsetY.current = event.nativeEvent.contentOffset.y;
        }}
        scrollEventThrottle={16}
        contentContainerStyle={contentContainerStyle}
      >
        {children}
      </Animated.ScrollView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: 34,
    borderTopRightRadius: 34,
    overflow: "hidden",
  },
  handleContainer: {
    alignItems: "center",
    paddingTop: 12,
    paddingBottom: 8,
  },
  handle: {
    width: 56,
    height: 6,
    borderRadius: 999,
    backgroundColor: "#E4E7ED",
  },
});
