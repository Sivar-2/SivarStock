'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Boxes,
  Lock,
  User,
  ArrowRight,
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
  KeyRound,
  Eye,
  EyeOff,
  Server,
  ArrowLeft,
  Delete,
  Smartphone,
  LogOut,
} from 'lucide-react';

interface QuickUser {
  username: string;
  fullName: string;
  initials: string;
  role: string;
}

export default function LoginPage() {
  const router = useRouter();

  // Estados del flujo
  const [step, setStep] = useState<'CREDENTIALS' | 'PIN_CHALLENGE' | 'QUICK_PIN'>('CREDENTIALS');
  const [quickUser, setQuickUser] = useState<QuickUser | null>(null);

  // Credenciales Paso 1
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberDevice, setRememberDevice] = useState(true);

  // Desafío Paso 2 (PIN de 4 dígitos)
  const [tempToken, setTempToken] = useState<string | null>(null);
  const [targetUser, setTargetUser] = useState<{ username: string; fullName: string; initials: string } | null>(null);
  const [pin, setPin] = useState<string>('');

  // Estados de retroalimentación
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Al montar el componente, verificar si hay un usuario recordado en este dispositivo (PC o APK)
  useEffect(() => {
    try {
      const stored = localStorage.getItem('sivarstock_quick_user');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && parsed.username) {
          setQuickUser(parsed);
          setTargetUser(parsed);
          setStep('QUICK_PIN');
        }
      }
    } catch {
      // Ignorar error de parsing
    }
  }, []);

  // Manejar teclado físico para PIN
  useEffect(() => {
    if (step !== 'PIN_CHALLENGE' && step !== 'QUICK_PIN') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (loading || success) return;

      if (e.key >= '0' && e.key <= '9') {
        if (pin.length < 4) {
          setPin((prev) => {
            const next = prev + e.key;
            if (next.length === 4) {
              setTimeout(() => submitPin(next), 50);
            }
            return next;
          });
        }
      } else if (e.key === 'Backspace') {
        setPin((prev) => prev.slice(0, -1));
      } else if (e.key === 'Escape') {
        setPin('');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [step, pin, loading, success]);

  // Manejo de dígitos en keypad táctil/en pantalla
  const handleKeypadPress = (digit: string) => {
    if (loading || success || pin.length >= 4) return;
    setError(null);
    const nextPin = pin + digit;
    setPin(nextPin);
    if (nextPin.length === 4) {
      setTimeout(() => submitPin(nextPin), 50);
    }
  };

  const handleKeypadBackspace = () => {
    if (loading || success) return;
    setPin((prev) => prev.slice(0, -1));
  };

  const handleKeypadClear = () => {
    if (loading || success) return;
    setPin('');
  };

  // Paso 1: Envío de credenciales (Usuario y Contraseña)
  const handleCredentialsLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier.trim() || !password) {
      setError('Por favor complete su usuario y contraseña.');
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: identifier.trim(),
          password,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Credenciales inválidas.');
      }

      // Si requiere segundo factor (PIN de 4 dígitos)
      if (data.requiresPin && data.tempToken) {
        setTempToken(data.tempToken);
        setTargetUser({
          username: data.username,
          fullName: data.fullName,
          initials: data.initials || 'US',
        });
        setPin('');
        setStep('PIN_CHALLENGE');
        setLoading(false);
        return;
      }

      // Si no requiere PIN, acceso directo
      setSuccess(true);
      setTimeout(() => {
        router.push('/');
        router.refresh();
      }, 500);
    } catch (err: any) {
      setError(err.message || 'Error al iniciar sesión.');
      setLoading(false);
    }
  };

  // Paso 2: Envío de PIN de 4 dígitos
  const submitPin = async (pinValue: string) => {
    setError(null);
    setLoading(true);

    try {
      if (step === 'QUICK_PIN' && quickUser) {
        // Modo rápido con PIN directo
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            quickLogin: true,
            username: quickUser.username,
            pin: pinValue,
          }),
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || 'PIN incorrecto.');
        }

        setSuccess(true);
        setTimeout(() => {
          router.push('/');
          router.refresh();
        }, 500);
      } else if (step === 'PIN_CHALLENGE' && tempToken) {
        // Desafío temporal 2FA
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tempToken,
            pin: pinValue,
            rememberDevice,
          }),
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || 'PIN incorrecto.');
        }

        // Si se seleccionó recordar dispositivo, guardar perfil mínimo
        if (rememberDevice && data.quickAccess) {
          localStorage.setItem('sivarstock_quick_user', JSON.stringify(data.quickAccess));
        }

        setSuccess(true);
        setTimeout(() => {
          router.push('/');
          router.refresh();
        }, 500);
      }
    } catch (err: any) {
      setError(err.message || 'Error al validar el PIN.');
      setPin('');
      setLoading(false);
    }
  };

  const handleForgetQuickUser = () => {
    localStorage.removeItem('sivarstock_quick_user');
    setQuickUser(null);
    setTargetUser(null);
    setPin('');
    setStep('CREDENTIALS');
    setError(null);
  };

  const handleBackToCredentials = () => {
    setTempToken(null);
    setPin('');
    setStep('CREDENTIALS');
    setError(null);
  };

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-military-950 px-4 py-8 text-slate-100 items-center justify-center">
      <div className="w-full max-w-md">
        {/* Encabezado Corporativo FPC */}
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-tr from-military-800 to-military-700 text-emerald-400 shadow-xl ring-1 ring-emerald-500/30">
            <Boxes className="h-9 w-9" />
          </div>
          <span className="text-[11px] font-bold tracking-widest text-emerald-400 uppercase">
            Fábrica de Persianas y Complementos, S.A.
          </span>
          <h1 className="text-3xl font-black tracking-tight text-white mt-0.5">
            SivarStock <span className="text-emerald-400 text-xl font-mono">v2.0</span>
          </h1>
          <p className="mt-1 text-xs text-slate-400">
            Control de Inventario Físico & Digital • Guatemala (GTQ)
          </p>

          <div className="mt-2.5 inline-flex items-center gap-2 rounded-full bg-slate-800/80 px-3 py-1 text-[11px] font-medium text-slate-300 border border-slate-700/60 shadow-xs">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            <Server className="h-3 w-3 text-emerald-400" />
            <span>Servidor FPC LAN • Local-First</span>
          </div>
        </div>

        {/* Tarjeta de Autenticación */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-6 shadow-2xl backdrop-blur-xl sm:p-8 relative overflow-hidden">
          {/* Alertas */}
          {error && (
            <div className="mb-5 flex items-start gap-3 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3.5 text-xs text-rose-300">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-400 mt-0.5" />
              <div className="flex-1">
                <span className="font-semibold block text-rose-200">Error de Autenticación</span>
                <span>{error}</span>
              </div>
            </div>
          )}

          {success && (
            <div className="mb-5 flex items-center gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3.5 text-xs text-emerald-300">
              <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
              <div>
                <span className="font-semibold block text-emerald-200">¡Acceso Autorizado!</span>
                <span>Cargando módulos y permisos del sistema...</span>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* MODO 1: ACCESO RÁPIDO CON PIN EN DISPOSITIVO RECORDADO                    */}
          {/* ========================================================================= */}
          {step === 'QUICK_PIN' && quickUser && (
            <div className="space-y-6">
              <div className="text-center">
                <div className="mx-auto mb-2.5 flex h-14 w-14 items-center justify-center rounded-full bg-military-800 text-emerald-300 font-bold text-lg ring-2 ring-emerald-500/30 shadow-md">
                  {quickUser.initials || 'TS'}
                </div>
                <h2 className="text-base font-bold text-white">
                  Bienvenido, {quickUser.fullName}
                </h2>
                <p className="text-xs text-slate-400 font-mono mt-0.5">
                  @{quickUser.username} • {quickUser.role}
                </p>
                <div className="mt-2 inline-flex items-center gap-1 text-[11px] text-emerald-400">
                  <Smartphone className="h-3 w-3" />
                  <span>Dispositivo Recordado FPC</span>
                </div>
              </div>

              {/* Indicador Visual de PIN (4 dígitos) */}
              <div className="space-y-2">
                <label className="block text-center text-xs font-semibold text-slate-300">
                  Ingresa tu PIN de 4 dígitos
                </label>
                <div className="flex justify-center gap-3 py-2">
                  {[0, 1, 2, 3].map((idx) => {
                    const isFilled = pin.length > idx;
                    const isActive = pin.length === idx;
                    return (
                      <div
                        key={idx}
                        className={`h-12 w-12 rounded-xl border flex items-center justify-center transition-all ${
                          isFilled
                            ? 'border-emerald-500 bg-emerald-950/40 text-emerald-400 shadow-md ring-2 ring-emerald-500/30'
                            : isActive
                            ? 'border-emerald-400 bg-slate-800 ring-2 ring-emerald-400/20'
                            : 'border-slate-700 bg-slate-950/60'
                        }`}
                      >
                        {isFilled ? (
                          <span className="h-3 w-3 rounded-full bg-emerald-400 animate-in fade-in zoom-in" />
                        ) : (
                          <span className="text-xs font-mono text-slate-600">_</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Teclado Numérico Táctil */}
              <div className="grid grid-cols-3 gap-2.5 pt-1">
                {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
                  <button
                    key={digit}
                    type="button"
                    disabled={loading || success}
                    onClick={() => handleKeypadPress(digit)}
                    className="flex h-12 items-center justify-center rounded-xl border border-slate-700/80 bg-slate-800/80 text-lg font-bold text-white shadow-sm transition hover:bg-slate-700 active:scale-95 focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:opacity-50"
                  >
                    {digit}
                  </button>
                ))}
                <button
                  type="button"
                  disabled={loading || success || pin.length === 0}
                  onClick={handleKeypadClear}
                  className="flex h-12 items-center justify-center rounded-xl border border-slate-800 bg-slate-900/60 text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 active:scale-95 transition disabled:opacity-30"
                >
                  Borrar
                </button>
                <button
                  type="button"
                  disabled={loading || success}
                  onClick={() => handleKeypadPress('0')}
                  className="flex h-12 items-center justify-center rounded-xl border border-slate-700/80 bg-slate-800/80 text-lg font-bold text-white shadow-sm transition hover:bg-slate-700 active:scale-95 focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:opacity-50"
                >
                  0
                </button>
                <button
                  type="button"
                  disabled={loading || success || pin.length === 0}
                  onClick={handleKeypadBackspace}
                  className="flex h-12 items-center justify-center rounded-xl border border-slate-800 bg-slate-900/60 text-slate-300 hover:text-rose-400 hover:bg-slate-800 active:scale-95 transition disabled:opacity-30"
                  title="Eliminar último dígito"
                >
                  <Delete className="h-5 w-5" />
                </button>
              </div>

              {/* Botón para cambiar de cuenta */}
              <div className="pt-2 text-center">
                <button
                  type="button"
                  onClick={handleForgetQuickUser}
                  className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition"
                >
                  <LogOut className="h-3.5 w-3.5 text-slate-500" />
                  <span>Ingresar con otra cuenta o contraseña completa</span>
                </button>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* MODO 2: PASO 2 - DESAFÍO 2FA (PIN DE 4 DÍGITOS) TRAS CONTRASEÑA           */}
          {/* ========================================================================= */}
          {step === 'PIN_CHALLENGE' && targetUser && (
            <div className="space-y-6">
              <div className="text-center">
                <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-950/60 text-emerald-400 ring-1 ring-emerald-500/30">
                  <KeyRound className="h-6 w-6" />
                </div>
                <h2 className="text-base font-bold text-white">
                  Verificación de Acceso (2FA)
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Hola <strong className="text-slate-200">{targetUser.fullName}</strong>, ingresa tu PIN de 4 dígitos para autorizar el ingreso.
                </p>
              </div>

              {/* Indicador Visual de PIN */}
              <div className="space-y-2">
                <div className="flex justify-center gap-3 py-2">
                  {[0, 1, 2, 3].map((idx) => {
                    const isFilled = pin.length > idx;
                    const isActive = pin.length === idx;
                    return (
                      <div
                        key={idx}
                        className={`h-12 w-12 rounded-xl border flex items-center justify-center transition-all ${
                          isFilled
                            ? 'border-emerald-500 bg-emerald-950/40 text-emerald-400 shadow-md ring-2 ring-emerald-500/30'
                            : isActive
                            ? 'border-emerald-400 bg-slate-800 ring-2 ring-emerald-400/20'
                            : 'border-slate-700 bg-slate-950/60'
                        }`}
                      >
                        {isFilled ? (
                          <span className="h-3 w-3 rounded-full bg-emerald-400 animate-in fade-in zoom-in" />
                        ) : (
                          <span className="text-xs font-mono text-slate-600">_</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Teclado Numérico */}
              <div className="grid grid-cols-3 gap-2.5">
                {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
                  <button
                    key={digit}
                    type="button"
                    disabled={loading || success}
                    onClick={() => handleKeypadPress(digit)}
                    className="flex h-12 items-center justify-center rounded-xl border border-slate-700/80 bg-slate-800/80 text-lg font-bold text-white shadow-sm transition hover:bg-slate-700 active:scale-95 focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:opacity-50"
                  >
                    {digit}
                  </button>
                ))}
                <button
                  type="button"
                  disabled={loading || success || pin.length === 0}
                  onClick={handleKeypadClear}
                  className="flex h-12 items-center justify-center rounded-xl border border-slate-800 bg-slate-900/60 text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 active:scale-95 transition disabled:opacity-30"
                >
                  Borrar
                </button>
                <button
                  type="button"
                  disabled={loading || success}
                  onClick={() => handleKeypadPress('0')}
                  className="flex h-12 items-center justify-center rounded-xl border border-slate-700/80 bg-slate-800/80 text-lg font-bold text-white shadow-sm transition hover:bg-slate-700 active:scale-95 focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:opacity-50"
                >
                  0
                </button>
                <button
                  type="button"
                  disabled={loading || success || pin.length === 0}
                  onClick={handleKeypadBackspace}
                  className="flex h-12 items-center justify-center rounded-xl border border-slate-800 bg-slate-900/60 text-slate-300 hover:text-rose-400 hover:bg-slate-800 active:scale-95 transition disabled:opacity-30"
                  title="Eliminar último dígito"
                >
                  <Delete className="h-5 w-5" />
                </button>
              </div>

              {/* Botón Volver */}
              <div className="pt-2 text-center">
                <button
                  type="button"
                  onClick={handleBackToCredentials}
                  className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  <span>Volver a ingresar credenciales</span>
                </button>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* MODO 3: PASO 1 - FORMULARIO DE USUARIO Y CONTRASEÑA                       */}
          {/* ========================================================================= */}
          {step === 'CREDENTIALS' && (
            <form onSubmit={handleCredentialsLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300">
                  Usuario o Correo Institucional
                </label>
                <div className="relative mt-1.5">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                    <User className="h-4 w-4" />
                  </div>
                  <input
                    type="text"
                    required
                    autoFocus
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder="Ej. TurcoSivar o usuario"
                    className="w-full rounded-xl border border-slate-700 bg-slate-950/70 py-2.5 pl-10 pr-3 text-sm text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300">
                  Contraseña de Acceso
                </label>
                <div className="relative mt-1.5">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                    <Lock className="h-4 w-4" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full rounded-xl border border-slate-700 bg-slate-950/70 py-2.5 pl-10 pr-10 text-sm text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-slate-400 hover:text-slate-200"
                    title={showPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* Checkbox Recordar en este dispositivo */}
              <div className="flex items-center justify-between pt-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={rememberDevice}
                    onChange={(e) => setRememberDevice(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-700 bg-slate-950 text-emerald-500 focus:ring-emerald-400 focus:ring-offset-slate-900"
                  />
                  <span className="text-xs text-slate-300">
                    Recordar en este equipo (PIN rápido)
                  </span>
                </label>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-950/50 transition hover:from-emerald-500 hover:to-teal-500 active:scale-98 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50"
              >
                <span>{loading ? 'Verificando...' : 'Continuar'}</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </form>
          )}

          {/* Caja Informativa de Seguridad Local */}
          <div className="mt-6 rounded-xl border border-slate-800/80 bg-slate-950/60 p-3.5 text-[11px] text-slate-400">
            <div className="font-semibold text-slate-300 mb-1 flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
              Seguridad FPC & Local-First:
            </div>
            <p className="text-slate-400 leading-relaxed text-[10px]">
              Acceso protegido mediante criptografía HMAC-SHA256 y PIN de 4 dígitos. Los permisos son administrados exclusivamente por el Super Admin en el módulo de Permisos.
            </p>
          </div>
        </div>

        {/* Footer */}
        <p className="mt-6 text-center text-xs text-slate-500 font-mono">
          FPC • SivarStock Local-First Enterprise • Quetzales (GTQ) & USD
        </p>
      </div>
    </div>
  );
}
