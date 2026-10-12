'use client';

import React, { useState, useEffect } from 'react';
import {
  Boxes,
  Menu,
  QrCode,
  Search,
  Plus,
  User,
  LogOut,
  ShieldCheck,
  ChevronDown,
  Moon,
  Sun
} from 'lucide-react';
import { useRouter } from 'next/navigation';

interface HeaderProps {
  onToggleSidebar: () => void;
  onOpenScanner: () => void;
  sidebarCollapsed?: boolean;
  currentUser?: {
    username: string;
    fullName: string;
    role: string;
    departmentName?: string;
    initials: string;
  };
}

export default function Header({
  onToggleSidebar,
  onOpenScanner,
  sidebarCollapsed = false,
  currentUser = {
    username: 'alexander7tm',
    fullName: 'Alexander Admin',
    role: 'ADMIN',
    departmentName: 'IT',
    initials: 'AA',
  },
}: HeaderProps) {
  const router = useRouter();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    setIsDark(document.documentElement.classList.contains('dark'));
  }, []);

  const toggleDarkMode = () => {
    const nextDark = !isDark;
    setIsDark(nextDark);
    if (nextDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('sivarstock_theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('sivarstock_theme', 'light');
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/inventario?search=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      router.push('/login');
      router.refresh();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-slate-200 bg-white/95 px-3 sm:px-6 shadow-sm backdrop-blur transition-colors">
      {/* Esquina superior izquierda: Botón de alternar menú sin duplicar marca si el sidebar está abierto */}
      <div className="flex items-center gap-3 sm:gap-4 flex-1 max-w-xl">
        <button
          onClick={onToggleSidebar}
          className="flex items-center gap-2 rounded-xl p-1.5 transition hover:bg-slate-100 focus:outline-none"
          title={sidebarCollapsed ? "Expandir menú lateral" : "Minimizar barra lateral"}
          aria-label="Alternar menú lateral"
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-military-800 to-military-700 text-emerald-400 shadow ring-1 ring-emerald-500/20">
            {sidebarCollapsed ? <Boxes className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </div>
          {/* Solo mostramos el texto de la marca en el Header cuando el sidebar está colapsado/oculto */}
          {sidebarCollapsed && (
            <div className="hidden sm:block text-left">
              <span className="text-base font-bold tracking-tight text-slate-900 flex items-center gap-1">
                SivarStock
                <span className="text-[10px] bg-emerald-100 text-emerald-800 px-1 py-0.2 rounded font-semibold">Q</span>
              </span>
              <span className="block text-[9px] uppercase tracking-wider text-slate-500">
                Burbuja activa
              </span>
            </div>
          )}
        </button>

        {/* Buscador de Activos */}
        <form onSubmit={handleSearchSubmit} className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar activo (ej. SIV-IT-000001, serie, IMEI)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 py-1.5 pl-9 pr-4 text-xs sm:text-sm text-slate-800 transition focus:border-emerald-600 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-600"
          />
        </form>
      </div>

      {/* Acciones principales y Perfil */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Botón Modo Nocturno / Modo Claro */}
        <button
          onClick={toggleDarkMode}
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-600 transition hover:bg-slate-100 shadow-sm"
          title={isDark ? "Cambiar a modo diurno (claro)" : "Activar modo nocturno (oscuro)"}
          aria-label="Alternar modo nocturno"
        >
          {isDark ? <Sun className="h-4 w-4 text-amber-400" /> : <Moon className="h-4 w-4 text-slate-600" />}
        </button>

        {/* Botón Escáner QR */}
        <button
          onClick={onOpenScanner}
          className="flex items-center gap-1.5 rounded-xl border border-emerald-600/30 bg-emerald-50 px-3 py-1.5 text-xs sm:text-sm font-semibold text-emerald-800 transition hover:bg-emerald-100 shadow-sm"
          title="Escanear código QR con cámara o pistola óptica"
        >
          <QrCode className="h-4 w-4 text-emerald-700" />
          <span className="hidden sm:inline">Escanear QR</span>
        </button>

        {/* Acceso rápido a Nuevo Activo */}
        <button
          onClick={() => router.push('/inventario?nuevo=true')}
          className="flex items-center gap-1.5 rounded-xl bg-military-800 px-3 py-1.5 text-xs sm:text-sm font-medium text-white shadow-sm transition hover:bg-military-900"
        >
          <Plus className="h-4 w-4" />
          <span className="hidden md:inline">Nuevo Activo</span>
        </button>

        {/* Menú de Usuario */}
        <div className="relative">
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="flex items-center gap-2 rounded-xl p-1.5 text-left transition hover:bg-slate-100"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-tr from-military-800 to-military-600 font-bold text-xs text-white shadow-sm">
              {currentUser.initials || 'AA'}
            </div>
            <div className="hidden text-left xl:block">
              <span className="block text-xs font-semibold text-slate-800 leading-tight">
                {currentUser.fullName}
              </span>
              <span className="block text-[11px] text-slate-500">
                {currentUser.role} • {currentUser.departmentName || 'IT'}
              </span>
            </div>
            <ChevronDown className="hidden h-3.5 w-3.5 text-slate-400 xl:block" />
          </button>

          {showUserMenu && (
            <div className="absolute right-0 mt-2 w-56 rounded-2xl border border-slate-200 bg-white py-2 shadow-2xl ring-1 ring-black/5 z-50 animate-in fade-in zoom-in-95">
              <div className="border-b border-slate-100 px-4 py-2">
                <p className="text-xs font-bold text-slate-800">{currentUser.fullName}</p>
                <p className="text-[11px] text-slate-500">{currentUser.departmentName}</p>
                <span className="mt-1 inline-block rounded-md bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-800">
                  Rol: {currentUser.role}
                </span>
              </div>

              <div className="py-1 text-xs">
                <button
                  onClick={() => {
                    setShowUserMenu(false);
                    router.push('/usuarios');
                  }}
                  className="flex w-full items-center gap-2 px-4 py-2 text-slate-700 hover:bg-slate-50"
                >
                  <User className="h-4 w-4 text-slate-400" />
                  <span>Usuarios y Permisos</span>
                </button>
                <button
                  onClick={() => {
                    setShowUserMenu(false);
                    router.push('/auditoria');
                  }}
                  className="flex w-full items-center gap-2 px-4 py-2 text-slate-700 hover:bg-slate-50"
                >
                  <ShieldCheck className="h-4 w-4 text-slate-400" />
                  <span>Bitácora de Auditoría</span>
                </button>
              </div>

              <div className="border-t border-slate-100 pt-1 text-xs">
                <button
                  onClick={handleLogout}
                  className="flex w-full items-center gap-2 px-4 py-2 text-rose-600 hover:bg-rose-50"
                >
                  <LogOut className="h-4 w-4" />
                  <span>Cerrar Sesión</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
