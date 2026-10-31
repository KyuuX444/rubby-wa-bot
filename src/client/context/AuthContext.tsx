import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { apiRequest, setCsrfToken } from '../lib/api';
import type { User } from '../../shared/types';

export interface RealtimeEvent {
  type: string;
  payload: any;
  timestamp: string;
}

type RealtimeListener = (event: RealtimeEvent) => void;

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  wsConnected: boolean;
  login: (identifier: string, password: string) => Promise<void>;
  register: (username: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  subscribeRealtime: (listener: RealtimeListener) => () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [wsConnected, setWsConnected] = useState<boolean>(false);

  const listenersRef = useRef<Set<RealtimeListener>>(new Set());
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);

  const subscribeRealtime = useCallback((listener: RealtimeListener) => {
    listenersRef.current.add(listener);
    return () => {
      listenersRef.current.delete(listener);
    };
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const data = await apiRequest<{ user: User; csrfToken: string }>('/api/auth/me');
      setCsrfToken(data.csrfToken);
      setUser(data.user);
    } catch {
      setCsrfToken(null);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  useEffect(() => {
    if (!user) {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      setWsConnected(false);
      return;
    }

    let unmounted = false;

    const connectWs = () => {
      if (unmounted) return;
      if (
        wsRef.current &&
        (wsRef.current.readyState === WebSocket.OPEN ||
          wsRef.current.readyState === WebSocket.CONNECTING)
      ) {
        return;
      }

      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws`;

      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        if (!unmounted) {
          setWsConnected(true);
          listenersRef.current.forEach((listener) => {
            try {
              listener({
                type: 'ws.reconnected',
                payload: {},
                timestamp: new Date().toISOString(),
              });
            } catch {
            }
          });
        }
      };

      ws.onmessage = (msgEvent) => {
        try {
          const parsed: RealtimeEvent = JSON.parse(msgEvent.data);

          if (parsed.type === 'role.update' && parsed.payload?.role) {
            setUser((prev) => (prev ? { ...prev, role: parsed.payload.role } : prev));
          }

          if (parsed.type === 'auth.revoked') {
            setCsrfToken(null);
            setUser(null);
            return;
          }

          listenersRef.current.forEach((listener) => {
            try {
              listener(parsed);
            } catch (err) {
              console.error('Realtime listener error:', err);
            }
          });
        } catch {
        }
      };

      ws.onclose = () => {
        if (!unmounted) {
          setWsConnected(false);
          wsRef.current = null;
          reconnectTimeoutRef.current = window.setTimeout(connectWs, 2000);
        }
      };

      ws.onerror = () => {
        ws.close();
      };
    };

    connectWs();

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && !unmounted) {
        connectWs();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleVisibilityChange);

    return () => {
      unmounted = true;
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleVisibilityChange);
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [user?.id]);

  const login = async (identifier: string, password: string) => {
    const data = await apiRequest<{ user: User; csrfToken: string }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ identifier, password }),
    });
    setCsrfToken(data.csrfToken);
    setUser(data.user);
  };

  const register = async (username: string, email: string, password: string) => {
    const data = await apiRequest<{ user: User; csrfToken: string }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username, email, password }),
    });
    setCsrfToken(data.csrfToken);
    setUser(data.user);
  };

  const logout = async () => {
    try {
      await apiRequest('/api/auth/logout', { method: 'POST' });
    } catch {
    } finally {
      setCsrfToken(null);
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        wsConnected,
        login,
        register,
        logout,
        refreshUser,
        subscribeRealtime,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}
