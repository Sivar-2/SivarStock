'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Globe,
  Plus,
  Search,
  Settings,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  Building2,
  Users,
  X,
  Edit3,
  Trash2,
  Download,
  FileText,
  Phone,
  Mail,
  RefreshCw,
  FileSignature,
  Share2,
  Printer,
  User,
} from 'lucide-react';
import { generateExcelBuffer, generatePdfDoc } from '@/lib/export';

const DEFAULT_CONTRACT_TYPE_LABELS: Record<string, string> = {
  LICENCIA_SAAS: 'Licencia / Software SaaS',
  CONTRATO_PROVEEDOR: 'Contrato con Proveedor',
  ENLACE_INTERNET: 'Enlace Internet / Telecom',
  ARRENDAMIENTO_EQUIPO: 'Arrendamiento (Impresoras/Equipos)',
  SOPORTE_MANTENIMIENTO: 'Póliza Soporte / Mantenimiento',
  DOMINIO_HOSTING: 'Dominio Web / Hosting / SSL',
};

export default function ServiciosDigitalesPage() {
  const [services, setServices] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [contractTypes, setContractTypes] = useState<Record<string, string>>(DEFAULT_CONTRACT_TYPE_LABELS);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const [selectedContractType, setSelectedContractType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  // Modal Crear / Editar / Renovar Servicio o Contrato con Proveedor
  const [showServiceModal, setShowServiceModal] = useState(false);
  const [editingService, setEditingService] = useState<any | null>(null);
  const [isRenewalMode, setIsRenewalMode] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    categoryId: '',
    provider: '',
    contractNumber: '',
    contractType: 'LICENCIA_SAAS',
    contactName: '',
    contactPhone: '',
    contactEmail: '',
    slaTerms: '',
    responsibleDepartmentId: '',
    chargedDepartmentId: '',
    assignedEmployeeId: '',
    planType: '',
    seatsContracted: '1',
    seatsUsed: '1',
    costPeriod: 'MENSUAL',
    amount: '',
    currency: 'GTQ',
    startDate: new Date().toISOString().split('T')[0],
    expirationDate: '',
    noExpiration: false,
    autoRenew: 'SI',
    status: 'ACTIVA',
    assignedUsersText: '',
    requiresActa: false,
    notes: '',
  });

  // Modal Ajustes: Gestionar Categorías y Tipos de Registro (Agregar y Eliminar)
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryDesc, setNewCategoryDesc] = useState('');
  const [newContractTypeName, setNewContractTypeName] = useState('');

  const fetchData = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (selectedCategoryId) params.set('categoryId', selectedCategoryId);
      if (selectedContractType) params.set('contractType', selectedContractType);
      if (filterStatus) params.set('status', filterStatus);

      const res = await fetch(`/api/digital-services?${params.toString()}`);
      const data = await res.json();
      setServices(data.services || []);
      setCategories(data.categories || []);
      setDepartments(data.departments || []);
      setEmployees(data.employees || []);
      if (data.contractTypes) setContractTypes(data.contractTypes);
    } catch (e) {
      console.error('Error cargando servicios y contratos:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedCategoryId, selectedContractType, filterStatus]);

  const handleOpenCreate = (defaultType = 'LICENCIA_SAAS') => {
    setEditingService(null);
    setIsRenewalMode(false);
    setFormData({
      name: '',
      categoryId: categories[0]?.id || '',
      provider: '',
      contractNumber: '',
      contractType: defaultType,
      contactName: '',
      contactPhone: '',
      contactEmail: '',
      slaTerms: '',
      responsibleDepartmentId: '',
      chargedDepartmentId: '',
      assignedEmployeeId: '',
      planType: '',
      seatsContracted: '1',
      seatsUsed: '1',
      costPeriod: 'MENSUAL',
      amount: '',
      currency: 'GTQ',
      startDate: new Date().toISOString().split('T')[0],
      expirationDate: '',
      noExpiration: false,
      autoRenew: 'SI',
      status: 'ACTIVA',
      assignedUsersText: '',
      requiresActa: false,
      notes: '',
    });
    setShowServiceModal(true);
  };

  const handleOpenEdit = (srv: any, renewal = false) => {
    setEditingService(srv);
    setIsRenewalMode(renewal);
    setFormData({
      name: srv.name || '',
      categoryId: srv.category_id || '',
      provider: srv.provider || '',
      contractNumber: srv.contract_number || '',
      contractType: srv.contract_type || 'LICENCIA_SAAS',
      contactName: srv.contact_name || '',
      contactPhone: srv.contact_phone || '',
      contactEmail: srv.contact_email || '',
      slaTerms: srv.sla_terms || '',
      responsibleDepartmentId: srv.responsible_department_id || '',
      chargedDepartmentId: srv.charged_department_id || '',
      assignedEmployeeId: srv.assigned_employee_id || '',
      planType: srv.plan_type || '',
      seatsContracted: String(srv.seats_contracted || 1),
      seatsUsed: String(srv.seats_used || 1),
      costPeriod: srv.cost_period || 'MENSUAL',
      amount: String(srv.amount || 0),
      currency: srv.currency || 'GTQ',
      startDate: renewal ? new Date().toISOString().split('T')[0] : srv.start_date || '',
      expirationDate: srv.expiration_date || '',
      noExpiration: Boolean(srv.no_expiration),
      autoRenew: srv.auto_renew || 'SI',
      status: renewal ? 'ACTIVA' : srv.status || 'ACTIVA',
      assignedUsersText: srv.assigned_users_text || '',
      requiresActa: false,
      notes: srv.notes || '',
    });
    setShowServiceModal(true);
  };

  const handleSaveService = async (e: React.FormEvent) => {
    e.preventDefault();
    const method = editingService ? 'PUT' : 'POST';
    const payload = editingService
      ? { id: editingService.id, ...formData, isRenewal: isRenewalMode }
      : formData;

    const res = await fetch('/api/digital-services', {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      setShowServiceModal(false);
      fetchData();
    }
  };

  const handleDeleteService = async (srv: any) => {
    if (!window.confirm(`¿Desea eliminar el contrato / licencia "${srv.name}" con proveedor ${srv.provider}?`)) return;
    const res = await fetch(`/api/digital-services?id=${srv.id}`, { method: 'DELETE' });
    if (res.ok) {
      fetchData();
    }
  };

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCategoryName.trim()) return;
    const res = await fetch('/api/digital-services', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'CREATE_CATEGORY',
        categoryName: newCategoryName,
        categoryDescription: newCategoryDesc,
      }),
    });
    if (res.ok) {
      setNewCategoryName('');
      setNewCategoryDesc('');
      fetchData();
    }
  };

  const handleDeleteCategory = async (catId: string, catName: string) => {
    if (!window.confirm(`¿Eliminar la categoría "${catName}"?`)) return;
    const res = await fetch('/api/digital-services', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'DELETE_CATEGORY',
        categoryIdToDelete: catId,
      }),
    });
    if (res.ok) fetchData();
  };

  const handleAddContractType = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newContractTypeName.trim()) return;
    const res = await fetch('/api/digital-services', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'ADD_CONTRACT_TYPE',
        typeLabel: newContractTypeName.trim(),
      }),
    });
    if (res.ok) {
      setNewContractTypeName('');
      fetchData();
    }
  };

  const handleDeleteContractType = async (key: string, label: string) => {
    if (!window.confirm(`¿Eliminar el tipo de registro "${label}"?`)) return;
    const res = await fetch('/api/digital-services', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'DELETE_CONTRACT_TYPE',
        typeKey: key,
      }),
    });
    if (res.ok) fetchData();
  };

  const totalGtqMonthly = services
    .filter((s) => s.status === 'ACTIVA' && s.currency === 'GTQ')
    .reduce((acc, s) => acc + (s.monthly_equivalent_cost || 0), 0);

  const totalUsdMonthly = services
    .filter((s) => s.status === 'ACTIVA' && s.currency === 'USD')
    .reduce((acc, s) => acc + (s.monthly_equivalent_cost || 0), 0);

  const expiringContractsCount = services.filter(
    (s) => !s.no_expiration && s.days_until_expiration !== null && s.days_until_expiration <= 45
  ).length;

  const exportColumns = [
    { key: 'contract_type', header: 'Tipo de Contrato' },
    { key: 'contract_number', header: 'No. Contrato' },
    { key: 'name', header: 'Servicio / Licencia' },
    { key: 'provider', header: 'Proveedor' },
    { key: 'assigned_employee_name', header: 'Empleado Asignado' },
    { key: 'cost_period', header: 'Ciclo' },
    { key: 'currency', header: 'Moneda' },
    { key: 'amount', header: 'Importe' },
    { key: 'expiration_date', header: 'Fecha Vencimiento' },
    { key: 'status', header: 'Estado' },
    { key: 'charged_department_name', header: 'Área Imputada' },
  ];

  const handleExportExcel = () => {
    const buf = generateExcelBuffer('Contratos Proveedores y Licencias', exportColumns, services);
    const blob = new Blob([buf as any], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `contratos_proveedores_licencias_${new Date().toISOString().slice(0, 10)}.xlsx`;
    a.click();
  };

  const handleExportPdf = () => {
    const doc = generatePdfDoc(
      'Control de Contratos con Proveedores, Licencias y Servicios',
      'Vencimiento de Contratos, Licencias con/sin renovación y Actas Digitales',
      exportColumns,
      services
    );
    doc.save(`contratos_proveedores_licencias_${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  return (
    <div className="space-y-6">
      {/* Cabecera */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2.5">
            <Globe className="h-7 w-7 text-military-700" />
            Licencias y Contratos
          </h1>
          <p className="text-sm text-slate-500">
            Control de licencias asignadas a personal (con o sin renovación), contratos con proveedores y generación de Actas Digitales en asignación o renovación.
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
            onClick={() => setShowCategoryModal(true)}
            className="flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 shadow-sm"
            title="Agregar o eliminar Categorías y Tipos de Registro"
          >
            <Settings className="h-4 w-4 text-military-700" /> Ajustes
          </button>
          <button
            onClick={() => handleOpenCreate('LICENCIA_SAAS')}
            className="flex items-center gap-2 rounded-xl bg-military-700 px-4 py-2 text-sm font-semibold text-white shadow-md hover:bg-military-800 transition"
          >
            <Plus className="h-4 w-4" /> Nueva Licencia / Contrato
          </button>
        </div>
      </div>

      {/* Tarjetas Resumen Financiero y Alertas de Vencimiento */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <span className="text-xs font-bold uppercase text-slate-400">Gasto Mensual en Quetzales</span>
          <div className="mt-1 text-2xl font-black text-slate-900">Q {totalGtqMonthly.toFixed(2)}</div>
          <span className="text-[11px] text-slate-500">Contratos y servicios activos en GTQ</span>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <span className="text-xs font-bold uppercase text-slate-400">Gasto Mensual en Dólares</span>
          <div className="mt-1 text-2xl font-black text-emerald-700">$ {totalUsdMonthly.toFixed(2)} USD</div>
          <span className="text-[11px] text-slate-500">Suscripciones internacionales</span>
        </div>

        <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-4 shadow-sm">
          <span className="text-xs font-bold uppercase text-amber-800 flex items-center justify-between">
            <span>Por Vencer / Vencidos</span>
            <AlertTriangle className="h-4 w-4 text-amber-600" />
          </span>
          <div className="mt-1 text-2xl font-black text-amber-900">{expiringContractsCount}</div>
          <span className="text-[11px] text-amber-700">Con vencimiento &le; 45 días</span>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <span className="text-xs font-bold uppercase text-slate-400">Total Licencias y Contratos</span>
          <div className="mt-1 text-2xl font-black text-military-800">{services.length}</div>
          <span className="text-[11px] text-slate-500">Con control de renovación y actas</span>
        </div>
      </div>

      {/* Filtro rápido por Tipo de Contrato / Licencia */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => setSelectedContractType('')}
          className={`rounded-xl px-3.5 py-2 text-xs font-bold transition ${
            selectedContractType === ''
              ? 'bg-military-700 text-white shadow'
              : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
          }`}
        >
          Todos ({services.length})
        </button>
        {Object.entries(contractTypes).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setSelectedContractType(key)}
            className={`rounded-xl px-3.5 py-2 text-xs font-bold transition ${
              selectedContractType === key
                ? 'bg-military-700 text-white shadow'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Barra de Búsqueda y Estado */}
      <div className="grid grid-cols-1 gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-4">
        <div className="relative sm:col-span-2">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por Licencia, Proveedor, Empleado asignado, No. Contrato..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && fetchData()}
            className="w-full rounded-xl border border-slate-200 pl-10 pr-4 py-2 text-sm"
          />
        </div>

        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
        >
          <option value="">Todos los Estados</option>
          <option value="ACTIVA">ACTIVA / VIGENTE</option>
          <option value="GRATUITA">GRATUITA</option>
          <option value="PAGO_UNICO">PAGO ÚNICO / PERPETUA</option>
          <option value="CADUCADA_INACTIVA">CADUCADA / VENCIDA</option>
        </select>

        <button
          onClick={fetchData}
          className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
        >
          Buscar
        </button>
      </div>

      {/* Tabla de Contratos con Proveedores y Licencias */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold uppercase text-slate-600">
              <tr>
                <th className="px-4 py-3.5">Licencia / Contrato</th>
                <th className="px-4 py-3.5">Proveedor y Contacto</th>
                <th className="px-4 py-3.5">Empleado / Área Asignada</th>
                <th className="px-4 py-3.5">Costo y Ciclo</th>
                <th className="px-4 py-3.5">Vencimiento / Renovación</th>
                <th className="px-4 py-3.5">Acta Digital</th>
                <th className="px-4 py-3.5 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-slate-400">
                    Cargando licencias y contratos...
                  </td>
                </tr>
              ) : services.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-slate-400">
                    No hay licencias ni contratos registrados con estos filtros.
                  </td>
                </tr>
              ) : (
                services.map((s) => {
                  const sym = s.currency === 'USD' ? '$' : 'Q';
                  const days = s.days_until_expiration;
                  const isExpiringSoon = !s.no_expiration && days !== null && days >= 0 && days <= 45;
                  const isExpired = !s.no_expiration && days !== null && days < 0;

                  return (
                    <tr key={s.id} className="hover:bg-slate-50/80 transition">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <span className="rounded bg-military-50 px-2 py-0.5 text-[10px] font-bold text-military-800 border border-military-200">
                            {contractTypes[s.contract_type] || s.category_name || 'Licencia / Contrato'}
                          </span>
                          {s.contract_number && (
                            <span className="font-mono text-[11px] font-bold text-slate-600">#{s.contract_number}</span>
                          )}
                        </div>
                        <div className="font-bold text-slate-900 mt-1">{s.name}</div>
                        {s.sla_terms && <div className="text-[11px] text-slate-500 mt-0.5">SLA: {s.sla_terms}</div>}
                      </td>

                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-800">{s.provider}</div>
                        {s.contact_name && <div className="text-xs text-slate-500">{s.contact_name}</div>}
                        <div className="flex flex-wrap gap-2 text-[11px] text-slate-500 mt-0.5">
                          {s.contact_phone && (
                            <span className="flex items-center gap-0.5">
                              <Phone className="h-3 w-3" /> {s.contact_phone}
                            </span>
                          )}
                          {s.contact_email && (
                            <span className="flex items-center gap-0.5">
                              <Mail className="h-3 w-3" /> {s.contact_email}
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="px-4 py-3 text-xs">
                        {s.assigned_employee_name ? (
                          <div className="font-bold text-indigo-800 flex items-center gap-1">
                            <User className="h-3.5 w-3.5 text-indigo-600" />
                            {s.assigned_employee_name}
                          </div>
                        ) : null}
                        <div className="font-semibold text-slate-700 flex items-center gap-1 mt-0.5">
                          <Building2 className="h-3.5 w-3.5 text-slate-400" />
                          {s.charged_department_name || s.responsible_department_name || 'General'}
                        </div>
                        <div className="text-slate-500 flex items-center gap-1 mt-0.5">
                          <Users className="h-3.5 w-3.5 text-slate-400" />
                          {s.seats_used} / {s.seats_contracted} cupos
                        </div>
                      </td>

                      <td className="px-4 py-3">
                        {s.cost_period === 'GRATUITO' ? (
                          <span className="font-bold text-emerald-700 text-xs">GRATUITO</span>
                        ) : (
                          <div>
                            <div className="font-bold text-slate-900">
                              {sym} {Number(s.amount || 0).toFixed(2)}{' '}
                              <span className="text-[10px] text-slate-500">{s.currency}</span>
                            </div>
                            <span className="text-[11px] text-slate-500">{s.cost_period}</span>
                          </div>
                        )}
                      </td>

                      <td className="px-4 py-3 text-xs">
                        {s.no_expiration ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2.5 py-0.5 text-[11px] font-bold text-indigo-800 border border-indigo-200">
                            Sin renovación / Perpetua
                          </span>
                        ) : s.expiration_date ? (
                          <div>
                            <div className="font-medium text-slate-800 flex items-center gap-1">
                              <Calendar className="h-3.5 w-3.5 text-slate-400" />
                              {s.expiration_date}
                            </div>
                            {isExpired ? (
                              <span className="text-[11px] font-bold text-rose-600 flex items-center gap-1 mt-0.5">
                                <XCircle className="h-3 w-3" /> Vencido hace {Math.abs(days)} días
                              </span>
                            ) : isExpiringSoon ? (
                              <span className="text-[11px] font-bold text-amber-600 flex items-center gap-1 mt-0.5">
                                <AlertTriangle className="h-3 w-3" /> Vence en {days} días
                              </span>
                            ) : (
                              <span className="text-[11px] text-emerald-600 mt-0.5 block">
                                Vigente ({days} días restantes)
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">Sin fecha definida</span>
                        )}
                      </td>

                      <td className="px-4 py-3 text-xs">
                        {s.acta_code ? (
                          <div className="space-y-1">
                            <span className="font-mono font-bold text-slate-900 block">{s.acta_code}</span>
                            <div className="flex items-center gap-1">
                              <Link
                                href={`/acta/${s.acta_code}?token=${s.acta_token || ''}`}
                                target="_blank"
                                className="inline-flex items-center gap-1 rounded bg-slate-900 px-2 py-0.5 text-[10px] font-bold text-white hover:bg-slate-800"
                              >
                                <Printer className="h-2.5 w-2.5" /> PDF
                              </Link>
                              <button
                                type="button"
                                onClick={() => {
                                  const url = `${window.location.origin}/acta/${s.acta_code}?token=${s.acta_token || ''}`;
                                  const phone = (s.assigned_employee_phone || '').replace(/[^0-9]/g, '');
                                  const text = `Hola *${s.assigned_employee_name || 'Colaborador'}*, te enviamos el Acta Digital *${s.acta_code}* por tu licencia *${s.name}* en Fábrica de Persianas y Complementos, S.A.:\n${url}`;
                                  window.open(
                                    phone
                                      ? `https://wa.me/${phone.startsWith('502') ? phone : `502${phone}`}?text=${encodeURIComponent(text)}`
                                      : `https://wa.me/?text=${encodeURIComponent(text)}`,
                                    '_blank'
                                  );
                                }}
                                className="inline-flex items-center gap-1 rounded bg-emerald-600 px-2 py-0.5 text-[10px] font-bold text-white hover:bg-emerald-700"
                              >
                                <Share2 className="h-2.5 w-2.5" /> WA
                              </button>
                            </div>
                          </div>
                        ) : (
                          <span className="text-[11px] text-slate-400">Sin acta</span>
                        )}
                      </td>

                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleOpenEdit(s, true)}
                            className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs font-bold text-emerald-800 hover:bg-emerald-100"
                            title="Renovar licencia o contrato (permite elegir si enviar nueva Acta)"
                          >
                            <RefreshCw className="h-3.5 w-3.5 text-emerald-700" /> Renovar
                          </button>
                          <button
                            onClick={() => handleOpenEdit(s, false)}
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                          >
                            <Edit3 className="h-3.5 w-3.5 text-military-700" /> Editar
                          </button>
                          <button
                            onClick={() => handleDeleteService(s)}
                            className="inline-flex items-center justify-center rounded-lg border border-rose-200 bg-rose-50 p-1.5 text-rose-600 hover:bg-rose-100"
                            title="Eliminar contrato o licencia"
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

      {/* Modal Crear / Editar / Renovar Licencia o Contrato */}
      {showServiceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-3xl rounded-2xl bg-white p-6 shadow-2xl max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <h2 className="text-lg font-bold text-slate-900">
                {isRenewalMode
                  ? `Renovar Licencia / Contrato: ${editingService?.name}`
                  : editingService
                  ? 'Editar Contrato con Proveedor / Licencia'
                  : 'Registrar Nueva Licencia o Contrato con Proveedor'}
              </h2>
              <button onClick={() => setShowServiceModal(false)} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveService} className="mt-4 space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-600 mb-1">Tipo de Registro *</label>
                  <select
                    value={formData.contractType}
                    onChange={(e) => setFormData({ ...formData, contractType: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold"
                  >
                    {Object.entries(contractTypes).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-slate-600 mb-1">No. de Contrato / Póliza</label>
                  <input
                    type="text"
                    placeholder="Ej. CNT-2026-014"
                    value={formData.contractNumber}
                    onChange={(e) => setFormData({ ...formData, contractNumber: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-slate-600 mb-1">Categoría</label>
                  <select
                    value={formData.categoryId}
                    onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  >
                    <option value="">-- General --</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-600 mb-1">
                    Nombre de la Licencia / Contrato / Servicio *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. Licencia Microsoft 365 Business / Enlace Fibra / Antivirus"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-slate-600 mb-1">Empresa Proveedora *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. Microsoft, Claro, PBS Guatemala, Adobe..."
                    value={formData.provider}
                    onChange={(e) => setFormData({ ...formData, provider: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  />
                </div>
              </div>

              {/* Asignación a Empleado y Opción de Generar Acta Digital */}
              <div className="rounded-xl border border-indigo-200 bg-indigo-50/50 p-4 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-indigo-950 mb-1">
                      Empleado Asignado a esta Licencia (Opcional)
                    </label>
                    <select
                      value={formData.assignedEmployeeId}
                      onChange={(e) => {
                        const emp = employees.find((x) => x.id === e.target.value);
                        setFormData({
                          ...formData,
                          assignedEmployeeId: e.target.value,
                          assignedUsersText: emp ? `${emp.full_name} (${emp.email || emp.employee_code})` : formData.assignedUsersText,
                        });
                      }}
                      className="w-full rounded-xl border border-indigo-200 bg-white px-3 py-2 text-sm"
                    >
                      <option value="">-- Licencia General de Área / Múltiples Usuarios --</option>
                      {employees.map((emp) => (
                        <option key={emp.id} value={emp.id}>
                          {emp.full_name} ({emp.employee_code})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-indigo-950 mb-1">Departamento / Área Imputada</label>
                    <select
                      value={formData.chargedDepartmentId}
                      onChange={(e) => setFormData({ ...formData, chargedDepartmentId: e.target.value })}
                      className="w-full rounded-xl border border-indigo-200 bg-white px-3 py-2 text-sm"
                    >
                      <option value="">-- General --</option>
                      {departments.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <label className="flex items-start gap-2.5 cursor-pointer pt-1">
                  <input
                    type="checkbox"
                    checked={formData.requiresActa}
                    onChange={(e) => setFormData({ ...formData, requiresActa: e.target.checked })}
                    className="mt-0.5 h-4 w-4 rounded border-indigo-300 text-indigo-600"
                  />
                  <div>
                    <span className="text-xs font-bold text-indigo-950 flex items-center gap-1.5">
                      <FileSignature className="h-4 w-4 text-indigo-700" />
                      {isRenewalMode
                        ? '¿Desea generar y enviar una nueva Acta Digital por esta Renovación?'
                        : '¿Generar Acta Digital de Entrega para firma del empleado receptor?'}
                    </span>
                    <span className="text-[11px] text-indigo-800 block">
                      Si lo marcas, se generará el Acta Oficial de 2 páginas lista para enviar por WhatsApp o Correo.
                    </span>
                  </div>
                </label>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-600 mb-1">Ciclo de Pago *</label>
                  <select
                    value={formData.costPeriod}
                    onChange={(e) => setFormData({ ...formData, costPeriod: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  >
                    <option value="MENSUAL">MENSUAL</option>
                    <option value="ANUAL">ANUAL</option>
                    <option value="UNICO">PAGO ÚNICO / PERPETUA</option>
                    <option value="GRATUITO">GRATUITO (Costo 0)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-slate-600 mb-1">Moneda *</label>
                  <select
                    value={formData.currency}
                    onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold"
                  >
                    <option value="GTQ">Quetzales (GTQ - Q)</option>
                    <option value="USD">Dólares (USD - $)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-slate-600 mb-1">Importe ({formData.currency})</label>
                  <input
                    type="number"
                    step="0.01"
                    disabled={formData.costPeriod === 'GRATUITO'}
                    value={formData.costPeriod === 'GRATUITO' ? '0' : formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-600 mb-1">Inicio / Renovación</label>
                  <input
                    type="date"
                    value={formData.startDate}
                    onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-amber-800 mb-1">Fecha Vencimiento</label>
                  <input
                    type="date"
                    disabled={formData.noExpiration}
                    value={formData.noExpiration ? '' : formData.expirationDate}
                    onChange={(e) => setFormData({ ...formData, expirationDate: e.target.value })}
                    className="w-full rounded-xl border border-amber-300 px-3 py-2 text-sm disabled:bg-slate-100"
                  />
                </div>

                <div className="flex items-end pb-1.5">
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-700">
                    <input
                      type="checkbox"
                      checked={formData.noExpiration}
                      onChange={(e) => setFormData({ ...formData, noExpiration: e.target.checked })}
                      className="h-4 w-4 rounded border-slate-300 text-military-700"
                    />
                    <span>Licencia Sin Renovación / Sin Vencimiento</span>
                  </label>
                </div>
              </div>

              {/* Datos de Contacto del Proveedor */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Ejecutivo / Contacto</label>
                  <input
                    type="text"
                    placeholder="Nombre del asesor"
                    value={formData.contactName}
                    onChange={(e) => setFormData({ ...formData, contactName: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Teléfono Proveedor</label>
                  <input
                    type="text"
                    placeholder="+502 2428-0000"
                    value={formData.contactPhone}
                    onChange={(e) => setFormData({ ...formData, contactPhone: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Correo Proveedor</label>
                  <input
                    type="email"
                    placeholder="soporte@proveedor.com"
                    value={formData.contactEmail}
                    onChange={(e) => setFormData({ ...formData, contactEmail: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-600 mb-1">
                  Detalle de Usuarios Asignados / Observaciones
                </label>
                <textarea
                  rows={2}
                  placeholder="Correos asignados, detalles del contrato..."
                  value={formData.assignedUsersText}
                  onChange={(e) => setFormData({ ...formData, assignedUsersText: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowServiceModal(false)}
                  className="rounded-xl px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-military-700 px-5 py-2 text-sm font-semibold text-white hover:bg-military-800"
                >
                  {isRenewalMode ? 'Confirmar Renovación' : 'Guardar Licencia / Contrato'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Ajustes: Agregar y Eliminar Categorías y Tipos de Registro */}
      {showCategoryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Settings className="h-5 w-5 text-military-700" />
                Ajustes de Licencias y Contratos (Categorías y Tipos de Registro)
              </h2>
              <button onClick={() => setShowCategoryModal(false)} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Columna 1: Categorías */}
              <div className="space-y-3">
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-700">
                  1. Categorías de Licencias y Contratos
                </h3>
                <form onSubmit={handleCreateCategory} className="space-y-2">
                  <input
                    type="text"
                    required
                    placeholder="Nueva categoría (ej. Licencias Diseño, Antivirus...)"
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs"
                  />
                  <input
                    type="text"
                    placeholder="Descripción opcional..."
                    value={newCategoryDesc}
                    onChange={(e) => setNewCategoryDesc(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs"
                  />
                  <button
                    type="submit"
                    className="w-full rounded-xl bg-military-700 py-2 text-xs font-bold text-white hover:bg-military-800"
                  >
                    + Agregar Categoría
                  </button>
                </form>

                <div className="max-h-56 overflow-y-auto space-y-1.5 pt-2 border-t border-slate-100">
                  {categories.map((c) => (
                    <div
                      key={c.id}
                      className="flex justify-between items-center rounded-xl bg-slate-50 px-3 py-2 text-xs border border-slate-100"
                    >
                      <div>
                        <span className="font-bold text-slate-800 block">{c.name}</span>
                        <span className="text-[10px] text-slate-500">{c.services_count} registros</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeleteCategory(c.id, c.name)}
                        className="rounded-lg p-1.5 text-rose-600 hover:bg-rose-50"
                        title="Eliminar categoría"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Columna 2: Tipos de Registro */}
              <div className="space-y-3">
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-700">
                  2. Tipos de Registro (Pestañas de Filtro)
                </h3>
                <form onSubmit={handleAddContractType} className="space-y-2">
                  <input
                    type="text"
                    required
                    placeholder="Nuevo tipo (ej. Suscripción Cloud, Certificados SSL...)"
                    value={newContractTypeName}
                    onChange={(e) => setNewContractTypeName(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs"
                  />
                  <button
                    type="submit"
                    className="w-full rounded-xl bg-indigo-600 py-2 text-xs font-bold text-white hover:bg-indigo-700"
                  >
                    + Agregar Tipo de Registro
                  </button>
                </form>

                <div className="max-h-56 overflow-y-auto space-y-1.5 pt-2 border-t border-slate-100">
                  {Object.entries(contractTypes).map(([key, label]) => (
                    <div
                      key={key}
                      className="flex justify-between items-center rounded-xl bg-slate-50 px-3 py-2 text-xs border border-slate-100"
                    >
                      <div>
                        <span className="font-bold text-slate-800 block">{label}</span>
                        <span className="font-mono text-[10px] text-slate-400">{key}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeleteContractType(key, label)}
                        className="rounded-lg p-1.5 text-rose-600 hover:bg-rose-50"
                        title="Eliminar tipo de registro"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
