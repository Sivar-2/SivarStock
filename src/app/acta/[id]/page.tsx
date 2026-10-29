'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  CheckCircle2,
  Printer,
  Share2,
  ShieldCheck,
  Eraser,
  PenTool,
  ArrowLeft,
  Clock,
  Smartphone,
  Laptop,
  AlertCircle,
  Copy,
  RefreshCw
} from 'lucide-react';

export default function ActaDigitalPublicPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const actaId = params?.id as string;
  const token = searchParams?.get('token') || '';

  const [acta, setActa] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dpiInput, setDpiInput] = useState('');
  const [signing, setSigning] = useState(false);
  const [signSuccess, setSignSuccess] = useState<string | null>(null);

  // Canvas de firma táctil (dedo en celular o mouse en PC)
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);

  const loadActa = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/actas?id=${encodeURIComponent(actaId)}`);
      const data = await res.json();
      if (!res.ok || !data.acta) {
        setError(data.error || 'No se encontró el acta solicitada.');
      } else {
        setActa(data.acta);
        setDpiInput(data.acta.employee_dpi || '');
      }
    } catch {
      setError('Error de conexión al cargar el acta digital.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (actaId) loadActa();
  }, [actaId]);

  // Inicializar lienzo de firma
  const getCoordinates = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    if ('touches' in e) {
      const touch = e.touches[0] || e.changedTouches[0];
      return {
        x: (touch.clientX - rect.left) * scaleX,
        y: (touch.clientY - rect.top) * scaleY,
      };
    } else {
      return {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top) * scaleY,
      };
    }
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { x, y } = getCoordinates(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineWidth = 2.6;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#0f172a';
    setIsDrawing(true);
    setHasDrawn(true);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { x, y } = getCoordinates(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
  };

  const handleConfirmSignature = async () => {
    if (!hasDrawn || !canvasRef.current) {
      alert('Por favor dibuja tu firma con el dedo o cursor en el recuadro antes de confirmar.');
      return;
    }
    if (!dpiInput.trim()) {
      alert('Por favor verifica o ingresa tu número de DPI para validar el acta.');
      return;
    }

    setSigning(true);
    try {
      const signatureDataUrl = canvasRef.current.toDataURL('image/png');
      const res = await fetch('/api/actas', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: acta.id,
          actaCode: acta.acta_code,
          employeeSignatureData: signatureDataUrl,
          employeeDpi: dpiInput.trim(),
          token: token || acta.public_token,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al guardar firma');
      setSignSuccess(data.message);
      await loadActa();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSigning(false);
    }
  };

  const handleShareWhatsApp = () => {
    if (!acta) return;
    const shareUrl = `${window.location.origin}/acta/${acta.acta_code}?token=${acta.public_token}`;
    const itemsSummary = (acta.items || [])
      .map((i: any) => `• ${i.name} (${i.code}) - Estado: ${formatConditionLabel(i.receive_condition)}`)
      .join('\n');

    const text =
      `Hola *${acta.employee_name}*, te comparto tu *Acta Digital de Entrega (${acta.acta_code})* emitida por *${acta.delivered_by_name}*.\n\n` +
      `*Equipos registrados:*\n${itemsSummary}\n\n` +
      `Por favor ingresa al siguiente enlace desde tu celular para revisarla y firmarla digitalmente:\n${shareUrl}`;

    const cleanPhone = (acta.employee_phone || '').replace(/[^0-9]/g, '');
    const waUrl = cleanPhone
      ? `https://wa.me/${cleanPhone.startsWith('502') ? cleanPhone : `502${cleanPhone}`}?text=${encodeURIComponent(text)}`
      : `https://wa.me/?text=${encodeURIComponent(text)}`;

    window.open(waUrl, '_blank');
  };

  const formatConditionLabel = (cond?: string) => {
    if (cond === 'NUEVO') return 'Nuevo';
    if (cond === 'USADO_MAL_ESTADO') return 'Usado en mal estado';
    return 'Usado en buen estado';
  };

  const getConditionBadgeStyle = (cond?: string) => {
    if (cond === 'NUEVO') return 'bg-emerald-100 text-emerald-800 border-emerald-300';
    if (cond === 'USADO_MAL_ESTADO') return 'bg-rose-100 text-rose-800 border-rose-300';
    return 'bg-blue-100 text-blue-800 border-blue-300';
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100 p-6">
        <div className="text-center space-y-2">
          <div className="h-10 w-10 mx-auto animate-spin rounded-full border-4 border-military-800 border-t-transparent" />
          <p className="text-sm font-bold text-slate-700">Cargando Acta Digital...</p>
        </div>
      </div>
    );
  }

  if (error || !acta) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100 p-6">
        <div className="max-w-md w-full rounded-2xl bg-white p-6 shadow-lg text-center space-y-4">
          <AlertCircle className="h-12 w-12 text-rose-600 mx-auto" />
          <h1 className="text-lg font-bold text-slate-900">Acta No Encontrada</h1>
          <p className="text-xs text-slate-600">{error}</p>
          <Link
            href="/asignaciones"
            className="inline-flex items-center gap-2 rounded-xl bg-military-800 px-4 py-2 text-xs font-bold text-white"
          >
            <ArrowLeft className="h-4 w-4" /> Volver a Asignaciones
          </Link>
        </div>
      </div>
    );
  }

  const isChangeActa = acta.acta_type === 'CAMBIO_EQUIPO';

  return (
    <div className="min-h-screen bg-slate-100 py-4 px-3 sm:py-8 sm:px-6 print:bg-white print:p-0">
      {/* Barra Superior de Acciones (Se oculta al imprimir) */}
      <div className="max-w-4xl mx-auto mb-4 flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-white p-3 shadow-sm border border-slate-200 print:hidden">
        <Link
          href="/asignaciones"
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Volver a Empleados y Actas</span>
        </Link>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleShareWhatsApp}
            className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-bold text-white shadow-sm hover:bg-emerald-700 transition"
          >
            <Share2 className="h-4 w-4" />
            <span>Enviar por WhatsApp</span>
          </button>

          <button
            onClick={() => {
              const shareUrl = `${window.location.origin}/acta/${acta.acta_code}?token=${acta.public_token}`;
              navigator.clipboard.writeText(shareUrl);
              alert('Enlace para firma copiado al portapapeles.');
            }}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100"
          >
            <Copy className="h-3.5 w-3.5" />
            <span>Copiar Link</span>
          </button>

          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-slate-800 transition"
          >
            <Printer className="h-4 w-4" />
            <span>Imprimir / PDF</span>
          </button>
        </div>
      </div>

      {signSuccess && (
        <div className="max-w-4xl mx-auto mb-4 rounded-2xl border border-emerald-300 bg-emerald-50 p-4 text-sm font-bold text-emerald-900 flex items-center gap-2 print:hidden">
          <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
          <span>{signSuccess}</span>
        </div>
      )}

      {/* HOJA OFICIAL DEL ACTA DE ENTREGA DIGITAL */}
      <div className="max-w-4xl mx-auto rounded-2xl bg-white p-6 sm:p-10 shadow-xl border border-slate-200 print:shadow-none print:border-none print:rounded-none">
        {/* Encabezado Membretado */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b-2 border-slate-900 pb-5 gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded-lg bg-slate-900 px-2.5 py-1 font-mono text-xs font-black text-emerald-400">
                SIVARSTOCK ENTERPRISE
              </span>
              <span
                className={`rounded-full px-2.5 py-0.5 text-[11px] font-extrabold uppercase ${
                  isChangeActa
                    ? 'bg-amber-100 text-amber-900 border border-amber-300'
                    : 'bg-blue-100 text-blue-900 border border-blue-300'
                }`}
              >
                {isChangeActa ? 'Acta por Cambio / Sustitución de Dispositivo' : 'Acta Oficial de Entrega de Equipos'}
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 mt-2">
              {isChangeActa
                ? 'CONSTANCIA DE CAMBIO / REEMPLAZO DE EQUIPO CORPORATIVO'
                : 'ACTA DE ENTREGA Y RESPONSABILIDAD DE EQUIPOS Y DISPOSITIVOS'}
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Departamento de Tecnología e Inventario • Control Patrimonial de Activos y Líneas
            </p>
          </div>

          <div className="text-left sm:text-right bg-slate-50 p-3 rounded-xl border border-slate-200">
            <div className="font-mono text-sm font-black text-slate-900">{acta.acta_code}</div>
            <div className="text-[11px] text-slate-600 mt-0.5">
              <strong>Fecha Entrega:</strong>{' '}
              {new Date(acta.delivery_date).toLocaleDateString('es-GT', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </div>
            <div className="mt-1">
              {acta.status === 'FIRMADA' ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-black text-emerald-800">
                  <CheckCircle2 className="h-3 w-3" /> FIRMADA DIGITALMENTE
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-[10px] font-black text-amber-800">
                  <Clock className="h-3 w-3" /> PENDIENTE DE FIRMA
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Sección 1: Datos del Empleado Custodio y Quien Entrega */}
        <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4 rounded-xl bg-slate-50 p-4 border border-slate-200 text-xs">
          <div className="space-y-1.5">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
              DATOS DEL EMPLEADO RECEPTOR (CUSTODIO)
            </span>
            <div>
              <span className="text-slate-500">Nombre Completo: </span>
              <strong className="text-slate-900 text-sm">{acta.employee_name}</strong>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-slate-500">Número de DPI: </span>
              {acta.status === 'FIRMADA' ? (
                <strong className="font-mono text-slate-900">{acta.employee_dpi || 'Registrado'}</strong>
              ) : (
                <input
                  type="text"
                  value={dpiInput}
                  onChange={(e) => setDpiInput(e.target.value)}
                  placeholder="Ingresa tu N° de DPI..."
                  className="rounded border border-slate-300 bg-white px-2 py-0.5 font-mono text-xs font-bold text-slate-900 focus:border-military-700 focus:outline-none print:border-none"
                />
              )}
            </div>
            <div>
              <span className="text-slate-500">Código Empleado / Área: </span>
              <strong className="text-slate-800">
                {acta.employee_code || 'S/C'} — {acta.department_name || 'General'}
              </strong>
            </div>
            {acta.supervisor_name && (
              <div>
                <span className="text-slate-500">Jefe Inmediato: </span>
                <strong className="text-slate-800">{acta.supervisor_name}</strong>
              </div>
            )}
            {(acta.employee_phone || acta.employee_email) && (
              <div>
                <span className="text-slate-500">Contacto: </span>
                <span className="text-slate-800">
                  {[acta.employee_phone, acta.employee_email].filter(Boolean).join(' • ')}
                </span>
              </div>
            )}
          </div>

          <div className="space-y-1.5 border-t sm:border-t-0 sm:border-l border-slate-200 pt-3 sm:pt-0 sm:pl-4">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
              DATOS DE QUIEN ENTREGA LOS DISPOSITIVOS
            </span>
            <div>
              <span className="text-slate-500">Entregado por: </span>
              <strong className="text-slate-900 text-sm">{acta.delivered_by_name}</strong>
            </div>
            <div>
              <span className="text-slate-500">Cargo: </span>
              <strong className="text-slate-800">
                {acta.delivered_by_role || 'Jefe de IT / Administración de Inventario'}
              </strong>
            </div>
            <div>
              <span className="text-slate-500">Modalidad de Acta: </span>
              <strong className="text-slate-800">
                {isChangeActa
                  ? 'Sustitución / Cambio Puntual de Dispositivo'
                  : 'Entrega de Equipos y Dispositivos a Cargo'}
              </strong>
            </div>
          </div>
        </div>

        {/* Si es un Acta de Cambio de Dispositivo, mostrar cuál fue el dispositivo anterior reemplazado */}
        {isChangeActa && acta.replacedItem && (
          <div className="mt-5 rounded-xl border border-amber-300 bg-amber-50/70 p-4 text-xs">
            <div className="flex items-center gap-2 font-black text-amber-900 uppercase mb-1">
              <RefreshCw className="h-4 w-4" />
              <span>Dispositivo Anterior Retirado / Sustituido en este Cambio:</span>
            </div>
            <p className="text-amber-900">
              Se deja constancia que este documento corresponde únicamente al cambio del dispositivo{' '}
              <strong className="font-mono">{acta.replacedItem.code}</strong> ({acta.replacedItem.name}
              {acta.replacedItem.serial_number ? ` • Serie/IMEI: ${acta.replacedItem.serial_number}` : ''}) por el nuevo dispositivo detallado a continuación:
            </p>
          </div>
        )}

        {/* Tabla Detallada de Dispositivos Entregados y Estado de Recepción */}
        <div className="mt-6">
          <h2 className="text-xs font-black uppercase tracking-wider text-slate-700 mb-2">
            {isChangeActa
              ? 'Detalle del Dispositivo Entregado en este Cambio'
              : `Detalle de Dispositivos y Equipos Entregados (${(acta.items || []).length})`}
          </h2>

          <div className="overflow-x-auto rounded-xl border border-slate-300">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-900 text-white uppercase text-[10px] font-bold">
                <tr>
                  <th className="px-3 py-2.5">Código</th>
                  <th className="px-3 py-2.5">Dispositivo / Marca y Modelo</th>
                  <th className="px-3 py-2.5">Serie / MAC / IMEI / Línea</th>
                  <th className="px-3 py-2.5">Situación en que Recibe</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {(acta.items || []).map((item: any, idx: number) => (
                  <tr key={idx} className="bg-white">
                    <td className="px-3 py-3 font-mono font-bold text-slate-900">{item.code}</td>
                    <td className="px-3 py-3">
                      <div className="font-bold text-slate-900">{item.name}</div>
                      <div className="text-[11px] text-slate-500">
                        {[item.brand, item.model].filter(Boolean).join(' ')}
                      </div>
                    </td>
                    <td className="px-3 py-3 font-mono text-[11px] text-slate-700">
                      {[
                        item.serial_number ? `S/N: ${item.serial_number}` : '',
                        item.mac_address ? `MAC: ${item.mac_address}` : '',
                        item.imei ? `IMEI: ${item.imei}` : '',
                        item.phone_number ? `Tel: ${item.phone_number}` : '',
                      ]
                        .filter(Boolean)
                        .join(' | ') || 'N/A'}
                    </td>
                    <td className="px-3 py-3">
                      <span
                        className={`inline-block rounded-lg border px-2.5 py-1 text-[11px] font-extrabold ${getConditionBadgeStyle(
                          item.receive_condition
                        )}`}
                      >
                        {formatConditionLabel(item.receive_condition)}
                      </span>
                      {item.notes && (
                        <div className="text-[10px] text-slate-500 mt-1">{item.notes}</div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {acta.notes && (
          <div className="mt-4 rounded-xl bg-slate-50 p-3 border border-slate-200 text-xs text-slate-700">
            <strong>Observaciones adicionales:</strong> {acta.notes}
          </div>
        )}

        {/* SECCIÓN DE FIRMAS: QUIEN ENTREGA (Alexander Turcios Melendez) Y QUIEN RECIBE (Empleado) */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-slate-200">
          {/* Firma 1: Entregado por (Alexander Turcios Melendez) */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 flex flex-col justify-between">
            <div className="text-[10px] font-black uppercase tracking-wider text-slate-500">
              ENTREGADO CONFORME POR:
            </div>

            <div className="my-4 h-28 flex items-center justify-center border-b-2 border-slate-800 bg-white rounded-t-lg p-2">
              {acta.delivered_by_signature && acta.delivered_by_signature.startsWith('data:image') ? (
                <img
                  src={acta.delivered_by_signature}
                  alt={acta.delivered_by_name}
                  className="max-h-24 object-contain"
                />
              ) : (
                <div className="text-center select-none">
                  <div
                    className="text-2xl sm:text-3xl text-slate-800 italic font-serif tracking-wide"
                    style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
                  >
                    {acta.delivered_by_name}
                  </div>
                  <span className="text-[9px] font-mono uppercase tracking-widest text-emerald-700 block mt-1">
                    ✓ Firma Autorizada Registrada
                  </span>
                </div>
              )}
            </div>

            <div className="text-center">
              <div className="font-black text-xs text-slate-900 uppercase">{acta.delivered_by_name}</div>
              <div className="text-[11px] text-slate-500">
                {acta.delivered_by_role || 'Jefe de IT / Administración de Inventario'}
              </div>
            </div>
          </div>

          {/* Firma 2: Recibido por el Empleado (Con Lienzo Táctil si está pendiente) */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                RECIBIDO CONFORME POR (EMPLEADO):
              </span>
              {acta.status !== 'FIRMADA' && (
                <button
                  type="button"
                  onClick={clearCanvas}
                  className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-600 hover:underline print:hidden"
                >
                  <Eraser className="h-3 w-3" /> Limpiar firma
                </button>
              )}
            </div>

            {acta.status === 'FIRMADA' && acta.employee_signature_data ? (
              <div className="my-4 h-28 flex flex-col items-center justify-center border-b-2 border-slate-800 bg-white rounded-t-lg p-2">
                <img
                  src={acta.employee_signature_data}
                  alt={`Firma de ${acta.employee_name}`}
                  className="max-h-20 object-contain"
                />
                <span className="text-[9px] font-mono text-emerald-700 font-bold">
                  Firmado el {new Date(acta.signed_at).toLocaleString('es-GT')}
                </span>
              </div>
            ) : (
              <div className="my-3">
                <div className="relative rounded-xl border-2 border-dashed border-slate-400 bg-white overflow-hidden">
                  <canvas
                    ref={canvasRef}
                    width={450}
                    height={140}
                    onMouseDown={startDrawing}
                    onMouseMove={draw}
                    onMouseUp={stopDrawing}
                    onMouseLeave={stopDrawing}
                    onTouchStart={startDrawing}
                    onTouchMove={draw}
                    onTouchEnd={stopDrawing}
                    className="w-full h-32 touch-none cursor-crosshair"
                  />
                  {!hasDrawn && (
                    <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-xs text-slate-400 gap-1.5">
                      <PenTool className="h-4 w-4" />
                      <span>Dibuja tu firma aquí con tu dedo o cursor</span>
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  disabled={signing}
                  onClick={handleConfirmSignature}
                  className="mt-2.5 w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-700 py-2.5 text-xs font-black text-white shadow-md hover:bg-emerald-800 transition disabled:opacity-50 print:hidden"
                >
                  <ShieldCheck className="h-4 w-4" />
                  <span>{signing ? 'Registrando firma en BD...' : 'Confirmar y Firmar Acta Digital'}</span>
                </button>
              </div>
            )}

            <div className="text-center">
              <div className="font-black text-xs text-slate-900 uppercase">{acta.employee_name}</div>
              <div className="text-[11px] text-slate-600 font-mono">
                DPI: {acta.employee_dpi || dpiInput || '_____________________'}
              </div>
            </div>
          </div>
        </div>

        {/* NOTA LEGAL Y DE CONFIDENCIALIDAD OBLIGATORIA AL PIE DEL ACTA */}
        <div className="mt-8 rounded-xl border border-slate-300 bg-slate-50 p-4 text-center">
          <p className="text-[11px] sm:text-xs font-semibold text-slate-700 leading-relaxed">
            &ldquo;Al firmar este documento, acepto los términos de entrega, la nota de confidencialidad y consiento el uso de la firma electrónica. Automáticamente recibirá una copia de este documento firmado en su correo electrónico. Si requiere una copia física, este documento digital puede ser impreso en cualquier momento.&rdquo;
          </p>
        </div>
      </div>
    </div>
  );
}
