'use client';

import React, { useState, useEffect, useRef } from 'react';
import { X, Camera, AlertCircle, Search, ArrowRight } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface QrScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function QrScannerModal({ isOpen, onClose }: QrScannerModalProps) {
  const router = useRouter();
  const [manualCode, setManualCode] = useState('');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    if (isOpen) {
      setCameraError(null);
      startCamera();
    } else {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [isOpen]);

  const startCamera = async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setCameraError('El navegador no soporta acceso a la cámara o requiere conexión HTTPS.');
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        setIsCameraActive(true);
      }
    } catch (err: any) {
      console.warn('Acceso a cámara no disponible:', err);
      setCameraError(
        'No se pudo acceder a la cámara. Asegúrese de otorgar permisos o use la búsqueda por código manual a continuación.'
      );
      setIsCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setIsCameraActive(false);
  };

  const handleLookup = (code: string) => {
    const clean = code.trim().toUpperCase();
    if (clean) {
      stopCamera();
      onClose();
      router.push(`/inventario?search=${encodeURIComponent(clean)}`);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl ring-1 ring-black/5 overflow-hidden">
        {/* Encabezado */}
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-5 py-4">
          <div className="flex items-center gap-2">
            <Camera className="h-5 w-5 text-military-700" />
            <h3 className="text-base font-bold text-slate-800">Escanear Etiqueta QR</h3>
          </div>
          <button
            onClick={() => {
              stopCamera();
              onClose();
            }}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-5">
          {/* Vista previa de Cámara */}
          <div className="relative mb-4 flex h-56 w-full flex-col items-center justify-center rounded-xl bg-slate-900 overflow-hidden">
            {isCameraActive ? (
              <>
                <video
                  ref={videoRef}
                  className="h-full w-full object-cover"
                  playsInline
                  autoPlay
                />
                {/* Marco de enfoque */}
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <div className="h-36 w-36 rounded-lg border-2 border-dashed border-emerald-400 bg-emerald-400/10" />
                </div>
              </>
            ) : (
              <div className="px-6 text-center text-slate-300">
                <Camera className="mx-auto mb-2 h-10 w-10 text-slate-500" />
                <p className="text-xs text-slate-400">
                  {cameraError || 'Iniciando cámara del dispositivo...'}
                </p>
              </div>
            )}
          </div>

          {cameraError && (
            <div className="mb-4 flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-xs text-amber-800 border border-amber-200">
              <AlertCircle className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
              <span>{cameraError}</span>
            </div>
          )}

          {/* Búsqueda manual alternativa */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              O introduzca el código del activo manualmente:
            </label>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleLookup(manualCode);
              }}
              className="flex gap-2"
            >
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="ej. SIV-IT-000001 o AM-2026-CBLE-001"
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-xs sm:text-sm text-slate-800 uppercase focus:border-military-600 focus:outline-none focus:ring-1 focus:ring-military-600"
                />
              </div>
              <button
                type="submit"
                disabled={!manualCode.trim()}
                className="flex items-center gap-1 rounded-lg bg-military-800 px-4 py-2 text-xs font-semibold text-white transition hover:bg-military-900 disabled:opacity-50"
              >
                <span>Buscar</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </form>
          </div>
        </div>

        <div className="border-t border-slate-100 bg-slate-50 px-5 py-3 text-right">
          <button
            onClick={() => {
              stopCamera();
              onClose();
            }}
            className="rounded-lg px-4 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-200"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
