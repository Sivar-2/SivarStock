'use client';

import React, { useState, useEffect } from 'react';
import {
  Wrench,
  AlertTriangle,
  CheckCircle2,
  Plus,
  Clock,
  User,
  X,
  History,
  Calendar,
  Layers,
  Eye,
  Trash2,
  ExternalLink,
  Sparkles,
  Building2,
} from 'lucide-react';

export default function MantenimientoPage() {
  const [records, setRecords] = useState<any[]>([]);
  const [brokenItems, setBrokenItems] = useState<any[]>([]);
  const [allItems, setAllItems] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'activas' | 'observacion' | 'resueltas'>('activas');

  // Modales
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [createNewBrokenItem, setCreateNewBrokenItem] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showResolveModal, setShowResolveModal] = useState(false);

  // Registro seleccionado
  const [activeRecord, setActiveRecord] = useState<any | null>(null);
  const [newUpdateNote, setNewUpdateNote] = useState('');
  const [newUpdateStatus, setNewUpdateStatus] = useState('EN_REPARACION');

  // Formulario Agendar / Nuevo Producto Averiado / Observación
  const [scheduleForm, setScheduleForm] = useState({
    itemId: '',
    newProductName: '',
    newBrand: '',
    newModel: '',
    newSerialNumber: '',
    employeeId: '',
    scheduledDate: new Date().toISOString().split('T')[0],
    faultDescription: '',
    severity: 'MODERADA',
    repairScope: 'TERCERO', // 'TERCERO' | 'INTERNA_NOSOTROS'
    technicianSupplier: '',
    repairCost: '0',
    currency: 'GTQ',
    startInObservation: false,
  });

  // Formulario Resolución / Observación 7 días / Baja
  const [resolveForm, setResolveForm] = useState({
    solutionType: 'REPARACION_PROVEEDOR',
    employeeId: '',
    replacementItemId: '',
    replacementReason: '',
    resolutionNotes: '',
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const [mntRes, invRes, empRes] = await Promise.all([
        fetch('/api/maintenance'),
        fetch('/api/inventory/items'),
        fetch('/api/employees?all=true'),
      ]);

      const mntData = await mntRes.json();
      const invData = await invRes.json();
      const empData = await empRes.json();

      if (mntData.records) setRecords(mntData.records);
      if (mntData.brokenItems) setBrokenItems(mntData.brokenItems);
      if (invData.items) setAllItems(invData.items);
      if (empData.employees) setEmployees(empData.employees);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const buildGoogleCalendarUrl = (params: {
    title: string;
    dateStr: string;
    details: string;
  }) => {
    const cleanDate = (params.dateStr || new Date().toISOString().split('T')[0]).replace(/-/g, '');
    const datesParam = `${cleanDate}/${cleanDate}`;
    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(
      params.title
    )}&dates=${datesParam}&details=${encodeURIComponent(params.details)}`;
  };

  const handleOpenGoogleCalendarForRecord = (r: any) => {
    const dateStr = r.scheduled_date || r.observation_end_date || r.reported_date?.slice(0, 10);
    const title = `[IT Grupo FPC] Mantenimiento / Entrega: ${r.permanent_code} (${r.brand || ''} ${r.model || ''})`;
    const details =
      `Equipo: ${r.permanent_code} - ${r.product_name || ''} (${r.brand || ''} ${r.model || ''})\n` +
      `Empleado asignado: ${r.employee_name || 'Bodega / General'}\n` +
      `Modalidad: ${r.repair_scope === 'INTERNA_NOSOTROS' ? 'Reparación Interna (IT Nosotros)' : `Tercero (${r.technician_supplier || 'Externo'})`}\n` +
      `Motivo / Falla: ${r.fault_description}\n` +
      `Estado: ${r.status}`;

    window.open(buildGoogleCalendarUrl({ title, dateStr, details }), '_blank');
  };

  const handleCreateSchedule = async (e: React.FormEvent, openCalendarAfter = false) => {
    e.preventDefault();
    if (!createNewBrokenItem && !scheduleForm.itemId) {
      alert('Debe seleccionar un equipo de la lista o activar "+ Nuevo Producto Averiado".');
      return;
    }
    if (!scheduleForm.faultDescription.trim()) {
      alert('Debe describir la avería o el motivo del mantenimiento.');
      return;
    }

    try {
      const res = await fetch('/api/maintenance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...scheduleForm,
          createNewBrokenItem,
        }),
      });

      const d = await res.json();
      if (!res.ok) throw new Error(d.error);

      if (openCalendarAfter) {
        const selectedItem = allItems.find((x) => x.id === scheduleForm.itemId);
        const itemLabel = createNewBrokenItem
          ? `${scheduleForm.newProductName} (${scheduleForm.newBrand} ${scheduleForm.newModel})`
          : `${selectedItem?.permanent_code || ''} ${selectedItem?.brand || ''} ${selectedItem?.model || ''}`;
        const url = buildGoogleCalendarUrl({
          title: `[IT Grupo FPC] Mantenimiento: ${itemLabel}`,
          dateStr: scheduleForm.scheduledDate,
          details: `Motivo / Avería: ${scheduleForm.faultDescription}\nResponsable: ${
            scheduleForm.repairScope === 'INTERNA_NOSOTROS'
              ? 'Reparación Interna (Nosotros IT)'
              : scheduleForm.technicianSupplier || 'Proveedor Tercero'
          }`,
        });
        window.open(url, '_blank');
      }

      setShowScheduleModal(false);
      setCreateNewBrokenItem(false);
      setScheduleForm({
        itemId: '',
        newProductName: '',
        newBrand: '',
        newModel: '',
        newSerialNumber: '',
        employeeId: '',
        scheduledDate: new Date().toISOString().split('T')[0],
        faultDescription: '',
        severity: 'MODERADA',
        repairScope: 'TERCERO',
        technicianSupplier: '',
        repairCost: '0',
        currency: 'GTQ',
        startInObservation: false,
      });
      if (scheduleForm.startInObservation) {
        setActiveTab('observacion');
      }
      loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleAddUpdate = async () => {
    if (!activeRecord || !newUpdateNote.trim()) return;

    try {
      const res = await fetch('/api/maintenance', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: activeRecord.id,
          action: 'ADD_UPDATE',
          note: newUpdateNote.trim(),
          status: newUpdateStatus,
        }),
      });

      const d = await res.json();
      if (!res.ok) throw new Error(d.error);

      setNewUpdateNote('');
      await loadData();
      setActiveRecord((prev: any) =>
        prev
          ? {
              ...prev,
              status: newUpdateStatus,
              updates: d.updates || [
                ...(prev.updates || []),
                {
                  date: new Date().toISOString().split('T')[0],
                  note: newUpdateNote.trim(),
                  author: 'Especialista IT',
                  status: newUpdateStatus,
                },
              ],
            }
          : null
      );
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleStartObservationQuick = async (record: any) => {
    try {
      const res = await fetch('/api/maintenance', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: record.id,
          action: 'START_OBSERVATION',
          employeeId: record.employee_id || record.current_employee_id || null,
          note: 'Equipo entregado al colaborador en período de observación por 7 días (1 semana).',
        }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      setShowDetailModal(false);
      setActiveTab('observacion');
      await loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleResolveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeRecord) return;

    try {
      const res = await fetch('/api/maintenance', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: activeRecord.id,
          action: resolveForm.solutionType === 'EN_OBSERVACION_7_DIAS' ? 'START_OBSERVATION' : 'RESOLVE',
          ...resolveForm,
        }),
      });

      const d = await res.json();
      if (!res.ok) throw new Error(d.error);

      setShowResolveModal(false);
      setShowDetailModal(false);
      if (resolveForm.solutionType === 'EN_OBSERVACION_7_DIAS') {
        setActiveTab('observacion');
      }
      await loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const activeRecords = records.filter((r) =>
    ['REPORTADA', 'AGENDADA', 'EN_DIAGNOSTICO', 'EN_REPARACION'].includes(r.status)
  );

  const observationRecords = records.filter(
    (r) => r.status === 'EN_OBSERVACION' || r.resolution_status === 'EN_OBSERVACION'
  );

  const resolvedRecords = records.filter((r) =>
    ['REPARADO', 'IRREPARABLE_REEMPLAZO', 'DADO_DE_BAJA'].includes(r.status)
  );

  const displayList =
    activeTab === 'activas'
      ? activeRecords
      : activeTab === 'observacion'
      ? observationRecords
      : resolvedRecords;

  return (
    <div className="space-y-6">
      {/* Cabecera con los 3 botones solicitados */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2.5">
            <Wrench className="h-7 w-7 text-emerald-600" />
            Averías y Mantenimiento
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Reparación con Terceros o Interna (Nosotros) • Prueba de 7 días en Observación con Empleado • Bitácora de Repuestos y Google Calendar
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => {
              setCreateNewBrokenItem(true);
              setScheduleForm((prev) => ({
                ...prev,
                itemId: '',
                startInObservation: false,
                scheduledDate: new Date().toISOString().split('T')[0],
              }));
              setShowScheduleModal(true);
            }}
            className="flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2 text-xs font-bold text-rose-800 hover:bg-rose-100 transition"
          >
            <AlertTriangle className="h-4 w-4 text-rose-600" />
            <span>+ Nuevo Producto Averiado</span>
          </button>

          <button
            onClick={() => {
              setCreateNewBrokenItem(false);
              setScheduleForm((prev) => ({
                ...prev,
                startInObservation: true,
                scheduledDate: new Date().toISOString().split('T')[0],
              }));
              setShowScheduleModal(true);
            }}
            className="flex items-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50 px-3.5 py-2 text-xs font-bold text-indigo-800 hover:bg-indigo-100 transition"
          >
            <Eye className="h-4 w-4 text-indigo-600" />
            <span>En Observación (Prueba 7 días)</span>
          </button>

          <button
            onClick={() => {
              setCreateNewBrokenItem(false);
              setScheduleForm({
                itemId: '',
                newProductName: '',
                newBrand: '',
                newModel: '',
                newSerialNumber: '',
                employeeId: '',
                scheduledDate: new Date().toISOString().split('T')[0],
                faultDescription: '',
                severity: 'MODERADA',
                repairScope: 'TERCERO',
                technicianSupplier: '',
                repairCost: '0',
                currency: 'GTQ',
                startInObservation: false,
              });
              setShowScheduleModal(true);
            }}
            className="flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white shadow-md hover:bg-emerald-800 transition"
          >
            <Plus className="h-4 w-4" />
            <span>Agendar Mantenimiento</span>
          </button>
        </div>
      </div>

      {/* Alerta de Equipos Averiados Pendientes de Agendar */}
      {brokenItems.length > 0 && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50/80 p-4 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 font-bold text-amber-900 text-sm">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
              <span>Equipos Reportados con Falla Pendientes de Agendar ({brokenItems.length})</span>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {brokenItems.map((bi) => (
              <div
                key={bi.id}
                className="flex items-center justify-between rounded-xl bg-white p-3 border border-amber-200 shadow-xs"
              >
                <div>
                  <div className="font-bold text-xs text-slate-900">
                    {bi.product_name} ({bi.brand} {bi.model})
                  </div>
                  <div className="font-mono text-[11px] text-amber-800 font-semibold">{bi.permanent_code}</div>
                  {bi.employee_name && (
                    <div className="text-[11px] font-semibold text-indigo-700">Empleado: {bi.employee_name}</div>
                  )}
                  <div className="text-[11px] text-slate-500 truncate max-w-[180px]">
                    {bi.broken_notes || 'Falla reportada'}
                  </div>
                </div>
                <button
                  onClick={() => {
                    setCreateNewBrokenItem(false);
                    setScheduleForm({
                      itemId: bi.id,
                      newProductName: '',
                      newBrand: '',
                      newModel: '',
                      newSerialNumber: '',
                      employeeId: bi.employee_id || '',
                      scheduledDate: new Date().toISOString().split('T')[0],
                      faultDescription: bi.broken_notes || 'Avería de equipo',
                      severity: 'MODERADA',
                      repairScope: 'TERCERO',
                      technicianSupplier: '',
                      repairCost: '0',
                      currency: 'GTQ',
                      startInObservation: false,
                    });
                    setShowScheduleModal(true);
                  }}
                  className="rounded-lg bg-amber-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-amber-700"
                >
                  Agendar
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pestañas de Órdenes */}
      <div className="flex flex-wrap items-center gap-2 bg-slate-100 p-1.5 rounded-xl w-fit">
        <button
          onClick={() => setActiveTab('activas')}
          className={`rounded-lg px-4 py-1.5 text-xs font-bold transition ${
            activeTab === 'activas' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          En Reparación / Taller ({activeRecords.length})
        </button>
        <button
          onClick={() => setActiveTab('observacion')}
          className={`rounded-lg px-4 py-1.5 text-xs font-bold transition flex items-center gap-1.5 ${
            activeTab === 'observacion'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-indigo-700 hover:bg-indigo-50'
          }`}
        >
          <Eye className="h-3.5 w-3.5" />
          En Observación 7 Días ({observationRecords.length})
        </button>
        <button
          onClick={() => setActiveTab('resueltas')}
          className={`rounded-lg px-4 py-1.5 text-xs font-bold transition ${
            activeTab === 'resueltas' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Historial: Funcionales / Bajas ({resolvedRecords.length})
        </button>
      </div>

      {/* Tabla de Mantenimientos */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="border-b border-slate-200 bg-slate-50/75 text-[11px] uppercase font-bold text-slate-700">
              <tr>
                <th className="py-3.5 px-4">Equipo / Código</th>
                <th className="py-3.5 px-4">Empleado / Área</th>
                <th className="py-3.5 px-4">Modalidad Reparación</th>
                <th className="py-3.5 px-4">Descripción / Último Update</th>
                <th className="py-3.5 px-4">Estado / Observación</th>
                <th className="py-3.5 px-4">Costo</th>
                <th className="py-3.5 px-4 text-right">Acciones & Calendar</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    Cargando órdenes de mantenimiento...
                  </td>
                </tr>
              ) : displayList.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    No hay registros en esta pestaña.
                  </td>
                </tr>
              ) : (
                displayList.map((r) => {
                  const lastUpdate = r.updates && r.updates.length > 0 ? r.updates[r.updates.length - 1] : null;
                  return (
                    <tr
                      key={r.id}
                      onClick={() => {
                        setActiveRecord(r);
                        setShowDetailModal(true);
                      }}
                      className="hover:bg-slate-50/70 cursor-pointer transition"
                    >
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-900">
                          {r.product_name} ({r.brand} {r.model})
                        </div>
                        <div className="font-mono text-xs text-emerald-700 font-bold">{r.permanent_code}</div>
                      </td>

                      <td className="py-3.5 px-4">
                        {r.employee_name ? (
                          <div className="text-xs font-bold text-slate-900 flex items-center gap-1">
                            <User className="h-3.5 w-3.5 text-indigo-600" />
                            {r.employee_name}
                          </div>
                        ) : (
                          <div className="text-xs font-semibold text-slate-500">Bodega Central</div>
                        )}
                        <div className="text-[11px] text-slate-400">{r.department_name || 'General'}</div>
                      </td>

                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-block rounded-lg px-2.5 py-0.5 text-[10px] font-bold ${
                            r.repair_scope === 'INTERNA_NOSOTROS'
                              ? 'bg-sky-100 text-sky-900'
                              : 'bg-purple-100 text-purple-900'
                          }`}
                        >
                          {r.repair_scope === 'INTERNA_NOSOTROS'
                            ? 'Reparación Interna (Nosotros)'
                            : `Con Tercero: ${r.technician_supplier || 'Proveedor'}`}
                        </span>
                        <div className="font-mono text-[11px] text-slate-400 mt-0.5">
                          Fecha: {r.scheduled_date || r.reported_date?.slice(0, 10)}
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-xs text-slate-800 max-w-xs">
                        <div className="font-semibold text-slate-900 truncate" title={r.fault_description}>
                          {r.fault_description}
                        </div>
                        {lastUpdate && (
                          <div className="text-[11px] text-slate-500 truncate mt-0.5" title={lastUpdate.note}>
                            Último avance ({lastUpdate.date}): {lastUpdate.note}
                          </div>
                        )}
                      </td>

                      <td className="py-3.5 px-4">
                        {r.status === 'EN_OBSERVACION' || r.resolution_status === 'EN_OBSERVACION' ? (
                          <div className="space-y-1">
                            <span className="inline-flex items-center gap-1 rounded-full bg-indigo-100 px-2.5 py-0.5 text-[10px] font-black text-indigo-800">
                              <Eye className="h-3 w-3" /> EN OBSERVACIÓN
                            </span>
                            <div className="text-[10px] font-bold text-indigo-700">
                              ⏳ {r.observationDaysRemaining ?? 7} día(s) restantes para pasar a Funcional
                            </div>
                          </div>
                        ) : r.status === 'REPARADO' ? (
                          <span className="inline-block rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-800">
                            ✓ FUNCIONAL / REPARADO
                          </span>
                        ) : r.status === 'DADO_DE_BAJA' || r.status === 'IRREPARABLE_REEMPLAZO' ? (
                          <span className="inline-block rounded-full bg-rose-100 px-2.5 py-0.5 text-xs font-bold text-rose-800">
                            DADO DE BAJA / DESECHADO
                          </span>
                        ) : (
                          <span className="inline-block rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-800">
                            {r.status}
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 font-mono text-xs font-bold text-slate-900">
                        {r.repair_cost > 0
                          ? `Q${Number(r.repair_cost).toLocaleString('es-GT', { minimumFractionDigits: 2 })}`
                          : '-'}
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenGoogleCalendarForRecord(r);
                            }}
                            className="inline-flex items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1 text-[11px] font-bold text-blue-700 hover:bg-blue-100"
                            title="Agendar recordatorio en Google Calendar"
                          >
                            <Calendar className="h-3 w-3" />
                            Calendar
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveRecord(r);
                              setShowDetailModal(true);
                            }}
                            className="rounded-xl border border-slate-200 bg-white px-2.5 py-1 text-xs font-bold text-slate-700 hover:bg-slate-50 shadow-sm"
                          >
                            Bitácora ({r.updates?.length || 0})
                          </button>
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

      {/* MODAL DETALLES DEL MANTENIMIENTO, BITÁCORA DE UPDATES Y RESOLUCIÓN */}
      {showDetailModal && activeRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl max-h-[92vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between border-b border-slate-100 pb-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                    {activeRecord.permanent_code}
                  </span>
                  <h3 className="text-lg font-bold text-slate-900">
                    {activeRecord.product_name} ({activeRecord.brand} {activeRecord.model})
                  </h3>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">Falla reportada: {activeRecord.fault_description}</p>
              </div>
              <button onClick={() => setShowDetailModal(false)} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Parámetros de la orden y Empleado vinculado */}
            <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-100 text-xs">
              <div>
                <span className="text-slate-400 block">Modalidad</span>
                <span className="font-bold text-slate-800">
                  {activeRecord.repair_scope === 'INTERNA_NOSOTROS'
                    ? 'Interna (Nosotros IT)'
                    : `Tercero (${activeRecord.technician_supplier || 'Externo'})`}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block">Empleado Asociado</span>
                <span className="font-bold text-indigo-800">{activeRecord.employee_name || 'Bodega Central'}</span>
              </div>
              <div>
                <span className="text-slate-400 block">Costo Reparación</span>
                <span className="font-mono font-bold text-emerald-700">
                  Q{Number(activeRecord.repair_cost || 0).toLocaleString('es-GT', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block">Estado Actual</span>
                <span className="font-bold text-amber-700">{activeRecord.status}</span>
              </div>
            </div>

            {activeRecord.status === 'EN_OBSERVACION' && (
              <div className="mt-3 rounded-xl border border-indigo-200 bg-indigo-50 p-3 text-xs text-indigo-950 flex items-center justify-between">
                <div>
                  <strong>En Período de Observación (1 Semana / 7 días):</strong> Del{' '}
                  <span className="font-mono">{activeRecord.observation_start_date}</span> al{' '}
                  <span className="font-mono font-bold">{activeRecord.observation_end_date}</span>. Si transcurren los 7 días sin inconvenientes, pasará automáticamente a <strong>FUNCIONAL</strong>.
                </div>
              </div>
            )}

            {/* Línea de Tiempo / Bitácora de Notas y Repuestos */}
            <div className="mt-5">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                  <History className="h-4 w-4 text-emerald-600" />
                  Bitácora de Avances, Repuestos y Seguimiento ({activeRecord.updates?.length || 0})
                </h4>
                <button
                  type="button"
                  onClick={() => handleOpenGoogleCalendarForRecord(activeRecord)}
                  className="inline-flex items-center gap-1 rounded-lg bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700 hover:bg-blue-100 border border-blue-200"
                >
                  <Calendar className="h-3.5 w-3.5" /> Agregar a Google Calendar
                </button>
              </div>

              <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                {activeRecord.updates && activeRecord.updates.length > 0 ? (
                  activeRecord.updates.map((u: any, idx: number) => (
                    <div key={idx} className="rounded-xl border border-slate-100 bg-slate-50 p-3 text-xs">
                      <div className="flex items-center justify-between text-slate-500 font-mono text-[11px] mb-1">
                        <span>
                          {u.date} • <strong>{u.status}</strong>
                        </span>
                        <span className="font-semibold text-slate-700">{u.author}</span>
                      </div>
                      <p className="text-slate-800">{u.note}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-slate-400 italic">Sin avances registrados.</p>
                )}
              </div>
            </div>

            {/* Agregar nueva nota a la bitácora del mantenimiento */}
            {!['REPARADO', 'IRREPARABLE_REEMPLAZO', 'DADO_DE_BAJA'].includes(activeRecord.status) && (
              <div className="mt-4 border-t border-slate-100 pt-3">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Agregar Nota a la Bitácora (ej. &ldquo;Se compró repuesto X&rdquo;, &ldquo;En espera de pieza para que funcione&rdquo;):
                </label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    placeholder="Escribe el avance o repuesto comprado..."
                    value={newUpdateNote}
                    onChange={(e) => setNewUpdateNote(e.target.value)}
                    className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-xs focus:border-emerald-600 focus:outline-none"
                  />
                  <select
                    value={newUpdateStatus}
                    onChange={(e) => setNewUpdateStatus(e.target.value)}
                    className="rounded-xl border border-slate-200 px-2.5 py-1.5 text-xs focus:border-emerald-600 focus:outline-none"
                  >
                    <option value="EN_DIAGNOSTICO">En Diagnóstico</option>
                    <option value="EN_REPARACION">En Reparación / Esperando Pieza</option>
                    <option value="EN_OBSERVACION">En Observación (Prueba)</option>
                    <option value="AGENDADA">Agendada</option>
                  </select>
                  <button
                    type="button"
                    onClick={handleAddUpdate}
                    disabled={!newUpdateNote.trim()}
                    className="rounded-xl bg-emerald-700 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-800 disabled:opacity-50"
                  >
                    + Guardar Nota
                  </button>
                </div>
              </div>
            )}

            {/* Botones de Acción Rápida: Poner en Observación 7 días o Concluir / Dar de Baja */}
            <div className="mt-6 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-4">
              <button
                type="button"
                onClick={() => setShowDetailModal(false)}
                className="rounded-xl bg-slate-100 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200"
              >
                Cerrar
              </button>

              {!['REPARADO', 'IRREPARABLE_REEMPLAZO', 'DADO_DE_BAJA'].includes(activeRecord.status) && (
                <div className="flex flex-wrap items-center gap-2">
                  {activeRecord.status !== 'EN_OBSERVACION' && (
                    <button
                      type="button"
                      onClick={() => handleStartObservationQuick(activeRecord)}
                      className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-indigo-700 shadow"
                    >
                      <Eye className="h-4 w-4" />
                      <span>Poner en Observación (7 días)</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setResolveForm({
                        solutionType:
                          activeRecord.repair_scope === 'INTERNA_NOSOTROS'
                            ? 'REPARACION_INTERNA'
                            : 'REPARACION_PROVEEDOR',
                        employeeId: activeRecord.employee_id || activeRecord.current_employee_id || '',
                        replacementItemId: '',
                        replacementReason: '',
                        resolutionNotes: '',
                      });
                      setShowResolveModal(true);
                    }}
                    className="flex items-center gap-1.5 rounded-xl bg-emerald-700 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-800 shadow"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    <span>Marcar Funcional / Dar de Baja</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL AGENDAR MANTENIMIENTO / NUEVO PRODUCTO AVERIADO / OBSERVACIÓN */}
      {showScheduleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm overflow-y-auto">
          <div className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-2xl my-8 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Wrench className="h-5 w-5 text-emerald-600" />
                {createNewBrokenItem
                  ? 'Registrar Nuevo Producto Averiado'
                  : scheduleForm.startInObservation
                  ? 'Registrar Equipo en Observación (Prueba de 7 Días)'
                  : 'Agendar Mantenimiento o Reparación'}
              </h3>
              <button onClick={() => setShowScheduleModal(false)} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2 rounded-xl bg-slate-100 p-1">
              <button
                type="button"
                onClick={() => setCreateNewBrokenItem(false)}
                className={`rounded-lg py-1.5 text-xs font-bold transition ${
                  !createNewBrokenItem ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
                }`}
              >
                Seleccionar Equipo del Inventario
              </button>
              <button
                type="button"
                onClick={() => setCreateNewBrokenItem(true)}
                className={`rounded-lg py-1.5 text-xs font-bold transition ${
                  createNewBrokenItem ? 'bg-rose-600 text-white shadow-sm' : 'text-slate-600'
                }`}
              >
                + Nuevo Producto Averiado
              </button>
            </div>

            <form onSubmit={(e) => handleCreateSchedule(e, false)} className="mt-4 space-y-3.5">
              {!createNewBrokenItem ? (
                <div>
                  <label className="block text-xs font-bold text-slate-700">Seleccionar Equipo *</label>
                  <select
                    required={!createNewBrokenItem}
                    value={scheduleForm.itemId}
                    onChange={(e) => {
                      const it = allItems.find((x) => x.id === e.target.value);
                      setScheduleForm({
                        ...scheduleForm,
                        itemId: e.target.value,
                        employeeId: it?.current_employee_id || scheduleForm.employeeId,
                      });
                    }}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none"
                  >
                    <option value="">Seleccione el equipo...</option>
                    {allItems.map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.permanent_code} - {i.product_name} ({i.brand} {i.model}){' '}
                        {i.assigned_user_name ? `• Asignado a: ${i.assigned_user_name}` : '• En Bodega'}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="rounded-xl border border-rose-200 bg-rose-50/40 p-3.5 space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-xs font-bold text-slate-700">Nombre del Equipo Averiado *</label>
                      <input
                        type="text"
                        required={createNewBrokenItem}
                        placeholder="ej. Impresora Térmica, Monitor..."
                        value={scheduleForm.newProductName}
                        onChange={(e) => setScheduleForm({ ...scheduleForm, newProductName: e.target.value })}
                        className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700">N° de Serie (S/N)</label>
                      <input
                        type="text"
                        placeholder="SN-12345"
                        value={scheduleForm.newSerialNumber}
                        onChange={(e) => setScheduleForm({ ...scheduleForm, newSerialNumber: e.target.value })}
                        className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-mono"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-xs font-bold text-slate-700">Marca</label>
                      <input
                        type="text"
                        placeholder="Epson, HP, Dell..."
                        value={scheduleForm.newBrand}
                        onChange={(e) => setScheduleForm({ ...scheduleForm, newBrand: e.target.value })}
                        className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700">Modelo</label>
                      <input
                        type="text"
                        placeholder="L3250..."
                        value={scheduleForm.newModel}
                        onChange={(e) => setScheduleForm({ ...scheduleForm, newModel: e.target.value })}
                        className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* ¿Quién realiza la reparación? Con un tercero vs Interna (Nosotros) */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  ¿Dónde se realiza la reparación? *
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setScheduleForm({ ...scheduleForm, repairScope: 'INTERNA_NOSOTROS' })}
                    className={`rounded-xl border p-2.5 text-xs font-bold transition ${
                      scheduleForm.repairScope === 'INTERNA_NOSOTROS'
                        ? 'border-sky-600 bg-sky-50 text-sky-900'
                        : 'border-slate-200 bg-white text-slate-600'
                    }`}
                  >
                    🛠️ Reparación Interna (Nosotros / IT)
                  </button>
                  <button
                    type="button"
                    onClick={() => setScheduleForm({ ...scheduleForm, repairScope: 'TERCERO' })}
                    className={`rounded-xl border p-2.5 text-xs font-bold transition ${
                      scheduleForm.repairScope === 'TERCERO'
                        ? 'border-purple-600 bg-purple-50 text-purple-900'
                        : 'border-slate-200 bg-white text-slate-600'
                    }`}
                  >
                    🏢 Reparación con un Tercero (Taller Externo)
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700">Empleado Vinculado al Equipo</label>
                  <select
                    value={scheduleForm.employeeId}
                    onChange={(e) => setScheduleForm({ ...scheduleForm, employeeId: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  >
                    <option value="">-- En Bodega / Sin empleado --</option>
                    {employees.map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.full_name} ({emp.employee_code})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700">Fecha Programada / Entrega</label>
                  <input
                    type="date"
                    required
                    value={scheduleForm.scheduledDate}
                    onChange={(e) => setScheduleForm({ ...scheduleForm, scheduledDate: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700">
                  Descripción de la Avería / Qué se está reparando o esperando *:
                </label>
                <textarea
                  rows={2}
                  required
                  placeholder="ej. Se compró kit de rodillos, en espera de repuesto para que funcione..."
                  value={scheduleForm.faultDescription}
                  onChange={(e) => setScheduleForm({ ...scheduleForm, faultDescription: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 text-sm"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700">
                    {scheduleForm.repairScope === 'INTERNA_NOSOTROS' ? 'Responsable IT' : 'Proveedor / Taller Tercero'}
                  </label>
                  <input
                    type="text"
                    placeholder={
                      scheduleForm.repairScope === 'INTERNA_NOSOTROS'
                        ? 'Alexander Turcios / IT'
                        : 'ej. Taller Epson, Canella...'
                    }
                    value={scheduleForm.technicianSupplier}
                    onChange={(e) => setScheduleForm({ ...scheduleForm, technicianSupplier: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700">Costo Repuesto/Taller (Q)</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={scheduleForm.repairCost}
                    onChange={(e) => setScheduleForm({ ...scheduleForm, repairCost: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700">Severidad</label>
                  <select
                    value={scheduleForm.severity}
                    onChange={(e) => setScheduleForm({ ...scheduleForm, severity: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs"
                  >
                    <option value="LEVE">Leve (Preventivo)</option>
                    <option value="MODERADA">Moderada</option>
                    <option value="CRITICA">Crítica / Urgente</option>
                  </select>
                </div>
              </div>

              {/* Opción: Iniciar directamente en observación por 7 días */}
              <label className="flex items-center gap-2.5 rounded-xl border border-indigo-200 bg-indigo-50/60 p-3 text-xs cursor-pointer">
                <input
                  type="checkbox"
                  checked={scheduleForm.startInObservation}
                  onChange={(e) => setScheduleForm({ ...scheduleForm, startInObservation: e.target.checked })}
                  className="h-4 w-4 rounded border-indigo-300 text-indigo-600"
                />
                <span className="font-bold text-indigo-950">
                  Dejar en Observación con el Empleado por 7 días (Si en 1 semana sigue bien, pasa a Funcional automáticamente)
                </span>
              </label>

              <div className="flex flex-wrap justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowScheduleModal(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={(e) => handleCreateSchedule(e as any, true)}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700 shadow-sm"
                >
                  <Calendar className="h-4 w-4" />
                  <span>Guardar + Abrir Google Calendar</span>
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-emerald-700 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-800 shadow-md"
                >
                  Guardar Registro
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL RESOLVER MANTENIMIENTO: FUNCIONAL, EN OBSERVACIÓN 7 DÍAS O DESECHAR / DAR DE BAJA */}
      {showResolveModal && activeRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                Resolución de {activeRecord.permanent_code}
              </h3>
              <button onClick={() => setShowResolveModal(false)} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleResolveSubmit} className="mt-4 space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700">Resultado / Estado del Equipo:</label>
                <select
                  value={resolveForm.solutionType}
                  onChange={(e) => setResolveForm({ ...resolveForm, solutionType: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold focus:border-emerald-600 focus:outline-none"
                >
                  <option value="REPARACION_INTERNA">✓ Funcional — Reparado Internamente por Nosotros (IT)</option>
                  <option value="REPARACION_PROVEEDOR">✓ Funcional — Reparado por un Tercero (Proveedor / Taller)</option>
                  <option value="EN_OBSERVACION_7_DIAS">
                    👁️ En Observación con Empleado (Prueba de 7 días → luego pasa a Funcional)
                  </option>
                  <option value="COMPRA_REEMPLAZO">🗑️ Desechar / Dar de Baja (Se reemplazó por otro equipo)</option>
                  <option value="BAJA_SIN_REEMPLAZO">🗑️ Desechar / Dar de Baja Definitiva (Irreparable)</option>
                </select>
              </div>

              {resolveForm.solutionType === 'EN_OBSERVACION_7_DIAS' && (
                <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-3 text-xs text-indigo-900 space-y-2">
                  <div className="font-bold">Prueba de 1 Semana (7 días) en Observación:</div>
                  <p>
                    El equipo quedará asignado en observación durante 7 días. Si no se reporta ninguna falla en ese lapso, el sistema lo marcará como <strong>FUNCIONAL</strong> automáticamente.
                  </p>
                  <div>
                    <label className="block font-bold mb-1">Empleado que tendrá el equipo en observación:</label>
                    <select
                      value={resolveForm.employeeId}
                      onChange={(e) => setResolveForm({ ...resolveForm, employeeId: e.target.value })}
                      className="w-full rounded-lg border border-indigo-300 bg-white px-2.5 py-1.5"
                    >
                      <option value="">-- Mantener empleado actual --</option>
                      {employees.map((emp) => (
                        <option key={emp.id} value={emp.id}>
                          {emp.full_name} ({emp.employee_code})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {resolveForm.solutionType === 'COMPRA_REEMPLAZO' && (
                <div className="rounded-xl border border-purple-200 bg-purple-50 p-3.5 space-y-3">
                  <div className="font-bold text-xs text-purple-900">
                    ¿Por cuál equipo disponible se sustituyó?
                  </div>
                  <select
                    value={resolveForm.replacementItemId}
                    onChange={(e) => setResolveForm({ ...resolveForm, replacementItemId: e.target.value })}
                    className="w-full rounded-xl border border-purple-300 bg-white px-3 py-2 text-xs"
                  >
                    <option value="">-- Opcional: Seleccione equipo sustituto --</option>
                    {allItems
                      .filter((i) => i.id !== activeRecord.item_id && i.operational_status === 'DISPONIBLE')
                      .map((i) => (
                        <option key={i.id} value={i.id}>
                          {i.permanent_code} - {i.brand} {i.model}
                        </option>
                      ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-700">Notas de Cierre / Qué se le realizó:</label>
                <textarea
                  rows={2}
                  placeholder="ej. Se instaló repuesto nuevo y quedó operando al 100%..."
                  value={resolveForm.resolutionNotes}
                  onChange={(e) => setResolveForm({ ...resolveForm, resolutionNotes: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 text-sm"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowResolveModal(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800"
                >
                  Confirmar Estado
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
