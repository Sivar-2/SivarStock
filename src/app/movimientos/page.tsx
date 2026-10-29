'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  ArrowLeftRight,
  Search,
  Plus,
  Download,
  FileText,
  User,
  Building,
  CheckCircle2,
  AlertCircle,
  X,
  Send,
  Mail,
  Printer,
  FileSignature,
  Clock,
  Sparkles,
  ExternalLink,
  Warehouse,
  FolderPlus,
} from 'lucide-react';

export default function MovimientosPage() {
  const [movements, setMovements] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Filtros
  const [movementType, setMovementType] = useState('');
  const [search, setSearch] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  // Modal registrar entrada / movimiento
  const [showModal, setShowModal] = useState(false);
  const [createNewProduct, setCreateNewProduct] = useState(false);
  const [formData, setFormData] = useState({
    productId: '',
    newProductName: '',
    newProductCategoryId: 'cat-2',
    newCategoryName: '',
    newProductBrand: '',
    newProductModel: '',
    newProductUnit: 'unidad',
    newProductSerial: '',
    newProductMac: '',
    newProductImei: '',
    isRented: false,
    rentalCost: '',
    rentalProvider: '',
    supplierName: '',
    supplierPhone: '',
    contractNumber: '',
    destinationType: 'BODEGA',
    movementType: 'ENTRADA',
    quantity: '1',
    unitCost: '',
    date: new Date().toISOString().split('T')[0],
    reason: '',
    referenceCode: '',
    fromDepartmentId: '',
    toDepartmentId: 'dept-bod',
    toEmployeeId: '',
    recipientName: '',
    requiresActa: false,
    condition: 'Nuevo',
  });

  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [accessDenied, setAccessDenied] = useState(false);
  const [generatingActaId, setGeneratingActaId] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    setAccessDenied(false);
    try {
      const queryParams = new URLSearchParams();
      if (movementType) queryParams.set('movementType', movementType);
      if (fromDate) queryParams.set('fromDate', fromDate);
      if (toDate) queryParams.set('toDate', toDate);

      const [movRes, prodRes, catRes] = await Promise.all([
        fetch(`/api/movements?${queryParams.toString()}`),
        fetch('/api/products'),
        fetch('/api/catalogs'),
      ]);

      if (movRes.status === 403) {
        setAccessDenied(true);
        return;
      }

      const movData = await movRes.json();
      const prodData = await prodRes.json();
      const catData = await catRes.json();

      if (movData.movements) setMovements(movData.movements);
      if (prodData.products) setProducts(prodData.products);
      if (catData.categories) setCategories(catData.categories);
      if (catData.departments) setDepartments(catData.departments);
      if (catData.employees) setEmployees(catData.employees);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [movementType, fromDate, toDate]);

  if (accessDenied) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 p-8 text-center max-w-xl mx-auto my-12">
        <ArrowLeftRight className="h-12 w-12 text-rose-600 mx-auto mb-3" />
        <h2 className="text-lg font-black text-rose-900">Acceso Restringido</h2>
        <p className="text-xs text-rose-700 mt-1">
          No cuenta con permisos habilitados para consultar el módulo de Entradas y Movimientos.
        </p>
      </div>
    );
  }

  const handleCreateMovement = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    if (!formData.reason.trim()) {
      setFeedback({ type: 'error', message: 'El motivo o justificación del movimiento es obligatorio.' });
      return;
    }

    try {
      const res = await fetch('/api/movements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          createNewProduct,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setFeedback({
        type: 'success',
        message: data.actaCode
          ? `Movimiento registrado y Acta Digital ${data.actaCode} generada con éxito.`
          : 'Movimiento registrado con éxito en Categorías y Bodega.',
      });
      setTimeout(() => {
        setShowModal(false);
        setFeedback(null);
        setCreateNewProduct(false);
        setFormData({
          productId: '',
          newProductName: '',
          newProductCategoryId: 'cat-2',
          newCategoryName: '',
          newProductBrand: '',
          newProductModel: '',
          newProductUnit: 'unidad',
          newProductSerial: '',
          newProductMac: '',
          newProductImei: '',
          isRented: false,
          rentalCost: '',
          rentalProvider: '',
          supplierName: '',
          supplierPhone: '',
          contractNumber: '',
          destinationType: 'BODEGA',
          movementType: 'ENTRADA',
          quantity: '1',
          unitCost: '',
          date: new Date().toISOString().split('T')[0],
          reason: '',
          referenceCode: '',
          fromDepartmentId: '',
          toDepartmentId: 'dept-bod',
          toEmployeeId: '',
          recipientName: '',
          requiresActa: false,
          condition: 'Nuevo',
        });
        loadData();
      }, 600);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message });
    }
  };

  const handleGenerateActaOnTheFly = async (mov: any) => {
    setGeneratingActaId(mov.id);
    try {
      const res = await fetch('/api/movements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'GENERATE_ACTA_FOR_MOVEMENT',
          movementId: mov.id,
          employeeId: mov.to_employee_id || null,
          recipientName: mov.to_employee_name || mov.recipient_name || 'Colaborador Receptor',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Error al generar acta.');
    } finally {
      setGeneratingActaId(null);
    }
  };

  const getActaPublicUrl = (actaIdOrCode: string, token?: string) => {
    if (typeof window === 'undefined') return '';
    return `${window.location.origin}/acta/${actaIdOrCode}${token ? `?token=${token}` : ''}`;
  };

  const handleSendWhatsApp = (mov: any) => {
    const url = getActaPublicUrl(mov.acta_id || mov.acta_code, mov.acta_token);
    const recipient = mov.to_employee_name || mov.recipient_name || 'Colaborador';
    const phoneRaw = (mov.to_employee_phone || '').replace(/[^0-9]/g, '');
    const phoneWithCountry = phoneRaw.length === 8 ? `502${phoneRaw}` : phoneRaw;
    const text =
      mov.acta_status === 'FIRMADA'
        ? `Hola *${recipient}*, te compartimos copia digital de tu *Acta de Entrega Firmada (${mov.acta_code})* correspondiente a *${mov.quantity}x ${mov.product_name}* en Fábrica de Persianas y Complementos, S.A.:\n\n📄 Ver / Imprimir Acta: ${url}`
        : `Hola *${recipient}*, el Departamento de Tecnología e Innovación (IT) de *Fábrica de Persianas y Complementos, S.A.* te envía tu *Acta Digital de Entrega (${mov.acta_code})* por *${mov.quantity}x ${mov.product_name}*.\n\nPor favor ingresa al siguiente enlace desde tu celular para revisarla y firmarla electrónicamente:\n✍️ ${url}`;

    const waUrl = phoneWithCountry
      ? `https://wa.me/${phoneWithCountry}?text=${encodeURIComponent(text)}`
      : `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(waUrl, '_blank');
  };

  const handleSendOutlook = (mov: any) => {
    const url = getActaPublicUrl(mov.acta_id || mov.acta_code, mov.acta_token);
    const recipient = mov.to_employee_name || mov.recipient_name || 'Colaborador';
    const email = mov.to_employee_email || '';
    const subject =
      mov.acta_status === 'FIRMADA'
        ? `Copia de Acta de Entrega Firmada ${mov.acta_code} - ${mov.product_name} | Grupo FPC`
        : `Firma Requerida: Acta de Entrega Digital ${mov.acta_code} - ${mov.product_name} | Grupo FPC`;
    const body =
      `Estimado(a) ${recipient},\n\n` +
      `Por medio del presente correo se adjunta el enlace oficial a su Acta de Entrega, Recepción y Uso Responsable (${mov.acta_code}) emitida por el Departamento de Tecnología e Innovación (IT) de Fábrica de Persianas y Complementos, S.A.\n\n` +
      `Equipo / Suministro: ${mov.quantity}x ${mov.product_name} (${mov.product_code})\n` +
      `Estado del Documento: ${mov.acta_status === 'FIRMADA' ? 'FIRMADA ELECTRÓNICAMENTE' : 'PENDIENTE DE FIRMA'}\n\n` +
      `Enlace al documento digital (Ver / Firmar / Imprimir PDF):\n${url}\n\n` +
      `Atentamente,\n` +
      `Alexander Turcios Melendez\n` +
      `Especialista de Tecnología, Sistemas e Innovación\n` +
      `Departamento de Tecnología e Innovación (IT) — Grupo FPC`;

    window.location.href = `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  const filtered = movements.filter(
    (m) =>
      m.product_name?.toLowerCase().includes(search.toLowerCase()) ||
      m.product_code?.toLowerCase().includes(search.toLowerCase()) ||
      m.reason?.toLowerCase().includes(search.toLowerCase()) ||
      m.reference_code?.toLowerCase().includes(search.toLowerCase()) ||
      m.to_employee_name?.toLowerCase().includes(search.toLowerCase()) ||
      m.acta_code?.toLowerCase().includes(search.toLowerCase()) ||
      m.executed_by_name?.toLowerCase().includes(search.toLowerCase())
  );

  const handleExport = async (fmt: 'excel' | 'csv') => {
    const cols = [
      { key: 'created_at', header: 'Fecha y Hora' },
      { key: 'movement_type', header: 'Tipo Movimiento' },
      { key: 'product_code', header: 'Código Producto' },
      { key: 'product_name', header: 'Producto' },
      { key: 'quantity', header: 'Cantidad' },
      { key: 'to_employee_name', header: 'Entregado A / Destinatario' },
      { key: 'acta_code', header: 'Código Acta' },
      { key: 'acta_status', header: 'Estado Acta' },
      { key: 'unit_cost', header: 'Costo Unitario (Q)' },
      { key: 'total_cost', header: 'Costo Total (Q)' },
      { key: 'reason', header: 'Motivo / Detalle' },
      { key: 'executed_by_name', header: 'Quién Realizó Movimiento' },
    ];

    const res = await fetch('/api/reports/export', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        format: fmt,
        title: 'Bitácora de Entradas, Movimientos y Actas de Entrega',
        columns: cols,
        data: filtered,
      }),
    });

    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bitacora_movimientos_${new Date().toISOString().slice(0, 10)}.${fmt === 'excel' ? 'xlsx' : 'csv'}`;
    a.click();
  };

  return (
    <div className="space-y-6">
      {/* Cabecera */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2.5">
            <ArrowLeftRight className="h-7 w-7 text-emerald-600" />
            Entradas y Movimientos
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Bitácora general de ingresos y entregas • Creación directa hacia Categorías y Bodega • Envío de Actas por WhatsApp, Outlook y PDF
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => handleExport('excel')}
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
          >
            <Download className="h-4 w-4 text-slate-500" />
            <span>Exportar Excel</span>
          </button>
          <button
            onClick={() => {
              setCreateNewProduct(true);
              setFormData((prev) => ({ ...prev, movementType: 'ENTRADA' }));
              setShowModal(true);
            }}
            className="flex items-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50 px-3.5 py-2 text-xs font-bold text-indigo-800 hover:bg-indigo-100 transition"
          >
            <Sparkles className="h-4 w-4 text-indigo-600" />
            <span>+ Nuevo Producto + Entrada</span>
          </button>
          <button
            onClick={() => {
              setCreateNewProduct(false);
              setShowModal(true);
            }}
            className="flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white shadow-md hover:bg-emerald-800 transition"
          >
            <Plus className="h-4 w-4" />
            <span>Registrar Movimiento</span>
          </button>
        </div>
      </div>

      {/* Barra de Filtros */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
        <div className="md:col-span-5 relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por producto, empleado receptor, código de acta, motivo..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-4 py-2 text-sm text-slate-800 focus:border-emerald-600 focus:bg-white focus:outline-none"
          />
        </div>

        <div className="md:col-span-3">
          <select
            value={movementType}
            onChange={(e) => setMovementType(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 focus:border-emerald-600 focus:outline-none"
          >
            <option value="">Todos los tipos de movimiento</option>
            <option value="ENTRADA">Entrada / Recepción a Bodega</option>
            <option value="ASIGNACION">Entrega / Asignación a Personal</option>
            <option value="TRASLADO">Traslado entre Áreas</option>
            <option value="DEVOLUCION">Devolución a Bodega</option>
            <option value="CONSUMO">Consumo Interno</option>
            <option value="REPARACION">Envío a Mantenimiento / Taller</option>
            <option value="BAJA">Baja de Activo</option>
          </select>
        </div>

        <div className="md:col-span-2">
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700 focus:border-emerald-600 focus:outline-none"
            title="Fecha inicial"
          />
        </div>

        <div className="md:col-span-2">
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700 focus:border-emerald-600 focus:outline-none"
            title="Fecha final"
          />
        </div>
      </div>

      {/* Tabla de Movimientos */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="border-b border-slate-200 bg-slate-50/75 text-[11px] uppercase font-bold text-slate-700">
              <tr>
                <th className="py-3.5 px-4">Fecha / Tipo</th>
                <th className="py-3.5 px-4">Producto y Cantidad</th>
                <th className="py-3.5 px-4">Entregado a / Destino</th>
                <th className="py-3.5 px-4">Acta Digital de Entrega</th>
                <th className="py-3.5 px-4">Acciones de Acta (WhatsApp / Correo / PDF)</th>
                <th className="py-3.5 px-4">Motivo / Justificación</th>
                <th className="py-3.5 px-4">Registrado Por</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    Cargando bitácora de movimientos...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    No se encontraron movimientos registrados.
                  </td>
                </tr>
              ) : (
                filtered.map((m) => {
                  const isPositive = ['ENTRADA', 'COMPRA', 'RECEPCION', 'DEVOLUCION'].includes(m.movement_type);
                  const hasActa = Boolean(m.acta_id || m.acta_code);
                  const isSigned = m.acta_status === 'FIRMADA';

                  return (
                    <tr key={m.id} className="hover:bg-slate-50/70 transition">
                      <td className="py-3.5 px-4">
                        <div className="font-mono text-xs text-slate-500">{m.created_at}</div>
                        <span
                          className={`mt-1 inline-block rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                            isPositive
                              ? 'bg-emerald-100 text-emerald-800'
                              : m.movement_type === 'ASIGNACION'
                              ? 'bg-blue-100 text-blue-800'
                              : m.movement_type === 'CONSUMO'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {m.movement_type}
                        </span>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-900">{m.product_name || 'Producto general'}</div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="font-mono text-xs text-slate-400">{m.product_code}</span>
                          <span className={`font-mono text-xs font-black ${isPositive ? 'text-emerald-700' : 'text-indigo-700'}`}>
                            {isPositive ? `+${m.quantity}` : `-${m.quantity}`} {m.unit_of_measure || 'unid'}
                          </span>
                          {m.total_cost > 0 && (
                            <span className="text-[11px] font-mono text-slate-500">
                              (Q{Number(m.total_cost).toLocaleString('es-GT', { minimumFractionDigits: 2 })})
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        {m.to_employee_name ? (
                          <div>
                            <div className="font-bold text-slate-900 flex items-center gap-1 text-xs">
                              <User className="h-3.5 w-3.5 text-indigo-600" />
                              {m.to_employee_name}
                            </div>
                            {m.to_dept_name && (
                              <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                                <Building className="h-3 w-3 text-slate-400" />
                                {m.to_dept_name}
                              </div>
                            )}
                          </div>
                        ) : m.to_dept_name ? (
                          <div className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                            <Warehouse className="h-3.5 w-3.5 text-emerald-600" />
                            {m.to_dept_name}
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400">Bodega Central / Interno</span>
                        )}
                      </td>

                      <td className="py-3.5 px-4">
                        {hasActa ? (
                          <div className="space-y-1">
                            <div className="font-mono text-xs font-bold text-slate-900">{m.acta_code}</div>
                            {isSigned ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-bold text-emerald-800">
                                <CheckCircle2 className="h-3 w-3" /> Firmada Digitalmente
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-[10px] font-bold text-amber-800">
                                <Clock className="h-3 w-3" /> Pendiente de Firma
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold text-slate-600">
                            No se entregó acta
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-4">
                        {hasActa ? (
                          <div className="flex flex-wrap items-center gap-1.5">
                            <button
                              onClick={() => handleSendWhatsApp(m)}
                              className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1.5 text-[11px] font-bold text-white hover:bg-emerald-700 shadow-sm transition"
                              title="Enviar link de firma o copia por WhatsApp"
                            >
                              <Send className="h-3 w-3" />
                              WhatsApp
                            </button>
                            <button
                              onClick={() => handleSendOutlook(m)}
                              className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-2.5 py-1.5 text-[11px] font-bold text-white hover:bg-blue-700 shadow-sm transition"
                              title="Enviar copia o solicitud de firma por Outlook / Correo"
                            >
                              <Mail className="h-3 w-3" />
                              Outlook
                            </button>
                            <Link
                              href={`/acta/${m.acta_id || m.acta_code}`}
                              target="_blank"
                              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-bold text-slate-700 hover:bg-slate-50 transition"
                              title="Abrir documento de Acta para Ver o Descargar PDF"
                            >
                              <Printer className="h-3 w-3 text-slate-500" />
                              PDF / Ver
                            </Link>
                          </div>
                        ) : (
                          <button
                            onClick={() => handleGenerateActaOnTheFly(m)}
                            disabled={generatingActaId === m.id}
                            className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-bold text-indigo-700 hover:bg-indigo-100 transition disabled:opacity-50"
                          >
                            <FileSignature className="h-3.5 w-3.5" />
                            {generatingActaId === m.id ? 'Generando...' : 'Generar / Enviar Acta'}
                          </button>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-xs text-slate-700 max-w-xs">
                        <div className="line-clamp-2" title={m.reason}>
                          {m.reason}
                        </div>
                        {m.reference_code && (
                          <div className="font-mono text-[10px] text-slate-400 mt-0.5">Ref: {m.reference_code}</div>
                        )}
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5 text-xs font-medium text-slate-700">
                          <User className="h-3.5 w-3.5 text-slate-400" />
                          <span>{m.executed_by_name || m.executed_by_username || 'Sistema'}</span>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL REGISTRAR ENTRADA / MOVIMIENTO / NUEVO PRODUCTO */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm overflow-y-auto">
          <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl my-8 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <ArrowLeftRight className="h-5 w-5 text-emerald-600" />
                Registrar Entrada, Entrega o Nuevo Producto
              </h3>
              <button onClick={() => setShowModal(false)} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Selector de modo: Producto existente vs Crear nuevo producto */}
            <div className="mt-4 grid grid-cols-2 gap-2 rounded-xl bg-slate-100 p-1">
              <button
                type="button"
                onClick={() => setCreateNewProduct(false)}
                className={`rounded-lg py-2 text-xs font-bold transition ${
                  !createNewProduct ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Movimiento de Producto Existente
              </button>
              <button
                type="button"
                onClick={() => setCreateNewProduct(true)}
                className={`rounded-lg py-2 text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                  createNewProduct ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Sparkles className="h-3.5 w-3.5" />
                + Agregar Nuevo Producto (Categorías + Bodega)
              </button>
            </div>

            {feedback && (
              <div
                className={`mt-4 flex items-center gap-2 rounded-xl p-3 text-xs font-semibold ${
                  feedback.type === 'success' ? 'bg-emerald-50 text-emerald-800' : 'bg-rose-50 text-rose-800'
                }`}
              >
                {feedback.type === 'success' ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                <span>{feedback.message}</span>
              </div>
            )}

            <form onSubmit={handleCreateMovement} className="mt-4 space-y-4">
              {!createNewProduct ? (
                <div>
                  <label className="block text-xs font-bold text-slate-700">Producto / Equipo *</label>
                  <select
                    required={!createNewProduct}
                    value={formData.productId}
                    onChange={(e) => setFormData({ ...formData, productId: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none"
                  >
                    <option value="">Seleccione un producto del catálogo...</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.code}) • Stock: {p.current_stock} {p.unit_of_measure}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="rounded-2xl border border-indigo-100 bg-indigo-50/40 p-4 space-y-3">
                  <div className="text-xs font-black uppercase tracking-wider text-indigo-900 flex items-center gap-1.5">
                    <FolderPlus className="h-4 w-4 text-indigo-600" />
                    Ficha del Nuevo Producto (Se creará en Categorías y Bodega)
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700">Nombre del Producto *</label>
                      <input
                        type="text"
                        required={createNewProduct}
                        placeholder="ej. Monitor Dell 27'', Cable UTP Cat 6..."
                        value={formData.newProductName}
                        onChange={(e) => setFormData({ ...formData, newProductName: e.target.value })}
                        className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700">Carpeta / Categoría *</label>
                      <select
                        value={formData.newProductCategoryId}
                        onChange={(e) => setFormData({ ...formData, newProductCategoryId: e.target.value })}
                        className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                      >
                        {categories.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                        <option value="__NEW__">+ Crear Nueva Carpeta de Categoría...</option>
                      </select>
                    </div>
                  </div>

                  {formData.newProductCategoryId === '__NEW__' && (
                    <div>
                      <label className="block text-xs font-semibold text-indigo-800">Nombre de la Nueva Categoría *</label>
                      <input
                        type="text"
                        required
                        placeholder="ej. Cámaras de Seguridad, Routers..."
                        value={formData.newCategoryName}
                        onChange={(e) => setFormData({ ...formData, newCategoryName: e.target.value })}
                        className="mt-1 w-full rounded-xl border border-indigo-300 bg-white px-3 py-2 text-sm"
                      />
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700">Marca</label>
                      <input
                        type="text"
                        placeholder="Dell, HP, Hikvision..."
                        value={formData.newProductBrand}
                        onChange={(e) => setFormData({ ...formData, newProductBrand: e.target.value })}
                        className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700">Modelo</label>
                      <input
                        type="text"
                        placeholder="Latitude 5440..."
                        value={formData.newProductModel}
                        onChange={(e) => setFormData({ ...formData, newProductModel: e.target.value })}
                        className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700">Unidad / Estructura</label>
                      <select
                        value={formData.newProductUnit}
                        onChange={(e) => setFormData({ ...formData, newProductUnit: e.target.value })}
                        className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                      >
                        <option value="unidad">Unidad (Equipo / Pieza)</option>
                        <option value="m2">Metro Cuadrado (m² - Cable Cat 6)</option>
                        <option value="metro">Metro Lineal (m)</option>
                        <option value="cartucho">Tinta / Tóner (Cartucho)</option>
                        <option value="backup">Equipo de Backup / Reserva</option>
                        <option value="chip_sim">Chip SIM de Backup</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700">N° de Serie (S/N - Opcional)</label>
                      <input
                        type="text"
                        placeholder="SN-123456"
                        value={formData.newProductSerial}
                        onChange={(e) => setFormData({ ...formData, newProductSerial: e.target.value })}
                        className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700">MAC Address (Opcional)</label>
                      <input
                        type="text"
                        placeholder="00:1A:2B:3C:4D:5E"
                        value={formData.newProductMac}
                        onChange={(e) => setFormData({ ...formData, newProductMac: e.target.value })}
                        className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700">IMEI (Si es celular)</label>
                      <input
                        type="text"
                        placeholder="3598..."
                        value={formData.newProductImei}
                        onChange={(e) => setFormData({ ...formData, newProductImei: e.target.value })}
                        className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-mono"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700">Proveedor (Opcional)</label>
                      <input
                        type="text"
                        placeholder="Intcomex, Claro..."
                        value={formData.supplierName}
                        onChange={(e) => setFormData({ ...formData, supplierName: e.target.value })}
                        className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700">Teléfono Contacto Proveedor</label>
                      <input
                        type="text"
                        placeholder="2233-4455"
                        value={formData.supplierPhone}
                        onChange={(e) => setFormData({ ...formData, supplierPhone: e.target.value })}
                        className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700">N° Contrato (Opcional)</label>
                      <input
                        type="text"
                        placeholder="CONT-2026-01"
                        value={formData.contractNumber}
                        onChange={(e) => setFormData({ ...formData, contractNumber: e.target.value })}
                        className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-mono"
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700">Tipo de Operación *</label>
                  <select
                    value={formData.movementType}
                    onChange={(e) => setFormData({ ...formData, movementType: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none"
                  >
                    <option value="ENTRADA">Entrada / Recepción a Bodega</option>
                    <option value="ASIGNACION">Entrega / Asignación a Empleado</option>
                    <option value="TRASLADO">Traslado entre Departamentos</option>
                    <option value="CONSUMO">Salida por Consumo</option>
                    <option value="DEVOLUCION">Devolución a Bodega</option>
                    <option value="BAJA">Baja de Activo</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700">Cantidad *</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={formData.quantity}
                    onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-mono focus:border-emerald-600 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700">Costo Unitario (Q - Opcional)</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={formData.unitCost}
                    onChange={(e) => setFormData({ ...formData, unitCost: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-mono focus:border-emerald-600 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700">
                    Entregar / Asignar a Empleado (Opcional)
                  </label>
                  <select
                    value={formData.toEmployeeId}
                    onChange={(e) => {
                      const emp = employees.find((x) => x.id === e.target.value);
                      setFormData({
                        ...formData,
                        toEmployeeId: e.target.value,
                        recipientName: emp ? emp.full_name : formData.recipientName,
                        toDepartmentId: emp?.department_id || formData.toDepartmentId,
                      });
                    }}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none"
                  >
                    <option value="">-- En Bodega Central / Sin empleado específico --</option>
                    {employees.map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.full_name} ({emp.employee_code})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700">Departamento Destino</label>
                  <select
                    value={formData.toDepartmentId}
                    onChange={(e) => setFormData({ ...formData, toDepartmentId: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none"
                  >
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Opción de Generar Acta de Entrega Digital (No obligatoria, a elección del admin) */}
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-3.5">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.requiresActa}
                    onChange={(e) => setFormData({ ...formData, requiresActa: e.target.checked })}
                    className="mt-0.5 h-4 w-4 rounded border-emerald-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  <div className="flex-1">
                    <div className="text-xs font-bold text-emerald-950 flex items-center gap-1.5">
                      <FileSignature className="h-4 w-4 text-emerald-700" />
                      ¿Generar Acta Digital de Entrega para Firma del Colaborador? (Opcional)
                    </div>
                    <p className="text-[11px] text-emerald-800 mt-0.5">
                      Si lo marcas, se creará automáticamente el Acta Oficial de 2 páginas lista para enviar por WhatsApp, Correo Outlook o imprimir en PDF. Si no lo marcas ahora, también podrás generarla después con 1 clic en la tabla.
                    </p>
                  </div>
                </label>

                {formData.requiresActa && (
                  <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-emerald-200/70">
                    <div>
                      <label className="block text-[11px] font-bold text-emerald-900">Condición de Entrega</label>
                      <select
                        value={formData.condition}
                        onChange={(e) => setFormData({ ...formData, condition: e.target.value })}
                        className="mt-1 w-full rounded-xl border border-emerald-300 bg-white px-2.5 py-1.5 text-xs"
                      >
                        <option value="Nuevo">Nuevo</option>
                        <option value="Usado en buen estado">Usado en buen estado</option>
                        <option value="Usado - malas condiciones">Usado - malas condiciones</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-emerald-900">
                        Nombre Receptor (si no seleccionó de la lista)
                      </label>
                      <input
                        type="text"
                        placeholder="Nombre completo de quien recibe..."
                        value={formData.recipientName}
                        onChange={(e) => setFormData({ ...formData, recipientName: e.target.value })}
                        className="mt-1 w-full rounded-xl border border-emerald-300 bg-white px-2.5 py-1.5 text-xs"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700">Fecha del Movimiento</label>
                  <input
                    type="date"
                    required
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700">N° Factura / Orden / Referencia</label>
                  <input
                    type="text"
                    placeholder="FAC-2026-001 o Vale N° 45"
                    value={formData.referenceCode}
                    onChange={(e) => setFormData({ ...formData, referenceCode: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-mono focus:border-emerald-600 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Motivo o Justificación del Movimiento *:
                </label>
                <textarea
                  rows={2}
                  required
                  placeholder="ej. Ingreso de equipo nuevo a Bodega Central / Entrega de teléfono corporativo a colaborador..."
                  value={formData.reason}
                  onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 text-sm focus:border-emerald-600 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-emerald-700 px-5 py-2 text-sm font-bold text-white hover:bg-emerald-800 shadow-md"
                >
                  Guardar Movimiento
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
