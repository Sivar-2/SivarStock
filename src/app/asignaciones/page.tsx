'use client';

import React, { useState, useEffect } from 'react';
import {
  UserCheck,
  Search,
  Filter,
  RotateCcw,
  Plus,
  CheckCircle,
  Download,
  AlertCircle,
  X,
  FileCheck,
  QrCode,
  Users,
  Smartphone,
  Package,
  Building2,
  KeyRound,
  UserMinus,
  History,
  Phone,
  Mail,
  Briefcase
} from 'lucide-react';
import QrCodeModal from '@/components/QrCodeModal';

export default function AsignacionesPage() {
  const [activeTab, setActiveTab] = useState<'personal' | 'actas'>('personal');
  const [employees, setEmployees] = useState<any[]>([]);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Empleado seleccionado para ver su expediente de asignaciones e historial
  const [selectedEmp, setSelectedEmp] = useState<any | null>(null);
  const [empItems, setEmpItems] = useState<any[]>([]);
  const [empMobiles, setEmpMobiles] = useState<any[]>([]);
  const [empHistory, setEmpHistory] = useState<any[]>([]);
  const [empDetailLoading, setEmpDetailLoading] = useState(false);

  // Modales
  const [showExitModal, setShowExitModal] = useState(false);
  const [showAccessModal, setShowAccessModal] = useState(false);
  const [returnModalItem, setReturnModalItem] = useState<any>(null);
  const [selectedQrItem, setSelectedQrItem] = useState<any>(null);

  // Formulario de devolución
  const [returnCondition, setReturnCondition] = useState('BUENO');
  const [returnNotes, setReturnNotes] = useState('');
  const [submittingReturn, setSubmittingReturn] = useState(false);

  // Formulario baja
  const [exitReasonText, setExitReasonText] = useState('');
  const [systemRole, setSystemRole] = useState('VIEWER');

  const loadData = async () => {
    setLoading(true);
    try {
      const [empRes, asgRes] = await Promise.all([
        fetch('/api/employees?all=true'),
        fetch('/api/reports/query', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            module: 'ASIGNACIONES',
            filters: { status: statusFilter || undefined },
            sortBy: 'a.assigned_at',
            sortDir: 'DESC',
          }),
        }),
      ]);

      const empData = await empRes.json();
      const asgData = await asgRes.json();

      if (empData.employees) setEmployees(empData.employees);
      if (asgData.data) setAssignments(asgData.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [statusFilter]);

  // Al hacer clic en un empleado: ver todo lo asignado e historial
  const handleSelectEmployee = async (emp: any) => {
    setSelectedEmp(emp);
    setEmpDetailLoading(true);

    try {
      const [invRes, celRes, asgRes] = await Promise.all([
        fetch('/api/inventory/items'),
        fetch(`/api/celulares`),
        fetch('/api/reports/query', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            module: 'ASIGNACIONES',
            filters: {},
            sortBy: 'a.assigned_at',
            sortDir: 'DESC',
          }),
        }),
      ]);

      const invData = await invRes.json();
      const celData = await celRes.json();
      const asgData = await asgRes.json();

      if (invData.items) {
        setEmpItems(invData.items.filter((i: any) => i.current_employee_id === emp.id));
      }
      if (celData.devices) {
        setEmpMobiles(celData.devices.filter((d: any) => d.employee_id === emp.id));
      }
      if (asgData.data) {
        setEmpHistory(asgData.data.filter((a: any) => a.employee_id === emp.id || a.user_id === emp.user_account_id));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setEmpDetailLoading(false);
    }
  };

  const handleProcessReturn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!returnModalItem) return;
    setSubmittingReturn(true);

    try {
      const res = await fetch('/api/inventory/return', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assignmentId: returnModalItem.id,
          returnCondition,
          newDepartmentId: 'dept-bod',
          returnNotes,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setReturnModalItem(null);
      setReturnNotes('');
      loadData();
      if (selectedEmp) handleSelectEmployee(selectedEmp);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSubmittingReturn(false);
    }
  };

  const handleExitSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmp || !exitReasonText.trim()) {
      alert('El motivo de la baja es obligatorio por políticas de auditoría.');
      return;
    }

    try {
      const res = await fetch('/api/employees', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: selectedEmp.id,
          action: 'EXIT',
          exitReason: exitReasonText.trim(),
        }),
      });

      const d = await res.json();
      if (!res.ok) throw new Error(d.error);

      setShowExitModal(false);
      setExitReasonText('');
      alert('Empleado dado de baja y sus artículos han sido desconectados y devueltos a Bodega.');
      loadData();
      setSelectedEmp(null);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleGiveAccessSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmp) return;

    try {
      const res = await fetch('/api/employees', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: selectedEmp.id,
          giveAccess: true,
          systemRole,
        }),
      });

      const d = await res.json();
      if (!res.ok) throw new Error(d.error);

      setShowAccessModal(false);
      alert('Acceso al sistema concedido con éxito.');
      loadData();
      setSelectedEmp(null);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const filteredEmployees = employees.filter((e) =>
    e.full_name.toLowerCase().includes(search.toLowerCase()) ||
    e.employee_code.toLowerCase().includes(search.toLowerCase()) ||
    (e.email && e.email.toLowerCase().includes(search.toLowerCase())) ||
    (e.department_name && e.department_name.toLowerCase().includes(search.toLowerCase()))
  );

  const filteredAssignments = assignments.filter((a) =>
    a.assignment_code?.toLowerCase().includes(search.toLowerCase()) ||
    a.employee_name?.toLowerCase().includes(search.toLowerCase()) ||
    a.product_name?.toLowerCase().includes(search.toLowerCase()) ||
    a.permanent_code?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
        {/* Cabecera */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-5">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2.5">
              <UserCheck className="h-7 w-7 text-emerald-600" />
              Asignaciones de Personal y Activos
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Expediente de empleados • Activos y celulares vinculados • Flujo de baja con devolución automática
            </p>
          </div>

          <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl">
            <button
              onClick={() => setActiveTab('personal')}
              className={`rounded-lg px-4 py-1.5 text-xs font-semibold transition ${
                activeTab === 'personal'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Expedientes de Personal
            </button>
            <button
              onClick={() => setActiveTab('actas')}
              className={`rounded-lg px-4 py-1.5 text-xs font-semibold transition ${
                activeTab === 'actas'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Actas de Entrega / Devolución
            </button>
          </div>
        </div>

        {/* VISTA 1: PERSONAL DE LA EMPRESA */}
        {activeTab === 'personal' && (
          <div className="space-y-4">
            {/* Buscador */}
            <div className="relative bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm">
              <Search className="absolute left-6 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar empleado por nombre, código (EMP-IT-001), departamento o correo..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-4 py-2 text-sm text-slate-800 focus:border-emerald-600 focus:bg-white focus:outline-none"
              />
            </div>

            {/* Lista de Empleados */}
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-600">
                  <thead className="border-b border-slate-200 bg-slate-50/75 text-xs uppercase font-semibold text-slate-700">
                    <tr>
                      <th className="py-3.5 px-4">Empleado / Iniciales</th>
                      <th className="py-3.5 px-4">Departamento</th>
                      <th className="py-3.5 px-4">Contacto & Empresa</th>
                      <th className="py-3.5 px-4">Jefe Inmediato</th>
                      <th className="py-3.5 px-4 text-center">Artículos Asignados</th>
                      <th className="py-3.5 px-4 text-center">Acceso Sistema</th>
                      <th className="py-3.5 px-4 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {loading ? (
                      <tr>
                        <td colSpan={7} className="py-12 text-center text-slate-400">
                          Cargando personal...
                        </td>
                      </tr>
                    ) : filteredEmployees.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-12 text-center text-slate-400">
                          No se encontraron empleados.
                        </td>
                      </tr>
                    ) : (
                      filteredEmployees.map((e) => (
                        <tr
                          key={e.id}
                          onClick={() => handleSelectEmployee(e)}
                          className="hover:bg-slate-50/80 cursor-pointer transition"
                        >
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-3">
                              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-100 font-bold text-xs text-emerald-800">
                                {e.initials}
                              </div>
                              <div>
                                <div className="font-bold text-slate-900 flex items-center gap-2">
                                  <span>{e.full_name}</span>
                                  {e.status === 'RETIRADO' && (
                                    <span className="text-[10px] bg-rose-100 text-rose-800 px-1.5 py-0.2 rounded font-semibold">
                                      Retirado
                                    </span>
                                  )}
                                </div>
                                <div className="font-mono text-xs text-slate-400">{e.employee_code}</div>
                              </div>
                            </div>
                          </td>

                          <td className="py-3.5 px-4">
                            <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">
                              <Building2 className="h-3 w-3 text-slate-400" />
                              {e.department_name}
                            </span>
                          </td>

                          <td className="py-3.5 px-4">
                            <div className="text-xs text-slate-800">{e.email || 'Sin correo'}</div>
                            <div className="text-[11px] text-slate-400">{e.phone || 'Sin tel'} • {e.company_name}</div>
                          </td>

                          <td className="py-3.5 px-4 text-xs text-slate-700">
                            {e.supervisor_name || 'Sin supervisor asignado'}
                          </td>

                          <td className="py-3.5 px-4 text-center">
                            <div className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-100">
                              <span className="flex items-center gap-1 text-emerald-700">
                                <Package className="h-3 w-3" />
                                {e.assigned_items_count}
                              </span>
                              <span>•</span>
                              <span className="flex items-center gap-1 text-blue-700">
                                <Smartphone className="h-3 w-3" />
                                {e.assigned_mobiles_count}
                              </span>
                            </div>
                          </td>

                          <td className="py-3.5 px-4 text-center">
                            {e.user_account_id ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                                <KeyRound className="h-3 w-3" />
                                {e.system_role}
                              </span>
                            ) : (
                              <span className="text-[11px] text-slate-400">Sin acceso</span>
                            )}
                          </td>

                          <td className="py-3.5 px-4 text-right">
                            <button
                              onClick={(evt) => {
                                evt.stopPropagation();
                                handleSelectEmployee(e);
                              }}
                              className="rounded-xl border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-sm"
                            >
                              Ver Activos
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* VISTA 2: ACTAS DE ASIGNACIÓN */}
        {activeTab === 'actas' && (
          <div className="space-y-4">
            <div className="flex flex-col md:flex-row gap-3 items-center justify-between bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
              <div className="relative flex-1 w-full">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Buscar acta (AM-2026-LAPD-001), empleado o activo..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-4 py-2 text-sm text-slate-800 focus:border-emerald-600 focus:bg-white focus:outline-none"
                />
              </div>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 focus:border-emerald-600 focus:outline-none"
              >
                <option value="">Todos los estados</option>
                <option value="ACTIVA">Activa</option>
                <option value="DEVUELTO">Devuelto</option>
              </select>
            </div>

            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-600">
                  <thead className="border-b border-slate-200 bg-slate-50/75 text-xs uppercase font-semibold text-slate-700">
                    <tr>
                      <th className="py-3.5 px-4">Acta / Código</th>
                      <th className="py-3.5 px-4">Empleado Receptor</th>
                      <th className="py-3.5 px-4">Artículo / Activo</th>
                      <th className="py-3.5 px-4">Fecha Entrega</th>
                      <th className="py-3.5 px-4">Estado</th>
                      <th className="py-3.5 px-4 text-center">Código QR</th>
                      <th className="py-3.5 px-4 text-right">Devolución</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredAssignments.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-12 text-center text-slate-400">
                          No hay actas registradas.
                        </td>
                      </tr>
                    ) : (
                      filteredAssignments.map((a) => (
                        <tr key={a.id} className="hover:bg-slate-50/70 transition">
                          <td className="py-3.5 px-4 font-mono font-bold text-xs text-slate-900">
                            {a.assignment_code}
                          </td>

                          <td className="py-3.5 px-4">
                            <div className="font-semibold text-slate-900">{a.employee_name || a.user_name}</div>
                            <div className="text-xs text-slate-400">{a.target_dept_name}</div>
                          </td>

                          <td className="py-3.5 px-4">
                            <div className="font-medium text-slate-800">{a.product_name}</div>
                            {a.permanent_code && (
                              <div className="font-mono text-[11px] text-emerald-700 font-bold">
                                {a.permanent_code}
                              </div>
                            )}
                          </td>

                          <td className="py-3.5 px-4 text-xs font-mono text-slate-500">
                            {a.assigned_at?.slice(0, 10)}
                          </td>

                          <td className="py-3.5 px-4">
                            <span
                              className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                                a.status === 'ACTIVA'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-slate-100 text-slate-600'
                              }`}
                            >
                              {a.status}
                            </span>
                          </td>

                          <td className="py-3.5 px-4 text-center">
                            <button
                              onClick={() => setSelectedQrItem({
                                code: a.assignment_code,
                                title: `Acta: ${a.assignment_code}`,
                                subtitle: `Entregado a: ${a.employee_name || a.user_name}`,
                                details: [
                                  { label: 'Artículo', value: a.product_name },
                                  { label: 'Fecha Entrega', value: a.assigned_at?.slice(0, 10) },
                                  { label: 'Estado', value: a.status },
                                ]
                              })}
                              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-800"
                              title="Ver Código QR del Acta"
                            >
                              <QrCode className="h-4 w-4" />
                            </button>
                          </td>

                          <td className="py-3.5 px-4 text-right">
                            {a.status === 'ACTIVA' && (
                              <button
                                onClick={() => setReturnModalItem(a)}
                                className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-sm"
                              >
                                <RotateCcw className="h-3.5 w-3.5 text-amber-600" />
                                <span>Devolver</span>
                              </button>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* MODAL EXPEDIENTE COMPLETO DEL EMPLEADO (AL HACER CLIC) */}
        {selectedEmp && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
            <div className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl animate-in fade-in zoom-in-95">
              <div className="flex items-start justify-between border-b border-slate-100 pb-4">
                <div className="flex items-center gap-3.5">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-military-800 to-military-700 text-white font-bold text-base shadow">
                    {selectedEmp.initials}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-xl font-bold text-slate-900">{selectedEmp.full_name}</h3>
                      <span className="font-mono text-xs px-2 py-0.5 rounded bg-slate-100 font-semibold text-slate-700">
                        {selectedEmp.employee_code}
                      </span>
                      {selectedEmp.status === 'RETIRADO' && (
                        <span className="text-xs bg-rose-100 text-rose-800 px-2 py-0.5 rounded-full font-semibold">
                          Retirado
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {selectedEmp.department_name} • {selectedEmp.company_name} • Tel: {selectedEmp.phone || 'N/A'}
                    </p>
                  </div>
                </div>

                <button onClick={() => setSelectedEmp(null)} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100">
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Botones de Acción de Empleado */}
              <div className="mt-4 flex flex-wrap items-center justify-between gap-2 bg-slate-50 p-3 rounded-xl border border-slate-100">
                <div className="text-xs text-slate-600">
                  <span>Jefe Inmediato: </span>
                  <span className="font-semibold text-slate-800">{selectedEmp.supervisor_name || 'General'}</span>
                </div>

                <div className="flex items-center gap-2">
                  {!selectedEmp.user_account_id && selectedEmp.status === 'ACTIVO' && (
                    <button
                      onClick={() => setShowAccessModal(true)}
                      className="flex items-center gap-1.5 rounded-xl bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-800"
                    >
                      <KeyRound className="h-3.5 w-3.5" />
                      <span>Dar Acceso al Sistema</span>
                    </button>
                  )}

                  {selectedEmp.status === 'ACTIVO' && (
                    <button
                      onClick={() => setShowExitModal(true)}
                      className="flex items-center gap-1.5 rounded-xl bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-700"
                    >
                      <UserMinus className="h-3.5 w-3.5" />
                      <span>Dar de Baja</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Artículos Físicos Individuales Asignados */}
              <div className="mt-5">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 mb-2 flex items-center gap-1.5">
                  <Package className="h-4 w-4 text-emerald-600" />
                  Activos Físicos Asignados ({empItems.length})
                </h4>

                {empItems.length === 0 ? (
                  <p className="text-xs text-slate-400 bg-slate-50 p-3 rounded-xl italic">
                    Sin activos físicos asignados actualmente.
                  </p>
                ) : (
                  <div className="divide-y divide-slate-100 rounded-xl border border-slate-100 bg-slate-50/50">
                    {empItems.map((item) => (
                      <div key={item.id} className="flex items-center justify-between p-3 text-xs">
                        <div>
                          <div className="font-bold text-slate-900">{item.brand} {item.model}</div>
                          <div className="font-mono text-[11px] text-emerald-700 font-semibold">{item.permanent_code}</div>
                        </div>
                        <div className="text-right">
                          <span className="font-mono font-bold text-slate-800">
                            Q{Number(item.purchase_price || 0).toLocaleString('es-GT', { minimumFractionDigits: 2 })}
                          </span>
                          <div className="text-[10px] text-slate-400">Entrega: {item.purchase_date || '-'}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Celulares Corporativos Asignados */}
              <div className="mt-5">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 mb-2 flex items-center gap-1.5">
                  <Smartphone className="h-4 w-4 text-emerald-600" />
                  Celulares y Telefonía Móvil ({empMobiles.length})
                </h4>

                {empMobiles.length === 0 ? (
                  <p className="text-xs text-slate-400 bg-slate-50 p-3 rounded-xl italic">
                    Sin celular corporativo asignado.
                  </p>
                ) : (
                  <div className="divide-y divide-slate-100 rounded-xl border border-slate-100 bg-slate-50/50">
                    {empMobiles.map((mob) => (
                      <div key={mob.id} className="flex items-center justify-between p-3 text-xs">
                        <div>
                          <div className="font-bold text-slate-900">{mob.brand} {mob.model} ({mob.device_code})</div>
                          <div className="font-mono text-[11px] text-slate-500">IMEI: {mob.imei}</div>
                        </div>
                        <div className="text-right">
                          <div className="font-mono font-bold text-slate-900">{mob.phone_number}</div>
                          <div className="text-[10px] text-slate-400">Entregado: {mob.delivery_date}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Historial de Movimientos y Devoluciones */}
              <div className="mt-5">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 mb-2 flex items-center gap-1.5">
                  <History className="h-4 w-4 text-emerald-600" />
                  Historial de Cambios y Entregas
                </h4>

                <div className="space-y-1.5 max-h-40 overflow-y-auto">
                  {empHistory.length === 0 ? (
                    <p className="text-xs text-slate-400 italic">Sin historial previo.</p>
                  ) : (
                    empHistory.map((h) => (
                      <div key={h.id} className="flex items-center justify-between bg-slate-50 px-3 py-2 rounded-lg text-xs border border-slate-100">
                        <div>
                          <span className="font-mono font-semibold text-slate-700">{h.assignment_code}</span>
                          <span className="text-slate-500 ml-2">{h.product_name}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-slate-400 text-[11px]">{h.assigned_at?.slice(0, 10)}</span>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            h.status === 'ACTIVA' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700'
                          }`}>
                            {h.status}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="mt-6 flex justify-end">
                <button
                  onClick={() => setSelectedEmp(null)}
                  className="rounded-xl bg-slate-100 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200"
                >
                  Cerrar Expediente
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL DEVOLUCIÓN A BODEGA */}
        {returnModalItem && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl animate-in fade-in zoom-in-95">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <RotateCcw className="h-5 w-5 text-amber-600" />
                  Procesar Devolución a Bodega
                </h3>
                <button onClick={() => setReturnModalItem(null)} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleProcessReturn} className="mt-4 space-y-3.5">
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 text-xs">
                  <p className="font-bold text-slate-800">{returnModalItem.product_name}</p>
                  <p className="font-mono text-slate-500">{returnModalItem.assignment_code}</p>
                  <p className="text-slate-500 mt-1">
                    Entregado por: {returnModalItem.employee_name || returnModalItem.user_name}
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700">Estado Físico al Recibir:</label>
                  <select
                    value={returnCondition}
                    onChange={(e) => setReturnCondition(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none"
                  >
                    <option value="BUENO">Bueno (Operativo para reasignación)</option>
                    <option value="NUEVO">Nuevo / Sin uso</option>
                    <option value="USADO">Usado (Desgaste natural)</option>
                    <option value="AVERIADO">Averiado / Con falla (Se enviará a Mantenimiento)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700">
                    Notas de Devolución / Observaciones:
                  </label>
                  <textarea
                    rows={2}
                    placeholder="ej. Devuelto en buen estado con todos sus cables originales..."
                    value={returnNotes}
                    onChange={(e) => setReturnNotes(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 text-sm focus:border-emerald-600 focus:outline-none"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setReturnModalItem(null)}
                    className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={submittingReturn}
                    className="rounded-xl bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
                  >
                    {submittingReturn ? 'Procesando...' : 'Confirmar Devolución'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL SALIDA DE EMPRESA (BAJA) */}
        {showExitModal && selectedEmp && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl animate-in fade-in zoom-in-95">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-lg font-bold text-rose-600 flex items-center gap-2">
                  <UserMinus className="h-5 w-5" />
                  Salida de la Empresa: {selectedEmp.full_name}
                </h3>
                <button onClick={() => setShowExitModal(false)} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleExitSubmit} className="mt-4 space-y-3.5">
                <div className="bg-rose-50 p-3 rounded-xl border border-rose-100 text-xs text-rose-800 space-y-1">
                  <p className="font-bold">Acción Poka-Yoke de desconexión total:</p>
                  <p>• Los {empItems.length} activos físicos y {empMobiles.length} celulares volverán a Bodega (Cuarto de Servidores).</p>
                  <p>• El estado del empleado pasará a RETIRADO y su usuario quedará inactivo.</p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700">
                    Motivo Obligatorio de Salida:
                  </label>
                  <textarea
                    rows={3}
                    required
                    placeholder="ej. Fin de contrato laboral, renuncia voluntaria..."
                    value={exitReasonText}
                    onChange={(e) => setExitReasonText(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 text-sm focus:border-rose-600 focus:outline-none"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowExitModal(false)}
                    className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700"
                  >
                    Confirmar Salida y Desconectar Activos
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL CREAR ACCESO */}
        {showAccessModal && selectedEmp && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl animate-in fade-in zoom-in-95">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <KeyRound className="h-5 w-5 text-emerald-600" />
                  Conceder Acceso al Sistema
                </h3>
                <button onClick={() => setShowAccessModal(false)} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleGiveAccessSubmit} className="mt-4 space-y-3.5">
                <div>
                  <label className="block text-xs font-medium text-slate-700">Empleado:</label>
                  <input
                    type="text"
                    disabled
                    value={selectedEmp.full_name}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700">Correo Electrónico:</label>
                  <input
                    type="text"
                    disabled
                    value={selectedEmp.email || 'Sin correo'}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700">Rol a Asignar:</label>
                  <select
                    value={systemRole}
                    onChange={(e) => setSystemRole(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none"
                  >
                    <option value="VIEWER">Visualizador (Solo consulta)</option>
                    <option value="AREA_MANAGER">Jefe de Área (Gestiona su departamento)</option>
                    <option value="SUBADMIN">Subadministrador</option>
                  </select>
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowAccessModal(false)}
                    className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800"
                  >
                    Crear Credencial de Acceso
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal QR Code */}
        {selectedQrItem && (
          <QrCodeModal
            isOpen={Boolean(selectedQrItem)}
            onClose={() => setSelectedQrItem(null)}
            item={selectedQrItem}
          />
        )}
      </div>
  );
}
