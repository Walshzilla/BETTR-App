import * as Haptics from "expo-haptics";
import React, { useEffect, useRef } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { useColors } from "@/hooks/useColors";

interface Props {
  speedMs: number | null;
  limitKph: number;
  onPressLimit: () => void;
}

export function Speedometer({ speedMs, limitKph, onPressLimit }: Props) {
  const colors = useColors();
  const shake = useSharedValue(0);
  const wasOver = useRef(false);

  const speedKph = speedMs != null ? Math.round(speedMs * 3.6) : null;
  const isOver = speedKph != null && speedKph > limitKph;

  useEffect(() => {
    if (isOver && !wasOver.current) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      shake.value = withSequence(
        withTiming(-6, { duration: 60 }),
        withTiming(6, { duration: 60 }),
        withTiming(-6, { duration: 60 }),
        withTiming(0, { duration: 60 })
      );
    }
    wasOver.current = isOver;
  }, [isOver]);

  const shakeStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shake.value }],
  }));

  const bgColor = isOver ? "#FF3B30" : colors.card;
  const textColor = isOver ? "#FFFFFF" : colors.foreground;
  const subColor = isOver ? "rgba(255,255,255,0.8)" : colors.mutedForeground;

  return (
    <Animated.View style={[shakeStyle]}>
      <View style={[styles.container, { backgroundColor: bgColor, borderColor: isOver ? "#FF3B30" : colors.border }]}>
        <Text style={[styles.speed, { color: textColor }]}>
          {speedKph != null ? speedKph : "--"}
        </Text>
        <Text style={[styles.unit, { color: subColor }]}>km/h</Text>
      </View>
      <TouchableOpacity
        style={[styles.limitBadge, { backgroundColor: isOver ? "#FF9500" : colors.secondary, borderColor: colors.border }]}
        onPress={onPressLimit}
        activeOpacity={0.8}
      >
        <Text style={[styles.limitText, { color: isOver ? "#FFFFFF" : colors.mutedForeground }]}>
          {limitKph}
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 70,
    height: 70,
    borderRadius: 35,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  speed: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    lineHeight: 26,
  },
  unit: {
    fontSize: 9,
    fontFamily: "Inter_500Medium",
    letterSpacing: 0.5,
  },
  limitBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    marginTop: -10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  limitText: {
    fontSize: 11,
    fontFamily: "Inter_700Bold",
  },
});
