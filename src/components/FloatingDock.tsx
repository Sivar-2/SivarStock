'use client';

import React from 'react';
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
  PanelLeftOpen,
} from 'lucide-react';

interface FloatingDockProps {
  onOpenScanner: () => void;
  onExpandSidebar: () => void;
  customShortcuts?: { name: string; href: string }[];
}

export default function FloatingDock({
  onOpenScanner,
  onExpandSidebar,
  customShortcuts,
}: FloatingDockProps) {
  const pathname = usePathname();

  // Atajos predeterminados según el requerimiento:
  // Izquierda: Inicio | Inventario
  // Centro: Escanear código QR o de barra
  // Derecha: Costos | Reportes
  const defaultShortcuts = [
    { name: 'Inicio', href: '/', icon: LayoutDashboard },
    { name: 'Inventario', href: '/inventario', icon: Boxes },
    { name: 'Costos', href: '/costos', icon: DollarSign },
    { name: 'Reportes', href: '/reportes', icon: FileBarChart2 },
  ];

  const leftShortcuts = defaultShortcuts.slice(0, 2);
  const rightShortcuts = defaultShortcuts.slice(2, 4);

  return (
    <div className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 transform transition-all duration-300 animate-in fade-in slide-in-from-bottom-5">
      <div className="flex items-center gap-1.5 sm:gap-3 rounded-full border border-slate-700/80 bg-slate-900/90 px-3 sm:px-4 py-2 shadow-2xl backdrop-blur-xl ring-1 ring-white/10">
        {/* Botón para expandir la barra lateral completa */}
        <button
          onClick={onExpandSidebar}
          className="flex h-10 w-10 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-800 hover:text-white"
          title="Mostrar barra lateral de menú"
          aria-label="Expandir menú"
        >
          <PanelLeftOpen className="h-5 w-5" />
        </button>

        <div className="h-6 w-px bg-slate-800" />

        {/* Atajos de la Izquierda */}
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

        {/* Botón Central: Escáner QR / Barra Destacado (Estilo iPhone) */}
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

        {/* Atajos de la Derecha */}
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
