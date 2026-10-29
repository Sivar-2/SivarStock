'use client';

import React, { useEffect, useState } from 'react';
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
  Briefcase,
  Phone,
  Mail,
} from 'lucide-react';
import { generateExcelBuffer, generatePdfDoc } from '@/lib/export';

const CONTRACT_TYPE_LABELS: Record<string, string> = {
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
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const [selectedContractType, setSelectedContractType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  // Modal Crear / Editar Servicio o Contrato con Proveedor
  const [showServiceModal, setShowServiceModal] = useState(false);
  const [editingService, setEditingService] = useState<any | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    categoryId: '',
    provider: '',
    contractNumber: '',
    contractType: 'CONTRATO_PROVEEDOR',
    contactName: '',
    contactPhone: '',
    contactEmail: '',
    slaTerms: '',
    responsibleDepartmentId: '',
    chargedDepartmentId: '',
    planType: '',
    seatsContracted: '1',
    seatsUsed: '1',
    costPeriod: 'MENSUAL',
    amount: '',
    currency: 'GTQ',
    startDate: new Date().toISOString().split('T')[0],
    expirationDate: '',
    autoRenew: 'SI',
    status: 'ACTIVA',
    assignedUsersText: '',
    notes: '',
  });

  // Modal Tuerca: Gestionar Categorías
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryDesc, setNewCategoryDesc] = useState('');

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
    } catch (e) {
      console.error('Error cargando servicios y contratos:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedCategoryId, selectedContractType, filterStatus]);

  const handleOpenCreate = (defaultType = 'CONTRATO_PROVEEDOR') => {
    setEditingService(null);
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
      planType: '',
      seatsContracted: '1',
      seatsUsed: '1',
      costPeriod: 'MENSUAL',
      amount: '',
      currency: 'GTQ',
      startDate: new Date().toISOString().split('T')[0],
      expirationDate: '',
      autoRenew: 'SI',
      status: 'ACTIVA',
      assignedUsersText: '',
      notes: '',
    });
    setShowServiceModal(true);
  };

  const handleOpenEdit = (srv: any) => {
    setEditingService(srv);
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
      planType: srv.plan_type || '',
      seatsContracted: String(srv.seats_contracted || 1),
      seatsUsed: String(srv.seats_used || 1),
      costPeriod: srv.cost_period || 'MENSUAL',
      amount: String(srv.amount || 0),
      currency: srv.currency || 'GTQ',
      startDate: srv.start_date || '',
      expirationDate: srv.expiration_date || '',
      autoRenew: srv.auto_renew || 'SI',
      status: srv.status || 'ACTIVA',
      assignedUsersText: srv.assigned_users_text || '',
      notes: srv.notes || '',
    });
    setShowServiceModal(true);
  };

  const handleSaveService = async (e: React.FormEvent) => {
    e.preventDefault();
    const method = editingService ? 'PUT' : 'POST';
    const payload = editingService ? { id: editingService.id, ...formData } : formData;

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
    if (!window.confirm(`¿Desea eliminar el contrato / servicio "${srv.name}" con proveedor ${srv.provider}?`)) return;
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

  // Totales financieros por moneda
  const totalGtqMonthly = services
    .filter((s) => s.status === 'ACTIVA' && s.currency === 'GTQ')
    .reduce((acc, s) => acc + (s.monthly_equivalent_cost || 0), 0);

  const totalUsdMonthly = services
    .filter((s) => s.status === 'ACTIVA' && s.currency === 'USD')
    .reduce((acc, s) => acc + (s.monthly_equivalent_cost || 0), 0);

  const expiringContractsCount = services.filter(
    (s) => s.days_until_expiration !== null && s.days_until_expiration <= 45
  ).length;

  const exportColumns = [
    { key: 'contract_type', header: 'Tipo de Contrato' },
    { key: 'contract_number', header: 'No. Contrato' },
    { key: 'name', header: 'Servicio / Objeto del Contrato' },
    { key: 'provider', header: 'Proveedor' },
    { key: 'contact_name', header: 'Contacto Proveedor' },
    { key: 'contact_phone', header: 'Teléfono Proveedor' },
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
      'Vencimiento de Contratos, SLA, Proveedores y Costos en Quetzales (Q) y Dólares ($)',
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
            Contratos con Proveedores, Licencias y Servicios Digitales
          </h1>
          <p className="text-sm text-slate-500">
            Control de vencimiento de contratos con proveedores (Internet, Arrendamiento, Soporte), licencias SaaS y dominios en Quetzales (Q) o Dólares ($).
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
            title="Configurar Categorías"
          >
            <Settings className="h-4 w-4 text-military-700" /> Categorías
          </button>
          <button
            onClick={() => handleOpenCreate('CONTRATO_PROVEEDOR')}
            className="flex items-center gap-2 rounded-xl bg-military-700 px-4 py-2 text-sm font-semibold text-white shadow-md hover:bg-military-800 transition"
          >
            <Plus className="h-4 w-4" /> Nuevo Contrato / Licencia
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
            <span>Contratos por Vencer / Vencidos</span>
            <AlertTriangle className="h-4 w-4 text-amber-600" />
          </span>
          <div className="mt-1 text-2xl font-black text-amber-900">{expiringContractsCount}</div>
          <span className="text-[11px] text-amber-700">Con vencimiento &le; 45 días</span>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <span className="text-xs font-bold uppercase text-slate-400">Total Contratos y Licencias</span>
          <div className="mt-1 text-2xl font-black text-military-800">{services.length}</div>
          <span className="text-[11px] text-slate-500">Proveedores y licencias activas</span>
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
        {Object.entries(CONTRACT_TYPE_LABELS).map(([key, label]) => (
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
            placeholder="Buscar por Proveedor, No. Contrato, Servicio, Contacto o Usuario..."
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
          <option value="PAGO_UNICO">PAGO ÚNICO</option>
          <option value="CADUCADA_INACTIVA">CADUCADA / VENCIDA</option>
        </select>

        <button
          onClick={fetchData}
          className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
        >
          Buscar
        </button>
      </div>

      {/* Tabla de Contratos con Proveedores y Servicios */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs font-bold uppercase text-slate-600">
              <tr>
                <th className="px-4 py-3.5">Contrato / Servicio</th>
                <th className="px-4 py-3.5">Proveedor y Contacto</th>
                <th className="px-4 py-3.5">Área / Alcance</th>
                <th className="px-4 py-3.5">Costo y Ciclo</th>
                <th className="px-4 py-3.5">Vencimiento Contrato</th>
                <th className="px-4 py-3.5">Estado</th>
                <th className="px-4 py-3.5 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-slate-400">
                    Cargando contratos con proveedores y licencias...
                  </td>
                </tr>
              ) : services.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-slate-400">
                    No hay contratos ni servicios registrados con estos filtros.
                  </td>
                </tr>
              ) : (
                services.map((s) => {
                  const sym = s.currency === 'USD' ? '$' : 'Q';
                  const days = s.days_until_expiration;
                  const isExpiringSoon = days !== null && days >= 0 && days <= 45;
                  const isExpired = days !== null && days < 0;

                  return (
                    <tr key={s.id} className="hover:bg-slate-50/80 transition">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <span className="rounded bg-military-50 px-2 py-0.5 text-[10px] font-bold text-military-800 border border-military-200">
                            {CONTRACT_TYPE_LABELS[s.contract_type] || s.category_name || 'Contrato / Licencia'}
                          </span>
                          {s.contract_number && (
                            <span className="font-mono text-[11px] font-bold text-slate-600">
                              #{s.contract_number}
                            </span>
                          )}
                        </div>
                        <div className="font-bold text-slate-900 mt-1">{s.name}</div>
                        {s.sla_terms && (
                          <div className="text-[11px] text-slate-500 mt-0.5">SLA: {s.sla_terms}</div>
                        )}
                      </td>

                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-800">{s.provider}</div>
                        {s.contact_name && (
                          <div className="text-xs text-slate-500">{s.contact_name}</div>
                        )}
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
                        <div className="font-semibold text-slate-700 flex items-center gap-1">
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
                              {sym} {Number(s.amount || 0).toFixed(2)} <span className="text-[10px] text-slate-500">{s.currency}</span>
                            </div>
                            <span className="text-[11px] text-slate-500">{s.cost_period}</span>
                          </div>
                        )}
                      </td>

                      <td className="px-4 py-3 text-xs">
                        {s.expiration_date ? (
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
                          <span className="text-slate-400 italic">Sin vencimiento / Indefinido</span>
                        )}
                      </td>

                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold ${
                            s.status === 'ACTIVA'
                              ? 'bg-emerald-100 text-emerald-800'
                              : s.status === 'GRATUITA'
                              ? 'bg-sky-100 text-sky-800'
                              : s.status === 'PAGO_UNICO'
                              ? 'bg-purple-100 text-purple-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {s.status === 'ACTIVA' && <CheckCircle2 className="h-3 w-3" />}
                          {s.status === 'CADUCADA_INACTIVA' && <XCircle className="h-3 w-3" />}
                          {s.status === 'PAGO_UNICO' && <Clock className="h-3 w-3" />}
                          {s.status}
                        </span>
                      </td>

                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleOpenEdit(s)}
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

      {/* Modal Crear / Editar Servicio o Contrato con Proveedor */}
      {showServiceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-3xl rounded-2xl bg-white p-6 shadow-2xl max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <h2 className="text-lg font-bold text-slate-900">
                {editingService ? 'Editar Contrato con Proveedor / Licencia' : 'Registrar Nuevo Contrato con Proveedor o Licencia'}
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
                    {Object.entries(CONTRACT_TYPE_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
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
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-600 mb-1">Nombre del Contrato / Servicio / Dominio *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. Enlace Dedicado Fibra 200Mbps / Arrendamiento Impresoras / Microsoft 365"
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
                    placeholder="Ej. Tigo Business, Claro, PBS Guatemala, GoDaddy..."
                    value={formData.provider}
                    onChange={(e) => setFormData({ ...formData, provider: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  />
                </div>
              </div>

              {/* Datos de Contacto del Proveedor y SLA */}
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                <h3 className="text-xs font-bold uppercase text-slate-600">
                  Contacto del Proveedor y Condiciones del Contrato (SLA)
                </h3>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Ejecutivo / Contacto</label>
                    <input
                      type="text"
                      placeholder="Nombre del asesor o soporte"
                      value={formData.contactName}
                      onChange={(e) => setFormData({ ...formData, contactName: e.target.value })}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Teléfono Soporte / Proveedor</label>
                    <input
                      type="text"
                      placeholder="+502 2428-0000"
                      value={formData.contactPhone}
                      onChange={(e) => setFormData({ ...formData, contactPhone: e.target.value })}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Correo Proveedor</label>
                    <input
                      type="email"
                      placeholder="soporte@proveedor.com"
                      value={formData.contactEmail}
                      onChange={(e) => setFormData({ ...formData, contactEmail: e.target.value })}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">SLA / Términos de Renovación o Penalización</label>
                  <input
                    type="text"
                    placeholder="Ej. Contrato forzoso 24 meses, preaviso de 30 días antes del vencimiento, soporte 24/7..."
                    value={formData.slaTerms}
                    onChange={(e) => setFormData({ ...formData, slaTerms: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                  />
                </div>
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
                    <option value="UNICO">PAGO ÚNICO</option>
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

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-600 mb-1">Estado *</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  >
                    <option value="ACTIVA">ACTIVA / VIGENTE</option>
                    <option value="GRATUITA">GRATUITA</option>
                    <option value="PAGO_UNICO">PAGO ÚNICO</option>
                    <option value="CADUCADA_INACTIVA">CADUCADA / VENCIDA</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-slate-600 mb-1">Inicio de Contrato</label>
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
                    value={formData.expirationDate}
                    onChange={(e) => setFormData({ ...formData, expirationDate: e.target.value })}
                    className="w-full rounded-xl border border-amber-300 px-3 py-2 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-slate-600 mb-1">Área Imputada (BD)</label>
                  <select
                    value={formData.chargedDepartmentId}
                    onChange={(e) => setFormData({ ...formData, chargedDepartmentId: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  >
                    <option value="">-- General --</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-600 mb-1">Cupos Contratados</label>
                  <input
                    type="number"
                    value={formData.seatsContracted}
                    onChange={(e) => setFormData({ ...formData, seatsContracted: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-600 mb-1">Usuarios / Equipos en Uso</label>
                  <input
                    type="number"
                    value={formData.seatsUsed}
                    onChange={(e) => setFormData({ ...formData, seatsUsed: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-600 mb-1">Detalle de Usuarios Asignados / Observaciones</label>
                <textarea
                  rows={2}
                  placeholder=" Correos asignados, detalles del contrato con el proveedor..."
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
                  Guardar Contrato / Servicio
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Tuerca: Crear Nuevas Categorías */}
      {showCategoryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Settings className="h-5 w-5 text-military-700" />
                Categorías de Licencias y Contratos
              </h2>
              <button onClick={() => setShowCategoryModal(false)} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateCategory} className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-bold uppercase text-slate-600 mb-1">Nombre de Nueva Categoría *</label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Contratos de Telecomunicaciones, Licencias Adobe..."
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase text-slate-600 mb-1">Descripción</label>
                <input
                  type="text"
                  placeholder="Descripción breve..."
                  value={newCategoryDesc}
                  onChange={(e) => setNewCategoryDesc(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                />
              </div>
              <button
                type="submit"
                className="w-full rounded-xl bg-military-700 py-2 text-xs font-bold text-white hover:bg-military-800"
              >
                + Crear Categoría
              </button>
            </form>

            <div className="mt-4 border-t border-slate-100 pt-3">
              <h3 className="text-xs font-bold uppercase text-slate-400 mb-2">Categorías Actuales</h3>
              <div className="max-h-48 overflow-y-auto space-y-1.5">
                {categories.map((c) => (
                  <div key={c.id} className="flex justify-between items-center rounded-lg bg-slate-50 px-3 py-2 text-xs">
                    <span className="font-semibold text-slate-800">{c.name}</span>
                    <span className="text-slate-500">{c.services_count} servicios ({c.total_users_count} cupos)</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
