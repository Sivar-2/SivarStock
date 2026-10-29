'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Boxes,
  QrCode,
  DollarSign,
  FileBarChart2,
  Smartphone,
  Layers,
  ArrowLeftRight,
  UserCheck,
  Wrench,
  Globe,
  Building2,
  Settings,
  PanelLeftOpen,
} from 'lucide-react';

interface FloatingDockProps {
  onOpenScanner: () => void;
  onExpandSidebar: () => void;
  currentUser?: {
    role?: string;
    allowedTabs?: string[];
  } | null;
}

const SHORTCUT_MAP: Record<string, { name: string; icon: any; tabKey: string }> = {
  '/': { name: 'Inicio', icon: LayoutDashboard, tabKey: 'DASHBOARD' },
  '/inventario': { name: 'Inventario', icon: Boxes, tabKey: 'INVENTARIO' },
  '/celulares': { name: 'Celulares', icon: Smartphone, tabKey: 'CELULARES' },
  '/productos': { name: 'Productos', icon: Layers, tabKey: 'PRODUCTOS' },
  '/movimientos': { name: 'Movimientos', icon: ArrowLeftRight, tabKey: 'MOVIMIENTOS' },
  '/asignaciones': { name: 'Asignaciones', icon: UserCheck, tabKey: 'ASIGNACIONES' },
  '/mantenimiento': { name: 'Averías', icon: Wrench, tabKey: 'MANTENIMIENTO' },
  '/servicios-digitales': { name: 'Servicios', icon: Globe, tabKey: 'SERVICIOS' },
  '/costos': { name: 'Costos', icon: DollarSign, tabKey: 'COSTOS' },
  '/reportes': { name: 'Reportes', icon: FileBarChart2, tabKey: 'REPORTES' },
  '/departamentos': { name: 'Áreas', icon: Building2, tabKey: 'DEPARTAMENTOS' },
  '/configuracion': { name: 'Ajustes', icon: Settings, tabKey: 'CONFIGURACION' },
};

export default function FloatingDock({
  onOpenScanner,
  onExpandSidebar,
  currentUser,
}: FloatingDockProps) {
  const pathname = usePathname();
  const [shortcutHrefs, setShortcutHrefs] = useState<string[]>([
    '/',
    '/inventario',
    '/asignaciones',
    '/reportes',
  ]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('sivarstock_dock_shortcuts');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length === 4) {
          setShortcutHrefs(parsed);
        } else if (parsed && typeof parsed === 'object') {
          const list = [
            parsed.left1?.href,
            parsed.left2?.href,
            parsed.right1?.href,
            parsed.right2?.href,
          ].filter(Boolean);
          if (list.length === 4) setShortcutHrefs(list);
        }
      }
    } catch {
      // Ignorar errores de parseo
    }
  }, [pathname]);

  const allowedTabs = Array.isArray(currentUser?.allowedTabs) ? currentUser!.allowedTabs : [];
  const isAdmin = currentUser?.role === 'ADMIN';

  const resolvedShortcuts = shortcutHrefs
    .map((href) => {
      const info = SHORTCUT_MAP[href] || { name: 'Módulo', icon: Boxes, tabKey: 'INVENTARIO' };
      return { href, name: info.name, icon: info.icon, tabKey: info.tabKey };
    })
    .filter((item) => isAdmin || allowedTabs.includes(item.tabKey));

  const leftShortcuts = resolvedShortcuts.slice(0, 2);
  const rightShortcuts = resolvedShortcuts.slice(2, 4);

  return (
    <div className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 transform transition-all duration-300 animate-in fade-in slide-in-from-bottom-5">
      <div className="flex items-center gap-1.5 sm:gap-3 rounded-full border border-slate-700/80 bg-slate-900/90 px-3 sm:px-4 py-2 shadow-2xl backdrop-blur-xl ring-1 ring-white/10">
        <button
          onClick={onExpandSidebar}
          className="flex h-10 w-10 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-800 hover:text-white"
          title="Mostrar barra lateral de menú"
          aria-label="Expandir menú"
        >
          <PanelLeftOpen className="h-5 w-5" />
        </button>

        <div className="h-6 w-px bg-slate-800" />

        {leftShortcuts.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center rounded-2xl px-2.5 py-1 transition-all ${
                isActive
                  ? 'bg-military-700 text-emerald-400 font-semibold shadow-inner'
                  : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
              }`}
              title={item.name}
            >
              <Icon className="h-5 w-5" />
              <span className="text-[10px] hidden sm:inline mt-0.5">{item.name}</span>
            </Link>
          );
        })}

        <div className="relative -my-3 px-1">
          <button
            onClick={onOpenScanner}
            className="group relative flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-tr from-emerald-600 to-teal-500 text-white shadow-lg shadow-emerald-500/30 ring-4 ring-slate-900 transition-transform duration-200 hover:scale-110 active:scale-95"
            title="Escanear código QR o Código de Barra"
            aria-label="Escanear QR o Barra"
          >
            <QrCode className="h-7 w-7 transition-transform group-hover:rotate-6" />
            <span className="absolute -top-1 -right-1 flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
            </span>
          </button>
        </div>

        {rightShortcuts.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center rounded-2xl px-2.5 py-1 transition-all ${
                isActive
                  ? 'bg-military-700 text-emerald-400 font-semibold shadow-inner'
                  : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
              }`}
              title={item.name}
            >
              <Icon className="h-5 w-5" />
              <span className="text-[10px] hidden sm:inline mt-0.5">{item.name}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
