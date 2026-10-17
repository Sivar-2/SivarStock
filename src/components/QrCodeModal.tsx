'use client';

import React, { useEffect, useState } from 'react';
import { X, Printer, Download, Check, Copy, Grid, Layers, FileText } from 'lucide-react';

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
  const [printMode, setPrintMode] = useState<'SINGLE' | 'BATCH'>('SINGLE');
  const [batchCount, setBatchCount] = useState<number>(8); // Lote estándar de 8 etiquetas por hoja

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

  const handleDownloadQr = () => {
    if (!qrDataUrl) return;
    const a = document.createElement('a');
    a.href = qrDataUrl;
    a.download = `QR_${item.permanentCode}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const labelsToRender = printMode === 'SINGLE' ? [item] : Array.from({ length: batchCount }, () => item);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-3 sm:p-4 backdrop-blur-sm overflow-y-auto">
      <div className="w-full max-w-2xl rounded-3xl bg-white shadow-2xl ring-1 ring-black/5 overflow-hidden my-auto">
        {/* Encabezado no imprimible */}
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-6 py-4 print:hidden">
          <div>
            <h3 className="text-base font-extrabold text-slate-900">
              Centro de Impresión de Etiquetas QR Adhesivas
            </h3>
            <p className="text-xs text-slate-500 font-mono">
              Activo: {item.permanentCode} - Formato Térmico / Adhesivo
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Selector de Modo: Individual vs Lote */}
        <div className="px-6 pt-4 pb-2 border-b border-slate-100 bg-white flex flex-wrap items-center justify-between gap-3 print:hidden">
          <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl">
            <button
              onClick={() => setPrintMode('SINGLE')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                printMode === 'SINGLE'
                  ? 'bg-white text-military-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FileText className="h-3.5 w-3.5" />
              <span>Etiqueta Individual</span>
            </button>
            <button
              onClick={() => setPrintMode('BATCH')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                printMode === 'BATCH'
                  ? 'bg-white text-military-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Grid className="h-3.5 w-3.5" />
              <span>Lote Adhesivo ({batchCount})</span>
            </button>
          </div>

          {printMode === 'BATCH' && (
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
              <span>Cantidad en hoja:</span>
              <select
                value={batchCount}
                onChange={(e) => setBatchCount(Number(e.target.value))}
                className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs font-bold text-slate-800"
              >
                <option value={4}>4 etiquetas (2x2)</option>
                <option value={8}>8 etiquetas (2x4)</option>
                <option value={12}>12 etiquetas (3x4)</option>
                <option value={16}>16 etiquetas (4x4)</option>
              </select>
            </div>
          )}
        </div>

        {/* Contenedor de Etiquetas (Diseño optimizado para pantalla y para impresión física) */}
        <div className="p-6 max-h-[60vh] overflow-y-auto bg-slate-50/50">
          <div
            id="printable-labels-container"
            className={`mx-auto ${
              printMode === 'SINGLE'
                ? 'flex justify-center'
                : 'grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 print:grid-cols-2 print:gap-2'
            }`}
          >
            {labelsToRender.map((labelItem, idx) => (
              <div
                key={idx}
                className="rounded-2xl border-2 border-military-800 bg-white p-3.5 shadow-sm text-center flex flex-col items-center justify-between w-64 max-w-full print:border-black print:shadow-none print:break-inside-avoid print:w-[70mm] print:h-[45mm]"
              >
                {/* Cabecera de Etiqueta */}
                <div className="w-full border-b border-slate-200 pb-1.5 mb-1.5 flex items-center justify-between">
                  <span className="text-[9px] uppercase font-black tracking-wider text-military-900">
                    SIVARSTOCK GT
                  </span>
                  <span className="text-[9px] font-bold text-military-700 truncate max-w-[120px]">
                    {labelItem.departmentName || 'BODEGA CENTRAL'}
                  </span>
                </div>

                {/* Código QR Nítido */}
                <div className="my-1 flex items-center justify-center">
                  {loading ? (
                    <div className="h-32 w-32 flex items-center justify-center text-[10px] text-slate-400 font-mono">
                      Generando QR...
                    </div>
                  ) : qrDataUrl ? (
                    <img
                      src={qrDataUrl}
                      alt={labelItem.permanentCode}
                      className="h-32 w-32 object-contain print:h-[26mm] print:w-[26mm]"
                    />
                  ) : (
                    <div className="h-32 w-32 bg-slate-100 flex items-center justify-center text-[10px] text-slate-400">
                      Error QR
                    </div>
                  )}
                </div>

                {/* Pie de Etiqueta con Datos Clave */}
                <div className="w-full border-t border-slate-200 pt-1.5 mt-1 text-center">
                  <span className="block text-sm font-black tracking-wider text-slate-900 font-mono">
                    {labelItem.permanentCode}
                  </span>
                  <p className="text-[11px] font-bold text-slate-800 truncate px-1">
                    {labelItem.productName}
                  </p>
                  {labelItem.serialNumber && (
                    <span className="block text-[9px] text-slate-500 font-mono truncate">
                      S/N: {labelItem.serialNumber}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Acciones de Impresión y Descarga */}
        <div className="border-t border-slate-100 bg-white px-6 py-4 flex flex-wrap items-center justify-between gap-3 print:hidden">
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyCode}
              className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
              <span>{copied ? 'Copiado' : 'Copiar Código'}</span>
            </button>
            <button
              onClick={handleDownloadQr}
              disabled={!qrDataUrl}
              className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition disabled:opacity-50"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Descargar PNG</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="rounded-xl px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 transition"
            >
              Cerrar
            </button>
            <button
              onClick={handlePrint}
              disabled={!qrDataUrl}
              className="flex items-center gap-2 rounded-xl bg-military-800 px-5 py-2 text-xs font-bold text-white shadow-lg shadow-military-900/20 hover:bg-military-900 transition disabled:opacity-50"
            >
              <Printer className="h-4 w-4" />
              <span>
                {printMode === 'SINGLE' ? 'Imprimir Etiqueta' : `Imprimir Lote (${batchCount})`}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Reglas de impresión CSS exclusivas para etiquetas adhesivas */}
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #printable-labels-container,
          #printable-labels-container * {
            visibility: visible;
          }
          #printable-labels-container {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            margin: 0;
            padding: 0;
          }
        }
      `}</style>
    </div>
  );
}
