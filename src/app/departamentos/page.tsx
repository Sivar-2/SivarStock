'use client';

import React, { useState, useEffect } from 'react';
import {
  Building2,
  Plus,
  Search,
  User,
  Users,
  Hash,
  X,
  Check,
  Edit,
  ArrowRightLeft,
  UserMinus,
  KeyRound,
  Package,
  Smartphone,
  AlertCircle,
  CheckCircle2,
  Shield,
  Briefcase,
  Archive
} from 'lucide-react';

export default function DepartamentosPage() {
  const [departments, setDepartments] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [selectedDept, setSelectedDept] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Modales
  const [showDeptModal, setShowDeptModal] = useState(false);
  const [editingDept, setEditingDept] = useState<any | null>(null);
  const [showAddEmpModal, setShowAddEmpModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [showExitModal, setShowExitModal] = useState(false);
  const [showAccessModal, setShowAccessModal] = useState(false);
  const [activeEmployee, setActiveEmployee] = useState<any | null>(null);

  // Formularios
  const [deptForm, setDeptForm] = useState({
    code: '',
    name: '',
    costCenter: '',
    managerName: '',
    isBodega: 0,
  });

  const [empForm, setEmpForm] = useState({
    fullName: '',
    initials: '',
    email: '',
    phone: '+502 ',
    immediateSupervisorId: '',
    companyName: 'Persiluz / SivarStock',
    createSystemUser: false,
    systemRole: 'VIEWER',
  });

  const [transferTargetDeptId, setTransferTargetDeptId] = useState('');
  const [exitReasonText, setExitReasonText] = useState('');
  const [systemAccessRole, setSystemAccessRole] = useState('VIEWER');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [deptRes, empRes] = await Promise.all([
        fetch('/api/catalogs'),
        fetch('/api/employees?all=true'),
      ]);

      const deptData = await deptRes.json();
      const empData = await empRes.json();

      if (deptData.departments) {
        setDepartments(deptData.departments);
        // Si no hay seleccionado, seleccionar el primero o mantener
        if (!selectedDept && deptData.departments.length > 0) {
          setSelectedDept(deptData.departments[0]);
        } else if (selectedDept) {
          const updated = deptData.departments.find((d: any) => d.id === selectedDept.id);
          if (updated) setSelectedDept(updated);
        }
      }

      if (empData.employees) {
        setEmployees(empData.employees);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSaveDept = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    try {
      const res = await fetch('/api/catalogs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'department',
          data: editingDept ? { ...deptForm, id: editingDept.id } : deptForm,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setShowDeptModal(false);
      setEditingDept(null);
      setDeptForm({ code: '', name: '', costCenter: '', managerName: '', isBodega: 0 });
      loadData();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message });
    }
  };

  const handleCreateEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDept) return;
    setFeedback(null);

    try {
      const res = await fetch('/api/employees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...empForm,
          departmentId: selectedDept.id,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setShowAddEmpModal(false);
      setEmpForm({
        fullName: '',
        initials: '',
        email: '',
        phone: '+502 ',
        immediateSupervisorId: '',
        companyName: 'Persiluz / SivarStock',
        createSystemUser: false,
        systemRole: 'VIEWER',
      });
      loadData();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message });
    }
  };

  const handleTransferSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeEmployee || !transferTargetDeptId) return;

    try {
      const res = await fetch('/api/employees', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: activeEmployee.id,
          departmentId: transferTargetDeptId,
          action: 'TRANSFER',
        }),
      });

      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error);
      }

      setShowTransferModal(false);
      loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleExitSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeEmployee) return;

    // Validación Poka-Yoke: motivo obligatorio
    if (!exitReasonText.trim()) {
      alert('El motivo de la baja es obligatorio por políticas de auditoría.');
      return;
    }

    try {
      const res = await fetch('/api/employees', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: activeEmployee.id,
          action: 'EXIT',
          exitReason: exitReasonText.trim(),
        }),
      });

      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error);
      }

      setShowExitModal(false);
      setExitReasonText('');
      loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleGiveAccessSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeEmployee) return;

    try {
      const res = await fetch('/api/employees', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: activeEmployee.id,
          giveAccess: true,
          systemRole: systemAccessRole,
        }),
      });

      const d = await res.json();
      if (!res.ok) throw new Error(d.error);

      setShowAccessModal(false);
      loadData();
      alert('¡Acceso al sistema creado con éxito para el empleado!');
    } catch (err: any) {
      alert(err.message);
    }
  };

  const [empFilterStatus, setEmpFilterStatus] = useState<'ACTIVO' | 'RETIRADO' | 'TODOS'>('ACTIVO');

  const deptAllEmployees = selectedDept
    ? employees.filter((e) => e.department_id === selectedDept.id)
    : [];

  const activeCount = deptAllEmployees.filter((e) => e.status === 'ACTIVO').length;
  const retiredCount = deptAllEmployees.filter((e) => e.status === 'RETIRADO').length;

  const currentDeptEmployees = deptAllEmployees.filter((e) => {
    if (empFilterStatus === 'ACTIVO') return e.status === 'ACTIVO';
    if (empFilterStatus === 'RETIRADO') return e.status === 'RETIRADO';
    return true;
  });

  const filteredDepts = departments.filter(
    (d) =>
      d.name.toLowerCase().includes(search.toLowerCase()) ||
      d.code.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
        {/* Cabecera */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-5">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2.5">
              <Building2 className="h-7 w-7 text-emerald-600" />
              Áreas y Departamentos de la Empresa
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Estructura organizacional unificada • Códigos únicos por empleado • Cuarto de Servidores (Bodega)
            </p>
          </div>

          <button
            onClick={() => {
              setEditingDept(null);
              setDeptForm({ code: '', name: '', costCenter: '', managerName: '', isBodega: 0 });
              setShowDeptModal(true);
            }}
            className="flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white shadow-md hover:bg-emerald-800 transition"
          >
            <Plus className="h-4 w-4" />
            <span>Agregar Departamento</span>
          </button>
        </div>

        {/* Layout en 2 columnas: Lista de departamentos a la izquierda, Personal del área a la derecha */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Columna Izquierda: Departamentos */}
          <div className="lg:col-span-4 space-y-4">
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar área o depto..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 py-2 text-sm text-slate-800 shadow-sm focus:border-emerald-600 focus:outline-none"
              />
            </div>

            <div className="space-y-2 max-h-[700px] overflow-y-auto pr-1">
              {loading ? (
                <p className="text-xs text-slate-400 text-center py-8">Cargando áreas...</p>
              ) : (
                filteredDepts.map((d) => {
                  const isSelected = selectedDept?.id === d.id;
                  const count = employees.filter((e) => e.department_id === d.id && e.status === 'ACTIVO').length;

                  return (
                    <div
                      key={d.id}
                      onClick={() => setSelectedDept(d)}
                      className={`group cursor-pointer rounded-2xl p-4 transition-all border ${
                        isSelected
                          ? 'border-emerald-600 bg-emerald-50/50 shadow-md ring-1 ring-emerald-600'
                          : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50 shadow-sm'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                              {d.code}
                            </span>
                            {d.is_bodega === 1 && (
                              <span className="text-[10px] font-semibold bg-amber-100 text-amber-800 px-1.5 py-0.2 rounded">
                                Bodega Central
                              </span>
                            )}
                          </div>
                          <h3 className="mt-1 text-sm font-bold text-slate-900">{d.name}</h3>
                          <p className="text-xs text-slate-500 mt-0.5">Jefe: {d.manager_name || 'Sin asignar'}</p>
                        </div>

                        <div className="flex flex-col items-end gap-2">
                          <span className="flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
                            <Users className="h-3 w-3" />
                            {count}
                          </span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingDept(d);
                              setDeptForm({
                                code: d.code,
                                name: d.name,
                                costCenter: d.cost_center || '',
                                managerName: d.manager_name || '',
                                isBodega: d.is_bodega || 0,
                              });
                              setShowDeptModal(true);
                            }}
                            className="rounded-lg p-1 text-slate-400 hover:bg-white hover:text-slate-700"
                            title="Editar departamento"
                          >
                            <Edit className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Columna Derecha: Personal y detalle del departamento seleccionado */}
          <div className="lg:col-span-8 space-y-4">
            {selectedDept ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-100 pb-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-bold px-2.5 py-0.5 rounded bg-military-800 text-white">
                        {selectedDept.code}
                      </span>
                      <h2 className="text-xl font-bold text-slate-900">{selectedDept.name}</h2>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      Centro de Costo: <span className="font-mono text-slate-700">{selectedDept.cost_center || 'General'}</span> • Jefatura: <span className="font-medium text-slate-700">{selectedDept.manager_name || 'N/A'}</span>
                    </p>
                  </div>

                  <button
                    onClick={() => setShowAddEmpModal(true)}
                    className="flex items-center gap-2 rounded-xl bg-emerald-700 px-3.5 py-2 text-xs font-semibold text-white hover:bg-emerald-800 shadow-sm"
                  >
                    <Plus className="h-4 w-4" />
                    <span>Agregar Empleado</span>
                  </button>
                </div>

                {/* Lista de Empleados del departamento */}
                <div className="mt-4">
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      Personal ({currentDeptEmployees.length})
                    </h3>

                    {/* Filtros de Personal: Activo vs Archivados/Retirados */}
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setEmpFilterStatus('ACTIVO')}
                        className={`px-2.5 py-1 text-xs rounded-lg font-semibold transition ${
                          empFilterStatus === 'ACTIVO'
                            ? 'bg-emerald-700 text-white shadow-sm'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        Activos ({activeCount})
                      </button>
                      <button
                        type="button"
                        onClick={() => setEmpFilterStatus('RETIRADO')}
                        className={`flex items-center gap-1 px-2.5 py-1 text-xs rounded-lg font-semibold transition ${
                          empFilterStatus === 'RETIRADO'
                            ? 'bg-rose-700 text-white shadow-sm'
                            : 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200'
                        }`}
                      >
                        <Archive className="h-3 w-3" />
                        <span>📁 Archivados / Retirados ({retiredCount})</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setEmpFilterStatus('TODOS')}
                        className={`px-2.5 py-1 text-xs rounded-lg font-semibold transition ${
                          empFilterStatus === 'TODOS'
                            ? 'bg-military-800 text-white shadow-sm'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        Todos ({deptAllEmployees.length})
                      </button>
                    </div>
                  </div>

                  {currentDeptEmployees.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-slate-400">
                      <Users className="mx-auto h-8 w-8 text-slate-300 mb-2" />
                      <p className="text-xs">No hay empleados registrados en este departamento.</p>
                      <button
                        onClick={() => setShowAddEmpModal(true)}
                        className="mt-3 text-xs font-semibold text-emerald-600 hover:underline"
                      >
                        + Agregar el primer empleado
                      </button>
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-100">
                      {currentDeptEmployees.map((emp) => (
                        <div
                          key={emp.id}
                          className="flex flex-col sm:flex-row sm:items-center justify-between py-3.5 gap-3 hover:bg-slate-50/60 rounded-xl px-2.5 transition"
                        >
                          <div className="flex items-start gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100 font-bold text-xs text-emerald-800 shadow-sm">
                              {emp.initials}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-slate-900 text-sm">{emp.full_name}</span>
                                <span className="font-mono text-[11px] bg-slate-100 px-1.5 py-0.2 rounded text-slate-600 font-semibold">
                                  {emp.employee_code}
                                </span>
                                {emp.status === 'RETIRADO' && (
                                  <span className="text-[10px] bg-rose-100 text-rose-700 px-1.5 py-0.2 rounded font-semibold">
                                    Retirado
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-slate-500 flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
                                {emp.email && <span>{emp.email}</span>}
                                {emp.phone && <span>Tel: {emp.phone}</span>}
                                {emp.supervisor_name && <span>Jefe: {emp.supervisor_name}</span>}
                              </div>
                              <div className="flex items-center gap-3 mt-1.5 text-[11px]">
                                <span className="flex items-center gap-1 text-slate-600">
                                  <Package className="h-3 w-3 text-emerald-600" />
                                  {emp.assigned_items_count} activo(s) físico(s)
                                </span>
                                <span className="flex items-center gap-1 text-slate-600">
                                  <Smartphone className="h-3 w-3 text-emerald-600" />
                                  {emp.assigned_mobiles_count} celular(es)
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Acciones por Empleado */}
                          <div className="flex items-center gap-1.5 self-end sm:self-center">
                            {/* Dar acceso al sistema si no tiene */}
                            {!emp.user_account_id && emp.status === 'ACTIVO' && (
                              <button
                                onClick={() => {
                                  setActiveEmployee(emp);
                                  setShowAccessModal(true);
                                }}
                                className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 hover:bg-slate-50 shadow-sm"
                                title="Crear usuario para que pueda ingresar a SivarStock"
                              >
                                <KeyRound className="h-3.5 w-3.5 text-emerald-600" />
                                <span className="hidden md:inline">Dar Acceso</span>
                              </button>
                            )}

                            {/* Trasladar */}
                            {emp.status === 'ACTIVO' && (
                              <button
                                onClick={() => {
                                  setActiveEmployee(emp);
                                  setTransferTargetDeptId(selectedDept.id);
                                  setShowTransferModal(true);
                                }}
                                className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 hover:bg-slate-50 shadow-sm"
                                title="Trasladar a otro departamento"
                              >
                                <ArrowRightLeft className="h-3.5 w-3.5 text-blue-600" />
                                <span className="hidden md:inline">Trasladar</span>
                              </button>
                            )}

                            {/* Dar de Baja */}
                            {emp.status === 'ACTIVO' && (
                              <button
                                onClick={() => {
                                  setActiveEmployee(emp);
                                  setExitReasonText('');
                                  setShowExitModal(true);
                                }}
                                className="flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-2 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-100 shadow-sm"
                                title="Dar de baja al empleado (requiere motivo y retorna activos)"
                              >
                                <UserMinus className="h-3.5 w-3.5" />
                                <span className="hidden md:inline">Dar de Baja</span>
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-slate-400">
                Seleccione un departamento para ver su personal y operaciones.
              </div>
            )}
          </div>
        </div>

        {/* MODAL CREAR / EDITAR DEPARTAMENTO */}
        {showDeptModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl animate-in fade-in zoom-in-95">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-lg font-bold text-slate-900">
                  {editingDept ? 'Editar Departamento' : 'Nuevo Departamento'}
                </h3>
                <button onClick={() => setShowDeptModal(false)} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleSaveDept} className="mt-4 space-y-3.5">
                <div>
                  <label className="block text-xs font-medium text-slate-700">Nombre del Departamento</label>
                  <input
                    type="text"
                    required
                    placeholder="ej. Gerencia, Mercadeo, IT..."
                    value={deptForm.name}
                    onChange={(e) => setDeptForm({ ...deptForm, name: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700">Código Único (2-4 letras)</label>
                    <input
                      type="text"
                      required
                      placeholder="ej. MKT, IT, GER"
                      value={deptForm.code}
                      onChange={(e) => setDeptForm({ ...deptForm, code: e.target.value.toUpperCase() })}
                      className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-mono uppercase focus:border-emerald-600 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700">Centro de Costos</label>
                    <input
                      type="text"
                      placeholder="CC-100"
                      value={deptForm.costCenter}
                      onChange={(e) => setDeptForm({ ...deptForm, costCenter: e.target.value })}
                      className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-mono focus:border-emerald-600 focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700">Jefe Inmediato / Encargado</label>
                  <input
                    type="text"
                    placeholder="Nombre del responsable"
                    value={deptForm.managerName}
                    onChange={(e) => setDeptForm({ ...deptForm, managerName: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none"
                  />
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="isBodegaCheck"
                    checked={deptForm.isBodega === 1}
                    onChange={(e) => setDeptForm({ ...deptForm, isBodega: e.target.checked ? 1 : 0 })}
                    className="rounded text-emerald-600 focus:ring-emerald-500"
                  />
                  <label htmlFor="isBodegaCheck" className="text-xs font-semibold text-slate-700">
                    Es la Bodega Central (Cuarto de Servidores)
                  </label>
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowDeptModal(false)}
                    className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800"
                  >
                    Guardar Departamento
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL AGREGAR EMPLEADO */}
        {showAddEmpModal && selectedDept && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
            <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl animate-in fade-in zoom-in-95">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-lg font-bold text-slate-900">
                  Agregar Empleado a {selectedDept.name}
                </h3>
                <button onClick={() => setShowAddEmpModal(false)} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleCreateEmployee} className="mt-4 space-y-3.5">
                <div>
                  <label className="block text-xs font-medium text-slate-700">Nombre Completo del Empleado</label>
                  <input
                    type="text"
                    required
                    placeholder="ej. Juan Carlos Pérez"
                    value={empForm.fullName}
                    onChange={(e) => setEmpForm({ ...empForm, fullName: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700">Iniciales (opcional)</label>
                    <input
                      type="text"
                      maxLength={4}
                      placeholder="ej. JCP"
                      value={empForm.initials}
                      onChange={(e) => setEmpForm({ ...empForm, initials: e.target.value.toUpperCase() })}
                      className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-mono uppercase focus:border-emerald-600 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700">Teléfono Corporativo</label>
                    <input
                      type="text"
                      placeholder="+502 5555-0000"
                      value={empForm.phone}
                      onChange={(e) => setEmpForm({ ...empForm, phone: e.target.value })}
                      className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-mono focus:border-emerald-600 focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700">Correo Electrónico</label>
                  <input
                    type="email"
                    placeholder="empleado@persiluz.com"
                    value={empForm.email}
                    onChange={(e) => setEmpForm({ ...empForm, email: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700">Jefe Inmediato</label>
                  <select
                    value={empForm.immediateSupervisorId}
                    onChange={(e) => setEmpForm({ ...empForm, immediateSupervisorId: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none"
                  >
                    <option value="">Seleccionar supervisor</option>
                    {employees.filter((e) => e.status === 'ACTIVO').map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.full_name} ({e.department_name})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="createSystemUserCheck"
                      checked={empForm.createSystemUser}
                      onChange={(e) => setEmpForm({ ...empForm, createSystemUser: e.target.checked })}
                      className="rounded text-emerald-600 focus:ring-emerald-500"
                    />
                    <label htmlFor="createSystemUserCheck" className="text-xs font-semibold text-slate-700">
                      Crear también usuario de inicio de sesión en SivarStock
                    </label>
                  </div>

                  {empForm.createSystemUser && (
                    <div className="pt-2">
                      <label className="block text-xs font-medium text-slate-600">Rol en el Sistema:</label>
                      <select
                        value={empForm.systemRole}
                        onChange={(e) => setEmpForm({ ...empForm, systemRole: e.target.value })}
                        className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs"
                      >
                        <option value="VIEWER">Visualizador (Solo consulta)</option>
                        <option value="AREA_MANAGER">Jefe de Área (Gestiona su depto)</option>
                        <option value="SUBADMIN">Subadministrador</option>
                      </select>
                    </div>
                  )}
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowAddEmpModal(false)}
                    className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800"
                  >
                    Generar Código y Registrar
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL TRASLADAR EMPLEADO */}
        {showTransferModal && activeEmployee && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl animate-in fade-in zoom-in-95">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <ArrowRightLeft className="h-5 w-5 text-blue-600" />
                  Trasladar de Área: {activeEmployee.full_name}
                </h3>
                <button onClick={() => setShowTransferModal(false)} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleTransferSubmit} className="mt-4 space-y-3.5">
                <div>
                  <label className="block text-xs font-medium text-slate-700">Seleccionar Nuevo Departamento:</label>
                  <select
                    value={transferTargetDeptId}
                    onChange={(e) => setTransferTargetDeptId(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none"
                  >
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name} ({d.code})
                      </option>
                    ))}
                  </select>
                </div>

                <p className="text-[11px] text-slate-500 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                  Nota: Al trasladar al empleado, todos sus artículos asignados y celular corporativo continuarán con él pero se imputarán al nuevo centro de costos.
                </p>

                <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowTransferModal(false)}
                    className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                  >
                    Confirmar Traslado
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL DAR DE BAJA / RETIRAR CON MOTIVO OBLIGATORIO (POKA-YOKE) */}
        {showExitModal && activeEmployee && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl animate-in fade-in zoom-in-95">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-lg font-bold text-rose-600 flex items-center gap-2">
                  <UserMinus className="h-5 w-5" />
                  Dar de Baja a Empleado
                </h3>
                <button onClick={() => setShowExitModal(false)} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleExitSubmit} className="mt-4 space-y-3.5">
                <div className="rounded-xl bg-rose-50 p-3 text-xs text-rose-800 border border-rose-100 space-y-1">
                  <p className="font-bold">¡Atención! Acción irreversible con modelo Poka-Yoke:</p>
                  <p>
                    • Se desconectarán automáticamente todos sus activos asignados ({activeEmployee.assigned_items_count}) y su celular corporativo ({activeEmployee.assigned_mobiles_count}), retornando a Cuarto de Servidores (Bodega).
                  </p>
                  <p>• Su usuario en SivarStock quedará inactivo de inmediato.</p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700">
                    Motivo obligatorio de salida de la empresa:
                  </label>
                  <textarea
                    rows={3}
                    required
                    placeholder="ej. Renuncia voluntaria, fin de contrato, mutuo acuerdo..."
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
                    Confirmar Baja y Retornar Activos
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL DAR ACCESO AL SISTEMA */}
        {showAccessModal && activeEmployee && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl animate-in fade-in zoom-in-95">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <KeyRound className="h-5 w-5 text-emerald-600" />
                  Dar Acceso al Sistema: {activeEmployee.full_name}
                </h3>
                <button onClick={() => setShowAccessModal(false)} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleGiveAccessSubmit} className="mt-4 space-y-3.5">
                <div>
                  <label className="block text-xs font-medium text-slate-700">Correo Electrónico para Iniciar Sesión:</label>
                  <input
                    type="email"
                    disabled
                    value={activeEmployee.email || 'Sin correo registrado'}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700">Rol a Asignar:</label>
                  <select
                    value={systemAccessRole}
                    onChange={(e) => setSystemAccessRole(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none"
                  >
                    <option value="VIEWER">Visualizador (Solo consulta de datos)</option>
                    <option value="AREA_MANAGER">Jefe de Área (Solo su departamento)</option>
                    <option value="SUBADMIN">Subadministrador</option>
                  </select>
                </div>

                <p className="text-xs text-slate-500 bg-emerald-50 p-2.5 rounded-xl border border-emerald-100">
                  Se creará su cuenta con contraseña inicial <span className="font-mono font-bold text-emerald-800">user123</span>. Podrá ingresar con sus credenciales o vincular su cuenta de Google.
                </p>

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
                    Crear Usuario de Acceso
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
  );
}
