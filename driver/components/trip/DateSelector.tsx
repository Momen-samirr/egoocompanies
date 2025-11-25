import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import React, { useEffect, useRef } from "react";
import { useTheme } from "@react-navigation/native";
import { formatDateDisplay, isSameDay, isToday } from "@/utils/weekGenerator";
import { spacing, shadows } from "@/styles/design-system";
import { fontSizes } from "@/themes/app.constant";
import fonts from "@/themes/app.fonts";
import color from "@/themes/app.colors";

interface DateSelectorProps {
  dates: Date[];
  selectedDate: Date;
  onDateSelect: (date: Date) => void;
}

export default function DateSelector({
  dates,
  selectedDate,
  onDateSelect,
}: DateSelectorProps) {
  const { colors } = useTheme();
  const scrollViewRef = useRef<ScrollView>(null);

  // Auto-scroll to selected date on mount
  useEffect(() => {
    if (scrollViewRef.current && dates.length > 0) {
      // Find index of selected date
      const selectedIndex = dates.findIndex((date) =>
        isSameDay(date, selectedDate)
      );
      
      if (selectedIndex !== -1) {
        // Calculate scroll position (each date button is ~70px wide + spacing)
        const itemWidth = 70; // Approximate width of each date button
        const scrollPosition = selectedIndex * itemWidth;
        
        // Scroll to selected date after a short delay to ensure layout is complete
        setTimeout(() => {
          scrollViewRef.current?.scrollTo({
            x: scrollPosition,
            animated: true,
          });
        }, 100);
      }
    }
  }, [dates, selectedDate]);

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.card,
          borderBottomColor: colors.border,
        },
      ]}
    >
      <ScrollView
        ref={scrollViewRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {dates.map((date, index) => {
          const { dayName, dayNumber } = formatDateDisplay(date);
          const isSelected = isSameDay(date, selectedDate);
          const isTodayDate = isToday(date);

          return (
            <TouchableOpacity
              key={index}
              onPress={() => onDateSelect(date)}
              style={[
                styles.dateButton,
                {
                  backgroundColor: isSelected
                    ? color.primary
                    : colors.background,
                  borderColor: isSelected
                    ? color.primary
                    : isTodayDate
                    ? color.primary
                    : colors.border,
                  borderWidth: isSelected ? 2 : isTodayDate ? 1 : 1,
                },
                isSelected && shadows.sm,
              ]}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.dayName,
                  {
                    color: isSelected ? "#fff" : color.text.secondary,
                  },
                ]}
              >
                {dayName}
              </Text>
              <Text
                style={[
                  styles.dayNumber,
                  {
                    color: isSelected ? "#fff" : colors.text,
                  },
                ]}
              >
                {dayNumber}
              </Text>
              {isTodayDate && !isSelected && (
                <View
                  style={[
                    styles.todayIndicator,
                    { backgroundColor: color.primary },
                  ]}
                />
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    ...shadows.sm,
  },
  scrollContent: {
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  dateButton: {
    width: 60,
    height: 70,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
    position: "relative",
  },
  dayName: {
    fontSize: fontSizes.FONT12,
    fontFamily: fonts.medium,
    marginBottom: spacing.xs / 2,
    textTransform: "uppercase",
  },
  dayNumber: {
    fontSize: fontSizes.FONT18,
    fontFamily: fonts.bold,
  },
  todayIndicator: {
    position: "absolute",
    bottom: 6,
    width: 4,
    height: 4,
    borderRadius: 2,
  },
});

