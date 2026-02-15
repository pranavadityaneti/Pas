import React, { createContext, useContext } from 'react';
import { useNotifications, Notification } from '../hooks/useNotifications';

import { useUser } from './UserContext';

interface NotificationContextType {
    notifications: Notification[];
    loading: boolean;
    unreadCount: number;
    markAsRead: (id: string) => Promise<void>;
    markAllAsRead: () => Promise<void>;
    refetch: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
    const { user } = useUser();
    const notificationState = useNotifications(user);

    return (
        <NotificationContext.Provider value={notificationState}>
            {children}
        </NotificationContext.Provider>
    );
}

export function useNotificationContext() {
    const context = useContext(NotificationContext);
    if (context === undefined) {
        throw new Error('useNotificationContext must be used within a NotificationProvider');
    }
    return context;
}
