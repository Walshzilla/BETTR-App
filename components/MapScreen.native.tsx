import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as Location from "expo-location";
import { LinearGradient } from "expo-linear-gradient";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert as RNAlert,
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
import { Speedometer } from "@/components/Speedometer";
import { ALERT_TYPE_CONFIG, AlertType } from "@/constants/colors";
import { Alert, useAlerts } from "@/context/AlertContext";
import { useColors } from "@/hooks/useColors";

const PROXIMITY_THRESHOLD = 600;
const DEFAULT_SPEED_LIMIT = 80;

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

function reliabilityLabel(confirms: number, dismissals: number): { label: string; color: string } {
  const total = confirms + dismissals;
  if (total < 2) return { label: "Unverified", color: "#8A8AB0" };
  const ratio = confirms / total;
  if (ratio >= 0.75) return { label: "Confirmed", color: "#34C759" };
  if (ratio >= 0.5) return { label: "Likely", color: "#FF9500" };
  return { label: "Disputed", color: "#FF3B30" };
}

export default function MapScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { alerts, addAlert, confirmAlert, dismissAlert } = useAlerts();
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [permError, setPermError] = useState(false);
  const [nearbyAlert, setNearbyAlert] = useState<Alert | null>(null);
  const [nearbyDist, setNearbyDist] = useState(0);
  const [dismissedId, setDismissedId] = useState<string | null>(null);
  const [showReport, setShowReport] = useState(false);
  const [listOpen, setListOpen] = useState(false);
  const [showTraffic, setShowTraffic] = useState(true);
  const [speedLimitKph, setSpeedLimitKph] = useState(DEFAULT_SPEED_LIMIT);
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
        { accuracy: Location.Accuracy.BestForNavigation, distanceInterval: 5 },
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
    const next = !listOpen;
    setListOpen(next);
    listHeight.value = withSpring(next ? 280 : 0, { damping: 18 });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleSetSpeedLimit = () => {
    const options = [60, 80, 100, 110, 120];
    RNAlert.alert(
      "Speed Alert Threshold",
      "Alert me when I exceed:",
      [
        ...options.map((v) => ({
          text: `${v} km/h`,
          onPress: () => setSpeedLimitKph(v),
        })),
        { text: "Cancel", style: "cancel" },
      ]
    );
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
        showsTraffic={showTraffic}
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
          const rel = reliabilityLabel(alert.confirms, alert.dismissals);
          return (
            <Marker
              key={alert.id}
              coordinate={{ latitude: alert.latitude, longitude: alert.longitude }}
            >
              <View style={[styles.markerWrap, { backgroundColor: config.color, opacity: rel.label === "Disputed" ? 0.5 : 1 }]}>
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

      <View style={[styles.topControls, { top: bannerTop + (nearbyAlert ? 72 : 0) }]}>
        <Speedometer
          speedMs={location?.coords.speed ?? null}
          limitKph={speedLimitKph}
          onPressLimit={handleSetSpeedLimit}
        />
      </View>

      <View style={[styles.sideControls, { right: 16, bottom: 220 + insets.bottom }]}>
        <TouchableOpacity
          style={[styles.iconBtn, { backgroundColor: showTraffic ? colors.primary : colors.card, borderColor: colors.border }]}
          onPress={() => {
            setShowTraffic((v) => !v);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          }}
          activeOpacity={0.8}
        >
          <Feather name="activity" size={18} color={showTraffic ? "#FFFFFF" : colors.mutedForeground} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.iconBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={centerOnUser}
          activeOpacity={0.8}
        >
          <Feather name="navigation" size={18} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <LinearGradient
        colors={["transparent", "rgba(13,13,20,0.97)"]}
        style={[styles.bottomGradient, { paddingBottom: insets.bottom + 16 }]}
      >
        <Animated.View style={[styles.listContainer, listStyle]}>
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 8, gap: 8 }}
          >
            {alerts.length === 0 ? (
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                No active alerts — be the first to report
              </Text>
            ) : (
              alerts.map((alert) => {
                const config = ALERT_TYPE_CONFIG[alert.type];
                const rel = reliabilityLabel(alert.confirms, alert.dismissals);
                return (
                  <View
                    key={alert.id}
                    style={[styles.alertRow, { backgroundColor: colors.card, borderColor: config.color + "40" }]}
                  >
                    <View style={[styles.alertRowIcon, { backgroundColor: config.color + "22" }]}>
                      <Feather name={config.icon} size={16} color={config.color} />
                    </View>
                    <View style={styles.alertRowText}>
                      <Text style={[styles.alertRowTitle, { color: colors.foreground }]}>{config.label}</Text>
                      <View style={styles.alertRowMeta}>
                        <Text style={[styles.alertRowSub, { color: colors.mutedForeground }]}>{timeAgo(alert.timestamp)}</Text>
                        <View style={[styles.relBadge, { backgroundColor: rel.color + "22" }]}>
                          <Text style={[styles.relText, { color: rel.color }]}>{rel.label}</Text>
                        </View>
                      </View>
                    </View>
                    <View style={styles.voteRow}>
                      <TouchableOpacity
                        style={[styles.voteBtn, { backgroundColor: "#34C75922" }]}
                        onPress={() => { confirmAlert(alert.id); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 4 }}
                      >
                        <Feather name="check" size={14} color="#34C759" />
                        <Text style={[styles.voteTxt, { color: "#34C759" }]}>{alert.confirms}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.voteBtn, { backgroundColor: "#FF3B3022" }]}
                        onPress={() => { dismissAlert(alert.id); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
                        hitSlop={{ top: 8, bottom: 8, left: 4, right: 8 }}
                      >
                        <Feather name="x" size={14} color="#FF3B30" />
                        <Text style={[styles.voteTxt, { color: "#FF3B30" }]}>{alert.dismissals}</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
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
  topControls: {
    position: "absolute",
    left: 16,
  },
  sideControls: {
    position: "absolute",
    gap: 10,
  },
  iconBtn: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: "center", justifyContent: "center",
    borderWidth: 1,
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
  alertRowMeta: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 },
  alertRowSub: { fontSize: 11, fontFamily: "Inter_400Regular" },
  relBadge: { borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  relText: { fontSize: 10, fontFamily: "Inter_600SemiBold" },
  voteRow: { flexDirection: "row", gap: 6 },
  voteBtn: {
    flexDirection: "row", alignItems: "center", gap: 3,
    paddingHorizontal: 8, paddingVertical: 5, borderRadius: 10,
  },
  voteTxt: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
});
