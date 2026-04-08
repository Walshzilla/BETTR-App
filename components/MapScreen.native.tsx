import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as Location from "expo-location";
import { LinearGradient } from "expo-linear-gradient";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import MapView, { Marker, PROVIDER_DEFAULT } from "react-native-maps";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AlertBanner } from "@/components/AlertBanner";
import { ReportSheet } from "@/components/ReportSheet";
import { ALERT_TYPE_CONFIG, AlertType } from "@/constants/colors";
import { Alert, useAlerts } from "@/context/AlertContext";
import { useColors } from "@/hooks/useColors";

const PROXIMITY_THRESHOLD = 600;

function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function timeAgo(timestamp: number): string {
  const mins = Math.floor((Date.now() - timestamp) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  return `${Math.floor(mins / 60)}h ago`;
}

export default function MapScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { alerts, addAlert, upvoteAlert } = useAlerts();
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [permError, setPermError] = useState(false);
  const [nearbyAlert, setNearbyAlert] = useState<Alert | null>(null);
  const [nearbyDist, setNearbyDist] = useState(0);
  const [dismissedId, setDismissedId] = useState<string | null>(null);
  const [showReport, setShowReport] = useState(false);
  const [listOpen, setListOpen] = useState(false);
  const mapRef = useRef<MapView>(null);
  const listHeight = useSharedValue(0);

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setPermError(true);
        return;
      }
      const sub = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, distanceInterval: 10 },
        (loc) => setLocation(loc)
      );
      return () => sub.remove();
    })();
  }, []);

  useEffect(() => {
    if (!location) return;
    const { latitude, longitude } = location.coords;
    let closest: Alert | null = null;
    let closestDist = Infinity;
    for (const a of alerts) {
      const d = haversine(latitude, longitude, a.latitude, a.longitude);
      if (d < PROXIMITY_THRESHOLD && d < closestDist && a.id !== dismissedId) {
        closest = a;
        closestDist = d;
      }
    }
    setNearbyAlert(closest);
    setNearbyDist(closestDist);
  }, [location, alerts, dismissedId]);

  const handleReport = useCallback(
    (type: AlertType) => {
      if (!location) return;
      addAlert(type, location.coords.latitude, location.coords.longitude);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    [location, addAlert]
  );

  const centerOnUser = useCallback(() => {
    if (!location || !mapRef.current) return;
    mapRef.current.animateToRegion(
      {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      },
      600
    );
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [location]);

  const toggleList = () => {
    setListOpen((v) => !v);
    listHeight.value = withSpring(listOpen ? 0 : 260, { damping: 18 });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const listStyle = useAnimatedStyle(() => ({ height: listHeight.value }));
  const bannerTop = insets.top + 12;

  return (
    <View style={styles.root}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        provider={PROVIDER_DEFAULT}
        showsUserLocation
        showsMyLocationButton={false}
        mapType="standard"
        customMapStyle={darkMapStyle}
        initialRegion={{
          latitude: location?.coords.latitude ?? 37.7749,
          longitude: location?.coords.longitude ?? -122.4194,
          latitudeDelta: 0.04,
          longitudeDelta: 0.04,
        }}
      >
        {alerts.map((alert) => {
          const config = ALERT_TYPE_CONFIG[alert.type];
          return (
            <Marker
              key={alert.id}
              coordinate={{ latitude: alert.latitude, longitude: alert.longitude }}
              onPress={() => upvoteAlert(alert.id)}
            >
              <View style={[styles.markerWrap, { backgroundColor: config.color }]}>
                <Feather name={config.icon} size={14} color="#FFFFFF" />
              </View>
            </Marker>
          );
        })}
      </MapView>

      <AlertBanner
        alert={nearbyAlert}
        distance={nearbyDist}
        onDismiss={() => {
          setDismissedId(nearbyAlert?.id ?? null);
          setNearbyAlert(null);
        }}
        style={{ top: bannerTop, paddingHorizontal: 16 }}
      />

      {permError && (
        <View style={[styles.permBanner, { top: bannerTop, marginHorizontal: 16 }]}>
          <Text style={styles.permText}>Location permission required</Text>
        </View>
      )}

      <TouchableOpacity
        style={[
          styles.centerBtn,
          { right: 16, bottom: 200 + insets.bottom, backgroundColor: colors.card, borderColor: colors.border },
        ]}
        onPress={centerOnUser}
        activeOpacity={0.8}
      >
        <Feather name="navigation" size={20} color={colors.primary} />
      </TouchableOpacity>

      <LinearGradient
        colors={["transparent", "rgba(13,13,20,0.95)"]}
        style={[styles.bottomGradient, { paddingBottom: insets.bottom + 16 }]}
      >
        <Animated.View style={[styles.listContainer, listStyle]}>
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 8, gap: 8 }}
          >
            {alerts.length === 0 ? (
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No alerts nearby</Text>
            ) : (
              alerts.map((alert) => {
                const config = ALERT_TYPE_CONFIG[alert.type];
                return (
                  <TouchableOpacity
                    key={alert.id}
                    style={[styles.alertRow, { backgroundColor: colors.card, borderColor: config.color + "40" }]}
                    onPress={() => upvoteAlert(alert.id)}
                    activeOpacity={0.8}
                  >
                    <View style={[styles.alertRowIcon, { backgroundColor: config.color + "22" }]}>
                      <Feather name={config.icon} size={16} color={config.color} />
                    </View>
                    <View style={styles.alertRowText}>
                      <Text style={[styles.alertRowTitle, { color: colors.foreground }]}>{config.label}</Text>
                      <Text style={[styles.alertRowSub, { color: colors.mutedForeground }]}>{timeAgo(alert.timestamp)}</Text>
                    </View>
                    <View style={styles.alertRowVote}>
                      <Feather name="thumbs-up" size={13} color={colors.mutedForeground} />
                      <Text style={[styles.alertRowCount, { color: colors.mutedForeground }]}>{alert.reportCount}</Text>
                    </View>
                  </TouchableOpacity>
                );
              })
            )}
          </ScrollView>
        </Animated.View>

        <View style={styles.bottomRow}>
          <TouchableOpacity
            style={[styles.listToggle, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={toggleList}
            activeOpacity={0.8}
          >
            <Feather name={listOpen ? "chevron-down" : "list"} size={18} color={colors.foreground} />
            <Text style={[styles.listToggleText, { color: colors.foreground }]}>
              {alerts.length} Alert{alerts.length !== 1 ? "s" : ""}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.reportBtn, { backgroundColor: colors.primary }]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              setShowReport(true);
            }}
            activeOpacity={0.85}
          >
            <Feather name="plus" size={26} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </LinearGradient>

      <ReportSheet
        visible={showReport}
        onClose={() => setShowReport(false)}
        onSelect={handleReport}
      />
    </View>
  );
}

