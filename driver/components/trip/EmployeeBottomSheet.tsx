import React, { useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  PanResponder,
  Dimensions,
  ScrollView,
  Modal,
} from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import color from "@/themes/app.colors";
import fonts from "@/themes/app.fonts";
import {
  fontSizes,
  windowHeight,
  windowWidth,
  SCREEN_HEIGHT,
} from "@/themes/app.constant";
import { spacing, shadows, borderRadius, zIndex } from "@/styles/design-system";

const { height: SCREEN_HEIGHT_DIM } = Dimensions.get("window");

interface EmployeeBottomSheetProps {
  visible: boolean;
  onClose: () => void;
  checkpointName: string;
  employees: Array<{ name: string; employeeId?: string }>;
}

const SHEET_MAX_HEIGHT = SCREEN_HEIGHT_DIM * 0.75; // 75% of screen height
const SHEET_MIN_HEIGHT = SCREEN_HEIGHT_DIM * 0.5; // 50% of screen height
const DRAG_THRESHOLD = 50; // Minimum drag distance to trigger close
const VELOCITY_THRESHOLD = 0.5; // Minimum velocity to trigger close

export default function EmployeeBottomSheet({
  visible,
  onClose,
  checkpointName,
  employees,
}: EmployeeBottomSheetProps) {
  const insets = useSafeAreaInsets();
  // Always start off-screen - animation will bring it in
  const translateY = useSharedValue(SHEET_MAX_HEIGHT);
  const backdropOpacity = useSharedValue(0);
  const isDragging = useRef(false);
  const startY = useRef(0);

  useEffect(() => {
    console.log(
      "EmployeeBottomSheet - visible changed to:",
      visible,
      "employees:",
      employees?.length
    );
    if (visible) {
      // Animate sheet in - translateY = 0 brings it to bottom of screen
      translateY.value = withSpring(0, {
        damping: 20,
        stiffness: 300,
      });
      backdropOpacity.value = withTiming(1, { duration: 250 });
    } else {
      // Animate sheet out - translateY = SHEET_MAX_HEIGHT pushes it down off-screen
      translateY.value = withSpring(SHEET_MAX_HEIGHT, {
        damping: 20,
        stiffness: 300,
      });
      backdropOpacity.value = withTiming(0, { duration: 200 });
    }
  }, [visible]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        // Only respond to vertical gestures
        return (
          Math.abs(gestureState.dy) > Math.abs(gestureState.dx) &&
          Math.abs(gestureState.dy) > 5
        );
      },
      onPanResponderGrant: (_, gestureState) => {
        isDragging.current = true;
        startY.current = gestureState.moveY;
      },
      onPanResponderMove: (_, gestureState) => {
        if (!isDragging.current) return;

        // Get current position and calculate new position
        const currentTranslate = translateY.value;
        const deltaY = gestureState.dy;
        const newTranslate = currentTranslate + deltaY;

        // Only allow dragging down (closing direction)
        // Constrain: 0 (open) <= translateY <= SHEET_MAX_HEIGHT (closed)
        if (newTranslate >= 0 && newTranslate <= SHEET_MAX_HEIGHT) {
          translateY.value = newTranslate;
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        isDragging.current = false;

        const dragDistance = gestureState.moveY - startY.current;
        const velocity = gestureState.vy;

        // Close if dragged down enough or with sufficient downward velocity
        if (dragDistance > DRAG_THRESHOLD || velocity > VELOCITY_THRESHOLD) {
          runOnJS(onClose)();
        } else {
          // Snap back to open position
          translateY.value = withSpring(0, {
            damping: 20,
            stiffness: 300,
          });
        }
      },
    })
  ).current;

  const sheetAnimatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateY: translateY.value }],
    };
  });

  const backdropAnimatedStyle = useAnimatedStyle(() => {
    return {
      opacity: backdropOpacity.value,
    };
  });

  const handleBackdropPress = () => {
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.container} pointerEvents="box-none">
        {/* Backdrop */}
        <Animated.View
          style={[styles.backdrop, backdropAnimatedStyle]}
          pointerEvents={visible ? "auto" : "none"}
        >
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={handleBackdropPress}
          />
        </Animated.View>

        {/* Bottom Sheet */}
        <Animated.View
          style={[
            styles.sheet,
            sheetAnimatedStyle,
            { paddingBottom: insets.bottom },
          ]}
        >
          {/* Draggable Area (Handle + Header) */}
          <View {...panResponder.panHandlers}>
            {/* Drag Handle */}
            <View style={styles.dragHandleContainer}>
              <View style={styles.dragHandle} />
            </View>

            {/* Header */}
            <View style={styles.header}>
              <View style={styles.headerContent}>
                <View style={styles.headerLeft}>
                  <View style={styles.iconContainer}>
                    <Ionicons name="people" size={24} color={color.primary} />
                  </View>
                  <View style={styles.headerTextContainer}>
                    <Text style={styles.checkpointName} numberOfLines={1}>
                      {checkpointName}
                    </Text>
                    <Text style={styles.employeeCount}>
                      {employees.length} employee
                      {employees.length !== 1 ? "s" : ""}
                    </Text>
                  </View>
                </View>
                <TouchableOpacity
                  onPress={onClose}
                  style={styles.closeButton}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ionicons
                    name="close"
                    size={24}
                    color={color.text.secondary}
                  />
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* Content */}
          <ScrollView
            style={styles.content}
            contentContainerStyle={styles.contentContainer}
            showsVerticalScrollIndicator={false}
          >
            {employees && employees.length > 0 ? (
              employees.map((employee, index) => (
                <View
                  key={index}
                  style={[
                    styles.employeeCard,
                    index < employees.length - 1 &&
                      styles.employeeCardWithBorder,
                  ]}
                >
                  <View style={styles.employeeAvatar}>
                    <Text style={styles.employeeAvatarText}>
                      {employee.name.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View style={styles.employeeInfo}>
                    <Text style={styles.employeeName} numberOfLines={1}>
                      {employee.name}
                    </Text>
                    {employee.employeeId && (
                      <Text style={styles.employeeId} numberOfLines={1}>
                        ID: {employee.employeeId}
                      </Text>
                    )}
                  </View>
                </View>
              ))
            ) : (
              <View style={styles.emptyState}>
                <Text style={styles.emptyStateText}>No employees assigned</Text>
              </View>
            )}
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "flex-end",
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: color.background.modal,
    zIndex: zIndex.modalBackdrop,
  },
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: SHEET_MAX_HEIGHT,
    backgroundColor: color.background.card,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    ...shadows.xl,
    zIndex: zIndex.modal,
  },
  dragHandleContainer: {
    alignItems: "center",
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  dragHandle: {
    width: 40,
    height: 4,
    backgroundColor: color.border,
    borderRadius: 2,
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: color.border,
  },
  headerContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: `${color.primary}15`,
    justifyContent: "center",
    alignItems: "center",
    marginRight: spacing.md,
  },
  headerTextContainer: {
    flex: 1,
  },
  checkpointName: {
    fontSize: fontSizes.FONT18,
    fontFamily: fonts.bold,
    color: color.text.primary,
    marginBottom: spacing.xs / 2,
  },
  employeeCount: {
    fontSize: fontSizes.FONT13,
    fontFamily: fonts.medium,
    color: color.text.secondary,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: color.lightGray,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: spacing.lg,
    paddingTop: spacing.md,
  },
  employeeCard: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    backgroundColor: color.background.secondary,
    borderRadius: borderRadius.md,
    marginBottom: spacing.md,
  },
  employeeCardWithBorder: {
    marginBottom: spacing.md,
  },
  employeeAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: color.primary,
    justifyContent: "center",
    alignItems: "center",
    marginRight: spacing.md,
  },
  employeeAvatarText: {
    fontSize: fontSizes.FONT18,
    fontFamily: fonts.bold,
    color: color.whiteColor,
  },
  employeeInfo: {
    flex: 1,
  },
  employeeName: {
    fontSize: fontSizes.FONT16,
    fontFamily: fonts.bold,
    color: color.text.primary,
    marginBottom: spacing.xs / 2,
  },
  employeeId: {
    fontSize: fontSizes.FONT13,
    fontFamily: fonts.regular,
    color: color.text.secondary,
  },
  emptyState: {
    padding: spacing.xl,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyStateText: {
    fontSize: fontSizes.FONT14,
    fontFamily: fonts.medium,
    color: color.text.secondary,
  },
});
