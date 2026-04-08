import React, { useEffect, useState } from "react";
import { View, TextInput, StyleSheet, TouchableOpacity, Text, Alert } from "react-native";
import MapView, { Marker, Polyline } from "react-native-maps";
import * as Location from "expo-location";
import polyline from "@mapbox/polyline";

export default function NavigationMap() {
  const [location, setLocation] = useState(null);
  const [region, setRegion] = useState(null);
  const [destination, setDestination] = useState("");
  const [routeCoords, setRouteCoords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);

  useEffect(() => {
    initializeLocation();
  }, []);

  const initializeLocation = async () => {
    try {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission Denied", "Location access is required for navigation");
        return;
      }

      let loc = await Location.getCurrentPositionAsync({});
      setLocation(loc.coords);
      setRegion({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      });
    } catch (error) {
      Alert.alert("Error", "Failed to get location: " + error.message);
    }
  };

  const getRoute = async () => {
    if (!destination || !location) {
      Alert.alert("Error", "Please enter a destination");
      return;
    }

    setLoading(true);
    try {
      const apiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
      if (!apiKey) {
        throw new Error("Google Maps API key not configured");
      }

      const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${location.latitude},${location.longitude}&destination=${encodeURIComponent(destination)}&key=${apiKey}`;

      const res = await fetch(url);
      const data = await res.json();

      if (!data.routes || data.routes.length === 0) {
        Alert.alert("No Route Found", "Could not find a route to that destination");
        setRouteCoords([]);
        return;
      }

      const points = polyline.decode(data.routes[0].overview_polyline.points);
      const coords = points.map((point) => ({
        latitude: point[0],
        longitude: point[1],
      }));

      setRouteCoords(coords);
    } catch (error) {
      Alert.alert("Error", "Failed to get route: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const startDrive = () => {
    if (routeCoords.length === 0) return;
    setIsNavigating(true);
    Alert.alert("Navigation Started", "Follow the route on the map");
  };

  if (!region) {
    return (
      <View style={styles.container}>
        <Text>Loading location...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <MapView 
        style={styles.map} 
        initialRegion={region} 
        showsUserLocation
        zoomEnabled
        scrollEnabled
      >
        {location && (
          <Marker
            coordinate={{ latitude: location.latitude, longitude: location.longitude }}
            title="Your Location"
            pinColor="blue"
          />
        )}
        {routeCoords.length > 0 && (
          <Polyline coordinates={routeCoords} strokeWidth={4} strokeColor="#FF0000" />
        )}
      </MapView>

      <View style={styles.searchBox}>
        <TextInput
          placeholder="Where are you going?"
          value={destination}
          onChangeText={setDestination}
          style={styles.input}
          editable={!loading}
        />
        <TouchableOpacity 
          onPress={getRoute} 
          style={[styles.button, loading && styles.buttonDisabled]}
          disabled={loading}
        >
          <Text style={{ color: "#fff" }}>
            {loading ? "..." : "Go"}
          </Text>
        </TouchableOpacity>
      </View>

      {routeCoords.length > 0 && (
        <TouchableOpacity 
          style={[styles.startButton, isNavigating && styles.startButtonActive]}
          onPress={startDrive}
          disabled={isNavigating}
        >
          <Text style={styles.startText}>
            {isNavigating ? "Navigating..." : "Start Drive"}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", alignItems: "center" },
  map: { flex: 1 },
  searchBox: {
    position: "absolute",
    top: 50,
    left: 10,
    right: 10,
    flexDirection: "row",
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 8,
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
  },
  input: { flex: 1, paddingHorizontal: 10, fontSize: 16 },
  button: {
    backgroundColor: "black",
    paddingHorizontal: 15,
    justifyContent: "center",
    borderRadius: 8,
  },
  buttonDisabled: {
    backgroundColor: "#ccc",
  },
  startButton: {
    position: "absolute",
    bottom: 40,
    left: 20,
    right: 20,
    backgroundColor: "#1E90FF",
    padding: 15,
    borderRadius: 12,
    alignItems: "center",
  },
  startButtonActive: {
    backgroundColor: "#228B22",
  },
  startText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
});