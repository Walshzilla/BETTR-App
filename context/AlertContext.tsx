import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { AlertType } from "@/constants/colors";

const STORAGE_KEY = "@bettr_alerts_v2";

export interface Alert {
  id: string;
  type: AlertType;
  latitude: number;
  longitude: number;
  timestamp: number;
  confirms: number;
  dismissals: number;
}

interface AlertContextValue {
  alerts: Alert[];
  addAlert: (type: AlertType, latitude: number, longitude: number) => void;
  confirmAlert: (id: string) => void;
  dismissAlert: (id: string) => void;
}

const AlertContext = createContext<AlertContextValue | null>(null);

const ALERT_EXPIRY_MS = 2 * 60 * 60 * 1000;

function isActive(alert: Alert): boolean {
  const age = Date.now() - alert.timestamp;
  if (age > ALERT_EXPIRY_MS) return false;
  if (alert.dismissals > 0 && alert.dismissals > alert.confirms) return false;
  return true;
}

export function AlertProvider({ children }: { children: React.ReactNode }) {
  const [alerts, setAlerts] = useState<Alert[]>([]);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((raw) => {
      if (raw) {
        try {
          const parsed: Alert[] = JSON.parse(raw);
          setAlerts(parsed.filter(isActive));
        } catch {}
      }
    });
  }, []);

  const save = useCallback((updated: Alert[]) => {
    const active = updated.filter(isActive);
    setAlerts(active);
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(active));
  }, []);

  const addAlert = useCallback(
    (type: AlertType, latitude: number, longitude: number) => {
      const newAlert: Alert = {
        id: Date.now().toString() + Math.random().toString(36).substr(2, 6),
        type,
        latitude,
        longitude,
        timestamp: Date.now(),
        confirms: 1,
        dismissals: 0,
      };
      save([newAlert, ...alerts]);
    },
    [alerts, save]
  );

  const confirmAlert = useCallback(
    (id: string) => {
      save(alerts.map((a) => (a.id === id ? { ...a, confirms: a.confirms + 1 } : a)));
    },
    [alerts, save]
  );

  const dismissAlert = useCallback(
    (id: string) => {
      save(alerts.map((a) => (a.id === id ? { ...a, dismissals: a.dismissals + 1 } : a)));
    },
    [alerts, save]
  );

  return (
    <AlertContext.Provider value={{ alerts, addAlert, confirmAlert, dismissAlert }}>
      {children}
    </AlertContext.Provider>
  );
}

export function useAlerts() {
  const ctx = useContext(AlertContext);
  if (!ctx) throw new Error("useAlerts must be used within AlertProvider");
  return ctx;
}
