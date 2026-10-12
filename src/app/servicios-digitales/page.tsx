'use client';

import React, { useState, useEffect } from 'react';
import {
  Globe,
  Plus,
  Search,
  Filter,
  Calendar,
  DollarSign,
  AlertTriangle,
  Building,
  CheckCircle2,
  Users,
  CreditCard,
  ExternalLink,
  Settings,
  X,
  FileText,
  Clock,
  Sparkles
} from 'lucide-react';

export default function ServiciosDigitalesPage() {
  const [services, setServices] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [catFilter, setCatFilter] = useState('');

  // Modales
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [activeService, setActiveService] = useState<any | null>(null);

  // Formulario Nueva Categoría (Tuerca de configuración)
  const [newCatName, setNewCatName] = useState('');
  const [newCatDesc, setNewCatDesc] = useState('');

  // Formulario Nuevo Servicio
  const [form, setForm] = useState({
    name: '',
    categoryId: '',
    provider: '',
    responsibleDepartmentId: '',
    chargedDepartmentId: '',
    planType: '',
    seatsContracted: '1',
    seatsUsed: '1',
    costPeriod: 'MENSUAL',
    amount: '0',
    currency: 'GTQ', // GTQ o USD
    startDate: new Date().toISOString().split('T')[0],
    expirationDate: '',
    autoRenew: 'SI',
    status: 'ACTIVA',
    invoiceNumber: '',
    assignedUsersText: '',
    notes: '',
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const queryParams = new URLSearchParams();
      if (catFilter) queryParams.set('categoryId', catFilter);
      if (statusFilter) queryParams.set('status', statusFilter);
      if (search) queryParams.set('search', search);

      const res = await fetch(`/api/digital-services?${queryParams.toString()}`);
      const data = await res.json();

      if (data.services) setServices(data.services);
      if (data.categories) setCategories(data.categories);
      if (data.departments) setDepartments(data.departments);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [catFilter, statusFilter]);

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim()) return;

    try {
      const res = await fetch('/api/digital-services', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'CREATE_CATEGORY',
          categoryName: newCatName.trim(),
          categoryDescription: newCatDesc.trim(),
        }),
      });

      const d = await res.json();
      if (!res.ok) throw new Error(d.error);

      setShowCategoryModal(false);
      setNewCatName('');
      setNewCatDesc('');
      loadData();
      alert('Categoría creada exitosamente.');
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleCreateService = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/digital-services', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });

      const d = await res.json();
      if (!res.ok) throw new Error(d.error);

      setShowCreateModal(false);
      setForm({
        name: '',
        categoryId: '',
        provider: '',
        responsibleDepartmentId: '',
        chargedDepartmentId: '',
        planType: '',
        seatsContracted: '1',
        seatsUsed: '1',
        costPeriod: 'MENSUAL',
        amount: '0',
        currency: 'GTQ',
        startDate: new Date().toISOString().split('T')[0],
        expirationDate: '',
        autoRenew: 'SI',
        status: 'ACTIVA',
        invoiceNumber: '',
        assignedUsersText: '',
        notes: '',
      });
      loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const filteredServices = services.filter((s) =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.provider.toLowerCase().includes(search.toLowerCase()) ||
    (s.assigned_users_text && s.assigned_users_text.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      {/* Cabecera */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2.5">
            <Globe className="h-7 w-7 text-emerald-600" />
            Licencias, Dominios y Servicios Digitales
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Suscripciones SaaS corporativas • Control de asientos/usuarios • Soporte en Quetzales (Q) y Dólares (USD)
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Tuerca de Configuración de Categorías */}
          <button
            onClick={() => setShowCategoryModal(true)}
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 transition"
            title="Tuerca: Gestionar categorías automáticas de licencias"
          >
            <Settings className="h-4 w-4 text-slate-500" />
            <span>Categorías</span>
          </button>

          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white shadow-md hover:bg-emerald-800 transition"
          >
            <Plus className="h-4 w-4" />
            <span>Registrar Servicio</span>
          </button>
        </div>
      </div>

      {/* Barra de Filtros */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
        <div className="md:col-span-6 relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar servicio (Microsoft 365, AWS, Canva), proveedor o usuario..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-4 py-2 text-sm text-slate-800 focus:border-emerald-600 focus:bg-white focus:outline-none"
          />
        </div>

        <div className="md:col-span-3">
          <select
            value={catFilter}
            onChange={(e) => setCatFilter(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 focus:border-emerald-600 focus:outline-none"
          >
            <option value="">Todas las categorías</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.services_count} servicios, {c.total_users_count} usuarios)
              </option>
            ))}
          </select>
        </div>

        <div className="md:col-span-3">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 focus:border-emerald-600 focus:outline-none"
          >
            <option value="">Todos los estados</option>
            <option value="ACTIVA">Activa</option>
            <option value="PAGO_UNICO">Pago Único</option>
            <option value="CADUCADA_INACTIVA">Caducada / Inactiva</option>
            <option value="GRATUITA">Gratuita</option>
          </select>
        </div>
      </div>

      {/* Cuadrícula de Servicios Digitales */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {loading ? (
          <div className="col-span-full py-16 text-center text-slate-400">
            Cargando servicios y licencias...
          </div>
        ) : filteredServices.length === 0 ? (
          <div className="col-span-full py-16 text-center text-slate-400">
            No se encontraron servicios digitales registrados.
          </div>
        ) : (
          filteredServices.map((s) => {
            const isExpired = s.status === 'CADUCADA_INACTIVA';
            const isUsd = s.currency === 'USD';
            return (
              <div
                key={s.id}
                onClick={() => {
                  setActiveService(s);
                  setShowDetailModal(true);
                }}
                className="group cursor-pointer rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md hover:border-emerald-600 transition flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-[11px] font-semibold text-emerald-700 uppercase tracking-wide">
                      {s.category_name || s.category_legacy || 'General'}
                    </span>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${s.status === 'ACTIVA'
                        ? 'bg-emerald-100 text-emerald-800'
                        : s.status === 'PAGO_UNICO'
                          ? 'bg-blue-100 text-blue-800'
                          : s.status === 'CADUCADA_INACTIVA'
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                    >
                      {s.status === 'PAGO_UNICO' ? 'Pago Único' : s.status}
                    </span>
                  </div>

                  <h3 className="font-bold text-slate-900 text-base mt-1 group-hover:text-emerald-700">
                    {s.name}
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">{s.provider}</p>

                  <div className="mt-4 flex items-center justify-between bg-slate-50 p-2.5 rounded-xl border border-slate-100 text-xs">
                    <div>
                      <span className="text-slate-400 block text-[10px]">Área Asignada:</span>
                      <span className="font-semibold text-slate-800">
                        {s.charged_department_name || s.responsible_department_name || 'General'}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-slate-400 block text-[10px]">Usuarios / Asientos:</span>
                      <span className="font-mono font-bold text-slate-900">
                        {s.seats_used} / {s.seats_contracted}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                  <div>
                    <span className="text-slate-400 block text-[10px]">Costo ({s.cost_period})</span>
                    <span className="font-mono font-bold text-sm text-slate-900">
                      {isUsd ? '$' : 'Q'}
                      {Number(s.amount || 0).toLocaleString('es-GT', { minimumFractionDigits: 2 })}
                      <span className="text-[10px] text-slate-400 ml-1 font-normal">{s.currency}</span>
                    </span>
                  </div>

                  <div className="text-right">
                    <span className="text-slate-400 block text-[10px]">Vencimiento:</span>
                    <span className="font-mono text-xs text-slate-600">
                      {s.expiration_date || 'Sin vencimiento'}
                    </span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* MODAL DETALLES DE LICENCIA (AL HACER CLIC) */}
      {showDetailModal && activeService && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-start justify-between border-b border-slate-100 pb-3">
              <div>
                <span className="text-xs font-semibold text-emerald-700 uppercase">
                  {activeService.category_name || activeService.category_legacy}
                </span>
                <h3 className="text-lg font-bold text-slate-900 mt-0.5">{activeService.name}</h3>
                <p className="text-xs text-slate-500">Proveedor: {activeService.provider}</p>
              </div>
              <button onClick={() => setShowDetailModal(false)} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-4 space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2 bg-slate-50 p-3 rounded-xl border border-slate-100">
                <div>
                  <span className="text-slate-400 block">Monto y Moneda:</span>
                  <span className="text-base font-bold font-mono text-emerald-700">
                    {activeService.currency === 'USD' ? '$' : 'Q'}
                    {Number(activeService.amount || 0).toLocaleString('es-GT', { minimumFractionDigits: 2 })} {activeService.currency}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block">Período de Facturación:</span>
                  <span className="font-semibold text-slate-800">{activeService.cost_period}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-slate-400 block">Área Responsable:</span>
                  <span className="font-semibold text-slate-800">{activeService.responsible_department_name || 'General'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Área Imputada:</span>
                  <span className="font-semibold text-slate-800">{activeService.charged_department_name || 'General'}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-slate-400 block">Fecha Contratación / Inicio:</span>
                  <span className="font-mono text-slate-800">{activeService.start_date || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Fecha Expiración:</span>
                  <span className="font-mono text-slate-800">{activeService.expiration_date || 'Indefinida'}</span>
                </div>
              </div>

              <div>
                <span className="text-slate-400 block">Usuarios Asignados / Beneficiarios:</span>
                <p className="mt-0.5 text-slate-800 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                  {activeService.assigned_users_text || 'Todos los empleados autorizados'}
                </p>
              </div>

              {activeService.notes && (
                <div>
                  <span className="text-slate-400 block">Notas y Observaciones:</span>
                  <p className="mt-0.5 text-slate-800">{activeService.notes}</p>
                </div>
              )}
            </div>

            <div className="mt-6 flex justify-end border-t border-slate-100 pt-3">
              <button
                onClick={() => setShowDetailModal(false)}
                className="rounded-xl bg-slate-100 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL CONFIGURACIÓN TUERCA DE CATEGORÍAS */}
      {showCategoryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Settings className="h-5 w-5 text-emerald-600" />
                Categorías de Licencias y Servicios
              </h3>
              <button onClick={() => setShowCategoryModal(false)} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Categorías existentes */}
            <div className="my-4 max-h-48 overflow-y-auto space-y-1.5">
              {categories.map((c) => (
                <div key={c.id} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-xs border border-slate-100">
                  <span className="font-semibold text-slate-800">{c.name}</span>
                  <span className="text-slate-500 font-mono">
                    {c.services_count} serv. • {c.total_users_count} usuarios
                  </span>
                </div>
              ))}
            </div>

            {/* Formulario agregar categoría */}
            <form onSubmit={handleCreateCategory} className="border-t border-slate-100 pt-3 space-y-2.5">
              <div className="text-xs font-bold text-slate-700">+ Agregar Nueva Categoría:</div>
              <input
                type="text"
                required
                placeholder="ej. Telefonía VoIP, Facturación Electrónica..."
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs focus:border-emerald-600 focus:outline-none"
              />
              <input
                type="text"
                placeholder="Descripción de la categoría..."
                value={newCatDesc}
                onChange={(e) => setNewCatDesc(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs focus:border-emerald-600 focus:outline-none"
              />
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCategoryModal(false)}
                  className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs text-slate-600"
                >
                  Cerrar
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-emerald-700 px-4 py-1.5 text-xs font-semibold text-white hover:bg-emerald-800"
                >
                  Guardar Categoría
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL REGISTRAR SERVICIO DIGITAL */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Plus className="h-5 w-5 text-emerald-600" />
                Registrar Licencia o Servicio Digital
              </h3>
              <button onClick={() => setShowCreateModal(false)} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateService} className="mt-4 space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-slate-700">Nombre del Servicio / Plataforma</label>
                <input
                  type="text"
                  required
                  placeholder="ej. Microsoft 365, Google Workspace, Adobe CC..."
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700">Categoría (Configurable)</label>
                  <select
                    value={form.categoryId}
                    onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none"
                  >
                    <option value="">Seleccione categoría</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700">Proveedor / Distribuidor</label>
                  <input
                    type="text"
                    required
                    placeholder="Microsoft, Google, Claro..."
                    value={form.provider}
                    onChange={(e) => setForm({ ...form, provider: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none"
                  />
                </div>
              </div>

              {/* Área y Asientos */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700">Área Asignada (Base de Datos)</label>
                  <select
                    value={form.chargedDepartmentId}
                    onChange={(e) => setForm({ ...form, chargedDepartmentId: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none"
                  >
                    <option value="">General / Toda la empresa</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name} ({d.code})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700">Usuarios / Asientos Contratados</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={form.seatsContracted}
                    onChange={(e) => setForm({ ...form, seatsContracted: e.target.value, seatsUsed: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-mono focus:border-emerald-600 focus:outline-none"
                  />
                </div>
              </div>

              {/* Moneda Quetzales vs Dólares y Montos */}
              <div className="grid grid-cols-3 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-100">
                <div>
                  <label className="block text-xs font-semibold text-slate-700">Moneda de Pago</label>
                  <select
                    value={form.currency}
                    onChange={(e) => setForm({ ...form, currency: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-emerald-800 focus:border-emerald-600 focus:outline-none"
                  >
                    <option value="GTQ">Quetzales (Q - GTQ)</option>
                    <option value="USD">Dólares ($ - USD)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700">Monto Facturado</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={form.amount}
                    onChange={(e) => setForm({ ...form, amount: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-mono focus:border-emerald-600 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700">Período de Cobro</label>
                  <select
                    value={form.costPeriod}
                    onChange={(e) => setForm({ ...form, costPeriod: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none"
                  >
                    <option value="MENSUAL">Mensual</option>
                    <option value="ANUAL">Anual</option>
                    <option value="UNICO">Pago Único</option>
                    <option value="GRATUITO">Gratuito</option>
                  </select>
                </div>
              </div>

              {/* Fechas y Estados */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700">Fecha de Expiración / Renovación</label>
                  <input
                    type="date"
                    value={form.expirationDate}
                    onChange={(e) => setForm({ ...form, expirationDate: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700">Estado del Servicio</label>
                  <select
                    value={form.status}
                    onChange={(e) => setForm({ ...form, status: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none"
                  >
                    <option value="ACTIVA">Activa</option>
                    <option value="PAGO_UNICO">Pago Único</option>
                    <option value="CADUCADA_INACTIVA">Caducada / Inactiva</option>
                    <option value="GRATUITA">Gratuita</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700">Usuarios Asignados / Detalle de Cuentas</label>
                <input
                  type="text"
                  placeholder="ej. Equipo de Mercadeo, Gerencias, alexander7tm@..."
                  value={form.assignedUsersText}
                  onChange={(e) => setForm({ ...form, assignedUsersText: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
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
                  Guardar Servicio
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