const darkMapStyle = [
  { elementType: "geometry", stylers: [{ color: "#1a1a2e" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#0d0d14" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#8a8ab0" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#2d2d4a" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#3a3a5c" }] },
  { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: "#8a8ab0" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#0d1020" }] },
  { featureType: "poi", elementType: "geometry", stylers: [{ color: "#1a1a2e" }] },
  { featureType: "poi", elementType: "labels.text.fill", stylers: [{ color: "#6b7280" }] },
  { featureType: "transit", elementType: "geometry", stylers: [{ color: "#22223a" }] },
];

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#0D0D14" },
  markerWrap: {
    width: 30, height: 30, borderRadius: 15,
    alignItems: "center", justifyContent: "center",
    borderWidth: 2, borderColor: "rgba(255,255,255,0.3)",
  },
  permBanner: {
    position: "absolute", backgroundColor: "#FF3B30",
    borderRadius: 12, paddingHorizontal: 16, paddingVertical: 10,
  },
  permText: { color: "#fff", fontFamily: "Inter_600SemiBold", fontSize: 14 },
  centerBtn: {
    position: "absolute", width: 44, height: 44, borderRadius: 22,
    alignItems: "center", justifyContent: "center", borderWidth: 1,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4, shadowRadius: 6, elevation: 4,
  },
  bottomGradient: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    paddingTop: 80, paddingHorizontal: 16,
  },
  listContainer: { overflow: "hidden", marginBottom: 12 },
  bottomRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  listToggle: {
    flexDirection: "row", alignItems: "center", gap: 8,
    paddingHorizontal: 16, paddingVertical: 12, borderRadius: 24, borderWidth: 1,
  },
  listToggleText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  reportBtn: {
    width: 60, height: 60, borderRadius: 30,
    alignItems: "center", justifyContent: "center",
    shadowColor: "#FF6B35", shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5, shadowRadius: 12, elevation: 8,
  },
  emptyText: { textAlign: "center", fontSize: 14, fontFamily: "Inter_400Regular", paddingVertical: 16 },
  alertRow: {
    flexDirection: "row", alignItems: "center",
    padding: 12, borderRadius: 14, borderWidth: 1, gap: 10,
  },
  alertRowIcon: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  alertRowText: { flex: 1 },
  alertRowTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  alertRowSub: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 1 },
  alertRowVote: { flexDirection: "row", alignItems: "center", gap: 4 },
  alertRowCount: { fontSize: 12, fontFamily: "Inter_500Medium" },
});
