'use client';

import React, { useEffect, useState } from 'react';
import {
  Smartphone,
  Plus,
  Search,
  Phone,
  Hash,
  Calendar,
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
  Wifi,
  CreditCard,
  ShieldAlert,
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
  const [filterCarrier, setFilterCarrier] = useState('');
  const [filterContract, setFilterContract] = useState(''); // '', 'EXPIRING', 'EXPIRED'

  // Modal Crear / Editar Celular y Línea
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingDeviceId, setEditingDeviceId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    brand: '',
    model: '',
    serialNumber: '',
    macAddress: '',
    employeeId: '',
    departmentId: '',
    phoneNumber: '+502 ',
    imei: '',
    simIccid: '',
    carrier: 'Tigo',
    planName: '',
    monthlyCost: '',
    contractNumber: '',
    contractStartDate: new Date().toISOString().split('T')[0],
    contractEndDate: '',
    renewalAlertDays: '30',
    deliveryDate: new Date().toISOString().split('T')[0],
    status: 'ASIGNADO',
    initialNote: '',
  });
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Modal Detalle, Historial de Notas y Reasignación Rápida
  const [selectedDevice, setSelectedDevice] = useState<any | null>(null);
  const [newNoteText, setNewNoteText] = useState('');
  const [editStatus, setEditStatus] = useState('');
  const [editEmployeeId, setEditEmployeeId] = useState('');
  const [editContractEndDate, setEditContractEndDate] = useState('');

  const fetchData = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (filterDept) params.set('departmentId', filterDept);
      if (filterStatus) params.set('status', filterStatus);
      if (filterCarrier) params.set('carrier', filterCarrier);
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
  }, [filterDept, filterStatus, filterCarrier, filterContract]);

  const openCreateModal = () => {
    setEditingDeviceId(null);
    setFormError('');
    setFormData({
      brand: '',
      model: '',
      serialNumber: '',
      macAddress: '',
      employeeId: '',
      departmentId: '',
      phoneNumber: '+502 ',
      imei: '',
      simIccid: '',
      carrier: 'Tigo',
      planName: '',
      monthlyCost: '',
      contractNumber: '',
      contractStartDate: new Date().toISOString().split('T')[0],
      contractEndDate: '',
      renewalAlertDays: '30',
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
      brand: d.brand || '',
      model: d.model || '',
      serialNumber: d.serial_number || '',
      macAddress: d.mac_address || '',
      employeeId: d.employee_id || '',
      departmentId: d.department_id || '',
      phoneNumber: d.phone_number || '+502 ',
      imei: d.imei || '',
      simIccid: d.sim_iccid || '',
      carrier: d.carrier || 'Tigo',
      planName: d.plan_name || '',
      monthlyCost: d.monthly_cost ? String(d.monthly_cost) : '',
      contractNumber: d.contract_number || '',
      contractStartDate: d.contract_start_date || d.delivery_date || '',
      contractEndDate: d.contract_end_date || '',
      renewalAlertDays: d.renewal_alert_days ? String(d.renewal_alert_days) : '30',
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
    setEditContractEndDate(device.contract_end_date || '');
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
        status: editStatus,
        contractEndDate: editContractEndDate || null,
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
    { key: 'carrier', header: 'Operador' },
    { key: 'phone_number', header: 'Número Línea' },
    { key: 'plan_name', header: 'Plan Contratado' },
    { key: 'monthly_cost', header: 'Cuota Mensual (Q)' },
    { key: 'contract_number', header: 'No. Contrato' },
    { key: 'contract_end_date', header: 'Vencimiento Contrato' },
    { key: 'brand', header: 'Marca' },
    { key: 'model', header: 'Modelo' },
    { key: 'imei', header: 'IMEI' },
    { key: 'serial_number', header: 'No. Serie' },
    { key: 'mac_address', header: 'MAC Wi-Fi' },
    { key: 'employee_name', header: 'Empleado Asignado' },
    { key: 'department_name', header: 'Departamento' },
    { key: 'delivery_date', header: 'Fecha Entrega' },
    { key: 'status', header: 'Estado' },
  ];

  const handleExportExcel = () => {
    const buf = generateExcelBuffer('Control de Celulares y Contratos', exportColumns, devices);
    const blob = new Blob([buf as any], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `celulares_lineas_contratos_${new Date().toISOString().slice(0, 10)}.xlsx`;
    a.click();
  };

  const handleExportPdf = () => {
    const doc = generatePdfDoc(
      'Control de Líneas Telefónicas, Dispositivos y Contratos',
      'Registro de IMEI, Serie, MAC, Planes y Vencimiento de Contratos Corporativos',
      exportColumns,
      devices
    );
    doc.save(`celulares_lineas_contratos_${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  // Métricas de resumen
  const totalLines = devices.length;
  const assignedCount = devices.filter((d) => d.status === 'ASIGNADO').length;
  const availableCount = devices.filter((d) => d.status === 'DISPONIBLE').length;
  const expiringOrExpiredCount = devices.filter(
    (d) => d.days_until_contract_end !== null && d.days_until_contract_end <= 45
  ).length;
  const totalMonthlySpend = devices
    .filter((d) => d.status !== 'DADO_DE_BAJA')
    .reduce((acc, d) => acc + Number(d.monthly_cost || 0), 0);

  const getContractBadge = (d: any) => {
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

  return (
    <div className="space-y-6">
      {/* Encabezado */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2.5">
            <Smartphone className="h-7 w-7 text-military-700" />
            Control de Líneas Telefónicas, Celulares y Contratos
          </h1>
          <p className="text-sm text-slate-500">
            Gestión de líneas corporativas (Claro / Tigo), control de vencimiento de contratos, IMEI, Serie, MAC, ICCID y empleado asignado.
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
            <Plus className="h-4 w-4" /> Registrar Celular / Línea
          </button>
        </div>
      </div>

      {/* Tarjetas KPI de Líneas y Contratos */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <div
          onClick={() => { setFilterStatus(''); setFilterContract(''); }}
          className="cursor-pointer rounded-2xl border border-slate-200 bg-white p-4 shadow-sm hover:border-military-500 transition"
        >
          <div className="text-xs font-bold uppercase text-slate-400">Total Líneas / Equipos</div>
          <div className="mt-1 text-2xl font-black text-slate-900">{totalLines}</div>
          <div className="mt-1 text-[11px] text-slate-500">Parque móvil registrado</div>
        </div>

        <div
          onClick={() => { setFilterStatus('ASIGNADO'); setFilterContract(''); }}
          className="cursor-pointer rounded-2xl border border-emerald-200 bg-emerald-50/40 p-4 shadow-sm hover:border-emerald-500 transition"
        >
          <div className="text-xs font-bold uppercase text-emerald-700">Asignados a Empleados</div>
          <div className="mt-1 text-2xl font-black text-emerald-800">{assignedCount}</div>
          <div className="mt-1 text-[11px] text-emerald-600">Líneas activas en uso</div>
        </div>

        <div
          onClick={() => { setFilterStatus('DISPONIBLE'); setFilterContract(''); }}
          className="cursor-pointer rounded-2xl border border-sky-200 bg-sky-50/40 p-4 shadow-sm hover:border-sky-500 transition"
        >
          <div className="text-xs font-bold uppercase text-sky-700">Disponibles en Bodega</div>
          <div className="mt-1 text-2xl font-black text-sky-800">{availableCount}</div>
          <div className="mt-1 text-[11px] text-sky-600">Listos para entrega</div>
        </div>

        <div
          onClick={() => { setFilterContract(filterContract === 'EXPIRING' ? '' : 'EXPIRING'); }}
          className="cursor-pointer rounded-2xl border border-amber-200 bg-amber-50/50 p-4 shadow-sm hover:border-amber-500 transition"
        >
          <div className="flex items-center justify-between text-xs font-bold uppercase text-amber-800">
            <span>Contratos por Vencer</span>
            <AlertTriangle className="h-4 w-4 text-amber-600" />
          </div>
          <div className="mt-1 text-2xl font-black text-amber-900">{expiringOrExpiredCount}</div>
          <div className="mt-1 text-[11px] text-amber-700">Vencidos o &le; 45 días</div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-900 p-4 text-white shadow-sm">
          <div className="text-xs font-bold uppercase text-emerald-400">Facturación Mensual</div>
          <div className="mt-1 text-2xl font-black">
            Q {totalMonthlySpend.toLocaleString('es-GT', { minimumFractionDigits: 2 })}
          </div>
          <div className="mt-1 text-[11px] text-slate-400">Planes móviles activos</div>
        </div>
      </div>

      {/* Barra de Filtros */}
      <div className="grid grid-cols-1 gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-6">
        <div className="relative sm:col-span-2">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por Teléfono, IMEI, Serie, MAC, Contrato o Empleado..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && fetchData()}
            className="w-full rounded-xl border border-slate-200 pl-10 pr-4 py-2 text-sm focus:border-military-600 focus:outline-none"
          />
        </div>

        <select
          value={filterCarrier}
          onChange={(e) => setFilterCarrier(e.target.value)}
          className="rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-military-600 focus:outline-none"
        >
          <option value="">Todos los Operadores</option>
          <option value="Tigo">Tigo Business</option>
          <option value="Claro">Claro Empresas</option>
          <option value="Otro">Otro Operador</option>
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

        <select
          value={filterContract}
          onChange={(e) => setFilterContract(e.target.value)}
          className="rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-military-600 focus:outline-none"
        >
          <option value="">Vigencia: Todos los Contratos</option>
          <option value="EXPIRING">Próximos a vencer (&le; 45 días)</option>
          <option value="EXPIRED">Contratos Vencidos</option>
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
                <th className="px-4 py-3.5">Código / Equipo</th>
                <th className="px-4 py-3.5">Línea / Operador / Plan</th>
                <th className="px-4 py-3.5">IMEI / Serie / MAC</th>
                <th className="px-4 py-3.5">Empleado & Área</th>
                <th className="px-4 py-3.5">Contrato & Vencimiento</th>
                <th className="px-4 py-3.5">Estado</th>
                <th className="px-4 py-3.5 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-slate-400">
                    Cargando parque de celulares y contratos de líneas...
                  </td>
                </tr>
              ) : devices.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-slate-400">
                    No hay dispositivos o líneas móviles registradas con estos criterios.
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
                        <div className="font-semibold text-slate-900 mt-1">{d.brand} {d.model}</div>
                        <div className="text-[11px] text-slate-500">Entregado: {d.delivery_date}</div>
                      </td>

                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5 font-semibold text-emerald-700">
                          <Phone className="h-3.5 w-3.5" />
                          {d.phone_number}
                        </div>
                        <div className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-600">
                          <span className="rounded bg-slate-100 px-1.5 py-0.5 font-bold text-slate-700">
                            {d.carrier || 'Tigo'}
                          </span>
                          {d.plan_name && <span className="truncate max-w-[140px]">{d.plan_name}</span>}
                        </div>
                        {Number(d.monthly_cost) > 0 && (
                          <div className="mt-0.5 text-xs font-bold text-slate-800">
                            Q {Number(d.monthly_cost).toFixed(2)} / mes
                          </div>
                        )}
                      </td>

                      <td className="px-4 py-3 font-mono text-xs text-slate-600 space-y-0.5">
                        <div><span className="font-bold text-slate-400">IMEI:</span> {d.imei}</div>
                        {d.serial_number && <div><span className="font-bold text-slate-400">S/N:</span> {d.serial_number}</div>}
                        {d.mac_address && <div><span className="font-bold text-slate-400">MAC:</span> {d.mac_address}</div>}
                        {d.sim_iccid && <div><span className="font-bold text-slate-400">SIM:</span> {d.sim_iccid}</div>}
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
                      </td>

                      <td className="px-4 py-3">
                        {getContractBadge(d)}
                        {d.contract_number && (
                          <div className="mt-1 text-[11px] font-mono text-slate-500">
                            Contrato: {d.contract_number}
                          </div>
                        )}
                        {lastNote && (
                          <div className="mt-1 text-[11px] text-slate-500 truncate max-w-[180px]" title={lastNote.note}>
                            Nota: &ldquo;{lastNote.note}&rdquo;
                          </div>
                        )}
                      </td>

                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold ${
                            d.status === 'ASIGNADO'
                              ? 'bg-emerald-100 text-emerald-800'
                              : d.status === 'DISPONIBLE'
                              ? 'bg-sky-100 text-sky-800'
                              : d.status === 'DEVOLUCION_PENDIENTE'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {d.status}
                        </span>
                      </td>

                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => openEditModal(d)}
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition"
                            title="Editar dispositivo, línea, IMEI, MAC o fecha de contrato"
                          >
                            <Edit3 className="h-3.5 w-3.5 text-military-700" />
                            Editar
                          </button>
                          <button
                            onClick={() => openNotesModal(d)}
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition"
                            title="Bitácora de notas y reasignación rápida"
                          >
                            <MessageSquarePlus className="h-3.5 w-3.5 text-sky-600" />
                            Bitácora
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

      {/* Modal: Registrar o Editar Celular y Contrato de Línea */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Smartphone className="h-5 w-5 text-military-700" />
                {editingDeviceId ? 'Editar Dispositivo Móvil y Contrato de Línea' : 'Registrar Nuevo Celular y Línea Corporativa'}
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

              {/* Bloque 1: Datos de la Línea y Contrato con Operador */}
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-4 space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-900 flex items-center gap-1.5">
                  <Phone className="h-4 w-4 text-emerald-700" /> 1. Datos de Línea Telefónica y Vencimiento de Contrato
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
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                    >
                      <option value="Tigo">Tigo Business</option>
                      <option value="Claro">Claro Empresas</option>
                      <option value="Otro">Otro</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase text-slate-600 mb-1">Cuota Mensual (Q)</label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="Ej. 275.00"
                      value={formData.monthlyCost}
                      onChange={(e) => setFormData({ ...formData, monthlyCost: e.target.value })}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold uppercase text-slate-600 mb-1">Plan Contratado</label>
                    <input
                      type="text"
                      placeholder="Ej. Plan Corporativo Ilimitado 35GB"
                      value={formData.planName}
                      onChange={(e) => setFormData({ ...formData, planName: e.target.value })}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase text-slate-600 mb-1">No. Contrato / Anexo</label>
                    <input
                      type="text"
                      placeholder="Ej. CTR-TIGO-2025"
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
              </div>

              {/* Bloque 2: Identificadores Técnicos del Dispositivo (IMEI, Serie, MAC, SIM) */}
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <Hash className="h-4 w-4 text-slate-600" /> 2. Especificaciones e Identificadores Únicos (IMEI, Serie, MAC)
                </h3>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-bold uppercase text-slate-600 mb-1">Marca *</label>
                    <input
                      type="text"
                      required
                      placeholder="Ej. Samsung, Apple, Xiaomi"
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
                      placeholder="Ej. Galaxy A55 5G / iPhone 15"
                      value={formData.model}
                      onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-bold uppercase text-slate-600 mb-1">Código IMEI (Único) *</label>
                    <input
                      type="text"
                      required
                      placeholder="15 dígitos ej. 358901092837461"
                      value={formData.imei}
                      onChange={(e) => setFormData({ ...formData, imei: e.target.value })}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase text-slate-600 mb-1">Número de Serie (S/N)</label>
                    <input
                      type="text"
                      placeholder="Ej. R58W20abcde"
                      value={formData.serialNumber}
                      onChange={(e) => setFormData({ ...formData, serialNumber: e.target.value })}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-bold uppercase text-slate-600 mb-1">Dirección MAC Wi-Fi</label>
                    <input
                      type="text"
                      placeholder="Ej. A4:83:E7:2F:91:0B"
                      value={formData.macAddress}
                      onChange={(e) => setFormData({ ...formData, macAddress: e.target.value })}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase text-slate-600 mb-1">SIM / ICCID</label>
                    <input
                      type="text"
                      placeholder="Ej. 8950201..."
                      value={formData.simIccid}
                      onChange={(e) => setFormData({ ...formData, simIccid: e.target.value })}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* Bloque 3: Asignación a Empleado y Departamento */}
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
                  <label className="block text-xs font-bold uppercase text-slate-600 mb-1">Fecha de Entrega *</label>
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
                  {editingDeviceId ? 'Agregar Nota a la Bitácora (Opcional)' : 'Nota Inicial de Entrega (Estado, cargador, estuche, etc.)'}
                </label>
                <textarea
                  rows={2}
                  placeholder="Ej. Se entrega con cargador original 25W, protector y chip corporativo activo..."
                  value={formData.initialNote}
                  onChange={(e) => setFormData({ ...formData, initialNote: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="rounded-xl px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-xl bg-military-700 px-5 py-2 text-sm font-semibold text-white hover:bg-military-800 disabled:opacity-50"
                >
                  {submitting ? 'Guardando...' : editingDeviceId ? 'Guardar Cambios' : 'Guardar Celular y Línea'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Historial de Notas y Reasignación Rápida */}
      {selectedDevice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <span className="font-mono text-xs font-bold text-military-700">{selectedDevice.device_code}</span>
                <h2 className="text-lg font-bold text-slate-900">
                  {selectedDevice.brand} {selectedDevice.model} • {selectedDevice.phone_number}
                </h2>
              </div>
              <button onClick={() => setSelectedDevice(null)} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-4 space-y-4">
              <div className="rounded-xl bg-slate-50 p-3 text-xs text-slate-600 grid grid-cols-2 sm:grid-cols-3 gap-2">
                <div><strong>Operador:</strong> {selectedDevice.carrier || 'Tigo'}</div>
                <div><strong>IMEI:</strong> <span className="font-mono">{selectedDevice.imei}</span></div>
                <div><strong>No. Serie:</strong> <span className="font-mono">{selectedDevice.serial_number || 'N/A'}</span></div>
                <div><strong>MAC Wi-Fi:</strong> <span className="font-mono">{selectedDevice.mac_address || 'N/A'}</span></div>
                <div><strong>Plan:</strong> {selectedDevice.plan_name || 'Estándar'}</div>
                <div><strong>Vence Contrato:</strong> {selectedDevice.contract_end_date || 'No definido'}</div>
              </div>

              {/* Historial de notas */}
              <div>
                <h3 className="text-xs font-bold uppercase text-slate-500 mb-2">Historial de Notas y Novedades</h3>
                <div className="max-h-48 overflow-y-auto space-y-2 rounded-xl border border-slate-200 p-3 bg-slate-50/50">
                  {(!selectedDevice.notesHistory || selectedDevice.notesHistory.length === 0) ? (
                    <p className="text-xs italic text-slate-400">Sin notas registradas aún.</p>
                  ) : (
                    selectedDevice.notesHistory.map((n: any, idx: number) => (
                      <div key={idx} className="rounded-lg bg-white p-2.5 shadow-sm border border-slate-100 text-xs">
                        <div className="flex justify-between text-[11px] font-bold text-slate-500 mb-1">
                          <span>{n.author || 'Administrador'}</span>
                          <span>{n.date}</span>
                        </div>
                        <p className="text-slate-800">{n.note}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Formulario para añadir nota o reasignar */}
              <form onSubmit={handleUpdateDeviceNotes} className="space-y-3 border-t border-slate-100 pt-3">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div>
                    <label className="block text-xs font-bold uppercase text-slate-600 mb-1">Empleado Asignado</label>
                    <select
                      value={editEmployeeId}
                      onChange={(e) => setEditEmployeeId(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                    >
                      <option value="">-- En Bodega (Sin asignar) --</option>
                      {employees.map((emp) => (
                        <option key={emp.id} value={emp.id}>{emp.full_name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase text-slate-600 mb-1">Estado del Equipo</label>
                    <select
                      value={editStatus}
                      onChange={(e) => setEditStatus(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                    >
                      <option value="ASIGNADO">ASIGNADO</option>
                      <option value="DISPONIBLE">DISPONIBLE (BODEGA)</option>
                      <option value="DEVOLUCION_PENDIENTE">DEVOLUCIÓN PENDIENTE</option>
                      <option value="EN_REPARACION">EN REPARACIÓN</option>
                      <option value="DADO_DE_BAJA">DADO DE BAJA</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase text-slate-600 mb-1">Vencimiento Contrato</label>
                    <input
                      type="date"
                      value={editContractEndDate}
                      onChange={(e) => setEditContractEndDate(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-slate-600 mb-1">Agregar Nueva Nota al Historial</label>
                  <textarea
                    rows={2}
                    placeholder="Escribir observación, renovación de contrato, cambio de pantalla, reasignación..."
                    value={newNoteText}
                    onChange={(e) => setNewNoteText(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setSelectedDevice(null)}
                    className="rounded-xl px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
                  >
                    Cerrar
                  </button>
                  <button
                    type="submit"
                    className="rounded-xl bg-military-700 px-5 py-2 text-sm font-semibold text-white hover:bg-military-800"
                  >
                    Guardar Actualización
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
