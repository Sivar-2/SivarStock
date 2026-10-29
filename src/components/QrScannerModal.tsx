'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import {
  X,
  Camera,
  Search,
  ArrowRight,
  UserCheck,
  ArrowLeftRight,
  RotateCcw,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Package,
  User,
  Clock,
  Sparkles,
  QrCode,
  ExternalLink,
} from 'lucide-react';

interface QrScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser?: {
    role?: string;
    canEdit?: boolean;
    fullName?: string;
    [key: string]: any;
  } | null;
}

export default function QrScannerModal({ isOpen, onClose, currentUser }: QrScannerModalProps) {
  const [manualCode, setManualCode] = useState('');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const [loadingAsset, setLoadingAsset] = useState(false);
  const [assetData, setAssetData] = useState<any | null>(null);
  const [productOnlyData, setProductOnlyData] = useState<any | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);

  const [activeAction, setActiveAction] = useState<
    'NONE' | 'ASSIGN' | 'SWAP' | 'RETURN' | 'DECOMMISSION' | 'REACTIVATE'
  >('NONE');
  const [employees, setEmployees] = useState<any[]>([]);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const [assignEmployeeId, setAssignEmployeeId] = useState('');
  const [assignNotes, setAssignNotes] = useState('');

  const [swapNewItemId, setSwapNewItemId] = useState('');
  const [swapDestStatus, setSwapDestStatus] = useState<
    'AVERIADO' | 'EN_REVISION' | 'DADO_DE_BAJA' | 'DISPONIBLE'
  >('AVERIADO');
  const [swapCondition, setSwapCondition] = useState('AVERIADO');
  const [swapReason, setSwapReason] = useState('');

  const [returnCondition, setReturnCondition] = useState('BUENO');
  const [returnNotes, setReturnNotes] = useState('');

  const [decommissionReason, setDecommissionReason] = useState('');
  const [decommissionCondition, setDecommissionCondition] = useState('AVERIADO');

  const [reactivateCondition, setReactivateCondition] = useState('BUENO');
  const [reactivateEmployeeId, setReactivateEmployeeId] = useState('');
  const [reactivateNotes, setReactivateNotes] = useState('');

  const canPerformActions = Boolean(
    !currentUser || currentUser?.role === 'ADMIN' || currentUser?.canEdit !== false
  );

  useEffect(() => {
    if (isOpen) {
      setCameraError(null);
      setLookupError(null);
      setAssetData(null);
      setProductOnlyData(null);
      setActiveAction('NONE');
      startCamera();
      loadEmployees();
    } else {
      stopCamera();
    }

    return () => {
      stopCamera();
    };
  }, [isOpen]);

  const loadEmployees = async () => {
    try {
      const res = await fetch('/api/employees?all=true');
      const data = await res.json();
      if (data.employees) {
        setEmployees(data.employees.filter((e: any) => e.status === 'ACTIVO'));
      }
    } catch (err) {
      console.warn('Error al cargar empleados:', err);
    }
  };

  const startCamera = async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setCameraError('El navegador no soporta acceso a la cámara o requiere HTTPS.');
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true');
        await videoRef.current.play();
        setIsCameraActive(true);
        startBarcodeScanning();
      }
    } catch (err: any) {
      console.warn('Acceso a cámara no disponible:', err);
      setCameraError(
        'Cámara trasera no accesible. Puede utilizar el buscador manual por código o serie abajo.'
      );
      setIsCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setIsCameraActive(false);
  };

  const startBarcodeScanning = () => {
    if (scanIntervalRef.current) clearInterval(scanIntervalRef.current);

    if (typeof window !== 'undefined' && 'BarcodeDetector' in window) {
      try {
        const barcodeDetector = new (window as any).BarcodeDetector({
          formats: ['qr_code', 'code_128', 'code_39', 'ean_13', 'data_matrix'],
        });

        scanIntervalRef.current = setInterval(async () => {
          if (videoRef.current && videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA) {
            try {
              const barcodes = await barcodeDetector.detect(videoRef.current);
              if (barcodes && barcodes.length > 0) {
                const rawValue = barcodes[0].rawValue;
                if (rawValue && rawValue.trim()) {
                  if (typeof navigator !== 'undefined' && navigator.vibrate) {
                    navigator.vibrate([40, 30, 40]);
                  }
                  handleLookupCode(rawValue.trim());
                }
              }
            } catch {
              // Detección en proceso
            }
          }
        }, 350);
      } catch (detectorErr) {
        console.warn('BarcodeDetector no inicializable:', detectorErr);
      }
    }
  };

  const handleLookupCode = async (codeToSearch: string) => {
    let clean = codeToSearch.trim();
    if (!clean) return;

    if (clean.includes('search=')) {
      try {
        const u = new URL(clean);
        clean = u.searchParams.get('search') || clean;
      } catch {
        const parts = clean.split('search=');
        clean = decodeURIComponent(parts[parts.length - 1] || clean);
      }
    }

    setLoadingAsset(true);
    setLookupError(null);
    setAssetData(null);
    setProductOnlyData(null);
    setActiveAction('NONE');
    setActionSuccess(null);
    setActionError(null);

    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }

    try {
      const res = await fetch(`/api/inventory/lifecycle?code=${encodeURIComponent(clean)}`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || `No se encontró activo con el código "${clean}".`);
      }

      if (data.isProductOnly) {
        setProductOnlyData(data.product);
      } else {
        setAssetData(data);
        if (data.item?.current_employee_id) {
          setAssignEmployeeId(data.item.current_employee_id);
        }
      }
    } catch (err: any) {
      setLookupError(err.message || 'Error al consultar código.');
      startBarcodeScanning();
    } finally {
      setLoadingAsset(false);
    }
  };

  const handleResetScan = () => {
    setAssetData(null);
    setProductOnlyData(null);
    setLookupError(null);
    setActionSuccess(null);
    setActionError(null);
    setActiveAction('NONE');
    setManualCode('');
    startBarcodeScanning();
  };

  const executeLifecycleAction = async (actionType: string, payload: any) => {
    setActionLoading(true);
    setActionError(null);
    setActionSuccess(null);

    try {
      const res = await fetch('/api/inventory/lifecycle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: actionType,
          ...payload,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Error al ejecutar la acción.');
      }

      setActionSuccess(data.message || 'Operación completada exitosamente.');
      setActiveAction('NONE');

      if (assetData?.item?.permanent_code) {
        await handleLookupCode(assetData.item.permanent_code);
      }
    } catch (err: any) {
      setActionError(err.message || 'Error al procesar la operación.');
    } finally {
      setActionLoading(false);
    }
  };

  if (!isOpen) return null;

  const item = assetData?.item;
  const activeAssignment = assetData?.activeAssignment;
  const availableSwaps = assetData?.availableSwaps || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-2 sm:p-4 backdrop-blur-md overflow-y-auto">
      <div className="w-full max-w-xl rounded-3xl bg-military-950 border border-military-800 text-slate-100 shadow-2xl overflow-hidden my-auto flex flex-col max-h-[95vh]">
        {/* Encabezado */}
        <div className="flex items-center justify-between border-b border-military-800/80 bg-military-900 px-5 py-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-military-800 border border-military-700/60 text-emerald-400">
              <Camera className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-black tracking-wide text-white flex items-center gap-2">
                <span>Escáner QR / Barra — Ficha y Movimientos en Vivo</span>
              </h3>
              <p className="text-[11px] text-military-300 font-mono">
                Escanea cualquier etiqueta para abrir su ficha y realizar movimientos al instante
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              stopCamera();
              onClose();
            }}
            className="rounded-xl p-2 text-military-300 hover:bg-military-800 hover:text-white transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Cuerpo del Modal */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {!assetData && !productOnlyData && (
            <>
              <div className="relative flex h-60 sm:h-72 w-full flex-col items-center justify-center rounded-2xl bg-black border border-military-800 overflow-hidden shadow-inner">
                {isCameraActive ? (
                  <>
                    <video
                      ref={videoRef}
                      className="h-full w-full object-cover"
                      playsInline
                      autoPlay
                      muted
                    />
                    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                      <div className="relative h-44 w-44 rounded-2xl border-2 border-emerald-400/80 bg-emerald-500/10 shadow-[0_0_25px_rgba(16,185,129,0.3)] animate-pulse">
                        <div className="absolute top-2 left-2 h-4 w-4 border-t-2 border-l-2 border-emerald-300" />
                        <div className="absolute top-2 right-2 h-4 w-4 border-t-2 border-r-2 border-emerald-300" />
                        <div className="absolute bottom-2 left-2 h-4 w-4 border-b-2 border-l-2 border-emerald-300" />
                        <div className="absolute bottom-2 right-2 h-4 w-4 border-b-2 border-r-2 border-emerald-300" />
                        <span className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-[10px] font-mono tracking-wider font-bold text-emerald-400 uppercase whitespace-nowrap bg-military-950/90 px-2 py-0.5 rounded border border-emerald-500/40">
                          Alinee código QR / Barra
                        </span>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="px-6 text-center text-military-300">
                    <QrCode className="mx-auto mb-3 h-12 w-12 text-military-600 animate-pulse" />
                    <p className="text-xs font-medium text-military-300">
                      {cameraError || 'Iniciando cámara trasera de alta resolución...'}
                    </p>
                  </div>
                )}
              </div>

              {cameraError && (
                <div className="flex items-start gap-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 p-3 text-xs text-amber-200">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400 mt-0.5" />
                  <span>{cameraError}</span>
                </div>
              )}

              <div className="rounded-2xl border border-military-800 bg-military-900/60 p-4">
                <label className="block text-xs font-bold text-military-200 mb-2 uppercase tracking-wider">
                  O busque por Código Permanente, Serie (S/N) o Empleado:
                </label>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleLookupCode(manualCode);
                  }}
                  className="flex gap-2"
                >
                  <div className="relative flex-1">
                    <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-military-400" />
                    <input
                      type="text"
                      placeholder="ej. SIV-IT-000001, EMP-001 o N° de Serie"
                      value={manualCode}
                      onChange={(e) => setManualCode(e.target.value)}
                      className="w-full rounded-xl border border-military-700 bg-military-950 py-2.5 pl-10 pr-3 text-xs sm:text-sm text-white placeholder-military-500 uppercase font-mono tracking-wider focus:border-emerald-500 focus:outline-none"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={!manualCode.trim() || loadingAsset}
                    className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-5 py-2.5 text-xs font-bold text-white shadow-lg hover:bg-emerald-500 transition disabled:opacity-50"
                  >
                    {loadingAsset ? (
                      <RefreshCw className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <span>Abrir Ficha</span>
                        <ArrowRight className="h-4 w-4" />
                      </>
                    )}
                  </button>
                </form>
              </div>

              {lookupError && (
                <div className="rounded-xl bg-rose-500/10 border border-rose-500/30 p-3.5 text-xs text-rose-300 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-rose-400" />
                  <span>{lookupError}</span>
                </div>
              )}
            </>
          )}

          {productOnlyData && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-military-800 bg-military-900 p-5">
                <div className="flex items-center justify-between pb-3 border-b border-military-800">
                  <span className="text-xs font-mono font-bold text-emerald-400">
                    PRODUCTO DE CATÁLOGO: {productOnlyData.code}
                  </span>
                  <button
                    onClick={handleResetScan}
                    className="text-xs text-military-300 hover:text-white flex items-center gap-1"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    <span>Escanear Otro</span>
                  </button>
                </div>
                <h4 className="text-lg font-black text-white mt-2">{productOnlyData.name}</h4>
                <div className="mt-4 flex justify-end">
                  <Link
                    href={`/productos`}
                    onClick={() => {
                      stopCamera();
                      onClose();
                    }}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-500"
                  >
                    <span>Ver en Categorías y Productos</span>
                    <ExternalLink className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </div>
            </div>
          )}

          {/* Ficha del Activo Escaneado */}
          {assetData && item && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-mono uppercase tracking-wider text-emerald-400 font-bold">
                  ✓ Ficha del Producto Escaneado
                </span>
                <div className="flex items-center gap-3">
                  <Link
                    href={`/inventario?search=${encodeURIComponent(item.permanent_code)}`}
                    onClick={() => {
                      stopCamera();
                      onClose();
                    }}
                    className="flex items-center gap-1 text-xs font-bold text-cyan-400 hover:underline"
                  >
                    <span>Abrir en Bodega</span>
                    <ExternalLink className="h-3.5 w-3.5" />
                  </Link>
                  <button
                    onClick={handleResetScan}
                    className="flex items-center gap-1 text-xs font-bold text-emerald-400 hover:text-emerald-300 transition"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    <span>Escanear Otro</span>
                  </button>
                </div>
              </div>

              {actionSuccess && (
                <div className="rounded-xl bg-emerald-500/15 border border-emerald-500/40 p-3 text-xs text-emerald-300 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
                  <span>{actionSuccess}</span>
                </div>
              )}
              {actionError && (
                <div className="rounded-xl bg-rose-500/15 border border-rose-500/40 p-3 text-xs text-rose-300 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-rose-400" />
                  <span>{actionError}</span>
                </div>
              )}

              <div className="rounded-2xl border border-military-800 bg-military-900/90 p-5 space-y-4 shadow-xl">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-base font-black tracking-wider text-emerald-400 bg-military-950 px-2.5 py-1 rounded-lg border border-military-800">
                        {item.permanent_code}
                      </span>
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold border ${
                          item.operational_status === 'DISPONIBLE'
                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                            : item.operational_status === 'ASIGNADO'
                            ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                            : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                        }`}
                      >
                        {item.operational_status}
                      </span>
                      <span className="rounded-full bg-military-800 px-2 py-0.5 text-[10px] text-military-300 border border-military-700">
                        Condición: {item.physical_condition || 'BUENO'}
                      </span>
                    </div>

                    <h3 className="text-lg font-black text-white mt-2 leading-tight">
                      {item.product_name}
                    </h3>
                    <p className="text-xs text-military-300 mt-0.5 font-mono">
                      Modelo: {item.brand || item.product_brand || ''} {item.model || item.product_model || ''} | Categoría: {item.category_name}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs font-mono">
                  <div className="p-2.5 rounded-xl bg-military-950 border border-military-800/80">
                    <span className="text-[10px] text-military-400 block uppercase">S/N (Serie):</span>
                    <span className="font-bold text-white truncate block">
                      {item.serial_number || 'SIN SERIE'}
                    </span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-military-950 border border-military-800/80">
                    <span className="text-[10px] text-military-400 block uppercase">Ubicación Actual:</span>
                    <span className="font-bold text-white truncate block">
                      {item.department_name || 'Bodega Central'}
                    </span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-military-950 border border-military-800/80 col-span-2 sm:col-span-1">
                    <span className="text-[10px] text-military-400 block uppercase">Cód. Empleado:</span>
                    <span className="font-bold text-emerald-400 truncate block">
                      {item.employee_code || 'EN BODEGA'}
                    </span>
                  </div>
                </div>

                <div className="rounded-2xl border border-military-700/80 bg-gradient-to-br from-military-950 to-military-900 p-4 shadow-md">
                  <div className="flex items-center gap-2 mb-2">
                    <User className="h-4 w-4 text-emerald-400" />
                    <span className="text-xs font-black uppercase tracking-wider text-military-200">
                      Custodio / Responsable Actual
                    </span>
                  </div>

                  {item.employee_name ? (
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-extrabold text-white">{item.employee_name}</span>
                        <span className="rounded-md bg-emerald-500/20 px-2 py-0.5 text-xs font-mono font-bold text-emerald-300 border border-emerald-500/30">
                          {item.employee_code || 'EMP-ACTIVO'}
                        </span>
                      </div>
                      {activeAssignment && (
                        <div className="pt-2 mt-2 border-t border-military-800 flex items-center justify-between text-[11px] font-mono text-military-300">
                          <span>
                            Asignación: <strong className="text-emerald-400">{activeAssignment.assignment_code}</strong>
                          </span>
                          <span>Fecha Entrega: {new Date(activeAssignment.assigned_at).toLocaleDateString('es-GT')}</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="py-2 text-xs text-military-400 flex items-center gap-2">
                      <Package className="h-4 w-4 text-emerald-500" />
                      <span>Disponible en Bodega Central — listo para movimiento o asignación.</span>
                    </div>
                  )}
                </div>

                {assetData.recentMovements && assetData.recentMovements.length > 0 && (
                  <div className="rounded-xl bg-military-950 p-3 border border-military-800 text-xs">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-military-400 block mb-2 flex items-center gap-1.5">
                      <Clock className="h-3 w-3 text-emerald-400" />
                      Últimos Movimientos del Activo:
                    </span>
                    <div className="space-y-1.5">
                      {assetData.recentMovements.map((mov: any) => (
                        <div
                          key={mov.id}
                          className="flex items-center justify-between text-[11px] text-military-300 border-b border-military-900 pb-1"
                        >
                          <span className="font-bold text-emerald-300">{mov.movement_type}</span>
                          <span className="truncate max-w-[200px] text-military-400">{mov.reason}</span>
                          <span className="font-mono text-[10px] text-military-500">
                            {new Date(mov.created_at).toLocaleDateString('es-GT')}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Botones para realizar movimientos inmediatamente desde el escáner */}
              {canPerformActions && (
                <div className="rounded-2xl border border-military-800 bg-military-900 p-4 space-y-3">
                  <span className="text-xs font-black uppercase tracking-wider text-emerald-400 block">
                    Realizar Movimiento o Asignación Ahora Mismo:
                  </span>

                  <div className="flex flex-wrap gap-2">
                    {item.operational_status === 'DISPONIBLE' && (
                      <button
                        onClick={() => setActiveAction(activeAction === 'ASSIGN' ? 'NONE' : 'ASSIGN')}
                        className={`flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold transition shadow-sm ${
                          activeAction === 'ASSIGN'
                            ? 'bg-emerald-600 text-white'
                            : 'bg-military-800 text-emerald-400 hover:bg-military-700'
                        }`}
                      >
                        <UserCheck className="h-4 w-4" />
                        <span>Asignar a Empleado</span>
                      </button>
                    )}

                    {item.operational_status === 'ASIGNADO' && (
                      <button
                        onClick={() => setActiveAction(activeAction === 'SWAP' ? 'NONE' : 'SWAP')}
                        className={`flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold transition shadow-sm ${
                          activeAction === 'SWAP'
                            ? 'bg-amber-600 text-white'
                            : 'bg-military-800 text-amber-400 hover:bg-military-700'
                        }`}
                      >
                        <ArrowLeftRight className="h-4 w-4" />
                        <span>Cambiar por Otro (Reemplazo)</span>
                      </button>
                    )}

                    {item.operational_status === 'ASIGNADO' && (
                      <button
                        onClick={() => setActiveAction(activeAction === 'RETURN' ? 'NONE' : 'RETURN')}
                        className={`flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold transition shadow-sm ${
                          activeAction === 'RETURN'
                            ? 'bg-blue-600 text-white'
                            : 'bg-military-800 text-blue-400 hover:bg-military-700'
                        }`}
                      >
                        <RotateCcw className="h-4 w-4" />
                        <span>Devolver a Bodega</span>
                      </button>
                    )}

                    {item.operational_status !== 'DADO_DE_BAJA' && (
                      <button
                        onClick={() =>
                          setActiveAction(activeAction === 'DECOMMISSION' ? 'NONE' : 'DECOMMISSION')
                        }
                        className={`flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold transition shadow-sm ${
                          activeAction === 'DECOMMISSION'
                            ? 'bg-rose-600 text-white'
                            : 'bg-military-800 text-rose-400 hover:bg-military-700'
                        }`}
                      >
                        <AlertTriangle className="h-4 w-4" />
                        <span>Dar de Baja / Avería</span>
                      </button>
                    )}

                    {(item.operational_status === 'DADO_DE_BAJA' ||
                      item.operational_status === 'AVERIADO' ||
                      item.operational_status === 'EN_REVISION') && (
                      <button
                        onClick={() => setActiveAction(activeAction === 'REACTIVATE' ? 'NONE' : 'REACTIVATE')}
                        className={`flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold transition shadow-sm ${
                          activeAction === 'REACTIVATE'
                            ? 'bg-emerald-600 text-white'
                            : 'bg-military-800 text-emerald-400 hover:bg-military-700'
                        }`}
                      >
                        <Sparkles className="h-4 w-4" />
                        <span>Reactivar y Reasignar</span>
                      </button>
                    )}
                  </div>

                  {activeAction === 'ASSIGN' && (
                    <div className="rounded-xl border border-emerald-500/40 bg-military-950 p-4 space-y-3">
                      <h4 className="text-xs font-bold text-emerald-400 uppercase">
                        Asignación Formal del Activo
                      </h4>
                      <div>
                        <label className="block text-xs font-bold text-military-300 mb-1">
                          Seleccionar Empleado Custodio *
                        </label>
                        <select
                          value={assignEmployeeId}
                          onChange={(e) => setAssignEmployeeId(e.target.value)}
                          className="w-full rounded-xl border border-military-700 bg-military-900 px-3 py-2 text-xs text-white"
                        >
                          <option value="">Seleccione un empleado...</option>
                          {employees.map((e) => (
                            <option key={e.id} value={e.id}>
                              {e.employee_code} - {e.full_name} ({e.department_name || 'Sin área'})
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-military-300 mb-1">
                          Notas o Condiciones de Entrega
                        </label>
                        <input
                          type="text"
                          placeholder="Ej. Entrega con cargador original"
                          value={assignNotes}
                          onChange={(e) => setAssignNotes(e.target.value)}
                          className="w-full rounded-xl border border-military-700 bg-military-900 px-3 py-2 text-xs text-white"
                        />
                      </div>
                      <div className="flex justify-end gap-2 pt-2">
                        <button
                          onClick={() => setActiveAction('NONE')}
                          className="px-3 py-1.5 text-xs text-military-400 hover:text-white"
                        >
                          Cancelar
                        </button>
                        <button
                          onClick={() =>
                            executeLifecycleAction('ASSIGN', {
                              itemId: item.id,
                              employeeId: assignEmployeeId,
                              notes: assignNotes,
                            })
                          }
                          disabled={!assignEmployeeId || actionLoading}
                          className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-500 disabled:opacity-50"
                        >
                          {actionLoading ? 'Asignando...' : 'Confirmar Asignación'}
                        </button>
                      </div>
                    </div>
                  )}

                  {activeAction === 'SWAP' && (
                    <div className="rounded-xl border border-amber-500/40 bg-military-950 p-4 space-y-3">
                      <h4 className="text-xs font-bold text-amber-400 uppercase">
                        Sustitución por Activo de Bodega
                      </h4>
                      <div>
                        <label className="block text-xs font-bold text-military-300 mb-1">
                          Seleccionar Equipo Sustituto de Bodega *
                        </label>
                        <select
                          value={swapNewItemId}
                          onChange={(e) => setSwapNewItemId(e.target.value)}
                          className="w-full rounded-xl border border-military-700 bg-military-900 px-3 py-2 text-xs text-white font-mono"
                        >
                          <option value="">Seleccione equipo disponible en bodega...</option>
                          {availableSwaps.map((s: any) => (
                            <option key={s.id} value={s.id}>
                              {s.permanent_code} - {s.product_name} (Serie: {s.serial_number || 'S/N'})
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-xs font-bold text-military-300 mb-1">
                            Destino del Equipo Anterior *
                          </label>
                          <select
                            value={swapDestStatus}
                            onChange={(e) => setSwapDestStatus(e.target.value as any)}
                            className="w-full rounded-xl border border-military-700 bg-military-900 px-3 py-2 text-xs text-white"
                          >
                            <option value="AVERIADO">Averiado / Para Reparación</option>
                            <option value="EN_REVISION">En Revisión Técnica</option>
                            <option value="DADO_DE_BAJA">Dado de Baja</option>
                            <option value="DISPONIBLE">Disponible en Bodega</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-military-300 mb-1">
                            Condición Física
                          </label>
                          <select
                            value={swapCondition}
                            onChange={(e) => setSwapCondition(e.target.value)}
                            className="w-full rounded-xl border border-military-700 bg-military-900 px-3 py-2 text-xs text-white"
                          >
                            <option value="AVERIADO">Averiado / Dañado</option>
                            <option value="USADO">Usado Funcional</option>
                            <option value="BUENO">Bueno</option>
                          </select>
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-military-300 mb-1">
                          Motivo del Cambio / Reemplazo *
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="Ej. Falla en pantalla; se reemplaza por equipo de bodega"
                          value={swapReason}
                          onChange={(e) => setSwapReason(e.target.value)}
                          className="w-full rounded-xl border border-military-700 bg-military-900 px-3 py-2 text-xs text-white"
                        />
                      </div>
                      <div className="flex justify-end gap-2 pt-2">
                        <button
                          onClick={() => setActiveAction('NONE')}
                          className="px-3 py-1.5 text-xs text-military-400 hover:text-white"
                        >
                          Cancelar
                        </button>
                        <button
                          onClick={() =>
                            executeLifecycleAction('SWAP', {
                              oldItemId: item.id,
                              newItemId: swapNewItemId,
                              employeeId: item.current_employee_id,
                              oldItemDestinationStatus: swapDestStatus,
                              oldItemCondition: swapCondition,
                              reason: swapReason,
                            })
                          }
                          disabled={!swapNewItemId || !swapReason.trim() || actionLoading}
                          className="rounded-xl bg-amber-600 px-4 py-2 text-xs font-bold text-white hover:bg-amber-500 disabled:opacity-50"
                        >
                          {actionLoading ? 'Sustituyendo...' : 'Confirmar Sustitución'}
                        </button>
                      </div>
                    </div>
                  )}

                  {activeAction === 'RETURN' && (
                    <div className="rounded-xl border border-blue-500/40 bg-military-950 p-4 space-y-3">
                      <h4 className="text-xs font-bold text-blue-400 uppercase">
                        Devolución a Bodega Central
                      </h4>
                      <div>
                        <label className="block text-xs font-bold text-military-300 mb-1">
                          Condición de Recepción Física *
                        </label>
                        <select
                          value={returnCondition}
                          onChange={(e) => setReturnCondition(e.target.value)}
                          className="w-full rounded-xl border border-military-700 bg-military-900 px-3 py-2 text-xs text-white"
                        >
                          <option value="BUENO">Bueno (Completo y funcional)</option>
                          <option value="USADO">Usado (Signos de desgaste)</option>
                          <option value="AVERIADO">Averiado (Requiere revisión)</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-military-300 mb-1">
                          Observaciones de Recepción
                        </label>
                        <input
                          type="text"
                          placeholder="Ej. Recibido completo en bodega"
                          value={returnNotes}
                          onChange={(e) => setReturnNotes(e.target.value)}
                          className="w-full rounded-xl border border-military-700 bg-military-900 px-3 py-2 text-xs text-white"
                        />
                      </div>
                      <div className="flex justify-end gap-2 pt-2">
                        <button
                          onClick={() => setActiveAction('NONE')}
                          className="px-3 py-1.5 text-xs text-military-400 hover:text-white"
                        >
                          Cancelar
                        </button>
                        <button
                          onClick={() =>
                            executeLifecycleAction('RETURN_TO_WAREHOUSE', {
                              itemId: item.id,
                              condition: returnCondition,
                              notes: returnNotes,
                            })
                          }
                          disabled={actionLoading}
                          className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-500 disabled:opacity-50"
                        >
                          {actionLoading ? 'Procesando...' : 'Confirmar Devolución'}
                        </button>
                      </div>
                    </div>
                  )}

                  {activeAction === 'DECOMMISSION' && (
                    <div className="rounded-xl border border-rose-500/40 bg-military-950 p-4 space-y-3">
                      <h4 className="text-xs font-bold text-rose-400 uppercase">Dar de Baja Activo</h4>
                      <div>
                        <label className="block text-xs font-bold text-military-300 mb-1">
                          Condición Física Final
                        </label>
                        <select
                          value={decommissionCondition}
                          onChange={(e) => setDecommissionCondition(e.target.value)}
                          className="w-full rounded-xl border border-military-700 bg-military-900 px-3 py-2 text-xs text-white"
                        >
                          <option value="AVERIADO">Averiado / Irreparable</option>
                          <option value="DANADO">Dañado / Obsolescencia</option>
                          <option value="USADO">Usado en desuso</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-military-300 mb-1">
                          Motivo Obligatorio de Baja *
                        </label>
                        <textarea
                          rows={2}
                          required
                          placeholder="Ej. Daño electrónico irreversible"
                          value={decommissionReason}
                          onChange={(e) => setDecommissionReason(e.target.value)}
                          className="w-full rounded-xl border border-military-700 bg-military-900 p-2 text-xs text-white"
                        />
                      </div>
                      <div className="flex justify-end gap-2 pt-2">
                        <button
                          onClick={() => setActiveAction('NONE')}
                          className="px-3 py-1.5 text-xs text-military-400 hover:text-white"
                        >
                          Cancelar
                        </button>
                        <button
                          onClick={() =>
                            executeLifecycleAction('DECOMMISSION', {
                              itemId: item.id,
                              reason: decommissionReason,
                              condition: decommissionCondition,
                            })
                          }
                          disabled={!decommissionReason.trim() || actionLoading}
                          className="rounded-xl bg-rose-600 px-4 py-2 text-xs font-bold text-white hover:bg-rose-500 disabled:opacity-50"
                        >
                          {actionLoading ? 'Dando de baja...' : 'Confirmar Baja'}
                        </button>
                      </div>
                    </div>
                  )}

                  {activeAction === 'REACTIVATE' && (
                    <div className="rounded-xl border border-emerald-500/40 bg-military-950 p-4 space-y-3">
                      <h4 className="text-xs font-bold text-emerald-400 uppercase">
                        Reactivar Activo Dado de Baja o Averiado
                      </h4>
                      <div>
                        <label className="block text-xs font-bold text-military-300 mb-1">
                          Nueva Condición Física *
                        </label>
                        <select
                          value={reactivateCondition}
                          onChange={(e) => setReactivateCondition(e.target.value)}
                          className="w-full rounded-xl border border-military-700 bg-military-900 px-3 py-2 text-xs text-white"
                        >
                          <option value="BUENO">Bueno (Reparado / Restaurado)</option>
                          <option value="USADO">Usado Funcional</option>
                          <option value="NUEVO">Nuevo</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-military-300 mb-1">
                          Reasignar a Empleado Inmediatamente (Opcional)
                        </label>
                        <select
                          value={reactivateEmployeeId}
                          onChange={(e) => setReactivateEmployeeId(e.target.value)}
                          className="w-full rounded-xl border border-military-700 bg-military-900 px-3 py-2 text-xs text-white"
                        >
                          <option value="">Dejar como DISPONIBLE en Bodega Central</option>
                          {employees.map((e) => (
                            <option key={e.id} value={e.id}>
                              Asignar a: {e.employee_code} - {e.full_name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-military-300 mb-1">
                          Notas de Reactivación
                        </label>
                        <input
                          type="text"
                          placeholder="Ej. Equipo reparado y 100% operativo"
                          value={reactivateNotes}
                          onChange={(e) => setReactivateNotes(e.target.value)}
                          className="w-full rounded-xl border border-military-700 bg-military-900 px-3 py-2 text-xs text-white"
                        />
                      </div>
                      <div className="flex justify-end gap-2 pt-2">
                        <button
                          onClick={() => setActiveAction('NONE')}
                          className="px-3 py-1.5 text-xs text-military-400 hover:text-white"
                        >
                          Cancelar
                        </button>
                        <button
                          onClick={() =>
                            executeLifecycleAction('REACTIVATE', {
                              itemId: item.id,
                              condition: reactivateCondition,
                              assignToEmployeeId: reactivateEmployeeId || null,
                              notes: reactivateNotes,
                            })
                          }
                          disabled={actionLoading}
                          className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-500 disabled:opacity-50"
                        >
                          {actionLoading ? 'Reactivando...' : 'Confirmar Reactivación'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Pie del Modal */}
        <div className="border-t border-military-800 bg-military-900 px-5 py-3 flex items-center justify-between text-xs">
          <span className="text-military-400 font-mono text-[11px]">
            Escáner conectado a Bodega y Movimientos
          </span>
          <button
            onClick={() => {
              stopCamera();
              onClose();
            }}
            className="rounded-xl px-4 py-1.5 text-xs font-semibold text-military-300 hover:bg-military-800 hover:text-white transition"
          >
            Cerrar Escáner
          </button>
        </div>
      </div>
    </div>
  );
}
