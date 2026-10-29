'use client';

import React, { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Sidebar from './Sidebar';
import Header from './Header';
import FloatingDock from './FloatingDock';
import QrScannerModal from './QrScannerModal';
import OfflineSyncBanner from './OfflineSyncBanner';
import { ShieldAlert, ArrowRight } from 'lucide-react';

interface AppLayoutProps {
  children: React.ReactNode;
}

const ROUTE_TO_TAB: Record<string, string> = {
  '/': 'DASHBOARD',
  '/inventario': 'INVENTARIO',
  '/celulares': 'CELULARES',
  '/productos': 'PRODUCTOS',
  '/movimientos': 'MOVIMIENTOS',
  '/asignaciones': 'ASIGNACIONES',
  '/mantenimiento': 'MANTENIMIENTO',
  '/servicios-digitales': 'SERVICIOS',
  '/costos': 'COSTOS',
  '/reportes': 'REPORTES',
  '/departamentos': 'DEPARTAMENTOS',
  '/usuarios': 'USUARIOS',
  '/auditoria': 'AUDITORIA',
  '/configuracion': 'CONFIGURACION',
};

const TAB_TO_ROUTE: Record<string, string> = {
  DASHBOARD: '/',
  INVENTARIO: '/inventario',
  CELULARES: '/celulares',
  PRODUCTOS: '/productos',
  MOVIMIENTOS: '/movimientos',
  ASIGNACIONES: '/asignaciones',
  MANTENIMIENTO: '/mantenimiento',
  SERVICIOS: '/servicios-digitales',
  COSTOS: '/costos',
  REPORTES: '/reportes',
  DEPARTAMENTOS: '/departamentos',
  USUARIOS: '/usuarios',
  AUDITORIA: '/auditoria',
  CONFIGURACION: '/configuracion',
};

function getFirstAllowedRoute(user: any): string {
  if (!user || user.role === 'ADMIN') return '/';
  const tabs: string[] = Array.isArray(user.allowedTabs) ? user.allowedTabs : [];
  if (tabs.includes('DASHBOARD')) return '/';
  for (const t of tabs) {
    if (TAB_TO_ROUTE[t]) return TAB_TO_ROUTE[t];
  }
  return '/login';
}

function isRouteAllowedForUser(pathname: string, user: any): boolean {
  if (!user) return false;
  if (user.role === 'ADMIN') return true;

  const matchedBase = Object.keys(ROUTE_TO_TAB).find((r) =>
    r === '/' ? pathname === '/' : pathname === r || pathname.startsWith(`${r}/`)
  );
  if (!matchedBase) return true;

  const requiredTab = ROUTE_TO_TAB[matchedBase];
  const allowedTabs: string[] = Array.isArray(user.allowedTabs) ? user.allowedTabs : [];
  return allowedTabs.includes(requiredTab);
}

export default function AppLayout({ children }: AppLayoutProps) {
  const pathname = usePathname() || '/';
  const router = useRouter();

  // Si estamos en login o en el enlace público de firma de acta (/acta/...), no forzamos el layout administrativo
  const isPublicPage = pathname === '/login' || pathname.startsWith('/acta/');

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [loadingAuth, setLoadingAuth] = useState(!isPublicPage);
  const [alertCounts, setAlertCounts] = useState<{ lowStock?: number; expiringServices?: number; brokenItems?: number }>({});

  useEffect(() => {
    if (isPublicPage) {
      setLoadingAuth(false);
      return;
    }

    // Hidratación rápida desde sessionStorage si acaba de iniciar sesión
    try {
      const cached = sessionStorage.getItem('sivarstock_logged_user');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed && parsed.id) {
          setCurrentUser(parsed);
          setLoadingAuth(false);
        }
      }
    } catch {
      // Ignorar errores de sessionStorage
    }

    // Verificar sesión activa contra el servidor sin caché
    fetch('/api/auth/me', { cache: 'no-store', credentials: 'include' })
      .then((res) => res.json())
      .then((data) => {
        if (!data.authenticated || !data.user) {
          try {
            sessionStorage.removeItem('sivarstock_logged_user');
          } catch {}
          setCurrentUser(null);
          router.replace('/login');
        } else {
          setCurrentUser(data.user);
          try {
            sessionStorage.setItem('sivarstock_logged_user', JSON.stringify(data.user));
          } catch {}
        }
      })
      .catch((err) => {
        console.error('Error verificando sesión:', err);
      })
      .finally(() => {
        setLoadingAuth(false);
      });

    // Cargar estadísticas para insignias de alerta en el sidebar
    fetch('/api/dashboard/stats')
      .then((res) => res.json())
      .then((data) => {
        if (data.stats) {
          setAlertCounts({
            lowStock: data.stats.lowStockAlertsCount || 0,
            expiringServices: data.expiringServices?.length || 0,
            brokenItems: data.stats.brokenEquipmentCount || 0,
          });
        }
      })
      .catch(() => {});

    // Modo nocturno inicial desde localStorage
    const savedTheme = localStorage.getItem('sivarstock_theme');
    if (savedTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isPublicPage, pathname, router]);

  if (isPublicPage) {
    return <>{children}</>;
  }

  if (loadingAuth && !currentUser) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-900 text-slate-200">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent" />
          <p className="text-sm font-medium tracking-wide">Cargando SivarStock...</p>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return null;
  }

  const allowedOnCurrentRoute = isRouteAllowedForUser(pathname, currentUser);
  const firstAllowedHref = getFirstAllowedRoute(currentUser);

  const handleToggleSidebar = () => {
    if (window.innerWidth < 1024) {
      setMobileSidebarOpen(!mobileSidebarOpen);
    } else {
      setSidebarCollapsed(!sidebarCollapsed);
    }
  };

  return (
    <div className="flex min-h-screen bg-slate-50 font-sans text-slate-900 antialiased">
      {/* Barra lateral (solo muestra las pestañas permitidas a este usuario) */}
      {!sidebarCollapsed && (
        <Sidebar
          isOpen={mobileSidebarOpen}
          onClose={() => setMobileSidebarOpen(false)}
          onToggleCollapse={() => setSidebarCollapsed(true)}
          currentUser={currentUser}
          alertCounts={alertCounts}
        />
      )}

      {/* Contenedor principal */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header
          onToggleSidebar={handleToggleSidebar}
          onOpenScanner={() => setScannerOpen(true)}
          sidebarCollapsed={sidebarCollapsed}
          currentUser={currentUser}
        />

        {/* Banner de Cola Offline y Auto-Confirmación al entrar al Wi-Fi de la empresa */}
        <OfflineSyncBanner />

        <main className={`flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 ${sidebarCollapsed ? 'pb-24' : ''}`}>
          {allowedOnCurrentRoute ? (
            children
          ) : (
            <div className="mx-auto max-w-lg mt-12 rounded-2xl border border-amber-200 bg-white p-8 text-center shadow-lg space-y-4">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
                <ShieldAlert className="h-8 w-8" />
              </div>
              <h2 className="text-lg font-black text-slate-900">
                Módulo No Incluido en tus Permisos
              </h2>
              <p className="text-xs text-slate-600 leading-relaxed">
                Tu usuario (<strong>@{currentUser.username}</strong>) solo tiene autorización para acceder a las secciones que el administrador te asignó.
              </p>
              {firstAllowedHref !== '/login' && (
                <button
                  onClick={() => router.replace(firstAllowedHref)}
                  className="inline-flex items-center gap-2 rounded-xl bg-military-800 px-5 py-2.5 text-xs font-bold text-white shadow hover:bg-military-900 transition"
                >
                  <span>Ir a mi sección autorizada</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              )}
            </div>
          )}
        </main>
      </div>

      {/* Burbuja Flotante Estilo iPhone cuando la barra lateral está oculta */}
      {sidebarCollapsed && (
        <FloatingDock
          onOpenScanner={() => setScannerOpen(true)}
          onExpandSidebar={() => setSidebarCollapsed(false)}
          currentUser={currentUser}
        />
      )}

      {/* Modal de escáner QR / Barras */}
      <QrScannerModal
        isOpen={scannerOpen}
        onClose={() => setScannerOpen(false)}
        currentUser={currentUser}
      />
    </div>
  );
}
