'use client';

import React, { useEffect, useState } from 'react';
import { X, Printer, Download, Check } from 'lucide-react';

interface QrCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: {
    permanentCode: string;
    productName: string;
    brand?: string;
    model?: string;
    serialNumber?: string;
    departmentName?: string;
  } | null;
}

export default function QrCodeModal({ isOpen, onClose, item }: QrCodeModalProps) {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (isOpen && item) {
      setLoading(true);
      fetch(`/api/qr/generate?code=${encodeURIComponent(item.permanentCode)}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.dataUrl) setQrDataUrl(data.dataUrl);
        })
        .catch(console.error)
        .finally(() => setLoading(false));
    }
  }, [isOpen, item]);

  if (!isOpen || !item) return null;

  const handlePrint = () => {
    window.print();
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(item.permanentCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl bg-white shadow-2xl ring-1 ring-black/5 overflow-hidden">
        {/* Encabezado */}
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-5 py-4">
          <h3 className="text-sm font-bold text-slate-800">Etiqueta de Identificación</h3>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tarjeta de Etiqueta Imprimible */}
        <div className="p-6 text-center">
          <div
            id="printable-labels"
            className="mx-auto rounded-xl border-2 border-dashed border-military-700 bg-white p-4 shadow-sm text-center max-w-[280px]"
          >
            <div className="border-b border-slate-200 pb-2 mb-2">
              <span className="text-[10px] uppercase font-bold tracking-wider text-military-800">
                SivarStock Manufactura
              </span>
              <p className="text-xs font-semibold text-slate-700 truncate">{item.productName}</p>
            </div>

            {loading ? (
              <div className="flex h-44 items-center justify-center">
                <span className="text-xs text-slate-400">Generando QR...</span>
              </div>
            ) : qrDataUrl ? (
              <img
                src={qrDataUrl}
                alt={item.permanentCode}
                className="mx-auto h-44 w-44 object-contain"
              />
            ) : (
              <div className="h-44 w-44 bg-slate-100 mx-auto flex items-center justify-center text-xs text-slate-400">
                Error al generar
              </div>
            )}

            <div className="mt-2 border-t border-slate-200 pt-2 text-center">
              <span className="block text-base font-extrabold tracking-wider text-slate-900 font-mono">
                {item.permanentCode}
              </span>
              {item.serialNumber && (
                <span className="block text-[11px] text-slate-500 font-mono">
                  S/N: {item.serialNumber}
                </span>
              )}
              {item.departmentName && (
                <span className="mt-0.5 inline-block rounded bg-slate-100 px-2 py-0.5 text-[10px] text-slate-600 font-medium">
                  {item.departmentName}
                </span>
              )}
            </div>
          </div>

          <div className="mt-4 flex items-center justify-center gap-2">
            <button
              onClick={handleCopyCode}
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : null}
              <span>{copied ? 'Copiado' : 'Copiar Código'}</span>
            </button>
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 rounded-lg bg-military-800 px-4 py-1.5 text-xs font-semibold text-white shadow hover:bg-military-900"
            >
              <Printer className="h-3.5 w-3.5" />
              <span>Imprimir Etiqueta</span>
            </button>
          </div>
        </div>

        <div className="border-t border-slate-100 bg-slate-50 px-5 py-3 text-right">
          <button
            onClick={onClose}
            className="rounded-lg px-4 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-200"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
