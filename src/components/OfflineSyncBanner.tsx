'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { Wifi, WifiOff, CloudUpload, CheckCircle2 } from 'lucide-react';

interface QueuedMutation {
  id: string;
  url: string;
  method: string;
  body: string;
  createdAt: string;
}

const QUEUE_STORAGE_KEY = 'sivarstock_offline_queue';

export default function OfflineSyncBanner() {
  const [queue, setQueue] = useState<QueuedMutation[]>([]);
  const [isServerReachable, setIsServerReachable] = useState<boolean>(true);
  const [syncing, setSyncing] = useState<boolean>(false);
  const [justConfirmedCount, setJustConfirmedCount] = useState<number>(0);

  const loadQueue = useCallback(() => {
    try {
      const raw = localStorage.getItem(QUEUE_STORAGE_KEY);
      if (raw) {
        setQueue(JSON.parse(raw));
      } else {
        setQueue([]);
      }
    } catch {
      setQueue([]);
    }
  }, []);

  // Sincronizar cola pendiente cuando el teléfono entra al Wi-Fi de la empresa
  const flushOfflineQueue = useCallback(async (originalFetch: typeof window.fetch) => {
    let currentQueue: QueuedMutation[] = [];
    try {
      const raw = localStorage.getItem(QUEUE_STORAGE_KEY);
      if (raw) currentQueue = JSON.parse(raw);
    } catch {
      currentQueue = [];
    }

    if (currentQueue.length === 0) return;

    setSyncing(true);
    const remaining: QueuedMutation[] = [];
    let confirmed = 0;

    for (const item of currentQueue) {
      try {
        const res = await originalFetch(item.url, {
          method: item.method,
          headers: { 'Content-Type': 'application/json', 'X-Offline-Replay': '1' },
          body: item.body,
        });
        if (res.ok || res.status < 500) {
          confirmed++;
        } else {
          remaining.push(item);
        }
      } catch {
        remaining.push(item);
      }
    }

    localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(remaining));
    setQueue(remaining);
    setSyncing(false);

    if (confirmed > 0) {
      setJustConfirmedCount(confirmed);
      setTimeout(() => setJustConfirmedCount(0), 5000);
    }
  }, []);

  useEffect(() => {
    loadQueue();

    const originalFetch = window.fetch.bind(window);

    // Interceptar mutaciones (POST, PUT, DELETE) a /api/* cuando no hay conexión al Wi-Fi de la empresa
    window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const urlStr = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      const method = (init?.method || 'GET').toUpperCase();
      const isApiMutation =
        urlStr.includes('/api/') &&
        ['POST', 'PUT', 'DELETE'].includes(method) &&
        !urlStr.includes('/api/auth/') &&
        !urlStr.includes('/api/reports/query') &&
        !(init?.headers && (init.headers as any)['X-Offline-Replay']);

      try {
        const response = await originalFetch(input, init);
        setIsServerReachable(true);
        return response;
      } catch (networkErr) {
        setIsServerReachable(false);

        if (isApiMutation && init?.body) {
          const newEntry: QueuedMutation = {
            id: `off-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            url: urlStr,
            method,
            body: typeof init.body === 'string' ? init.body : JSON.stringify(init.body),
            createdAt: new Date().toISOString(),
          };

          try {
            const raw = localStorage.getItem(QUEUE_STORAGE_KEY);
            const list: QueuedMutation[] = raw ? JSON.parse(raw) : [];
            list.push(newEntry);
            localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(list));
            setQueue(list);
          } catch (e) {
            console.error(e);
          }

          // Retornar respuesta simulada exitosa para que el usuario en el celular continúe sin bloqueo
          return new Response(
            JSON.stringify({
              success: true,
              offlineQueued: true,
              message:
                'Guardado en tu teléfono (Modo Fuera de Oficina). Se confirmará automáticamente en la BD al conectarte al Wi-Fi de la empresa.',
            }),
            {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            }
          );
        }

        throw networkErr;
      }
    };

    // Verificar conectividad periódicamente cada 12 segundos para auto-confirmar al entrar al Wi-Fi
    const interval = setInterval(async () => {
      try {
        const res = await originalFetch('/api/auth/me', { method: 'GET', cache: 'no-store' });
        if (res.ok) {
          setIsServerReachable(true);
          await flushOfflineQueue(originalFetch);
        }
      } catch {
        setIsServerReachable(false);
      }
    }, 12000);

    const handleOnline = () => {
      flushOfflineQueue(originalFetch);
    };

    window.addEventListener('online', handleOnline);

    return () => {
      window.fetch = originalFetch;
      clearInterval(interval);
      window.removeEventListener('online', handleOnline);
    };
  }, [flushOfflineQueue, loadQueue]);

  if (queue.length === 0 && isServerReachable && justConfirmedCount === 0) {
    return null;
  }

  return (
    <div className="px-4 pt-2 print:hidden">
      {justConfirmedCount > 0 && (
        <div className="mb-2 flex items-center justify-between rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-2.5 text-xs font-bold text-emerald-900 shadow-sm">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
            <span>
              ¡Conectado al Wi-Fi de la empresa! Se confirmaron {justConfirmedCount} cambio(s) guardado(s) desde tu celular en la base de datos local.
            </span>
          </div>
        </div>
      )}

      {(queue.length > 0 || !isServerReachable) && (
        <div
          className={`flex flex-wrap items-center justify-between gap-2 rounded-xl border px-4 py-2.5 text-xs font-bold shadow-sm ${
            !isServerReachable
              ? 'border-amber-300 bg-amber-50 text-amber-900'
              : 'border-blue-300 bg-blue-50 text-blue-900'
          }`}
        >
          <div className="flex items-center gap-2">
            {!isServerReachable ? (
              <WifiOff className="h-4 w-4 text-amber-600 shrink-0" />
            ) : (
              <Wifi className="h-4 w-4 text-blue-600 shrink-0" />
            )}
            <span>
              {!isServerReachable
                ? `Sin conexión al Wi-Fi de la empresa • Los cambios que hagas en tu celular se guardan al instante (${queue.length} en cola) y se confirmarán al entrar al Wi-Fi.`
                : `Tienes ${queue.length} cambio(s) realizado(s) fuera de la red listos para confirmar en la base de datos local.`}
            </span>
          </div>

          {queue.length > 0 && (
            <button
              onClick={() => flushOfflineQueue(window.fetch.bind(window))}
              disabled={syncing}
              className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1 text-[11px] font-bold text-white hover:bg-slate-800 disabled:opacity-50"
            >
              <CloudUpload className="h-3.5 w-3.5" />
              <span>{syncing ? 'Confirmando en BD...' : 'Confirmar Ahora'}</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
