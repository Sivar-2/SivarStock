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
  AlertCircle,
  Copy,
  RefreshCw,
  Mail,
  Maximize2,
  X,
  Ban,
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

  // Modal de Firma Ampliada (Zoom para firmar cómodamente desde el celular)
  const [showZoomSignModal, setShowZoomSignModal] = useState(false);

  // Canvas de firma táctil (en vista normal y en modal ampliado)
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const zoomCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);
  const [previewSignatureUrl, setPreviewSignatureUrl] = useState<string | null>(null);

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

  const getCoordinates = (
    e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>,
    targetCanvas: HTMLCanvasElement | null
  ) => {
    if (!targetCanvas) return { x: 0, y: 0 };
    const rect = targetCanvas.getBoundingClientRect();
    const scaleX = targetCanvas.width / rect.width;
    const scaleY = targetCanvas.height / rect.height;

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

  const startDrawing = (
    e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>,
    targetCanvas: HTMLCanvasElement | null
  ) => {
    e.preventDefault();
    if (!targetCanvas) return;
    const ctx = targetCanvas.getContext('2d');
    if (!ctx) return;
    const { x, y } = getCoordinates(e, targetCanvas);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineWidth = 3.2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#0f172a';
    setIsDrawing(true);
    setHasDrawn(true);
  };

  const draw = (
    e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>,
    targetCanvas: HTMLCanvasElement | null
  ) => {
    if (!isDrawing || !targetCanvas) return;
    e.preventDefault();
    const ctx = targetCanvas.getContext('2d');
    if (!ctx) return;
    const { x, y } = getCoordinates(e, targetCanvas);
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = (targetCanvas?: HTMLCanvasElement | null) => {
    setIsDrawing(false);
    if (targetCanvas && hasDrawn) {
      setPreviewSignatureUrl(targetCanvas.toDataURL('image/png'));
    }
  };

  const clearCanvas = () => {
    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      ctx?.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    }
    if (zoomCanvasRef.current) {
      const ctx = zoomCanvasRef.current.getContext('2d');
      ctx?.clearRect(0, 0, zoomCanvasRef.current.width, zoomCanvasRef.current.height);
    }
    setHasDrawn(false);
    setPreviewSignatureUrl(null);
  };

  const handleConfirmSignature = async (fromZoomModal = false) => {
    const activeCanvas = fromZoomModal ? zoomCanvasRef.current : canvasRef.current;
    const signatureDataUrl =
      previewSignatureUrl || (activeCanvas && hasDrawn ? activeCanvas.toDataURL('image/png') : null);

    if (!signatureDataUrl) {
      alert('Por favor dibuja tu firma con el dedo o cursor en el recuadro antes de confirmar.');
      return;
    }
    if (!dpiInput.trim()) {
      alert('Por favor verifica o ingresa tu número de DPI para validar el acta.');
      return;
    }

    setSigning(true);
    try {
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
      setShowZoomSignModal(false);
      await loadActa();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSigning(false);
    }
  };

  const formatConditionLabel = (cond?: string) => {
    if (!cond) return 'Usado en buen estado';
    const u = cond.toUpperCase();
    if (u === 'NUEVO' || cond === 'Nuevo') return 'Nuevo';
    if (u === 'USADO_MAL_ESTADO' || u.includes('MAL')) return 'Usado - malas condiciones';
    if (u === 'USADO_BUEN_ESTADO' || u.includes('BUEN')) return 'Usado en buen estado';
    return cond;
  };

  const getConditionBadgeStyle = (cond?: string) => {
    const label = formatConditionLabel(cond);
    if (label === 'Nuevo') return 'bg-emerald-100 text-emerald-800 border-emerald-300';
    if (label.includes('malas')) return 'bg-rose-100 text-rose-800 border-rose-300';
    return 'bg-blue-100 text-blue-800 border-blue-300';
  };

  const handleShareWhatsApp = () => {
    if (!acta) return;
    const shareUrl = `${window.location.origin}/acta/${acta.acta_code}?token=${acta.public_token}`;
    const itemsSummary = (acta.items || [])
      .map(
        (i: any) =>
          `• ${i.quantity || 1}x ${i.name} (${i.code}) - Condición: ${formatConditionLabel(
            i.receive_condition || i.condition
          )}`
      )
      .join('\n');

    const text =
      `Hola *${acta.employee_name}*, te comparto tu *Acta Digital (${acta.acta_code})* de *Fábrica de Persianas y Complementos, S.A.* emitida por *${acta.delivered_by_name}*.\n\n` +
      `*Detalle registrado:*\n${itemsSummary}\n\n` +
      `Por favor ingresa al siguiente enlace desde tu celular para revisarla y firmarla electrónicamente:\n${shareUrl}`;

    const cleanPhone = (acta.employee_phone || '').replace(/[^0-9]/g, '');
    const waUrl = cleanPhone
      ? `https://wa.me/${cleanPhone.startsWith('502') ? cleanPhone : `502${cleanPhone}`}?text=${encodeURIComponent(text)}`
      : `https://wa.me/?text=${encodeURIComponent(text)}`;

    window.open(waUrl, '_blank');
  };

  const handleShareOutlook = () => {
    if (!acta) return;
    const shareUrl = `${window.location.origin}/acta/${acta.acta_code}?token=${acta.public_token}`;
    const subject = `Acta de Entrega, Recepción y Uso Responsable (${acta.acta_code}) - ${acta.employee_name} | Fábrica de Persianas y Complementos, S.A.`;
    const itemsSummary = (acta.items || [])
      .map(
        (i: any) =>
          `- ${i.quantity || 1} unidad(es) | ${i.code} | ${i.name} (${formatConditionLabel(
            i.receive_condition || i.condition
          )})`
      )
      .join('\n');

    const body =
      `Estimado(a) ${acta.employee_name},\n\n` +
      `Por medio del presente correo le compartimos el enlace oficial a su Acta de Entrega, Recepción y Uso Responsable (${acta.acta_code}) emitida por el Departamento de Tecnología e Innovación (IT) de Fábrica de Persianas y Complementos, S.A.\n\n` +
      `Bienes / Licencias registrados:\n${itemsSummary}\n\n` +
      `Enlace para revisar, firmar electrónicamente o imprimir copia en PDF:\n${shareUrl}\n\n` +
      `Atentamente,\n` +
      `${acta.delivered_by_name || 'Alexander Turcios Melendez'}\n` +
      `Especialista de Tecnología, Sistemas e Innovación\n` +
      `Departamento de Tecnología e Innovación (IT)\n` +
      `Fábrica de Persianas y Complementos, S.A.`;

    window.location.href = `mailto:${encodeURIComponent(acta.employee_email || '')}?subject=${encodeURIComponent(
      subject
    )}&body=${encodeURIComponent(body)}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100 p-6">
        <div className="text-center space-y-2">
          <div className="h-10 w-10 mx-auto animate-spin rounded-full border-4 border-slate-900 border-t-transparent" />
          <p className="text-sm font-bold text-slate-700">Cargando Documento Oficial de Acta...</p>
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
            className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white"
          >
            <ArrowLeft className="h-4 w-4" /> Volver a Asignaciones
          </Link>
        </div>
      </div>
    );
  }

  const isChangeActa = acta.acta_type === 'CAMBIO_EQUIPO';
  const isReturnActa = acta.acta_type === 'DEVOLUCION_BAJA' || acta.acta_type === 'DEVOLUCION';
  const refusedToSign = Boolean(acta.refused_to_sign) || acta.status === 'NO_QUISO_FIRMAR';

  return (
    <div className="min-h-screen bg-slate-100 py-4 px-3 sm:py-8 sm:px-6 print:bg-white print:p-0">
      {/* Barra Superior de Acciones (Se oculta al imprimir) */}
      <div className="max-w-4xl mx-auto mb-4 flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-white p-3 shadow-sm border border-slate-200 print:hidden">
        <Link
          href="/asignaciones"
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Volver a Asignaciones</span>
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
            onClick={handleShareOutlook}
            className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3.5 py-2 text-xs font-bold text-white shadow-sm hover:bg-blue-700 transition"
          >
            <Mail className="h-4 w-4" />
            <span>Enviar por Correo Outlook</span>
          </button>

          <button
            onClick={() => {
              const shareUrl = `${window.location.origin}/acta/${acta.acta_code}?token=${acta.public_token}`;
              navigator.clipboard.writeText(shareUrl);
              alert('Enlace copiado al portapapeles.');
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
            <span>Imprimir / Guardar PDF</span>
          </button>
        </div>
      </div>

      {signSuccess && (
        <div className="max-w-4xl mx-auto mb-4 rounded-2xl border border-emerald-300 bg-emerald-50 p-4 text-sm font-bold text-emerald-900 flex items-center gap-2 print:hidden">
          <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
          <span>{signSuccess}</span>
        </div>
      )}

      {/* DOCUMENTO OFICIAL DE 2 PÁGINAS — FÁBRICA DE PERSIANAS Y COMPLEMENTOS, S.A. */}
      <div className="max-w-4xl mx-auto rounded-2xl bg-white p-6 sm:p-10 shadow-xl border border-slate-200 print:shadow-none print:border-none print:rounded-none print:p-4">
        {/* Encabezado Corporativo Oficial */}
        <div className="flex flex-col sm:flex-row sm:items-start justify-between border-b-2 border-slate-900 pb-5 gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-lg bg-slate-900 px-3 py-1 font-mono text-xs font-black tracking-wider text-white">
                FÁBRICA DE PERSIANAS Y COMPLEMENTOS, S.A.
              </span>
              <span
                className={`rounded-full px-2.5 py-0.5 text-[11px] font-extrabold uppercase ${
                  isReturnActa
                    ? 'bg-rose-100 text-rose-900 border border-rose-300'
                    : isChangeActa
                    ? 'bg-amber-100 text-amber-900 border border-amber-300'
                    : 'bg-blue-100 text-blue-900 border border-blue-300'
                }`}
              >
                {isReturnActa
                  ? 'Acta de Devolución / Baja de Equipos'
                  : isChangeActa
                  ? 'Acta por Cambio / Sustitución de Dispositivo'
                  : 'Acta de Entrega de Nuevos Productos'}
              </span>
            </div>

            <h1 className="text-lg sm:text-xl font-black text-slate-900 mt-2 uppercase tracking-tight">
              ACTA DE ENTREGA, RECEPCIÓN Y USO RESPONSABLE
            </h1>
            <p className="text-xs font-semibold italic text-slate-600 mt-0.5">
              De bienes tecnológicos, accesorios, software y licencias digitales
            </p>
          </div>

          <div className="text-left sm:text-right bg-slate-50 p-3.5 rounded-xl border border-slate-200 shrink-0">
            <div className="font-mono text-sm font-black text-slate-900">{acta.acta_code}</div>
            <div className="text-[11px] text-slate-600 mt-0.5">
              <strong>Fecha de Emisión:</strong>{' '}
              {new Date(acta.delivery_date).toLocaleDateString('es-GT', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </div>
            <div className="mt-1.5">
              {acta.status === 'FIRMADA' ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-black text-emerald-800">
                  <CheckCircle2 className="h-3 w-3" /> FIRMADA ELECTRÓNICAMENTE
                </span>
              ) : refusedToSign ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2.5 py-0.5 text-[10px] font-black text-rose-800">
                  <Ban className="h-3 w-3" /> NO QUISO FIRMAR
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-[10px] font-black text-amber-800">
                  <Clock className="h-3 w-3" /> PENDIENTE DE FIRMA
                </span>
              )}
            </div>
          </div>
        </div>

        {/* SECCIÓN 1: DATOS DE LA PERSONA RECEPTORA Y DEL RESPONSABLE EMISOR */}
        <div className="mt-5">
          <h2 className="text-xs font-black uppercase tracking-wider text-slate-900 mb-2">
            1. Identificación de la Persona Receptora y Área Asignada
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 rounded-xl bg-slate-50 p-4 border border-slate-200 text-xs">
            <div className="space-y-1.5">
              <div>
                <span className="text-slate-500">Nombre Completo: </span>
                <strong className="text-slate-900 text-sm">{acta.employee_name}</strong>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-slate-500">Documento de Identificación (DPI): </span>
                {acta.status === 'FIRMADA' || refusedToSign ? (
                  <strong className="font-mono text-slate-900">{acta.employee_dpi || 'Registrado'}</strong>
                ) : (
                  <input
                    type="text"
                    value={dpiInput}
                    onChange={(e) => setDpiInput(e.target.value)}
                    placeholder="Ingresa tu N° de DPI..."
                    className="rounded border border-slate-300 bg-white px-2 py-0.5 font-mono text-xs font-bold text-slate-900 focus:border-slate-900 focus:outline-none print:border-none"
                  />
                )}
              </div>
              <div>
                <span className="text-slate-500">Código Colaborador / Departamento: </span>
                <strong className="text-slate-800">
                  {acta.employee_code || 'S/C'} — {acta.department_name || 'General'}
                </strong>
              </div>
              <div>
                <span className="text-slate-500">Jefe Inmediato: </span>
                <strong className="text-slate-800">{acta.supervisor_name || 'Dirección / Jefatura de Área'}</strong>
              </div>
              <div>
                <span className="text-slate-500">Teléfono / Correo: </span>
                <span className="text-slate-800 font-medium">
                  {[acta.employee_phone, acta.employee_email].filter(Boolean).join(' • ') || 'Corporativo'}
                </span>
              </div>
            </div>

            <div className="space-y-1.5 border-t sm:border-t-0 sm:border-l border-slate-200 pt-3 sm:pt-0 sm:pl-4">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                EMITIDO Y ENTREGADO POR
              </span>
              <div>
                <span className="text-slate-500">Nombre: </span>
                <strong className="text-slate-900 text-sm">
                  {acta.delivered_by_name || 'Alexander Turcios Melendez'}
                </strong>
              </div>
              <div>
                <span className="text-slate-500">Cargo: </span>
                <strong className="text-slate-800">
                  Especialista de Tecnología, Sistemas e Innovación
                </strong>
              </div>
              <div>
                <span className="text-slate-500">Departamento: </span>
                <strong className="text-slate-800">
                  Departamento de Tecnología e Innovación (IT)
                </strong>
              </div>
              <div>
                <span className="text-slate-500">Empresa: </span>
                <strong className="text-slate-900">Fábrica de Persianas y Complementos, S.A.</strong>
              </div>
            </div>
          </div>
        </div>

        {/* Párrafo Introductorio Oficial */}
        <div className="mt-4 rounded-xl bg-slate-50/70 p-3.5 border border-slate-200 text-xs text-slate-800 leading-relaxed text-justify">
          Por medio de la presente, <strong>Fábrica de Persianas y Complementos, S.A.</strong> hace constar la{' '}
          {isReturnActa ? 'recepción por devolución o baja' : 'entrega'} a la persona arriba identificada de los bienes,
          accesorios y/o licencias detallados a continuación. La persona receptora reconoce la recepción de las
          cantidades indicadas y acepta las condiciones de custodia, uso, reporte de incidentes y devolución descritas
          en esta acta.
        </div>

        {/* Si es un Acta de Cambio de Dispositivo, mostrar cuál fue el dispositivo anterior reemplazado */}
        {isChangeActa && acta.replacedItem && (
          <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50/80 p-4 text-xs">
            <div className="flex items-center gap-2 font-black text-amber-900 uppercase mb-1">
              <RefreshCw className="h-4 w-4" />
              <span>Constancia de Cambio / Sustitución de Dispositivo:</span>
            </div>
            <p className="text-amber-950">
              Se realizó el cambio del producto anterior{' '}
              <strong className="font-mono">{acta.replacedItem.code || 'S/C'}</strong> (
              {acta.replacedItem.name || 'Equipo anterior'}
              {acta.replacedItem.serial_number ? ` • Serie/IMEI: ${acta.replacedItem.serial_number}` : ''}
              {acta.replacedItem.quantity ? ` • Unidades: ${acta.replacedItem.quantity}` : ''}) por el nuevo producto
              detallado a continuación:
            </p>
          </div>
        )}

        {/* Si es Acta de Devolución / Baja */}
        {isReturnActa && (
          <div className="mt-4 rounded-xl border border-rose-300 bg-rose-50/80 p-4 text-xs">
            <div className="font-black text-rose-900 uppercase mb-1">
              Constancia de Devolución de Equipos / Terminación o Baja:
            </div>
            <p className="text-rose-950">
              Se deja constancia de los equipos devueltos por el colaborador al Departamento de Tecnología e Innovación
              (IT). Estado general de recepción reportado:{' '}
              <strong>{acta.returned_condition || 'Revisado en recepción'}</strong>.
              {refusedToSign && (
                <span className="block mt-1 font-black text-rose-800">
                  * NOTA DE AUDITORÍA: El colaborador se negó a firmar el presente documento al momento de la recepción.
                </span>
              )}
            </p>
          </div>
        )}

        {/* SECCIÓN 2: TABLA DE BIENES Y LICENCIAS (Con columna UNIDADES al inicio) */}
        <div className="mt-5">
          <h2 className="text-xs font-black uppercase tracking-wider text-slate-900 mb-2">
            2. Detalle de Bienes Tecnológicos, Accesorios y/o Licencias ({(acta.items || []).length})
          </h2>

          <div className="overflow-x-auto rounded-xl border border-slate-300">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-900 text-white uppercase text-[10px] font-bold">
                <tr>
                  <th className="px-3 py-2.5 text-center w-20">Unidades</th>
                  <th className="px-3 py-2.5">Código</th>
                  <th className="px-3 py-2.5">Descripción / Marca y Modelo</th>
                  <th className="px-3 py-2.5">Serie / MAC / IMEI / Línea</th>
                  <th className="px-3 py-2.5">Condición</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {(acta.items || []).map((item: any, idx: number) => (
                  <tr key={idx} className="bg-white">
                    <td className="px-3 py-3 text-center font-mono text-sm font-black text-slate-900 bg-slate-50/70">
                      {item.quantity || 1}
                    </td>
                    <td className="px-3 py-3 font-mono font-bold text-slate-900">{item.code}</td>
                    <td className="px-3 py-3">
                      <div className="font-bold text-slate-900">{item.name}</div>
                      <div className="text-[11px] text-slate-500">
                        {[item.brand, item.model].filter(Boolean).join(' ')}
                      </div>
                    </td>
                    <td className="px-3 py-3 font-mono text-[11px] text-slate-700">
                      {[
                        item.serial_number || item.serialNumber
                          ? `S/N: ${item.serial_number || item.serialNumber}`
                          : '',
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
                          item.receive_condition || item.condition
                        )}`}
                      >
                        {formatConditionLabel(item.receive_condition || item.condition)}
                      </span>
                      {item.notes && <div className="text-[10px] text-slate-500 mt-1">{item.notes}</div>}
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

        {/* SECCIÓN 3: CONDICIONES DE USO, CUSTODIA, REPORTE Y DEVOLUCIÓN (8 CLÁUSULAS OFICIALES) */}
        <div className="mt-6 pt-5 border-t-2 border-slate-200">
          <h2 className="text-xs font-black uppercase tracking-wider text-slate-900 mb-3">
            3. Condiciones de uso, custodia, reporte y devolución
          </h2>

          <div className="grid grid-cols-1 gap-2.5 text-[11px] leading-relaxed text-slate-700 bg-slate-50/70 p-4 rounded-xl border border-slate-200 text-justify">
            <div>
              <strong className="text-slate-900">1. Uso laboral y restricciones:</strong> Los equipos, líneas,
              accesorios, cuentas y licencias entregados son propiedad de la empresa y se asignan exclusivamente para el
              desempeño de funciones laborales. No está permitido instalar software no autorizado, alterar
              configuraciones de seguridad ni prestar el equipo a terceros.
            </div>
            <div>
              <strong className="text-slate-900">2. Cuidado y custodia:</strong> La persona receptora se compromete a
              utilizar los bienes de forma adecuada, conservarlos en buen estado y resguardarlos en lugares seguros
              tanto dentro como fuera de las instalaciones.
            </div>
            <div>
              <strong className="text-slate-900">3. Fallas, mantenimiento y desgaste natural:</strong> Cualquier falla
              técnica, alerta o deterioro por uso normal deberá reportarse al Departamento de Sistemas / IT al correo{' '}
              <strong className="font-mono text-slate-900 underline">depto.sistemas@grupofpc.com</strong> dentro de las{' '}
              <strong>24 horas</strong> siguientes a su detección. Queda prohibido abrir, reparar o intervenir los
              equipos por cuenta propia o mediante talleres no autorizados. El desgaste natural o las fallas técnicas no
              atribuibles a mal uso no generarán cobro para el colaborador.
            </div>
            <div>
              <strong className="text-slate-900">4. Robo, pérdida o incidente de seguridad:</strong> En caso de robo,
              hurto o extravío de equipos, teléfonos o credenciales de acceso, la persona receptora deberá notificar de
              inmediato a su jefe directo y a IT para el bloqueo de accesos, líneas y servicios, y colaborar con el
              reporte o denuncia correspondiente cuando aplique.
            </div>
            <div>
              <strong className="text-slate-900">5. Daño intencional o negligencia comprobada:</strong> Cuando exista
              pérdida, faltante de accesorios o daño ocasionado por dolo, uso indebido o negligencia comprobada, el caso
              será evaluado técnicamente por IT y administrativamente por Recursos Humanos conforme a las políticas
              internas y a la legislación laboral vigente.
            </div>
            <div>
              <strong className="text-slate-900">6. Devolución y terminación laboral:</strong> Todos los bienes físicos,
              accesorios, tarjetas SIM y accesos digitales deberán devolverse al Departamento de IT cuando la empresa lo
              solicite, por cambio de puesto o al finalizar la relación laboral, dejando constancia del estado de
              recepción.
            </div>
            <div>
              <strong className="text-slate-900">7. Protección de la información empresarial:</strong> Toda información,
              documentos, bases de datos, correos y archivos generados o almacenados en los equipos y cuentas
              corporativas son propiedad exclusiva de <strong>Fábrica de Persianas y Complementos, S.A.</strong> y están
              sujetos a confidencialidad. No se deberá guardar información sensible empresarial en dispositivos
              personales no autorizados.
            </div>
            <div>
              <strong className="text-slate-900">8. Constancia y alcance:</strong> Si esta acta corresponde a un cambio,
              reposición o adición parcial de equipo, únicamente modifica los ítems aquí descritos, permaneciendo
              vigentes las asignaciones previas que continúen en poder del colaborador.
            </div>
          </div>
        </div>

        {/* SECCIÓN DE FIRMAS: ENTREGADO CONFORME POR Y RECIBIDO CONFORME POR */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-slate-200">
          {/* Firma 1: Entregado conforme por (Alexander Turcios Melendez) */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 flex flex-col justify-between">
            <div className="text-[10px] font-black uppercase tracking-wider text-slate-500">
              ENTREGADO CONFORME POR:
            </div>

            <div className="my-4 h-32 flex items-center justify-center border-b-2 border-slate-800 bg-white rounded-t-lg p-2">
              {acta.delivered_by_signature && acta.delivered_by_signature.startsWith('data:image') ? (
                <img
                  src={acta.delivered_by_signature}
                  alt={acta.delivered_by_name}
                  className="max-h-28 object-contain"
                />
              ) : (
                <div className="text-center select-none">
                  <div
                    className="text-2xl sm:text-3xl text-slate-800 italic font-serif tracking-wide"
                    style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
                  >
                    {acta.delivered_by_name || 'Alexander Turcios Melendez'}
                  </div>
                  <span className="text-[9px] font-mono uppercase tracking-widest text-emerald-700 block mt-1">
                    ✓ Firma Preseleccionada en Ajustes
                  </span>
                </div>
              )}
            </div>

            <div className="text-center space-y-0.5">
              <div className="font-black text-xs text-slate-900 uppercase">
                {acta.delivered_by_name || 'Alexander Turcios Melendez'}
              </div>
              <div className="text-[11px] font-semibold text-slate-700">
                Especialista de Tecnología, Sistemas e Innovación
              </div>
              <div className="text-[10px] text-slate-500">
                Departamento de Tecnología e Innovación (IT)
              </div>
            </div>
          </div>

          {/* Firma 2: Recibido conforme por (Con botón para Ampliar Recuadro de Firma en Pantalla Completa) */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                RECIBIDO CONFORME POR:
              </span>
              {acta.status !== 'FIRMADA' && !refusedToSign && (
                <div className="flex items-center gap-2 print:hidden">
                  <button
                    type="button"
                    onClick={() => setShowZoomSignModal(true)}
                    className="inline-flex items-center gap-1 rounded-lg bg-indigo-50 px-2 py-1 text-[10px] font-bold text-indigo-700 hover:bg-indigo-100 border border-indigo-200"
                  >
                    <Maximize2 className="h-3 w-3" /> Ampliar para Firmar
                  </button>
                  <button
                    type="button"
                    onClick={clearCanvas}
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-600 hover:underline"
                  >
                    <Eraser className="h-3 w-3" /> Limpiar
                  </button>
                </div>
              )}
            </div>

            {acta.status === 'FIRMADA' && acta.employee_signature_data ? (
              <div className="my-4 h-32 flex flex-col items-center justify-center border-b-2 border-slate-800 bg-white rounded-t-lg p-2">
                <img
                  src={acta.employee_signature_data}
                  alt={`Firma de ${acta.employee_name}`}
                  className="max-h-24 object-contain"
                />
                <span className="text-[9px] font-mono text-emerald-700 font-bold mt-1">
                  Firmado electrónicamente el {new Date(acta.signed_at).toLocaleString('es-GT')}
                </span>
              </div>
            ) : refusedToSign ? (
              <div className="my-4 h-32 flex flex-col items-center justify-center border-b-2 border-rose-700 bg-rose-50 rounded-t-lg p-3 text-center">
                <Ban className="h-7 w-7 text-rose-600 mb-1" />
                <span className="text-xs font-black uppercase text-rose-800">
                  EL COLABORADOR NO QUISO FIRMAR
                </span>
                <span className="text-[10px] text-rose-700">
                  Constancia administrativa de recepción sin firma del colaborador
                </span>
              </div>
            ) : (
              <div className="my-3">
                <div
                  onClick={() => {
                    if (!hasDrawn) setShowZoomSignModal(true);
                  }}
                  className="relative rounded-xl border-2 border-dashed border-slate-400 bg-white overflow-hidden cursor-pointer hover:border-indigo-500 transition"
                >
                  {previewSignatureUrl ? (
                    <div className="h-32 flex flex-col items-center justify-center p-2">
                      <img src={previewSignatureUrl} alt="Previsualización de firma" className="max-h-24 object-contain" />
                      <span className="text-[10px] font-bold text-indigo-600">Clic para volver a abrir lienzo ampliado</span>
                    </div>
                  ) : (
                    <>
                      <canvas
                        ref={canvasRef}
                        width={450}
                        height={140}
                        onMouseDown={(e) => startDrawing(e, canvasRef.current)}
                        onMouseMove={(e) => draw(e, canvasRef.current)}
                        onMouseUp={() => stopDrawing(canvasRef.current)}
                        onMouseLeave={() => stopDrawing(canvasRef.current)}
                        onTouchStart={(e) => startDrawing(e, canvasRef.current)}
                        onTouchMove={(e) => draw(e, canvasRef.current)}
                        onTouchEnd={() => stopDrawing(canvasRef.current)}
                        className="w-full h-32 touch-none cursor-crosshair"
                      />
                      {!hasDrawn && (
                        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-xs text-slate-500 gap-1">
                          <div className="flex items-center gap-1.5 font-bold text-indigo-700">
                            <Maximize2 className="h-4 w-4" />
                            <span>Toca aquí para ampliar el recuadro y firmar cómodamente</span>
                          </div>
                          <span className="text-[10px] text-slate-400">O dibuja directamente en este espacio</span>
                        </div>
                      )}
                    </>
                  )}
                </div>

                <button
                  type="button"
                  disabled={signing}
                  onClick={() => handleConfirmSignature(false)}
                  className="mt-2.5 w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-700 py-2.5 text-xs font-black text-white shadow-md hover:bg-emerald-800 transition disabled:opacity-50 print:hidden"
                >
                  <ShieldCheck className="h-4 w-4" />
                  <span>{signing ? 'Registrando firma en BD...' : 'Confirmar y Firmar Acta Digital'}</span>
                </button>
              </div>
            )}

            <div className="text-center space-y-0.5">
              <div className="font-black text-xs text-slate-900 uppercase">{acta.employee_name}</div>
              <div className="text-[11px] text-slate-600 font-mono">
                DPI: {acta.employee_dpi || dpiInput || '_____________________'}
              </div>
              <div className="text-[10px] text-slate-500">{acta.department_name || 'Colaborador Receptor'}</div>
            </div>
          </div>
        </div>

        {/* NOTA LEGAL EXACTA AL PIE DEL ACTA */}
        <div className="mt-8 rounded-xl border border-slate-300 bg-slate-50 p-4 text-center">
          <p className="text-[11px] sm:text-xs font-semibold text-slate-800 leading-relaxed">
            &ldquo;Al firmar este documento, acepto los términos de entrega, la nota de confidencialidad y consiento el
            uso de la firma electrónica. Automáticamente recibirá una copia de este documento firmado. Si requiere una
            copia física, este documento digital puede ser impreso en cualquier momento.&rdquo;
          </p>
        </div>
      </div>

      {/* MODAL AMPLIADO DE FIRMA TÁCTIL (PANTALLA GRANDE PARA CELULAR) */}
      {showZoomSignModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 sm:p-6 backdrop-blur-sm print:hidden">
          <div className="w-full max-w-2xl rounded-2xl bg-white p-5 sm:p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <h3 className="text-base sm:text-lg font-black text-slate-900 flex items-center gap-2">
                  <PenTool className="h-5 w-5 text-indigo-600" />
                  Recuadro Ampliado de Firma Electrónica
                </h3>
                <p className="text-xs text-slate-500">
                  Firmando como: <strong>{acta.employee_name}</strong> ({acta.acta_code})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowZoomSignModal(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Confirma tu Número de DPI antes de firmar *:
              </label>
              <input
                type="text"
                value={dpiInput}
                onChange={(e) => setDpiInput(e.target.value)}
                placeholder="Ej. 2345 67890 0101"
                className="w-full rounded-xl border border-slate-300 px-3.5 py-2 font-mono text-sm font-bold text-slate-900 focus:border-indigo-600 focus:outline-none"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-bold text-slate-700">
                  Dibuja tu firma con el dedo o stylus dentro del recuadro grande:
                </span>
                <button
                  type="button"
                  onClick={clearCanvas}
                  className="inline-flex items-center gap-1 rounded-lg bg-rose-50 px-2.5 py-1 text-xs font-bold text-rose-600 hover:bg-rose-100"
                >
                  <Eraser className="h-3.5 w-3.5" /> Borrar y repetir
                </button>
              </div>

              <div className="relative rounded-2xl border-2 border-indigo-500 bg-slate-50 overflow-hidden shadow-inner">
                <canvas
                  ref={zoomCanvasRef}
                  width={750}
                  height={300}
                  onMouseDown={(e) => startDrawing(e, zoomCanvasRef.current)}
                  onMouseMove={(e) => draw(e, zoomCanvasRef.current)}
                  onMouseUp={() => stopDrawing(zoomCanvasRef.current)}
                  onMouseLeave={() => stopDrawing(zoomCanvasRef.current)}
                  onTouchStart={(e) => startDrawing(e, zoomCanvasRef.current)}
                  onTouchMove={(e) => draw(e, zoomCanvasRef.current)}
                  onTouchEnd={() => stopDrawing(zoomCanvasRef.current)}
                  className="w-full h-64 sm:h-72 touch-none cursor-crosshair bg-white"
                />
                <div className="pointer-events-none absolute bottom-6 left-8 right-8 border-b border-slate-300 text-center">
                  <span className="text-[10px] font-mono uppercase tracking-widest text-slate-400">
                    Línea de Firma — {acta.employee_name}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowZoomSignModal(false)}
                className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50"
              >
                Cerrar
              </button>
              <button
                type="button"
                disabled={signing}
                onClick={() => handleConfirmSignature(true)}
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-6 py-2.5 text-sm font-black text-white shadow-lg hover:bg-emerald-800 transition disabled:opacity-50"
              >
                <ShieldCheck className="h-4 w-4" />
                <span>{signing ? 'Guardando Firma...' : 'Confirmar y Firmar Documento'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
