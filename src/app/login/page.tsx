'use client';

import React, { useState } from 'react';
import { Boxes, Lock, User, ArrowRight, ShieldCheck, AlertCircle, CheckCircle2, Zap } from 'lucide-react';

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

function getTargetRouteForUser(user: any): string {
  if (!user || user.role === 'ADMIN') return '/';
  const tabs: string[] = Array.isArray(user.allowedTabs) ? user.allowedTabs : [];
  if (tabs.includes('DASHBOARD')) return '/';
  for (const t of tabs) {
    if (TAB_TO_ROUTE[t]) {
      return TAB_TO_ROUTE[t];
    }
  }
  return '/inventario';
}

export default function LoginPage() {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const performLogin = async (userVal: string, passVal: string) => {
    setError(null);
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          username: userVal.trim(),
          password: passVal,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Credenciales inválidas.');
      }

      if (data.user) {
        try {
          sessionStorage.setItem('sivarstock_logged_user', JSON.stringify(data.user));
        } catch {
          // Ignorar si sessionStorage está restringido
        }
      }

      setSuccess(true);
      const targetRoute = getTargetRouteForUser(data.user);
      window.location.href = targetRoute;
    } catch (err: any) {
      setError(err.message || 'Error al iniciar sesión.');
      setLoading(false);
    }
  };

  const handleCredentialsLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    await performLogin(identifier, password);
  };

  const handleQuickDirectLogin = async () => {
    setIdentifier('turcosivar');
    setPassword('12345679');
    await performLogin('turcosivar', '12345679');
  };

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-slate-900 via-military-900 to-slate-950 px-4 py-8 text-slate-100 sm:px-6 lg:px-8 items-center justify-center">
      <div className="w-full max-w-md">
        {/* Encabezado y Logo */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-military-800 text-emerald-400 shadow-xl ring-1 ring-emerald-500/30">
            <Boxes className="h-9 w-9" />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white">SivarStock</h1>
          <p className="mt-1 text-sm text-slate-400">
            Control de Inventario Físico & Digital • Guatemala
          </p>
          <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-400 border border-emerald-500/20">
            <ShieldCheck className="h-3.5 w-3.5" />
            Acceso Seguro por Roles y Permisos
          </div>
        </div>

        {/* Tarjeta de Autenticación */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-6 shadow-2xl backdrop-blur-xl sm:p-8">
          {error && (
            <div className="mb-5 flex items-start gap-3 rounded-lg border border-rose-500/30 bg-rose-500/10 p-3.5 text-xs text-rose-300">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="mb-5 flex items-center gap-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3.5 text-xs text-emerald-300">
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              <span>¡Acceso verificado! Entrando al sistema...</span>
            </div>
          )}

          {/* Botón de Acceso Rápido Directo (turcosivar / 12345679) */}
          <div className="mb-6">
            <button
              type="button"
              disabled={loading}
              onClick={handleQuickDirectLogin}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-950/50 px-4 py-3 text-xs sm:text-sm font-bold text-emerald-300 shadow-sm transition hover:bg-emerald-900/60 hover:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-60"
            >
              <Zap className="h-4 w-4 text-emerald-400" />
              <span>Acceso Rápido Directo</span>
            </button>
          </div>

          <div className="relative mb-6 flex items-center justify-center">
            <div className="w-full border-t border-slate-800"></div>
            <span className="absolute bg-slate-900 px-3 text-xs text-slate-400">
              Ingresar con usuario y contraseña
            </span>
          </div>

          {/* Formulario de Usuario y Contraseña */}
          <form onSubmit={handleCredentialsLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-300">
                Usuario
              </label>
              <div className="relative mt-1">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                  <User className="h-4 w-4" />
                </div>
                <input
                  type="text"
                  required
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="Ingresa tu usuario"
                  autoComplete="username"
                  className="w-full rounded-xl border border-slate-700 bg-slate-950/70 py-2.5 pl-10 pr-3 text-sm text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300">
                Contraseña
              </label>
              <div className="relative mt-1">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                  <Lock className="h-4 w-4" />
                </div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  className="w-full rounded-xl border border-slate-700 bg-slate-950/70 py-2.5 pl-10 pr-3 text-sm text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-900/30 transition hover:from-emerald-500 hover:to-teal-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50"
            >
              <span>{loading ? 'Ingresando...' : 'Iniciar Sesión'}</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </form>
        </div>

        {/* Footer */}
        <p className="mt-6 text-center text-xs text-slate-500">
          SivarStock • Sistema Seguro de Gestión de Activos • Quetzales (GTQ) & USD
        </p>
      </div>
    </div>
  );
}
