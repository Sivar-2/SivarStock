'use client';

import React, { useEffect, useState } from 'react';
import {
  Smartphone,
  Plus,
  Search,
  Phone,
  Hash,
  User,
  Building2,
  FileText,
  Edit3,
  Trash2,
  X,
  MessageSquarePlus,
  Download,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ShieldAlert,
  Wrench,
  Cpu,
} from 'lucide-react';
import { generateExcelBuffer, generatePdfDoc } from '@/lib/export';

export default function CelularesPage() {
  const [devices, setDevices] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [filterDept, setFilterDept] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterMode, setFilterMode] = useState(''); // '', 'EQUIPO_Y_LINEA', 'SOLO_CHIP', 'PERSONAL_SIN_PLAN'
  const [filterIncident, setFilterIncident] = useState(''); // '', 'WAITING_CLARO', 'IN_MAINTENANCE'
  const [filterContract, setFilterContract] = useState(''); // '', 'EXPIRING', 'EXPIRED'

  // Modal Crear / Editar Celular y Línea
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingDeviceId, setEditingDeviceId] =State<string | null>(null);
  const [formData, setFormData] = useState({
    assignmentMode: 'EQUIPO_Y_LINEA',
    brand: '',
    model: '',
    serialNumber: '',
    macAddress: '',
    employeeId: '',
    departmentId: '',
    phoneNumber: '+502 ',
    imei: '',
    simIccid: '',
    carrier: 'Claro Guatemala',
    customCarrierNote: '',
    planName: '',
    monthlyCost: '',
    contractNumber: '',
    contractStartDate: new Date().toISOString().split('T')[0],
    contractEndDate: '',
    renewalAlertDays: '30',
    incidentType: 'NINGUNO',
    incidentDate: '',
    repairDetails: '',
    deliveryDate: new Date().toISOString().split('T')[0],
    status: 'ASIGNADO',
    initialNote: '',
  });
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Modal Bitácora por Empleado / Línea
  const [selectedDevice, setSelectedDevice] = useState<any | null>(null);
  const [newNoteText, setNewNoteText] = useState('');
  const [editStatus, setEditStatus] = useState('');
  const [editEmployeeId, setEditEmployeeId] = useState('');
  const [editPhoneNumber, setEditPhoneNumber] = useState('');
  const [editIncidentType, setEditIncidentType] = useState('NINGUNO');
  const [editIncidentDate, setEditIncidentDate] = useState('');
  const [editRepairDetails, setEditRepairDetails] = useState('');

  const fetchData = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (filterDept) params.set('departmentId', filterDept);
      if (filterStatus) params.set('status', filterStatus);
      if (filterMode) params.set('assignmentMode', filterMode);
      if (filterIncident) params.set('incidentFilter', filterIncident);
      if (filterContract) params.set('contractFilter', filterContract);

      const [resCel, resEmp, resCat] = await Promise.all([
        fetch(`/api/celulares?${params.toString()}`),
        fetch('/api/employees?all=true'),
        fetch('/api/catalogs'),
      ]);

      const dataCel = await resCel.json();
      const dataEmp = await resEmp.json();
      const dataCat = await resCat.json();

      setDevices(dataCel.devices || []);
      setEmployees(dataEmp.employees || []);
      setDepartments(dataCat.departments || []);
    } catch (e) {
      console.error('Error cargando celulares:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [filterDept, filterStatus, filterMode, filterIncident, filterContract]);

  const openCreateModal = () => {
    setEditingDeviceId(null);
    setFormError('');
    setFormData({
      assignmentMode: 'EQUIPO_Y_LINEA',
      brand: '',
      model: '',
      serialNumber: '',
      macAddress: '',
      employeeId: '',
      departmentId: '',
      phoneNumber: '+502 ',
      imei: '',
      simIccid: '',
      carrier: 'Claro Guatemala',
      customCarrierNote: '',
      planName: '',
      monthlyCost: '',
      contractNumber: '',
      contractStartDate: new Date().toISOString().split('T')[0],
      contractEndDate: '',
      renewalAlertDays: '30',
      incidentType: 'NINGUNO',
      incidentDate: '',
      repairDetails: '',
      deliveryDate: new Date().toISOString().split('T')[0],
      status: 'ASIGNADO',
      initialNote: '',
    });
    setShowCreateModal(true);
  };

  const openEditModal = (d: any) => {
    setEditingDeviceId(d.id);
    setFormError('');
    setFormData({
      assignmentMode: d.assignment_mode || 'EQUIPO_Y_LINEA',
      brand: d.brand || '',
      model: d.model || '',
      serialNumber: d.serial_number || '',
      macAddress: d.mac_address || '',
      employeeId: d.employee_id || '',
      departmentId: d.department_id || '',
      phoneNumber: d.phone_number || '+502 ',
      imei: d.imei || '',
      simIccid: d.sim_iccid || '',
      carrier: d.carrier === 'Otro' ? 'Otro' : 'Claro Guatemala',
      customCarrierNote: d.custom_carrier_note || '',
      planName: d.plan_name || '',
      monthlyCost: d.monthly_cost ? String(d.monthly_cost) : '',
      contractNumber: d.contract_number || '',
      contractStartDate: d.contract_start_date || d.delivery_date || '',
      contractEndDate: d.contract_end_date || '',
      renewalAlertDays: d.renewal_alert_days ? String(d.renewal_alert_days) : '30',
      incidentType: d.incident_type || 'NINGUNO',
      incidentDate: d.incident_date || '',
      repairDetails: d.repair_details || '',
      deliveryDate: d.delivery_date || new Date().toISOString().split('T')[0],
      status: d.status || (d.employee_id ? 'ASIGNADO' : 'DISPONIBLE'),
      initialNote: '',
    });
    setShowCreateModal(true);
  };

  const handleSaveDevice = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setSubmitting(true);

    try {
      const method = editingDeviceId ? 'PUT' : 'POST';
      const payload = editingDeviceId
        ? { id: editingDeviceId, ...formData, addNote: formData.initialNote }
        : formData;

      const res = await fetch('/api/celulares', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setFormError(data.error || 'Error al guardar celular y línea.');
      } else {
        setShowCreateModal(false);
        setEditingDeviceId(null);
        fetchData();
      }
    } catch {
      setFormError('Error de conexión.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteDevice = async (device: any) => {
    if (!window.confirm(`¿Está seguro de eliminar el celular y línea ${device.device_code} (${device.phone_number})?`)) {
      return;
    }
    try {
      const res = await fetch(`/api/celulares?id=${device.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'No se pudo eliminar el registro.');
      } else {
        fetchData();
      }
    } catch {
      alert('Error de red al eliminar.');
    }
  };

  const handleEmployeeChange = (empId: string) => {
    const emp = employees.find((e) => e.id === empId);
    setFormData({
      ...formData,
      employeeId: empId,
      departmentId: emp ? emp.department_id || '' : formData.departmentId,
      status: empId ? 'ASIGNADO' : 'DISPONIBLE',
    });
  };

  const openNotesModal = (device: any) => {
    setSelectedDevice(device);
    setEditStatus(device.status);
    setEditEmployeeId(device.employee_id || '');
    setEditPhoneNumber(device.phone_number || '');
    setEditIncidentType(device.incident_type || 'NINGUNO');
    setEditIncidentDate(device.incident_date || new Date().toISOString().split('T')[0]);
    setEditRepairDetails(device.repair_details || '');
    setNewNoteText('');
  };

  const handleUpdateDeviceNotes = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDevice) return;

    const emp = employees.find((ep) => ep.id === editEmployeeId);
    const res = await fetch('/api/celulares', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: selectedDevice.id,
        employeeId: editEmployeeId || null,
        departmentId: emp ? emp.department_id : selectedDevice.department_id,
        phoneNumber: editPhoneNumber,
        status: editStatus,
        incidentType: editIncidentType,
        incidentDate: editIncidentType !== 'NINGUNO' ? editIncidentDate : null,
        repairDetails: editRepairDetails,
        addNote: newNoteText,
      }),
    });

    if (res.ok) {
      setSelectedDevice(null);
      fetchData();
    }
  };

  const exportColumns = [
    { key: 'device_code', header: 'Código' },
    { key: 'assignment_mode', header: 'Modalidad' },
    { key: 'carrier', header: 'Operador' },
    { key: 'phone_number', header: 'Número Línea' },
    { key: 'plan_name', header: 'Plan Contratado' },
    { key: 'monthly_cost', header: 'Cuota Mensual (Q)' },
    { key: 'contract_end_date', header: 'Vencimiento Contrato' },
    { key: 'brand', header: 'Marca' },
    { key: 'model', header: 'Modelo' },
    { key: 'imei', header: 'IMEI / SIM' },
    { key: 'employee_name', header: 'Empleado Asignado' },
    { key: 'department_name', header: 'Departamento' },
    { key: 'incident_type', header: 'Incidente / Soporte' },
    { key: 'days_waiting_claro', header: 'Días Espera Claro' },
    { key: 'status', header: 'Estado' },
  ];

  const handleExportExcel = () => {
    const buf = generateExcelBuffer('Control de Celulares y Lineas Claro', exportColumns, devices);
    const blob = new Blob([buf as any], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `celulares_lineas_claro_${new Date().toISOString().slice(0, 10)}.xlsx`;
    a.click();
  };

  const handleExportPdf = () => {
    const doc = generatePdfDoc(
      'Control de Líneas Claro Guatemala, Números Personales y Reposiciones',
      'Incluye Equipo + Línea, Solo Chip SIM, Números Personales sin Plan y Tiempo de Espera de Equipo Claro',
      exportColumns,
      devices
    );
    doc.save(`celulares_lineas_claro_${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  // Estadísticas clave
  const totalLines = devices.length;
  const personalNoPlanCount = devices.filter((d) => d.assignment_mode === 'PERSONAL_SIN_PLAN').length;
  const onlyChipCount = devices.filter((d) => d.assignment_mode === 'SOLO_CHIP').length;
  const waitingClaroCount = devices.filter((d) =>
    ['ROBO_ASALTO', 'PERDIDA_REPOSICION'].includes(d.incident_type)
  ).length;
  const inMaintCount = devices.filter(
    (d) => ['MANTENIMIENTO', 'TALLER_DESPERFECTO'].includes(d.incident_type) || d.status === 'EN_REPARACION'
  ).length;
  const totalMonthlySpend = devices
    .filter((d) => d.status !== 'DADO_DE_BAJA' && d.assignment_mode !== 'PERSONAL_SIN_PLAN')
    .reduce((acc, d) => acc + Number(d.monthly_cost || 0), 0);

  const getContractBadge = (d: any) => {
    if (d.assignment_mode === 'PERSONAL_SIN_PLAN') {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-purple-100 px-2.5 py-0.5 text-[11px] font-bold text-purple-800 border border-purple-200">
          Número Personal (Sin Plan)
        </span>
      );
    }
    if (!d.contract_end_date) {
      return <span className="text-[11px] text-slate-400">Sin fecha contrato</span>;
    }
    const days = d.days_until_contract_end;
    if (days !== null && days < 0) {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2.5 py-0.5 text-[11px] font-bold text-rose-700 border border-rose-200">
          <ShieldAlert className="h-3 w-3" /> VENCIDO ({Math.abs(days)}d)
        </span>
      );
    }
    if (days !== null && days <= 45) {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-bold text-amber-800 border border-amber-200">
          <Clock className="h-3 w-3" /> Vence en {days}d ({d.contract_end_date})
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700 border border-emerald-200">
        <CheckCircle2 className="h-3 w-3" /> Vigente ({d.contract_end_date})
      </span>
    );
  };

  const getIncidentBadge = (d: any) => {
    const inc = d.incident_type || 'NINGUNO';
    if (inc === 'ROBO_ASALTO' || inc === 'PERDIDA_REPOSICION') {
      return (
        <div className="mt-1 rounded-lg border border-rose-300 bg-rose-50 p-1.5 text-[11px] text-rose-900">
          <div className="font-bold flex items-center gap-1 text-rose-700">
            <AlertTriangle className="h-3.5 w-3.5" />
            {inc === 'ROBO_ASALTO' ? 'Asalto / Robo Reportado' : 'Pérdida / Extravío'}
          </div>
          <div className="font-mono font-black text-rose-800 mt-0.5">
            ⏳ {d.days_waiting_claro ?? 0} día(s) esperando reposición Claro
          </div>
          {d.incident_date && <div className="text-[10px] text-rose-600">Desde: {d.incident_date}</div>}
        </div>
      );
    }
    if (inc === 'MANTENIMIENTO' || inc === 'TALLER_DESPERFECTO') {
      return (
        <div className="mt-1 rounded-lg border border-amber-300 bg-amber-50 p-1.5 text-[11px] text-amber-900">
          <div className="font-bold flex items-center gap-1 text-amber-800">
            <Wrench className="h-3.5 w-3.5" />
            {inc === 'TALLER_DESPERFECTO' ? 'Devuelto al Taller por Desperfecto' : 'En Mantenimiento'}
          </div>
          {d.repair_details && <div className="text-[10px] text-amber-700 mt-0.5">Reparando: {d.repair_details}</div>}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6">
      {/* Encabezado */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2.5">
            <Smartphone className="h-7 w-7 text-military-700" />
            Celulares, Líneas Claro Guatemala y Control de Reposiciones
          </h1>
          <p className="text-sm text-slate-500">
            Control de Equipo + Línea Claro, Solo Chip (SIM), personal con Número Personal (Sin Plan), bitácora de cambios por persona, mantenimiento y días de espera de reposición Claro por robo o extravío.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleExportExcel}
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-sm"
          >
            <Download className="h-4 w-4 text-emerald-600" /> Excel
          </button>
          <button
            onClick={handleExportPdf}
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-sm"
          >
            <FileText className="h-4 w-4 text-rose-600" /> PDF
          </button>
          <button
            onClick={openCreateModal}
            className="flex items-center gap-2 rounded-xl bg-military-700 px-4 py-2.5 text-sm font-semibold text-white shadow-md hover:bg-military-800 transition"
          >
            <Plus className="h-4 w-4" /> Registrar Teléfono / Chip / Línea
          </button>
        </div>
      </div>

      {/* Tarjetas KPI de Líneas, Números Personales, Solo Chip y Reposición Claro */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6">
        <div
          onClick={() => { setFilterMode(''); setFilterIncident(''); setFilterStatus(''); }}
          className="cursor-pointer rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm hover:border-military-500 transition"
        >
          <div className="text-[11px] font-bold uppercase text-slate-400">Total Registros</div>
          <div className="mt-1 text-2xl font-black text-slate-900">{totalLines}</div>
          <div className="mt-0.5 text-[11px] text-slate-500">Todo el directorio móvil</div>
        </div>

        <div
          onClick={() => { setFilterMode(filterMode === 'SOLO_CHIP' ? '' : 'SOLO_CHIP'); setFilterIncident(''); }}
          className={`cursor-pointer rounded-2xl border p-3.5 shadow-sm transition ${
            filterMode === 'SOLO_CHIP' ? 'border-sky-600 bg-sky-50' : 'border-sky-200 bg-sky-50/40 hover:border-sky-500'
          }`}
        >
          <div className="text-[11px] font-bold uppercase text-sky-700">Solo Chip (SIM)</div>
          <div className="mt-1 text-2xl font-black text-sky-900">{onlyChipCount}</div>
          <div className="mt-0.5 text-[11px] text-sky-600">Sin dispositivo entregado</div>
        </div>

        <div
          onClick={() => { setFilterMode(filterMode === 'PERSONAL_SIN_PLAN' ? '' : 'PERSONAL_SIN_PLAN'); setFilterIncident(''); }}
          className={`cursor-pointer rounded-2xl border p-3.5 shadow-sm transition ${
            filterMode === 'PERSONAL_SIN_PLAN' ? 'border-purple-600 bg-purple-50' : 'border-purple-200 bg-purple-50/40 hover:border-purple-500'
          }`}
        >
          <div className="text-[11px] font-bold uppercase text-purple-800">Número Personal</div>
          <div className="mt-1 text-2xl font-black text-purple-900">{personalNoPlanCount}</div>
          <div className="mt-0.5 text-[11px] text-purple-700">Personal sin plan corporativo</div>
        </div>

        <div
          onClick={() => { setFilterIncident(filterIncident === 'IN_MAINTENANCE' ? '' : 'IN_MAINTENANCE'); setFilterMode(''); }}
          className={`cursor-pointer rounded-2xl border p-3.5 shadow-sm transition ${
            filterIncident === 'IN_MAINTENANCE' ? 'border-amber-600 bg-amber-50' : 'border-amber-200 bg-amber-50/50 hover:border-amber-500'
          }`}
        >
          <div className="text-[11px] font-bold uppercase text-amber-800">Mantenimiento / Taller</div>
          <div className="mt-1 text-2xl font-black text-amber-900">{inMaintCount}</div>
          <div className="mt-0.5 text-[11px] text-amber-700">Reparación o desperfecto</div>
        </div>

        <div
          onClick={() => { setFilterIncident(filterIncident === 'WAITING_CLARO' ? '' : 'WAITING_CLARO'); setFilterMode(''); }}
          className={`cursor-pointer rounded-2xl border p-3.5 shadow-sm transition ${
            filterIncident === 'WAITING_CLARO' ? 'border-rose-600 bg-rose-50' : 'border-rose-200 bg-rose-50/50 hover:border-rose-500'
          }`}
        >
          <div className="text-[11px] font-bold uppercase text-rose-700">Espera Equipo Claro</div>
          <div className="mt-1 text-2xl font-black text-rose-900">{waitingClaroCount}</div>
          <div className="mt-0.5 text-[11px] text-rose-600">Asalto / Robo o Pérdida</div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-900 p-3.5 text-white shadow-sm">
          <div className="text-[11px] font-bold uppercase text-emerald-400">Facturación Claro</div>
          <div className="mt-1 text-xl font-black">
            Q {totalMonthlySpend.toLocaleString('es-GT', { minimumFractionDigits: 2 })}
          </div>
          <div className="mt-0.5 text-[11px] text-slate-400">Planes activos mensuales</div>
        </div>
      </div>

      {/* Barra de Filtros */}
      <div className="grid grid-cols-1 gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-6">
        <div className="relative sm:col-span-2">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por Teléfono, Empleado, IMEI, Serie, SIM..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && fetchData()}
            className="w-full rounded-xl border border-slate-200 pl-10 pr-4 py-2 text-sm focus:border-military-600 focus:outline-none"
          />
        </div>

        <select
          value={filterMode}
          onChange={(e) => setFilterMode(e.target.value)}
          className="rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-military-600 focus:outline-none"
        >
          <option value="">Todas las Modalidades</option>
          <option value="EQUIPO_Y_LINEA">Equipo Móvil + Línea Claro</option>
          <option value="SOLO_CHIP">Solo Chip SIM (Sin Teléfono)</option>
          <option value="PERSONAL_SIN_PLAN">Número Personal (Sin Plan)</option>
        </select>

        <select
          value={filterIncident}
          onChange={(e) => setFilterIncident(e.target.value)}
          className="rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-military-600 focus:outline-none"
        >
          <option value="">Estado / Incidentes: Todos</option>
          <option value="WAITING_CLARO">En Espera de Reposición Claro (Robo/Pérdida)</option>
          <option value="IN_MAINTENANCE">En Mantenimiento o Devuelto al Taller</option>
        </select>

        <select
          value={filterDept}
          onChange={(e) => setFilterDept(e.target.value)}
          className="rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-military-600 focus:outline-none"
        >
          <option value="">Todas las Áreas / Deptos.</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>{d.name}</option>
          ))}
        </select>

        <button
          onClick={fetchData}
          className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 transition"
        >
          Filtrar / Buscar
        </button>
      </div>

      {/* Tabla de Dispositivos Móviles y Contratos */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs font-bold uppercase text-slate-600">
              <tr>
                <th className="px-4 py-3.5">Código / Modalidad</th>
                <th className="px-4 py-3.5">Línea / Operador / Plan</th>
                <th className="px-4 py-3.5">Equipo / IMEI / SIM</th>
                <th className="px-4 py-3.5">Empleado & Bitácora</th>
                <th className="px-4 py-3.5">Vigencia & Estado Soporte</th>
                <th className="px-4 py-3.5 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-slate-400">
                    Cargando parque de celulares y líneas Claro Guatemala...
                  </td>
                </tr>
              ) : devices.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-slate-400">
                    No hay líneas o teléfonos registrados con estos criterios.
                  </td>
                </tr>
              ) : (
                devices.map((d) => {
                  const lastNote = d.notesHistory && d.notesHistory.length > 0
                    ? d.notesHistory[d.notesHistory.length - 1]
                    : null;

                  return (
                    <tr key={d.id} className="hover:bg-slate-50/80 transition">
                      <td className="px-4 py-3">
                        <span className="font-mono text-xs font-bold text-military-800 bg-military-50 px-2 py-0.5 rounded border border-military-200">
                          {d.device_code}
                        </span>
                        <div className="mt-1">
                          {d.assignment_mode === 'SOLO_CHIP' ? (
                            <span className="inline-flex items-center gap-1 rounded bg-sky-100 px-2 py-0.5 text-[11px] font-bold text-sky-800">
                              <Cpu className="h-3 w-3" /> Solo Chip SIM
                            </span>
                          ) : d.assignment_mode === 'PERSONAL_SIN_PLAN' ? (
                            <span className="inline-flex items-center gap-1 rounded bg-purple-100 px-2 py-0.5 text-[11px] font-bold text-purple-800">
                              Número Personal (Sin Plan)
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-800">
                              Equipo + Línea
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">Fecha: {d.delivery_date}</div>
                      </td>

                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5 font-semibold text-emerald-700">
                          <Phone className="h-3.5 w-3.5" />
                          {d.phone_number}
                        </div>
                        <div className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-600">
                          <span className="rounded bg-rose-50 border border-rose-200 px-1.5 py-0.5 font-bold text-rose-700">
                            {d.carrier || 'Claro Guatemala'}
                          </span>
                          {d.custom_carrier_note && (
                            <span className="text-[11px] text-slate-500">({d.custom_carrier_note})</span>
                          )}
                        </div>
                        {d.assignment_mode !== 'PERSONAL_SIN_PLAN' && Number(d.monthly_cost) > 0 && (
                          <div className="mt-0.5 text-xs font-bold text-slate-800">
                            Q {Number(d.monthly_cost).toFixed(2)} / mes {d.plan_name ? `• ${d.plan_name}` : ''}
                          </div>
                        )}
                      </td>

                      <td className="px-4 py-3 text-xs text-slate-600 space-y-0.5">
                        <div className="font-semibold text-slate-900">{d.brand} {d.model}</div>
                        <div className="font-mono"><span className="font-bold text-slate-400">IMEI/ID:</span> {d.imei}</div>
                        {d.serial_number && <div className="font-mono"><span className="font-bold text-slate-400">S/N:</span> {d.serial_number}</div>}
                        {d.sim_iccid && <div className="font-mono"><span className="font-bold text-slate-400">SIM ICCID:</span> {d.sim_iccid}</div>}
                      </td>

                      <td className="px-4 py-3">
                        {d.employee_name ? (
                          <div>
                            <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                              <User className="h-3.5 w-3.5 text-slate-400" />
                              {d.employee_name}
                            </div>
                            <span className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                              <Building2 className="h-3 w-3 text-slate-400" />
                              {d.department_name || 'Sin área'} ({d.employee_code})
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs italic text-slate-400">En Bodega (Sin asignar)</span>
                        )}
                        {lastNote && (
                          <div className="mt-1 text-[11px] text-slate-500 truncate max-w-[220px]" title={lastNote.note}>
                            Último cambio: &ldquo;{lastNote.note}&rdquo;
                          </div>
                        )}
                      </td>

                      <td className="px-4 py-3">
                        {getContractBadge(d)}
                        {getIncidentBadge(d)}
                      </td>

                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => openEditModal(d)}
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition"
                            title="Editar teléfono, cambiar modalidad, reportar asalto/pérdida o mantenimiento"
                          >
                            <Edit3 className="h-3.5 w-3.5 text-military-700" />
                            Editar / Incidente
                          </button>
                          <button
                            onClick={() => openNotesModal(d)}
                            className="inline-flex items-center gap-1 rounded-lg border border-sky-200 bg-sky-50 px-2.5 py-1.5 text-xs font-semibold text-sky-800 hover:bg-sky-100 transition"
                            title="Ver bitácora completa de cambios de número o teléfono de esta persona"
                          >
                            <MessageSquarePlus className="h-3.5 w-3.5 text-sky-600" />
                            Bitácora ({d.notesHistory?.length || 0})
                          </button>
                          <button
                            onClick={() => handleDeleteDevice(d)}
                            className="inline-flex items-center justify-center rounded-lg border border-rose-200 bg-rose-50 p-1.5 text-rose-600 hover:bg-rose-100 transition"
                            title="Eliminar registro"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
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

      {/* Modal: Registrar o Editar Celular, Modalidad e Incidente Claro */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-3xl rounded-2xl bg-white p-6 shadow-2xl max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Smartphone className="h-5 w-5 text-military-700" />
                {editingDeviceId ? 'Editar Teléfono, Línea Claro, Mantenimiento o Reposición' : 'Registrar Teléfono, Solo Chip o Número Personal'}
              </h2>
              <button onClick={() => setShowCreateModal(false)} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveDevice} className="mt-4 space-y-4">
              {formError && (
                <div className="rounded-xl bg-rose-50 border border-rose-200 p-3 text-xs font-semibold text-rose-700">
                  {formError}
                </div>
              )}

              {/* Selector de Modalidad */}
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <label className="block text-xs font-bold uppercase text-slate-700 mb-2">Modalidad de Línea / Dispositivo *</label>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, assignmentMode: 'EQUIPO_Y_LINEA' })}
                    className={`rounded-xl border p-2.5 text-left text-xs transition ${
                      formData.assignmentMode === 'EQUIPO_Y_LINEA'
                        ? 'border-emerald-600 bg-emerald-50 font-bold text-emerald-900'
                        : 'border-slate-200 bg-white text-slate-600'
                    }`}
                  >
                    <div>1. Equipo + Línea Claro</div>
                    <div className="text-[10px] font-normal opacity-80">Se entregó aparato celular y chip</div>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setFormData({
                        ...formData,
                        assignmentMode: 'SOLO_CHIP',
                        brand: formData.brand || 'Solo Chip SIM',
                        model: formData.model || 'SIM Claro Corporativa',
                      })
                    }
                    className={`rounded-xl border p-2.5 text-left text-xs transition ${
                      formData.assignmentMode === 'SOLO_CHIP'
                        ? 'border-sky-600 bg-sky-50 font-bold text-sky-900'
                        : 'border-slate-200 bg-white text-slate-600'
                    }`}
                  >
                    <div>2. Solo Chip (Sin Teléfono)</div>
                    <div className="text-[10px] font-normal opacity-80">Solo se le dio SIM y no aparato móvil</div>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setFormData({
                        ...formData,
                        assignmentMode: 'PERSONAL_SIN_PLAN',
                        brand: 'Teléfono Personal',
                        model: 'Sin Plan Corporativo',
                        monthlyCost: '0',
                        contractEndDate: '',
                      })
                    }
                    className={`rounded-xl border p-2.5 text-left text-xs transition ${
                      formData.assignmentMode === 'PERSONAL_SIN_PLAN'
                        ? 'border-purple-600 bg-purple-50 font-bold text-purple-900'
                        : 'border-slate-200 bg-white text-slate-600'
                    }`}
                  >
                    <div>3. Número Personal (Sin Plan)</div>
                    <div className="text-[10px] font-normal opacity-80">Personal sin plan con nosotros (Para reportes)</div>
                  </button>
                </div>
              </div>

              {/* Bloque 1: Datos de la Línea y Operador (Claro Guatemala u Otro) */}
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-4 space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-900 flex items-center gap-1.5">
                  <Phone className="h-4 w-4 text-emerald-700" /> 1. Datos de Línea Telefónica y Operador
                </h3>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div>
                    <label className="block text-xs font-bold uppercase text-slate-600 mb-1">Número Telefónico *</label>
                    <input
                      type="text"
                      required
                      placeholder="+502 5555-0000"
                      value={formData.phoneNumber}
                      onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase text-slate-600 mb-1">Operador *</label>
                    <select
                      value={formData.carrier}
                      onChange={(e) => setFormData({ ...formData, carrier: e.target.value })}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold"
                    >
                      <option value="Claro Guatemala">Claro Guatemala</option>
                      <option value="Otro">Otro (Especificar en nota)</option>
                    </select>
                  </div>
                  {formData.carrier === 'Otro' ? (
                    <div>
                      <label className="block text-xs font-bold uppercase text-amber-800 mb-1">¿Cuál Operador? (Nota) *</label>
                      <input
                        type="text"
                        required
                        placeholder="Especifique el operador..."
                        value={formData.customCarrierNote}
                        onChange={(e) => setFormData({ ...formData, customCarrierNote: e.target.value })}
                        className="w-full rounded-xl border border-amber-300 bg-white px-3 py-2 text-sm"
                      />
                    </div>
                  ) : (
                    <div>
                      <label className="block text-xs font-bold uppercase text-slate-600 mb-1">Cuota Mensual (Q)</label>
                      <input
                        type="number"
                        step="0.01"
                        disabled={formData.assignmentMode === 'PERSONAL_SIN_PLAN'}
                        placeholder="Ej. 275.00"
                        value={formData.monthlyCost}
                        onChange={(e) => setFormData({ ...formData, monthlyCost: e.target.value })}
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm disabled:bg-slate-100"
                      />
                    </div>
                  )}
                </div>

                {formData.assignmentMode !== 'PERSONAL_SIN_PLAN' && (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div>
                      <label className="block text-xs font-bold uppercase text-slate-600 mb-1">Plan Contratado</label>
                      <input
                        type="text"
                        placeholder="Ej. Plan Corporativo Claro 35GB"
                        value={formData.planName}
                        onChange={(e) => setFormData({ ...formData, planName: e.target.value })}
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase text-slate-600 mb-1">No. Contrato Claro</label>
                      <input
                        type="text"
                        placeholder="Ej. CTR-CLARO-2025"
                        value={formData.contractNumber}
                        onChange={(e) => setFormData({ ...formData, contractNumber: e.target.value })}
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase text-amber-800 mb-1">Vencimiento Contrato</label>
                      <input
                        type="date"
                        value={formData.contractEndDate}
                        onChange={(e) => setFormData({ ...formData, contractEndDate: e.target.value })}
                        className="w-full rounded-xl border border-amber-300 bg-white px-3 py-2 text-sm"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Bloque 2: Identificadores del Aparato o Chip */}
              {formData.assignmentMode !== 'PERSONAL_SIN_PLAN' && (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                    <Hash className="h-4 w-4 text-slate-600" /> 2. Datos de Dispositivo Móvil y Chip SIM
                  </h3>
                  {formData.assignmentMode === 'EQUIPO_Y_LINEA' && (
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                      <div>
                        <label className="block text-xs font-bold uppercase text-slate-600 mb-1">Marca *</label>
                        <input
                          type="text"
                          required
                          placeholder="Samsung, Honor, Apple..."
                          value={formData.brand}
                          onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold uppercase text-slate-600 mb-1">Modelo *</label>
                        <input
                          type="text"
                          required
                          placeholder="Galaxy A55 / Honor 400"
                          value={formData.model}
                          onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold uppercase text-slate-600 mb-1">Código IMEI *</label>
                        <input
                          type="text"
                          required
                          placeholder="15 dígitos IMEI"
                          value={formData.imei}
                          onChange={(e) => setFormData({ ...formData, imei: e.target.value })}
                          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-mono"
                        />
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div>
                      <label className="block text-xs font-bold uppercase text-slate-600 mb-1">SIM / ICCID Claro</label>
                      <input
                        type="text"
                        placeholder="89502..."
                        value={formData.simIccid}
                        onChange={(e) => setFormData({ ...formData, simIccid: e.target.value })}
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase text-slate-600 mb-1">Número de Serie (S/N)</label>
                      <input
                        type="text"
                        placeholder="Opcional"
                        value={formData.serialNumber}
                        onChange={(e) => setFormData({ ...formData, serialNumber: e.target.value })}
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase text-slate-600 mb-1">MAC Wi-Fi</label>
                      <input
                        type="text"
                        placeholder="Opcional"
                        value={formData.macAddress}
                        onChange={(e) => setFormData({ ...formData, macAddress: e.target.value })}
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-mono"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Bloque 3: Control de Mantenimiento, Devolución al Taller o Asalto/Pérdida (Espera de Claro) */}
              <div className="rounded-xl border border-amber-200 bg-amber-50/40 p-4 space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-amber-900 flex items-center gap-1.5">
                  <Wrench className="h-4 w-4 text-amber-700" /> 3. Estado de Mantenimiento, Taller o Reposición Claro (Asalto / Extravío)
                </h3>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-bold uppercase text-slate-700 mb-1">Situación Especial / Incidente</label>
                    <select
                      value={formData.incidentType}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          incidentType: e.target.value,
                          incidentDate:
                            e.target.value !== 'NINGUNO' && !formData.incidentDate
                              ? new Date().toISOString().split('T')[0]
                              : formData.incidentDate,
                        })
                      }
                      className="w-full rounded-xl border border-amber-300 bg-white px-3 py-2 text-sm font-semibold"
                    >
                      <option value="NINGUNO">Ninguno (Operativo Normal)</option>
                      <option value="MANTENIMIENTO">En Mantenimiento (En reparación)</option>
                      <option value="TALLER_DESPERFECTO">Devuelto al Taller por Desperfecto</option>
                      <option value="ROBO_ASALTO">Asaltaron al Empleado (Esperando Reposición Claro)</option>
                      <option value="PERDIDA_REPOSICION">Perdió el Teléfono (Esperando Reposición Claro)</option>
                    </select>
                  </div>

                  {formData.incidentType !== 'NINGUNO' && (
                    <div>
                      <label className="block text-xs font-bold uppercase text-rose-800 mb-1">
                        Fecha del Suceso / Ingreso a Taller *
                      </label>
                      <input
                        type="date"
                        required
                        value={formData.incidentDate}
                        onChange={(e) => setFormData({ ...formData, incidentDate: e.target.value })}
                        className="w-full rounded-xl border border-rose-300 bg-white px-3 py-2 text-sm"
                      />
                    </div>
                  )}
                </div>

                {formData.incidentType !== 'NINGUNO' && (
                  <div>
                    <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                      {formData.incidentType === 'MANTENIMIENTO' || formData.incidentType === 'TALLER_DESPERFECTO'
                        ? '¿Qué se está reparando o cuál es el desperfecto?'
                        : 'Detalles del Asalto/Pérdida y Gestión de Reposición con Claro'}
                    </label>
                    <input
                      type="text"
                      value={formData.repairDetails}
                      onChange={(e) => setFormData({ ...formData, repairDetails: e.target.value })}
                      placeholder="Ej. Cambio de pantalla / Reporte policial #1234 — Solicitud ingresada en Claro..."
                      className="w-full rounded-xl border border-amber-300 bg-white px-3 py-2 text-sm"
                    />
                  </div>
                )}
              </div>

              {/* Bloque 4: Asignación a Empleado y Departamento */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-600 mb-1">Empleado Responsable</label>
                  <select
                    value={formData.employeeId}
                    onChange={(e) => handleEmployeeChange(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  >
                    <option value="">-- En Bodega (Sin asignar) --</option>
                    {employees.map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.full_name} ({emp.employee_code})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-slate-600 mb-1">Área / Departamento</label>
                  <select
                    value={formData.departmentId}
                    onChange={(e) => setFormData({ ...formData, departmentId: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  >
                    <option value="">-- Seleccionar --</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-slate-600 mb-1">Fecha de Entrega / Alta *</label>
                  <input
                    type="date"
                    required
                    value={formData.deliveryDate}
                    onChange={(e) => setFormData({ ...formData, deliveryDate: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-600 mb-1">
                  {editingDeviceId ? 'Agregar Nota a la Bitácora del Empleado' : 'Nota Inicial en Bitácora'}
                </label>
                <textarea
                  rows={2}
                  placeholder="Cualquier cambio de número, actualización de aparato o nota queda guardada en la bitácora histórica..."
                  value={formData.initialNote}
                  onChange={(e) => setFormData({ ...formData, initialNote: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-xl bg-military-700 px-5 py-2 text-sm font-semibold text-white hover:bg-military-800 disabled:opacity-50"
                >
                  {submitting ? 'Guardando...' : editingDeviceId ? 'Guardar Cambios y Actualizar Bitácora' : 'Guardar Registro'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Bitácora Histórica de Cambios por Empleado / Línea */}
      {selectedDevice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <span className="font-mono text-xs font-bold text-military-700 bg-military-50 px-2 py-0.5 rounded">
                  {selectedDevice.device_code}
                </span>
                <h2 className="text-lg font-bold text-slate-900 mt-1">
                  Bitácora de Cambios: {selectedDevice.employee_name || 'En Bodega'} ({selectedDevice.phone_number})
                </h2>
                <p className="text-xs text-slate-500">
                  Historial completo de cambios de número, actualizaciones de teléfono, mantenimiento o espera de equipo Claro.
                </p>
              </div>
              <button onClick={() => setSelectedDevice(null)} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-4 space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Historial Cronológico de Movimientos y Cambios ({selectedDevice.notesHistory?.length || 0})
              </h3>
              <div className="max-h-56 overflow-y-auto space-y-2 rounded-xl bg-slate-50 p-3 border border-slate-200">
                {(!selectedDevice.notesHistory || selectedDevice.notesHistory.length === 0) ? (
                  <p className="text-xs text-slate-400 text-center py-4">Sin registros en la bitácora.</p>
                ) : (
                  selectedDevice.notesHistory.map((n: any, idx: number) => (
                    <div key={n.id || idx} className="rounded-lg bg-white p-2.5 shadow-sm border border-slate-200/80 text-xs">
                      <div className="flex justify-between text-[11px] font-semibold text-slate-500 mb-1">
                        <span>Fecha: {n.date}</span>
                        <span>Por: {n.author || 'Admin'}</span>
                      </div>
                      <p className="text-slate-800 font-medium">{n.note}</p>
                    </div>
                  ))
                )}
              </div>
            </div>

            <form onSubmit={handleUpdateDeviceNotes} className="mt-5 space-y-4 border-t border-slate-100 pt-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-600 mb-1">Actualizar Número Telefónico</label>
                  <input
                    type="text"
                    value={editPhoneNumber}
                    onChange={(e) => setEditPhoneNumber(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-600 mb-1">Empleado Asignado</label>
                  <select
                    value={editEmployeeId}
                    onChange={(e) => setEditEmployeeId(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  >
                    <option value="">-- En Bodega (Sin asignar) --</option>
                    {employees.map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.full_name} ({emp.employee_code})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-bold uppercase text-amber-800 mb-1">Mantenimiento / Robo / Pérdida</label>
                  <select
                    value={editIncidentType}
                    onChange={(e) => setEditIncidentType(e.target.value)}
                    className="w-full rounded-xl border border-amber-300 px-3 py-2 text-sm"
                  >
                    <option value="NINGUNO">Operativo Normal</option>
                    <option value="MANTENIMIENTO">En Mantenimiento</option>
                    <option value="TALLER_DESPERFECTO">Devuelto al Taller por Desperfecto</option>
                    <option value="ROBO_ASALTO">Asalto / Robo (Espera Claro)</option>
                    <option value="PERDIDA_REPOSICION">Pérdida / Extravío (Espera Claro)</option>
                  </select>
                </div>
                {editIncidentType !== 'NINGUNO' && (
                  <div>
                    <label className="block text-xs font-bold uppercase text-rose-700 mb-1">Fecha del Incidente / Taller</label>
                    <input
                      type="date"
                      value={editIncidentDate}
                      onChange={(e) => setEditIncidentDate(e.target.value)}
                      className="w-full rounded-xl border border-rose-300 px-3 py-2 text-sm"
                    />
                  </div>
                )}
              </div>

              {editIncidentType !== 'NINGUNO' && (
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-600 mb-1">Detalle de Reparación o Gestión Claro</label>
                  <input
                    type="text"
                    value={editRepairDetails}
                    onChange={(e) => setEditRepairDetails(e.target.value)}
                    placeholder="Qué se está reparando o número de gestión en Claro..."
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-bold uppercase text-slate-600 mb-1">Agregar Nueva Entrada a la Bitácora</label>
                <textarea
                  rows={2}
                  placeholder="Escriba aquí cualquier novedad, cambio de SIM, actualización de equipo o seguimiento..."
                  value={newNoteText}
                  onChange={(e) => setNewNoteText(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedDevice(null)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Cerrar
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-military-700 px-5 py-2 text-sm font-semibold text-white hover:bg-military-800"
                >
                  Guardar y Registrar en Bitácora
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
