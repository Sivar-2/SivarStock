'use client';

import React, { useState, useEffect } from 'react';
import {
  Wrench,
  AlertTriangle,
  CheckCircle2,
  Plus,
  Clock,
  DollarSign,
  User,
  Building,
  X,
  History,
  Calendar,
  Layers,
  ArrowRight,
  ShieldAlert,
  Printer,
  Laptop
} from 'lucide-react';

export default function MantenimientoPage() {
  const [records, setRecords] = useState<any[]>([]);
  const [brokenItems, setBrokenItems] = useState<any[]>([]);
  const [allItems, setAllItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'activas' | 'resueltas'>('activas');

  // Modales
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showResolveModal, setShowResolveModal] = useState(false);

  // Registro seleccionado
  const [activeRecord, setActiveRecord] = useState<any | null>(null);
  const [newUpdateNote, setNewUpdateNote] = useState('');
  const [newUpdateStatus, setNewUpdateStatus] = useState('EN_REPARACION');

  // Formulario Agendar
  const [scheduleForm, setScheduleForm] = useState({
    itemId: '',
    scheduledDate: new Date().toISOString().split('T')[0],
    faultDescription: '',
    severity: 'MODERADA',
    technicianSupplier: '',
    repairCost: '0',
    currency: 'GTQ',
  });

  // Formulario Resolución / Reemplazo
  const [resolveForm, setResolveForm] = useState({
    solutionType: 'REPARACION_PROVEEDOR',
    replacementItemId: '',
    replacementReason: '',
    resolutionNotes: '',
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const [mntRes, invRes] = await Promise.all([
        fetch('/api/maintenance'),
        fetch('/api/inventory/items'),
      ]);

      const mntData = await mntRes.json();
      const invData = await invRes.json();

      if (mntData.records) setRecords(mntData.records);
      if (mntData.brokenItems) setBrokenItems(mntData.brokenItems);
      if (invData.items) setAllItems(invData.items);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scheduleForm.itemId || !scheduleForm.faultDescription.trim()) {
      alert('Debe seleccionar el equipo y describir la avería.');
      return;
    }

    try {
      const res = await fetch('/api/maintenance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(scheduleForm),
      });

      const d = await res.json();
      if (!res.ok) throw new Error(d.error);

      setShowScheduleModal(false);
      setScheduleForm({
        itemId: '',
        scheduledDate: new Date().toISOString().split('T')[0],
        faultDescription: '',
        severity: 'MODERADA',
        technicianSupplier: '',
        repairCost: '0',
        currency: 'GTQ',
      });
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
      loadData();
      // Recargar registro activo
      const updated = {
        ...activeRecord,
        status: newUpdateStatus,
        updates: [
          ...activeRecord.updates,
          {
            date: new Date().toISOString().split('T')[0],
            note: newUpdateNote.trim(),
            author: 'Usuario Activo',
            status: newUpdateStatus,
          },
        ],
      };
      setActiveRecord(updated);
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
          action: 'RESOLVE',
          ...resolveForm,
        }),
      });

      const d = await res.json();
      if (!res.ok) throw new Error(d.error);

      setShowResolveModal(false);
      setShowDetailModal(false);
      loadData();
      alert('Mantenimiento resuelto y estado de inventario actualizado.');
    } catch (err: any) {
      alert(err.message);
    }
  };

  const activeRecords = records.filter((r) =>
    ['REPORTADA', 'AGENDADA', 'EN_DIAGNOSTICO', 'EN_REPARACION'].includes(r.status)
  );

  const resolvedRecords = records.filter((r) =>
    ['REPARADO', 'IRREPARABLE_REEMPLAZO', 'DADO_DE_BAJA'].includes(r.status)
  );

  const displayList = activeTab === 'activas' ? activeRecords : resolvedRecords;

  return (
    <div className="space-y-6">
        {/* Cabecera */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-5">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2.5">
              <Wrench className="h-7 w-7 text-emerald-600" />
              Averías y Mantenimiento de Equipos
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Control preventivo y correctivo para impresoras y computadoras • Agendamiento • Historial de reparaciones y eventos de reemplazo child
            </p>
          </div>

          <button
            onClick={() => {
              setScheduleForm({
                itemId: '',
                scheduledDate: new Date().toISOString().split('T')[0],
                faultDescription: '',
                severity: 'MODERADA',
                technicianSupplier: '',
                repairCost: '0',
                currency: 'GTQ',
              });
              setShowScheduleModal(true);
            }}
            className="flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white shadow-md hover:bg-emerald-800 transition"
          >
            <Plus className="h-4 w-4" />
            <span>Agendar Mantenimiento</span>
          </button>
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
                    <div className="font-bold text-xs text-slate-900">{bi.brand} {bi.model}</div>
                    <div className="font-mono text-[11px] text-amber-800 font-semibold">{bi.permanent_code}</div>
                    <div className="text-[11px] text-slate-500 truncate max-w-[180px]">{bi.broken_notes || 'Falla reportada'}</div>
                  </div>
                  <button
                    onClick={() => {
                      setScheduleForm({
                        itemId: bi.id,
                        scheduledDate: new Date().toISOString().split('T')[0],
                        faultDescription: bi.broken_notes || 'Avería de equipo',
                        severity: 'MODERADA',
                        technicianSupplier: '',
                        repairCost: '0',
                        currency: 'GTQ',
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
        <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl w-fit">
          <button
            onClick={() => setActiveTab('activas')}
            className={`rounded-lg px-4 py-1.5 text-xs font-semibold transition ${
              activeTab === 'activas'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Órdenes Activas ({activeRecords.length})
          </button>
          <button
            onClick={() => setActiveTab('resueltas')}
            className={`rounded-lg px-4 py-1.5 text-xs font-semibold transition ${
              activeTab === 'resueltas'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Historial de Reparaciones / Bajas ({resolvedRecords.length})
          </button>
        </div>

        {/* Tabla de Mantenimientos */}
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="border-b border-slate-200 bg-slate-50/75 text-xs uppercase font-semibold text-slate-700">
                <tr>
                  <th className="py-3.5 px-4">Equipo / Código</th>
                  <th className="py-3.5 px-4">Categoría & Área</th>
                  <th className="py-3.5 px-4">Fecha Programada</th>
                  <th className="py-3.5 px-4">Descripción Avería</th>
                  <th className="py-3.5 px-4">Severidad</th>
                  <th className="py-3.5 px-4">Estado</th>
                  <th className="py-3.5 px-4">Costo Reparación</th>
                  <th className="py-3.5 px-4 text-right">Detalle & Updates</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-400">
                      Cargando órdenes de mantenimiento...
                    </td>
                  </tr>
                ) : displayList.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-400">
                      No hay órdenes en esta categoría.
                    </td>
                  </tr>
                ) : (
                  displayList.map((r) => (
                    <tr
                      key={r.id}
                      onClick={() => {
                        setActiveRecord(r);
                        setShowDetailModal(true);
                      }}
                      className="hover:bg-slate-50/70 cursor-pointer transition"
                    >
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-900">{r.brand} {r.model}</div>
                        <div className="font-mono text-xs text-emerald-700 font-bold">{r.permanent_code}</div>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="text-xs font-semibold text-slate-700">{r.category_name}</div>
                        <div className="text-[11px] text-slate-400">{r.department_name}</div>
                      </td>

                      <td className="py-3.5 px-4 font-mono text-xs text-slate-600">
                        {r.scheduled_date || r.reported_date?.slice(0, 10)}
                      </td>

                      <td className="py-3.5 px-4 text-xs text-slate-800 max-w-xs truncate" title={r.fault_description}>
                        {r.fault_description}
                      </td>

                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-bold ${
                            r.severity === 'CRITICA'
                              ? 'bg-rose-100 text-rose-800'
                              : r.severity === 'MODERADA'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-blue-100 text-blue-800'
                          }`}
                        >
                          {r.severity}
                        </span>
                      </td>

                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                            r.status === 'REPARADO'
                              ? 'bg-emerald-100 text-emerald-800'
                              : r.status === 'IRREPARABLE_REEMPLAZO'
                              ? 'bg-purple-100 text-purple-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {r.status}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 font-mono text-xs font-bold text-slate-900">
                        {r.repair_cost > 0
                          ? `Q${Number(r.repair_cost).toLocaleString('es-GT', { minimumFractionDigits: 2 })}`
                          : '-'}
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveRecord(r);
                            setShowDetailModal(true);
                          }}
                          className="rounded-xl border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-sm"
                        >
                          Ver ({r.updates?.length || 0})
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* MODAL DETALLES DEL MANTENIMIENTO, LÍNEA DE TIEMPO Y RESOLUCIÓN */}
        {showDetailModal && activeRecord && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
            <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl animate-in fade-in zoom-in-95">
              <div className="flex items-start justify-between border-b border-slate-100 pb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                      {activeRecord.permanent_code}
                    </span>
                    <h3 className="text-lg font-bold text-slate-900">
                      {activeRecord.brand} {activeRecord.model}
                    </h3>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Falla: {activeRecord.fault_description}
                  </p>
                </div>
                <button onClick={() => setShowDetailModal(false)} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100">
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Parámetros de la orden */}
              <div className="mt-4 grid grid-cols-3 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-100 text-xs">
                <div>
                  <span className="text-slate-400 block">Técnico / Proveedor</span>
                  <span className="font-bold text-slate-800">{activeRecord.technician_supplier || 'Interno IT'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Costo Estimado</span>
                  <span className="font-mono font-bold text-emerald-700">
                    Q{Number(activeRecord.repair_cost || 0).toLocaleString('es-GT', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block">Estado Actual</span>
                  <span className="font-bold text-amber-700">{activeRecord.status}</span>
                </div>
              </div>

              {/* Evento Child: Si fue reemplazado por otro equipo */}
              {activeRecord.replacement_item_code && (
                <div className="mt-4 rounded-xl border border-purple-200 bg-purple-50 p-3.5 text-xs text-purple-900">
                  <div className="flex items-center gap-1.5 font-bold mb-1">
                    <Layers className="h-4 w-4 text-purple-700" />
                    <span>Equipo Reemplazado (Evento Child de Sustitución):</span>
                  </div>
                  <p>
                    Sustituido por el equipo nuevo:{' '}
                    <span className="font-mono font-bold text-purple-950">
                      {activeRecord.replacement_item_code}
                    </span>{' '}
                    ({activeRecord.replacement_product_name}).
                  </p>
                  <p className="mt-0.5 text-purple-800">
                    Motivo registrado: {activeRecord.replacement_reason || 'Sin reparación posible'}
                  </p>
                </div>
              )}

              {/* Línea de Tiempo de Updates */}
              <div className="mt-5">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 mb-2 flex items-center gap-1.5">
                  <History className="h-4 w-4 text-emerald-600" />
                  Línea de Tiempo de Avances y Reparación
                </h4>

                <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                  {activeRecord.updates && activeRecord.updates.length > 0 ? (
                    activeRecord.updates.map((u: any, idx: number) => (
                      <div key={idx} className="rounded-xl border border-slate-100 bg-slate-50 p-3 text-xs">
                        <div className="flex items-center justify-between text-slate-500 font-mono text-[11px] mb-1">
                          <span>{u.date} • {u.status}</span>
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

              {/* Agregar nuevo avance */}
              {!['REPARADO', 'IRREPARABLE_REEMPLAZO', 'DADO_DE_BAJA'].includes(activeRecord.status) && (
                <div className="mt-4 border-t border-slate-100 pt-3">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Registrar Avance / Update del Producto:
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="ej. Diagnóstico completado, esperando repuesto..."
                      value={newUpdateNote}
                      onChange={(e) => setNewUpdateNote(e.target.value)}
                      className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-xs focus:border-emerald-600 focus:outline-none"
                    />
                    <select
                      value={newUpdateStatus}
                      onChange={(e) => setNewUpdateStatus(e.target.value)}
                      className="rounded-xl border border-slate-200 px-2.5 py-1 text-xs focus:border-emerald-600 focus:outline-none"
                    >
                      <option value="EN_DIAGNOSTICO">En Diagnóstico</option>
                      <option value="EN_REPARACION">En Reparación</option>
                      <option value="AGENDADA">Agendada</option>
                    </select>
                    <button
                      onClick={handleAddUpdate}
                      disabled={!newUpdateNote.trim()}
                      className="rounded-xl bg-emerald-700 px-3.5 py-2 text-xs font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
                    >
                      + Update
                    </button>
                  </div>
                </div>
              )}

              {/* Botón Resolver */}
              <div className="mt-6 flex justify-between border-t border-slate-100 pt-4">
                <button
                  onClick={() => setShowDetailModal(false)}
                  className="rounded-xl bg-slate-100 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200"
                >
                  Cerrar
                </button>

                {!['REPARADO', 'IRREPARABLE_REEMPLAZO', 'DADO_DE_BAJA'].includes(activeRecord.status) && (
                  <button
                    onClick={() => {
                      setResolveForm({
                        solutionType: 'REPARACION_PROVEEDOR',
                        replacementItemId: '',
                        replacementReason: '',
                        resolutionNotes: '',
                      });
                      setShowResolveModal(true);
                    }}
                    className="flex items-center gap-1.5 rounded-xl bg-emerald-700 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-800 shadow"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    <span>Concluir / Resolver Mantenimiento</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* MODAL AGENDAR MANTENIMIENTO */}
        {showScheduleModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
            <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl animate-in fade-in zoom-in-95">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-emerald-600" />
                  Agendar Mantenimiento
                </h3>
                <button onClick={() => setShowScheduleModal(false)} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleCreateSchedule} className="mt-4 space-y-3.5">
                <div>
                  <label className="block text-xs font-medium text-slate-700">Seleccionar Equipo (Computadora / Impresora / Red)</label>
                  <select
                    required
                    value={scheduleForm.itemId}
                    onChange={(e) => setScheduleForm({ ...scheduleForm, itemId: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none"
                  >
                    <option value="">Seleccione el equipo</option>
                    {allItems.map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.permanent_code} - {i.brand} {i.model} ({i.department_name || 'Bodega'})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700">Fecha Programada / Visita</label>
                    <input
                      type="date"
                      required
                      value={scheduleForm.scheduledDate}
                      onChange={(e) => setScheduleForm({ ...scheduleForm, scheduledDate: e.target.value })}
                      className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700">Severidad de la Falla</label>
                    <select
                      value={scheduleForm.severity}
                      onChange={(e) => setScheduleForm({ ...scheduleForm, severity: e.target.value })}
                      className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none"
                    >
                      <option value="LEVE">Leve (Mantenimiento preventivo)</option>
                      <option value="MODERADA">Moderada (Falla parcial)</option>
                      <option value="CRITICA">Crítica (Inoperativo / Urgente)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700">
                    Descripción Detallada de la Avería:
                  </label>
                  <textarea
                    rows={2}
                    required
                    placeholder="ej. Impresora atascando papel en rodillo de alimentación continuo..."
                    value={scheduleForm.faultDescription}
                    onChange={(e) => setScheduleForm({ ...scheduleForm, faultDescription: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 text-sm focus:border-emerald-600 focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700">Taller / Técnico Autorizado</label>
                    <input
                      type="text"
                      placeholder="ej. Taller Epson, Dell Partner..."
                      value={scheduleForm.technicianSupplier}
                      onChange={(e) => setScheduleForm({ ...scheduleForm, technicianSupplier: e.target.value })}
                      className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700">Costo Estimado (Q)</label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={scheduleForm.repairCost}
                      onChange={(e) => setScheduleForm({ ...scheduleForm, repairCost: e.target.value })}
                      className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-mono focus:border-emerald-600 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowScheduleModal(false)}
                    className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800"
                  >
                    Agendar Orden
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL RESOLVER MANTENIMIENTO (CON OPCIÓN DE COMPRA REEMPLAZO Y EVENTO CHILD) */}
        {showResolveModal && activeRecord && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
            <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl animate-in fade-in zoom-in-95">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                  Concluir Reparación de {activeRecord.permanent_code}
                </h3>
                <button onClick={() => setShowResolveModal(false)} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleResolveSubmit} className="mt-4 space-y-3.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-700">Tipo de Solución Final:</label>
                  <select
                    value={resolveForm.solutionType}
                    onChange={(e) => setResolveForm({ ...resolveForm, solutionType: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none"
                  >
                    <option value="REPARACION_PROVEEDOR">Reparado por Taller Oficial / Proveedor</option>
                    <option value="REPARACION_INTERNA">Reparado Internamente por IT</option>
                    <option value="COMPRA_REEMPLAZO">No tenía reparación • Se compró equipo de reemplazo</option>
                    <option value="BAJA_SIN_REEMPLAZO">Irreparable • Baja definitiva sin reemplazo</option>
                  </select>
                </div>

                {/* Si la solución fue compra de reemplazo: Evento Child */}
                {resolveForm.solutionType === 'COMPRA_REEMPLAZO' && (
                  <div className="rounded-xl border border-purple-200 bg-purple-50 p-3.5 space-y-3">
                    <div className="font-bold text-xs text-purple-900">
                      Vincular Evento Child: ¿Por cuál equipo nuevo se reemplazó?
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-purple-800">
                        Seleccionar equipo nuevo de reemplazo:
                      </label>
                      <select
                        required
                        value={resolveForm.replacementItemId}
                        onChange={(e) => setResolveForm({ ...resolveForm, replacementItemId: e.target.value })}
                        className="mt-1 w-full rounded-xl border border-purple-300 bg-white px-3 py-2 text-xs focus:outline-none"
                      >
                        <option value="">Seleccione el equipo sustituto</option>
                        {allItems
                          .filter((i) => i.id !== activeRecord.item_id && i.operational_status === 'DISPONIBLE')
                          .map((i) => (
                            <option key={i.id} value={i.id}>
                              {i.permanent_code} - {i.brand} {i.model}
                            </option>
                          ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-purple-800">
                        Justificación / Por qué se sustituyó:
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="ej. Costo de repuesto superaba 60% del valor del equipo nuevo..."
                        value={resolveForm.replacementReason}
                        onChange={(e) => setResolveForm({ ...resolveForm, replacementReason: e.target.value })}
                        className="mt-1 w-full rounded-xl border border-purple-300 bg-white px-3 py-2 text-xs focus:outline-none"
                      />
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-medium text-slate-700">Notas de Resolución Final:</label>
                  <textarea
                    rows={2}
                    placeholder="ej. Pruebas realizadas satisfactoriamente, equipo entregado operativo..."
                    value={resolveForm.resolutionNotes}
                    onChange={(e) => setResolveForm({ ...resolveForm, resolutionNotes: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 text-sm focus:border-emerald-600 focus:outline-none"
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
                    Confirmar Resolución
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
  );
}
