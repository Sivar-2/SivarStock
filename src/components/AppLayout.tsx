'use client';

import React, { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Sidebar from './Sidebar';
import Header from './Header';
import FloatingDock from './FloatingDock';
import QrScannerModal from './QrScannerModal';
import OfflineSyncBanner from './OfflineSyncBanner';

interface AppLayoutProps {
  children: React.ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  const pathname = usePathname();
  const router = useRouter();

  // Si estamos en login o en el enlace público de firma de acta (/acta/...), no forzamos el layout administrativo
  const isPublicPage = pathname === '/login' || pathname?.startsWith('/acta/');

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

    // Verificar sesión activa
    fetch('/api/auth/me')
      .then((res) => res.json())
      .then((data) => {
        if (!data.authenticated || !data.user) {
          router.push('/login');
        } else {
          setCurrentUser(data.user);
        }
      })
      .catch((err) => {
        console.error('Error verificando sesión:', err);
        router.push('/login');
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
      .catch(console.error);

    // Modo nocturno inicial desde localStorage
    const savedTheme = localStorage.getItem('sivarstock_theme');
    if (savedTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isPublicPage, router]);

  if (isPublicPage) {
    return <>{children}</>;
  }

  if (loadingAuth) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-900 text-slate-200">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent" />
          <p className="text-sm font-medium tracking-wide">Cargando SivarStock...</p>
        </div>
      </div>
    );
  }

  const handleToggleSidebar = () => {
    if (window.innerWidth < 1024) {
      setMobileSidebarOpen(!mobileSidebarOpen);
    } else {
      setSidebarCollapsed(!sidebarCollapsed);
    }
  };

  return (
    <div className="flex min-h-screen bg-slate-50 font-sans text-slate-900 antialiased">
      {/* Barra lateral */}
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
          currentUser={currentUser || undefined}
        />

        {/* Banner de Cola Offline y Auto-Confirmación al entrar al Wi-Fi de la empresa */}
        <OfflineSyncBanner />

        <main className={`flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 ${sidebarCollapsed ? 'pb-24' : ''}`}>
          {children}
        </main>
      </div>

      {/* Burbuja Flotante Estilo iPhone cuando la barra lateral está oculta */}
      {sidebarCollapsed && (
        <FloatingDock
          onOpenScanner={() => setScannerOpen(true)}
          onExpandSidebar={() => setSidebarCollapsed(false)}
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
