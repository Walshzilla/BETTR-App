import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useEffect } from "react";
import { StyleSheet, Text, TouchableOpacity, View, ViewStyle } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { ALERT_TYPE_CONFIG } from "@/constants/colors";
import { useColors } from "@/hooks/useColors";
import { Alert } from "@/context/AlertContext";

interface Props {
  alert: Alert | null;
  distance: number;
  onDismiss: () => void;
  style?: ViewStyle;
}

export function AlertBanner({ alert, distance, onDismiss, style }: Props) {
  const colors = useColors();
  const translateY = useSharedValue(-120);

  useEffect(() => {
    if (alert) {
      translateY.value = withSpring(0, { damping: 15, stiffness: 180 });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    } else {
      translateY.value = withTiming(-120, { duration: 300 });
    }
  }, [alert]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  if (!alert) return null;

  const config = ALERT_TYPE_CONFIG[alert.type];
  const distLabel = distance < 1000 ? `${Math.round(distance)}m` : `${(distance / 1000).toFixed(1)}km`;

  return (
    <Animated.View style={[styles.container, style, animStyle]}>
      <View style={[styles.banner, { backgroundColor: config.color + "F0", borderColor: config.color }]}>
        <View style={[styles.iconWrap, { backgroundColor: "rgba(0,0,0,0.25)" }]}>
          <Feather name={config.icon} size={22} color="#FFFFFF" />
        </View>
        <View style={styles.textWrap}>
          <Text style={styles.title}>{config.label} Ahead</Text>
          <Text style={styles.sub}>{distLabel} away</Text>
        </View>
        <TouchableOpacity onPress={onDismiss} style={styles.dismiss} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Feather name="x" size={18} color="#FFFFFF" />
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    paddingHorizontal: 16,
  },
  banner: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 12,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  textWrap: {
    flex: 1,
  },
  title: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
  },
  sub: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    marginTop: 1,
  },
  dismiss: {
    padding: 4,
  },
});
