'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Boxes,
  Smartphone,
  Layers,
  ArrowLeftRight,
  UserCheck,
  Wrench,
  Globe,
  DollarSign,
  FileBarChart2,
  Building2,
  Users,
  History,
  Settings,
  X,
  PanelLeftClose,
} from 'lucide-react';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  onToggleCollapse?: () => void;
  currentUser?: {
    role?: string;
    allowedTabs?: string[];
    [key: string]: any;
  } | null;
  alertCounts?: {
    lowStock?: number;
    expiringServices?: number;
    brokenItems?: number;
  };
}

export const allNavigationItems = [
  { name: 'Inicio / Dashboard', href: '/', icon: LayoutDashboard, tabKey: 'DASHBOARD' },
  { name: 'Inventario físico', href: '/inventario', icon: Boxes, tabKey: 'INVENTARIO' },
  { name: 'Celulares y líneas', href: '/celulares', icon: Smartphone, tabKey: 'CELULARES' },
  { name: 'Categorías y productos', href: '/productos', icon: Layers, tabKey: 'PRODUCTOS' },
  { name: 'Entradas y movimientos', href: '/movimientos', icon: ArrowLeftRight, tabKey: 'MOVIMIENTOS', adminOnly: true },
  { name: 'Asignaciones a personal', href: '/asignaciones', icon: UserCheck, tabKey: 'ASIGNACIONES' },
  { name: 'Averías y mantenimiento', href: '/mantenimiento', icon: Wrench, tabKey: 'MANTENIMIENTO', badgeKey: 'brokenItems' },
  { name: 'Licencias y contratos', href: '/servicios-digitales', icon: Globe, tabKey: 'SERVICIOS', badgeKey: 'expiringServices' },
  { name: 'Costos y facturas', href: '/costos', icon: DollarSign, tabKey: 'COSTOS' },
  { name: 'Reportes y métricas', href: '/reportes', icon: FileBarChart2, tabKey: 'REPORTES' },
  { name: 'Áreas y empleados', href: '/departamentos', icon: Building2, tabKey: 'DEPARTAMENTOS' },
  { name: 'Usuarios y permisos', href: '/usuarios', icon: Users, tabKey: 'USUARIOS', adminOnly: true },
  { name: 'Historial de auditoría', href: '/auditoria', icon: History, tabKey: 'AUDITORIA', adminOnly: true },
  { name: 'Configuración', href: '/configuracion', icon: Settings, tabKey: 'CONFIGURACION' },
];

export default function Sidebar({
  isOpen,
  onClose,
  onToggleCollapse,
  currentUser,
  alertCounts = {},
}: SidebarProps) {
  const pathname = usePathname();
  const [customTabNames, setCustomTabNames] = useState<Record<string, string>>({});

  useEffect(() => {
    const loadNames = () => {
      try {
        const saved = localStorage.getItem('sivarstock_tab_names');
        if (saved) setCustomTabNames(JSON.parse(saved));
      } catch {
        // Ignorar errores de parseo
      }
    };
    loadNames();
    window.addEventListener('storage', loadNames);
    return () => window.removeEventListener('storage', loadNames);
  }, [pathname]);

  // Filtrado de pestañas según permisos del usuario (RBAC granular)
  const userAllowedTabs = currentUser?.allowedTabs || [
    'DASHBOARD', 'INVENTARIO', 'CELULARES', 'PRODUCTOS', 'MOVIMIENTOS',
    'ASIGNACIONES', 'MANTENIMIENTO', 'SERVICIOS', 'COSTOS', 'REPORTES',
    'DEPARTAMENTOS', 'USUARIOS', 'AUDITORIA', 'CONFIGURACION'
  ];

  const visibleItems = allNavigationItems.filter((item) => {
    if (item.adminOnly && currentUser?.role !== 'ADMIN') {
      return false;
    }
    if (currentUser?.role !== 'ADMIN' && !userAllowedTabs.includes(item.tabKey)) {
      return false;
    }
    return true;
  });

  return (
    <>
      {/* Overlay para móviles */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 flex w-72 flex-col bg-military-900 text-slate-100 transition-all duration-300 ease-in-out lg:static lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Cabecera del Sidebar con Logo interactivo */}
        <div className="flex h-16 items-center justify-between border-b border-military-800 px-4 sm:px-6">
          <button
            onClick={() => {
              if (onToggleCollapse) onToggleCollapse();
            }}
            className="group flex items-center gap-3 text-left transition hover:opacity-90 focus:outline-none"
            title="Hacer clic para ocultar barra y activar burbuja flotante"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-military-700 to-military-600 text-white shadow-md ring-1 ring-emerald-400/30 group-hover:ring-emerald-400">
              <Boxes className="h-6 w-6 text-emerald-400 transition-transform group-hover:scale-105" />
            </div>
            <div>
              <span className="text-xl font-bold tracking-tight text-white flex items-center gap-1.5">
                SivarStock
                <span className="text-[10px] rounded bg-emerald-500/20 text-emerald-300 px-1 py-0.2 border border-emerald-500/30">GT</span>
              </span>
              <span className="block text-[10px] uppercase tracking-wider text-military-300">Inventario & Activos</span>
            </div>
          </button>

          <div className="flex items-center gap-1">
            {onToggleCollapse && (
              <button
                onClick={onToggleCollapse}
                className="hidden lg:flex rounded-lg p-1.5 text-slate-400 hover:bg-military-800 hover:text-white transition"
                title="Minimizar a burbuja flotante"
              >
                <PanelLeftClose className="h-4 w-4" />
              </button>
            )}

            <button
              onClick={onClose}
              className="rounded-lg p-1 text-slate-400 hover:bg-military-800 hover:text-white lg:hidden"
              aria-label="Cerrar menú"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Lista de Navegación */}
        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4 text-sm font-medium">
          {visibleItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
            const badgeCount = item.badgeKey ? (alertCounts as any)[item.badgeKey] : 0;
            const displayLabel = customTabNames[item.href] || item.name;

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={`group flex items-center justify-between rounded-xl px-3 py-2.5 transition-all ${
                  isActive
                    ? 'bg-military-700 text-white font-semibold shadow-md ring-1 ring-white/10'
                    : 'text-slate-300 hover:bg-military-800/80 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon
                    className={`h-4 w-4 shrink-0 transition-colors ${
                      isActive ? 'text-emerald-400' : 'text-slate-400 group-hover:text-slate-200'
                    }`}
                  />
                  <span className="truncate">{displayLabel}</span>
                </div>

                {badgeCount > 0 && (
                  <span className="flex h-5 items-center justify-center rounded-full bg-rose-600 px-1.5 text-[10px] font-bold text-white shadow">
                    {badgeCount}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Pie de Sidebar con información de empresa y Quetzales */}
        <div className="border-t border-military-800 p-4">
          <div className="rounded-xl bg-military-800/70 p-3 text-xs text-slate-300 ring-1 ring-white/5">
            <div className="flex items-center justify-between font-semibold text-emerald-400">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                Guatemala (GTQ)
              </span>
              <span className="font-mono text-[11px] text-slate-400">IVA 12%</span>
            </div>
            <p className="mt-1 text-[11px] text-slate-400 truncate">
              Persiluz / SivarStock • Bodega Central
            </p>
          </div>
        </div>
      </aside>
    </>
  );
}
