import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { AlertType } from "@/constants/colors";

const STORAGE_KEY = "@bettr_alerts";

export interface Alert {
  id: string;
  type: AlertType;
  latitude: number;
  longitude: number;
  timestamp: number;
  reportCount: number;
}

interface AlertContextValue {
  alerts: Alert[];
  addAlert: (type: AlertType, latitude: number, longitude: number) => void;
  upvoteAlert: (id: string) => void;
  clearOldAlerts: () => void;
}

const AlertContext = createContext<AlertContextValue | null>(null);

const ALERT_EXPIRY_MS = 2 * 60 * 60 * 1000;

export function AlertProvider({ children }: { children: React.ReactNode }) {
  const [alerts, setAlerts] = useState<Alert[]>([]);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((raw) => {
      if (raw) {
        try {
          const parsed: Alert[] = JSON.parse(raw);
          const now = Date.now();
          setAlerts(parsed.filter((a) => now - a.timestamp < ALERT_EXPIRY_MS));
        } catch {}
      }
    });
  }, []);

  const save = useCallback((updated: Alert[]) => {
    setAlerts(updated);
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  }, []);

  const addAlert = useCallback(
    (type: AlertType, latitude: number, longitude: number) => {
      const newAlert: Alert = {
        id: Date.now().toString() + Math.random().toString(36).substr(2, 6),
        type,
        latitude,
        longitude,
        timestamp: Date.now(),
        reportCount: 1,
      };
      save([newAlert, ...alerts]);
    },
    [alerts, save]
  );

  const upvoteAlert = useCallback(
    (id: string) => {
      save(alerts.map((a) => (a.id === id ? { ...a, reportCount: a.reportCount + 1 } : a)));
    },
    [alerts, save]
  );

  const clearOldAlerts = useCallback(() => {
    const now = Date.now();
    save(alerts.filter((a) => now - a.timestamp < ALERT_EXPIRY_MS));
  }, [alerts, save]);

  return (
    <AlertContext.Provider value={{ alerts, addAlert, upvoteAlert, clearOldAlerts }}>
      {children}
    </AlertContext.Provider>
  );
}

export function useAlerts() {
  const ctx = useContext(AlertContext);
  if (!ctx) throw new Error("useAlerts must be used within AlertProvider");
  return ctx;
}
