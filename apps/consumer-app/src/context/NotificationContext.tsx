// App-wide provider for consumer notifications. Mounted once (App.tsx), inside
// AuthProvider, so any screen (and GlobalHeader's bell badge) can read unread
// count + the list without re-subscribing.
import React, { createContext, useContext } from 'react';
import { useAuth } from './AuthContext';
import { useNotifications, ConsumerNotification } from '../hooks/useNotifications';

interface NotificationContextType {
    notifications: ConsumerNotification[];
    loading: boolean;
    unreadCount: number;
    markAsRead: (id: string) => Promise<void>;
    markAllAsRead: () => Promise<void>;
    refetch: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
    const { user } = useAuth();
    const state = useNotifications(user?.id);

    return (
        <NotificationContext.Provider value={state}>
            {children}
        </NotificationContext.Provider>
    );
}

export function useNotificationContext() {
    const ctx = useContext(NotificationContext);
    if (ctx === undefined) {
        throw new Error('useNotificationContext must be used within a NotificationProvider');
    }
    return ctx;
}
