"use client";

import { useEffect, useMemo, useRef, useState } from 'react';
import socketClient from '../../../services/socketClient';

export interface BuildTestProgressEvent {
  phase: string;
  message: string;
  progress: number; // 0-100
  details?: any;
  timestamp?: string;
}

export interface UseBuildTestRealtime {
  events: BuildTestProgressEvent[];
  latest: BuildTestProgressEvent | null;
  connected: boolean;
  subscribe: () => void;
  clear: () => void;
}

export const useBuildTestRealtime = (): UseBuildTestRealtime => {
  const [events, setEvents] = useState<BuildTestProgressEvent[]>([]);
  const [connected, setConnected] = useState(false);
  const latest = useMemo(() => (events.length ? events[events.length - 1] : null), [events]);
  const subscribedRef = useRef(false);

  useEffect(() => {
    const onConnect = () => {
      setConnected(true);
      // subscribe on connect to the build-test progress room
      try {
        socketClient.emit('subscribe_progress', 'build-test');
      } catch {}
    };
    const onDisconnect = () => setConnected(false);

    // Note: socketClient.on delegates to underlying socket.on
    socketClient.on('connect', onConnect);
    socketClient.on('disconnect', onDisconnect);

    // Progress messages from backend come on the 'progress' channel with { type, data, timestamp }
    const onProgress = (msg: { type: string; data: any; timestamp: string }) => {
      const d = msg?.data || msg;
      const evt: BuildTestProgressEvent = {
        phase: d.phase || 'unknown',
        message: d.message || '',
        progress: typeof d.progress === 'number' ? d.progress : 0,
        details: d.details,
        timestamp: msg?.timestamp || new Date().toISOString(),
      };
      setEvents(prev => [...prev, evt].slice(-200));
    };

    socketClient.on('progress', onProgress);

    // Ensure connection attempt
    try {
      // underlying client auto-connects on window load; emit subscribe if already connected
      const status = socketClient.getConnectionStatus?.();
      if (status?.connected && !subscribedRef.current) {
        socketClient.emit('subscribe_progress', 'build-test');
        subscribedRef.current = true;
      }
    } catch {}

    return () => {
      socketClient.off('progress', onProgress);
      socketClient.off('connect', onConnect);
      socketClient.off('disconnect', onDisconnect);
    };
  }, []);

  const subscribe = () => {
    try {
      socketClient.emit('subscribe_progress', 'build-test');
      subscribedRef.current = true;
    } catch {}
  };

  const clear = () => setEvents([]);

  return { events, latest, connected, subscribe, clear };
};
