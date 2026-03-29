import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import { notificationsApi, type AppNotification } from "@/lib/api";

interface NotificationContextValue {
  notifications: AppNotification[];
  unreadCount: number;
  refresh: () => Promise<void>;
  dismiss: (id: string) => void;
}

const NotificationContext = createContext<NotificationContextValue>({
  notifications: [],
  unreadCount: 0,
  refresh: async () => {},
  dismiss: () => {},
});

const POLL_INTERVAL = 300000; // 5 minutes

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refresh = useCallback(async () => {
    try {
      const data = await notificationsApi.list();
      setNotifications(data.notifications);
    } catch {}
  }, []);

  const dismiss = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
    notificationsApi.dismiss(id).catch(() => {});
  }, []);

  useEffect(() => {
    // Initial fetch
    refresh();

    // Poll on interval
    intervalRef.current = setInterval(refresh, POLL_INTERVAL);

    // Also refresh when app comes to foreground
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") refresh();
    });

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      sub.remove();
    };
  }, [refresh]);

  return (
    <NotificationContext.Provider value={{
      notifications,
      unreadCount: notifications.length,
      refresh,
      dismiss,
    }}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  return useContext(NotificationContext);
}
