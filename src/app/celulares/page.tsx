'use client';

import React, { useState, useEffect } from 'react';
import {
  Smartphone,
  Plus,
  Search,
  User,
  Building2,
  Calendar,
  FileText,
  Edit,
  ArrowRightLeft,
  CheckCircle2,
  AlertCircle,
  X,
  MessageSquare,
  History,
  ShieldCheck,
  PhoneCall
} from 'lucide-react';

interface NoteItem {
  id: string;
  date: string;
  note: string;
  author: string;
}

interface MobileDevice {
  id: string;
  device_code: string;
  brand: string;
  model: string;
  employee_id: string | null;
  department_id: string | null;
  phone_number: string;
  imei: string;
  delivery_date: string;
  status: string;
  notesHistory: NoteItem[];
  employee_name?: string;
  employee_code?: string;
  employee_email?: string;
  employee_initials?: string;
  department_name?: string;
  department_code?: string;
}

export default function CelularesPage() {
  const [devices, setDevices] = useState<MobileDevice[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('');

  // Modales
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showNotesModal, setShowNotesModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [activeDevice, setActiveDevice] = useState<MobileDevice | null>(null);

  // Formulario de creación
  const [formData, setFormData] = useState({
    brand: '',
    model: '',
    employeeId: '',
    departmentId: '',
    phoneNumber: '+502 ',
    imei: '',
    deliveryDate: new Date().toISOString().split('T')[0],
    initialNote: '',
  });

  // Nota nueva
  const [newNoteText, setNewNoteText] = useState('');
  const [modalFeedback, setModalFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [devRes, empRes, deptRes] = await Promise.all([
        fetch('/api/celulares'),
        fetch('/api/employees'),
        fetch('/api/catalogs'),
      ]);

      const devData = await devRes.json();
      const empData = await empRes.json();
      const deptData = await deptRes.json();

      if (devData.devices) setDevices(devData.devices);
      if (empData.employees) setEmployees(empData.employees);
      if (deptData.departments) setDepartments(deptData.departments);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Manejador Poka-Yoke: al seleccionar empleado, asignar su departamento automáticamente
  const handleEmployeeChange = (empId: string) => {
    const selectedEmp = employees.find((e) => e.id === empId);
    setFormData((prev) => ({
      ...prev,
      employeeId: empId,
      departmentId: selectedEmp?.department_id || prev.departmentId,
    }));
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalFeedback(null);

    // Validación Poka-yoke
    if (!formData.brand.trim() || !formData.model.trim() || !formData.imei.trim()) {
      setModalFeedback({ type: 'error', message: 'Marca, modelo e IMEI son obligatorios.' });
      return;
    }

    try {
      const res = await fetch('/api/celulares', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al guardar');

      setModalFeedback({ type: 'success', message: 'Celular registrado exitosamente.' });
      setTimeout(() => {
        setShowCreateModal(false);
        setModalFeedback(null);
        setFormData({
          brand: '',
          model: '',
          employeeId: '',
          departmentId: '',
          phoneNumber: '+502 ',
          imei: '',
          deliveryDate: new Date().toISOString().split('T')[0],
          initialNote: '',
        });
        loadData();
      }, 600);
    } catch (err: any) {
      setModalFeedback({ type: 'error', message: err.message });
    }
  };

  const handleAddNote = async () => {
    if (!activeDevice || !newNoteText.trim()) return;

    try {
      const res = await fetch('/api/celulares', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: activeDevice.id,
          addNote: newNoteText.trim(),
        }),
      });

      if (!res.ok) throw new Error('Error al guardar nota');

      const updatedNotes = [
        ...activeDevice.notesHistory,
        {
          id: Date.now().toString(),
          date: new Date().toISOString().split('T')[0],
          note: newNoteText.trim(),
          author: 'Usuario Activo',
        },
      ];

      setActiveDevice({ ...activeDevice, notesHistory: updatedNotes });
      setNewNoteText('');
      loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleReassignSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeDevice) return;

    try {
      const res = await fetch('/api/celulares', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: activeDevice.id,
          employeeId: activeDevice.employee_id,
          departmentId: activeDevice.department_id,
          phoneNumber: activeDevice.phone_number,
          brand: activeDevice.brand,
          model: activeDevice.model,
          imei: activeDevice.imei,
          deliveryDate: activeDevice.delivery_date,
          status: activeDevice.employee_id ? 'ASIGNADO' : 'DISPONIBLE',
        }),
      });

      if (!res.ok) throw new Error('Error al reasignar');

      setShowEditModal(false);
      loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const filteredDevices = devices.filter((d) => {
    const matchesSearch =
      d.device_code.toLowerCase().includes(search.toLowerCase()) ||
      d.brand.toLowerCase().includes(search.toLowerCase()) ||
      d.model.toLowerCase().includes(search.toLowerCase()) ||
      d.imei.toLowerCase().includes(search.toLowerCase()) ||
      d.phone_number.includes(search) ||
      (d.employee_name && d.employee_name.toLowerCase().includes(search.toLowerCase()));

    const matchesDept = deptFilter ? d.department_id === deptFilter : true;
    return matchesSearch && matchesDept;
  });

  return (
    <div className="space-y-6">
        {/* Cabecera de Página */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-5">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2.5">
              <Smartphone className="h-7 w-7 text-emerald-600" />
              Gestión de Celulares y Líneas Corporativas
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Control de smartphones asignados a empleados, IMEIs, fechas de entrega y bitácora histórica de notas y garantías.
            </p>
          </div>

          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white shadow-md transition hover:bg-emerald-800"
          >
            <Plus className="h-4 w-4" />
            <span>Registrar Celular</span>
          </button>
        </div>

        {/* Barra de Filtros */}
        <div className="flex flex-col md:flex-row gap-3 items-center justify-between bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por código (CEL-001), empleado, IMEI, número o modelo..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-4 py-2 text-sm text-slate-800 focus:border-emerald-600 focus:bg-white focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto">
            <select
              value={deptFilter}
              onChange={(e) => setDeptFilter(e.target.value)}
              className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 focus:border-emerald-600 focus:outline-none"
            >
              <option value="">Todos los departamentos</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Tabla de Celulares */}
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="border-b border-slate-200 bg-slate-50/75 text-xs uppercase font-semibold text-slate-700">
                <tr>
                  <th className="py-3.5 px-4">Código / Equipo</th>
                  <th className="py-3.5 px-4">Empleado Asignado</th>
                  <th className="py-3.5 px-4">Departamento</th>
                  <th className="py-3.5 px-4">Teléfono & IMEI</th>
                  <th className="py-3.5 px-4">Fecha Entrega</th>
                  <th className="py-3.5 px-4">Estado</th>
                  <th className="py-3.5 px-4 text-center">Bitácora Notas</th>
                  <th className="py-3.5 px-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-400">
                      Cargando celulares corporativos...
                    </td>
                  </tr>
                ) : filteredDevices.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-400">
                      No se encontraron celulares con los criterios seleccionados.
                    </td>
                  </tr>
                ) : (
                  filteredDevices.map((d) => (
                    <tr key={d.id} className="hover:bg-slate-50/70 transition">
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-900 font-mono">{d.device_code}</div>
                        <div className="text-xs text-slate-500">{d.brand} {d.model}</div>
                      </td>

                      <td className="py-3.5 px-4">
                        {d.employee_name ? (
                          <div className="flex items-center gap-2">
                            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-100 font-bold text-xs text-emerald-800">
                              {d.employee_initials || 'EM'}
                            </div>
                            <div>
                              <div className="font-medium text-slate-900">{d.employee_name}</div>
                              <div className="text-[11px] text-slate-400">{d.employee_code}</div>
                            </div>
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-md">
                            Sin asignar (Bodega)
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-4">
                        <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">
                          <Building2 className="h-3 w-3 text-slate-400" />
                          {d.department_name || 'Cuarto de Servidores'}
                        </span>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="font-mono text-xs font-semibold text-slate-900 flex items-center gap-1">
                          <PhoneCall className="h-3 w-3 text-emerald-600" />
                          {d.phone_number}
                        </div>
                        <div className="font-mono text-[11px] text-slate-400">
                          IMEI: {d.imei}
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-xs font-mono text-slate-600">
                        {d.delivery_date}
                      </td>

                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                            d.status === 'ASIGNADO'
                              ? 'bg-emerald-100 text-emerald-800'
                              : d.status === 'DISPONIBLE'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {d.status}
                        </span>
                      </td>

                      {/* Botón de Notas */}
                      <td className="py-3.5 px-4 text-center">
                        <button
                          onClick={() => {
                            setActiveDevice(d);
                            setShowNotesModal(true);
                          }}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100 shadow-sm"
                        >
                          <MessageSquare className="h-3.5 w-3.5 text-emerald-600" />
                          <span>Notas ({d.notesHistory?.length || 0})</span>
                        </button>
                      </td>

                      {/* Acciones */}
                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={() => {
                            setActiveDevice(d);
                            setShowEditModal(true);
                          }}
                          className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                          title="Reasignar o editar celular"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* MODAL REGISTRAR CELULAR */}
        {showCreateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
            <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl animate-in fade-in zoom-in-95">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <Smartphone className="h-5 w-5 text-emerald-600" />
                  Nuevo Celular Corporativo
                </h3>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {modalFeedback && (
                <div
                  className={`mt-4 flex items-center gap-2 rounded-xl p-3 text-xs ${
                    modalFeedback.type === 'success'
                      ? 'bg-emerald-50 text-emerald-800'
                      : 'bg-rose-50 text-rose-800'
                  }`}
                >
                  {modalFeedback.type === 'success' ? (
                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                  ) : (
                    <AlertCircle className="h-4 w-4 shrink-0" />
                  )}
                  <span>{modalFeedback.message}</span>
                </div>
              )}

              <form onSubmit={handleCreateSubmit} className="mt-4 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700">Marca</label>
                    <input
                      type="text"
                      required
                      placeholder="ej. Samsung, Xiaomi"
                      value={formData.brand}
                      onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                      className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700">Modelo</label>
                    <input
                      type="text"
                      required
                      placeholder="ej. Galaxy A54 128GB"
                      value={formData.model}
                      onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                      className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700">Número de Teléfono</label>
                    <input
                      type="text"
                      required
                      placeholder="+502 5555-0000"
                      value={formData.phoneNumber}
                      onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
                      className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700">Número IMEI (15 dígitos)</label>
                    <input
                      type="text"
                      required
                      maxLength={16}
                      placeholder="354890123456781"
                      value={formData.imei}
                      onChange={(e) => setFormData({ ...formData, imei: e.target.value })}
                      className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700">
                    Asignar a Empleado (Poka-Yoke: asigna departamento automáticamente)
                  </label>
                  <select
                    value={formData.employeeId}
                    onChange={(e) => handleEmployeeChange(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none"
                  >
                    <option value="">Dejar disponible en Bodega</option>
                    {employees.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.full_name} ({e.employee_code}) - {e.department_name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700">Departamento</label>
                    <select
                      value={formData.departmentId}
                      onChange={(e) => setFormData({ ...formData, departmentId: e.target.value })}
                      className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none"
                    >
                      <option value="">Cuarto de Servidores (Bodega)</option>
                      {departments.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700">Fecha de Entrega</label>
                    <input
                      type="date"
                      required
                      value={formData.deliveryDate}
                      onChange={(e) => setFormData({ ...formData, deliveryDate: e.target.value })}
                      className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700">Nota inicial (Garantía, accesorios, estado)</label>
                  <textarea
                    rows={2}
                    placeholder="ej. Entregado con cargador 25W y funda transparente..."
                    value={formData.initialNote}
                    onChange={(e) => setFormData({ ...formData, initialNote: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 text-sm focus:border-emerald-600 focus:outline-none"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800"
                  >
                    Guardar Celular
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL HISTORIAL DE NOTAS */}
        {showNotesModal && activeDevice && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
            <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl animate-in fade-in zoom-in-95">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                    <History className="h-5 w-5 text-emerald-600" />
                    Bitácora de Notas: {activeDevice.device_code}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {activeDevice.brand} {activeDevice.model} • IMEI: {activeDevice.imei}
                  </p>
                </div>
                <button
                  onClick={() => setShowNotesModal(false)}
                  className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Lista de Notas Históricas */}
              <div className="my-4 max-h-60 overflow-y-auto space-y-2.5 pr-1">
                {activeDevice.notesHistory && activeDevice.notesHistory.length > 0 ? (
                  activeDevice.notesHistory.map((n) => (
                    <div key={n.id} className="rounded-xl border border-slate-100 bg-slate-50 p-3 text-xs">
                      <div className="flex items-center justify-between text-slate-500 font-mono text-[11px] mb-1">
                        <span>{n.date}</span>
                        <span className="font-semibold text-slate-700">{n.author}</span>
                      </div>
                      <p className="text-slate-800">{n.note}</p>
                    </div>
                  ))
                ) : (
                  <p className="py-6 text-center text-xs text-slate-400">
                    Aún no hay notas registradas para este dispositivo.
                  </p>
                )}
              </div>

              {/* Formulario para Agregar Nueva Nota */}
              <div className="border-t border-slate-100 pt-3">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Agregar Nueva Nota (Cambio de pantalla, garantía aplicada, etc.):
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newNoteText}
                    onChange={(e) => setNewNoteText(e.target.value)}
                    placeholder="ej. Reemplazo de batería por garantía oficial..."
                    className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-xs focus:border-emerald-600 focus:outline-none"
                  />
                  <button
                    onClick={handleAddNote}
                    disabled={!newNoteText.trim()}
                    className="rounded-xl bg-emerald-700 px-3.5 py-2 text-xs font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
                  >
                    Agregar
                  </button>
                </div>
              </div>

              <div className="mt-4 flex justify-end">
                <button
                  onClick={() => setShowNotesModal(false)}
                  className="rounded-xl bg-slate-100 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL REASIGNAR O EDITAR */}
        {showEditModal && activeDevice && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl animate-in fade-in zoom-in-95">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <ArrowRightLeft className="h-5 w-5 text-emerald-600" />
                  Reasignar Celular {activeDevice.device_code}
                </h3>
                <button
                  onClick={() => setShowEditModal(false)}
                  className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleReassignSubmit} className="mt-4 space-y-3.5 text-sm">
                <div>
                  <label className="block text-xs font-medium text-slate-700">Reasignar a Empleado:</label>
                  <select
                    value={activeDevice.employee_id || ''}
                    onChange={(e) => {
                      const empId = e.target.value;
                      const emp = employees.find((em) => em.id === empId);
                      setActiveDevice({
                        ...activeDevice,
                        employee_id: empId || null,
                        department_id: emp?.department_id || activeDevice.department_id,
                      });
                    }}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none"
                  >
                    <option value="">Devolver a Cuarto de Servidores (Bodega)</option>
                    {employees.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.full_name} ({e.employee_code}) - {e.department_name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700">Número de Teléfono:</label>
                  <input
                    type="text"
                    value={activeDevice.phone_number}
                    onChange={(e) => setActiveDevice({ ...activeDevice, phone_number: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-mono focus:border-emerald-600 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700">Fecha de Entrega:</label>
                  <input
                    type="date"
                    value={activeDevice.delivery_date}
                    onChange={(e) => setActiveDevice({ ...activeDevice, delivery_date: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowEditModal(false)}
                    className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800"
                  >
                    Confirmar Cambio
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
  );
}
