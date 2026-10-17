'use client';

import React, { useState, useEffect } from 'react';
import {
  Boxes,
  Plus,
  Search,
  Filter,
  QrCode,
  UserCheck,
  RotateCcw,
  Trash2,
  Edit,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Download,
  AlertCircle,
  Eye,
  CheckCircle,
  X,
  Archive
} from 'lucide-react';
import QrCodeModal from '@/components/QrCodeModal';
import ConfirmationModal from '@/components/ConfirmationModal';

export default function InventarioPage() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [catalogs, setCatalogs] = useState<any>({
    departments: [],
    categories: [],
    products: [],
    users: [],
    locations: [],
    suppliers: [],
  });

  // Filtros
  const [search, setSearch] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [status, setStatus] = useState('');
  const [condition, setCondition] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [sortBy, setSortBy] = useState('permanent_code');
  const [sortDir, setSortDir] = useState<'ASC' | 'DESC'>('ASC');

  // Modales
  const [showNewModal, setShowNewModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedItemDetail, setSelectedItemDetail] = useState<any>(null);
  const [selectedQrItem, setSelectedQrItem] = useState<any>(null);
  const [assignModalItem, setAssignModalItem] = useState<any>(null);
  const [decommissionItem, setDecommissionItem] = useState<any>(null);

  // Formulario nuevo activo
  const [formProduct, setFormProduct] = useState('');
  const [formDept, setFormDept] = useState('');
  const [formLocation, setFormLocation] = useState('');
  const [formSerial, setFormSerial] = useState('');
  const [formBrand, setFormBrand] = useState('');
  const [formModel, setFormModel] = useState('');
  const [formCondition, setFormCondition] = useState('NUEVO');
  const [formStatus, setFormStatus] = useState('DISPONIBLE');
  const [formPrice, setFormPrice] = useState('');
  const [formReplacement, setFormReplacement] = useState('');
  const [formSupplier, setFormSupplier] = useState('');
  const [formWarranty, setFormWarranty] = useState('');
  const [formInvoice, setFormInvoice] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [formChargedDept, setFormChargedDept] = useState('');
  const [showAdvancedFields, setShowAdvancedFields] = useState(false);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Formulario de asignación
  const [assignUser, setAssignUser] = useState('');
  const [assignTargetDept, setAssignTargetDept] = useState('');
  const [assignChargedDept, setAssignChargedDept] = useState('');
  const [assignExpectedReturn, setAssignExpectedReturn] = useState('');
  const [assignNotes, setAssignNotes] = useState('');

  // Cargar catálogos
  useEffect(() => {
    fetch('/api/catalogs')
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setCatalogs(d);
      })
      .catch(console.error);

    // Revisar query param ?search= o ?nuevo=true
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const qSearch = urlParams.get('search');
      if (qSearch) setSearch(qSearch);
      if (urlParams.get('nuevo') === 'true') setShowNewModal(true);
    }
  }, []);

  // Cargar items
  const fetchItems = () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (departmentId) params.set('departmentId', departmentId);
    if (status) params.set('status', status);
    if (condition) params.set('condition', condition);
    if (categoryId) params.set('categoryId', categoryId);
    params.set('sortBy', sortBy);
    params.set('sortDir', sortDir);

    fetch(`/api/inventory/items?${params.toString()}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.items) setItems(d.items);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchItems();
  }, [search, departmentId, status, condition, categoryId, sortBy, sortDir]);

  // Manejar creación de activo
  const handleCreateItem = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormSubmitting(true);

    try {
      const res = await fetch('/api/inventory/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: formProduct,
          departmentId: formDept,
          locationId: formLocation || null,
          serialNumber: formSerial,
          brand: formBrand,
          model: formModel,
          physicalCondition: formCondition,
          operationalStatus: formStatus,
          purchasePrice: formPrice ? parseFloat(formPrice) : null,
          replacementValue: formReplacement ? parseFloat(formReplacement) : null,
          supplier: formSupplier,
          warrantyExpiration: formWarranty || null,
          invoiceNumber: formInvoice,
          notes: formNotes,
          chargedDepartmentId: formChargedDept || formDept,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al guardar activo');

      // Limpiar formulario y cerrar
      setShowNewModal(false);
      resetNewForm();
      fetchItems();
    } catch (err: any) {
      setFormError(err.message);
    } finally {
      setFormSubmitting(false);
    }
  };

  const resetNewForm = () => {
    setFormProduct('');
    setFormDept('');
    setFormLocation('');
    setFormSerial('');
    setFormBrand('');
    setFormModel('');
    setFormPrice('');
    setFormReplacement('');
    setFormSupplier('');
    setFormWarranty('');
    setFormInvoice('');
    setFormNotes('');
    setShowAdvancedFields(false);
  };

  // Manejar asignación rápida
  const handleAssignSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignModalItem || !assignUser) return;

    try {
      const res = await fetch('/api/inventory/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemId: assignModalItem.id,
          userId: assignUser,
          targetDepartmentId: assignTargetDept || assignModalItem.department_id,
          chargedDepartmentId: assignChargedDept || assignTargetDept || assignModalItem.department_id,
          expectedReturnDate: assignExpectedReturn || null,
          notes: assignNotes,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setAssignModalItem(null);
      setAssignUser('');
      fetchItems();
    } catch (err: any) {
      alert(`Error en asignación: ${err.message}`);
    }
  };

  // Manejar baja confirmada
  const handleConfirmDecommission = async () => {
    if (!decommissionItem) return;
    try {
      const res = await fetch(`/api/inventory/items/${decommissionItem.id}?reason=Baja+autorizada`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Error al procesar la baja');
      setDecommissionItem(null);
      fetchItems();
    } catch (e: any) {
      alert(e.message);
    }
  };

  // Abrir detalle completo de activo
  const handleOpenDetail = (item: any) => {
    fetch(`/api/inventory/items/${item.id}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.success) {
          setSelectedItemDetail(d);
          setShowDetailModal(true);
        }
      })
      .catch(console.error);
  };

  // Exportar vista actual
  const handleExportView = async (fmt: 'excel' | 'csv') => {
    const cols = [
      { key: 'permanent_code', header: 'Código Permanente' },
      { key: 'product_name', header: 'Producto' },
      { key: 'brand', header: 'Marca' },
      { key: 'model', header: 'Modelo' },
      { key: 'serial_number', header: 'N° Serie' },
      { key: 'department_name', header: 'Área Actual' },
      { key: 'assigned_user_name', header: 'Responsable' },
      { key: 'operational_status', header: 'Estado Operativo' },
      { key: 'physical_condition', header: 'Condición Física' },
      { key: 'purchase_price', header: 'Precio Compra' },
    ];

    const res = await fetch('/api/reports/export', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        format: fmt,
        title: 'Inventario de Activos Físicos',
        columns: cols,
        data: items,
      }),
    });

    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `inventario_activos_${new Date().toISOString().slice(0, 10)}.${fmt === 'excel' ? 'xlsx' : 'csv'}`;
    a.click();
  };

  return (
    <div className="space-y-6">
      {/* Encabezado */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">
            Inventario de Activos Físicos
          </h1>
          <p className="text-xs sm:text-sm text-slate-500">
            Control individual de equipos corporativos, series, códigos permanentes y trazabilidad.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => handleExportView('excel')}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Excel</span>
          </button>
          <button
            onClick={() => handleExportView('csv')}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
          >
            <Download className="h-3.5 w-3.5" />
            <span>CSV</span>
          </button>
          <button
            onClick={() => setShowNewModal(true)}
            className="flex items-center gap-1.5 rounded-lg bg-military-800 px-4 py-2 text-xs sm:text-sm font-semibold text-white shadow hover:bg-military-900"
          >
            <Plus className="h-4 w-4" />
            <span>+ Registrar Activo</span>
          </button>
        </div>
      </div>

      {/* Barra de Búsqueda y Filtros */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
        {/* Pestañas de Vista Rápida / Carpeta de Archivados */}
        <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-100 pb-3">
          <button
            type="button"
            onClick={() => setStatus('')}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              status === ''
                ? 'bg-military-800 text-white shadow-sm'
                : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            Todos los Activos
          </button>
          <button
            type="button"
            onClick={() => setStatus('DISPONIBLE')}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              status === 'DISPONIBLE'
                ? 'bg-emerald-700 text-white shadow-sm'
                : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            Disponibles en Bodega
          </button>
          <button
            type="button"
            onClick={() => setStatus('ASIGNADO')}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              status === 'ASIGNADO'
                ? 'bg-blue-700 text-white shadow-sm'
                : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            Asignados a Personal
          </button>
          <button
            type="button"
            onClick={() => setStatus('EN_REVISION')}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              status === 'EN_REVISION'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            En Revisión / Reparación
          </button>
          <button
            type="button"
            onClick={() => setStatus('DADO_DE_BAJA')}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition ${
              status === 'DADO_DE_BAJA'
                ? 'bg-rose-700 text-white shadow-sm ring-2 ring-rose-600/30'
                : 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200'
            }`}
          >
            <Archive className="h-3.5 w-3.5" />
            <span>📁 Carpeta de Archivados / Dados de Baja</span>
          </button>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
          {/* Búsqueda */}
          <div className="lg:col-span-2">
            <label className="block text-[11px] font-bold text-slate-600 mb-1">Buscar</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar por empleado, teléfono, código (SIV-...), serie, fecha (AAAA-MM-DD)..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 py-1.5 pl-8 pr-3 text-xs text-slate-800 focus:border-military-600 focus:bg-white focus:outline-none"
              />
            </div>
          </div>

          {/* Departamento */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1">Área / Depto</label>
            <select
              value={departmentId}
              onChange={(e) => setDepartmentId(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-slate-50 py-1.5 px-2 text-xs text-slate-800 focus:border-military-600 focus:bg-white focus:outline-none"
            >
              <option value="">Todas las áreas</option>
              {(catalogs?.departments || []).map((d: any) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>

          {/* Estado Operativo */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1">Disponibilidad</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-slate-50 py-1.5 px-2 text-xs text-slate-800 focus:border-military-600 focus:bg-white focus:outline-none"
            >
              <option value="">Todos los estados</option>
              <option value="DISPONIBLE">Disponible</option>
              <option value="ASIGNADO">Asignado</option>
              <option value="EN_REVISION">En Revisión / Rep.</option>
              <option value="DADO_DE_BAJA">Dado de Baja</option>
              <option value="PERDIDO">Perdido</option>
            </select>
          </div>

          {/* Condición Física */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1">Condición</label>
            <select
              value={condition}
              onChange={(e) => setCondition(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-slate-50 py-1.5 px-2 text-xs text-slate-800 focus:border-military-600 focus:bg-white focus:outline-none"
            >
              <option value="">Todas las condiciones</option>
              <option value="NUEVO">Nuevo</option>
              <option value="BUENO">Bueno</option>
              <option value="USADO">Usado</option>
              <option value="AVERIADO">Averiado</option>
              <option value="DANADO">Dañado</option>
            </select>
          </div>

          {/* Categoría */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1">Categoría</label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-slate-50 py-1.5 px-2 text-xs text-slate-800 focus:border-military-600 focus:bg-white focus:outline-none"
            >
              <option value="">Todas las categorías</option>
              {(catalogs?.categories || []).map((c: any) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Tabla de Activos */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="border-b border-slate-200 bg-slate-50 text-[11px] uppercase font-bold text-slate-500">
              <tr>
                <th className="px-4 py-3 cursor-pointer" onClick={() => { setSortBy('permanent_code'); setSortDir(sortDir === 'ASC' ? 'DESC' : 'ASC'); }}>
                  Código Permanente
                </th>
                <th className="px-4 py-3">Artículo / Producto</th>
                <th className="px-4 py-3">Área / Ubicación</th>
                <th className="px-4 py-3">Responsable Asignado</th>
                <th className="px-4 py-3">Disponibilidad</th>
                <th className="px-4 py-3">Condición</th>
                <th className="px-4 py-3 text-right">Precio Compra</th>
                <th className="px-4 py-3 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    Cargando inventario...
                  </td>
                </tr>
              ) : items.length > 0 ? (
                items.map((it) => (
                  <tr key={it.id} className="hover:bg-slate-50 transition">
                    {/* Código Permanente */}
                    <td className="px-4 py-3 font-mono font-bold text-slate-900">
                      <button
                        onClick={() => handleOpenDetail(it)}
                        className="text-military-800 hover:underline flex items-center gap-1"
                      >
                        <span>{it.permanent_code}</span>
                      </button>
                      {it.serial_number && (
                        <span className="block text-[10px] text-slate-400 font-mono">
                          S/N: {it.serial_number}
                        </span>
                      )}
                    </td>

                    {/* Producto */}
                    <td className="px-4 py-3">
                      <span className="font-semibold text-slate-800 block">{it.product_name}</span>
                      <span className="text-[11px] text-slate-500">
                        {it.brand} {it.model} • {it.category_name}
                      </span>
                    </td>

                    {/* Área */}
                    <td className="px-4 py-3">
                      <span className="font-medium text-slate-800 block">{it.department_name}</span>
                      <span className="text-[10px] text-slate-400">{it.location_name || 'Sin ubicación específica'}</span>
                    </td>

                    {/* Responsable */}
                    <td className="px-4 py-3">
                      {it.assigned_user_name ? (
                        <div>
                          <div className="flex items-center gap-1.5">
                            <div className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-100 text-[10px] font-bold text-blue-700">
                              {it.assigned_user_name.charAt(0)}
                            </div>
                            <span className="font-medium text-slate-800">{it.assigned_user_name}</span>
                          </div>
                          {it.assigned_user_phone && (
                            <span className="text-[10px] text-slate-500 font-mono mt-0.5 ml-6 block">
                              Tel: {it.assigned_user_phone}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-400 italic">Sin asignar</span>
                      )}
                    </td>

                    {/* Disponibilidad */}
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          it.operational_status === 'DISPONIBLE'
                            ? 'bg-emerald-100 text-emerald-800'
                            : it.operational_status === 'ASIGNADO'
                            ? 'bg-blue-100 text-blue-800'
                            : it.operational_status === 'EN_REVISION'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-red-100 text-brandRed-700'
                        }`}
                      >
                        {it.operational_status}
                      </span>
                    </td>

                    {/* Condición */}
                    <td className="px-4 py-3">
                      <span className="text-slate-700 text-xs">{it.physical_condition}</span>
                    </td>

                    {/* Precio */}
                    <td className="px-4 py-3 text-right font-mono font-medium text-slate-800">
                      {it.purchase_price ? `Q${it.purchase_price.toFixed(2)}` : <span className="text-slate-400 text-[11px]">No registrado</span>}
                    </td>

                    {/* Acciones */}
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => setSelectedQrItem({
                            permanentCode: it.permanent_code,
                            productName: it.product_name,
                            brand: it.brand,
                            model: it.model,
                            serialNumber: it.serial_number,
                            departmentName: it.department_name,
                          })}
                          className="rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-military-800"
                          title="Ver e Imprimir Etiqueta QR"
                        >
                          <QrCode className="h-4 w-4" />
                        </button>

                        {it.operational_status === 'DISPONIBLE' && (
                          <button
                            onClick={() => {
                              setAssignModalItem(it);
                              setAssignTargetDept(it.department_id);
                            }}
                            className="rounded p-1 text-blue-600 hover:bg-blue-50"
                            title="Asignar a usuario"
                          >
                            <UserCheck className="h-4 w-4" />
                          </button>
                        )}

                        <button
                          onClick={() => handleOpenDetail(it)}
                          className="rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                          title="Ficha completa"
                        >
                          <Eye className="h-4 w-4" />
                        </button>

                        {it.operational_status !== 'DADO_DE_BAJA' && (
                          <button
                            onClick={() => setDecommissionItem(it)}
                            className="rounded p-1 text-red-500 hover:bg-red-50 hover:text-brandRed-700"
                            title="Dar de baja"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    No se encontraron activos con los filtros aplicados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL: REGISTRAR NUEVO ACTIVO INDIVIDUAL */}
      {showNewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm overflow-y-auto">
          <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl ring-1 ring-black/5 overflow-hidden my-8">
            <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-6 py-4">
              <div>
                <h3 className="text-base font-bold text-slate-900">Registrar Nuevo Activo Físico</h3>
                <p className="text-xs text-slate-500">
                  El sistema generará automáticamente su código permanente inmutable.
                </p>
              </div>
              <button
                onClick={() => { setShowNewModal(false); resetNewForm(); }}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-200"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateItem} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              {formError && (
                <div className="rounded-lg bg-red-50 p-3 text-xs text-brandRed-700 border border-red-200 flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Sección 1: Campos Esenciales */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Tipo de Producto / Modelo Base *
                  </label>
                  <select
                    required
                    value={formProduct}
                    onChange={(e) => {
                      setFormProduct(e.target.value);
                      const prod = (catalogs?.products || []).find((p: any) => p.id === e.target.value);
                      if (prod) {
                        setFormBrand(prod.brand || '');
                        setFormModel(prod.model || '');
                        setFormSupplier(prod.default_supplier || '');
                      }
                    }}
                    className="w-full rounded-lg border border-slate-300 py-2 px-3 text-xs sm:text-sm text-slate-800 focus:border-military-600 focus:outline-none"
                  >
                    <option value="">Seleccione un producto</option>
                    {(catalogs?.products || []).map((p: any) => (
                      <option key={p.id} value={p.id}>
                        {p.code} - {p.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Área / Departamento Actual *
                  </label>
                  <select
                    required
                    value={formDept}
                    onChange={(e) => setFormDept(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 py-2 px-3 text-xs sm:text-sm text-slate-800 focus:border-military-600 focus:outline-none"
                  >
                    <option value="">Seleccione un área</option>
                    {(catalogs?.departments || []).map((d: any) => (
                      <option key={d.id} value={d.id}>
                        {d.code} - {d.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Número de Serie (Opcional)
                  </label>
                  <input
                    type="text"
                    placeholder="ej. DL-5440-9981"
                    value={formSerial}
                    onChange={(e) => setFormSerial(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 py-2 px-3 text-xs sm:text-sm text-slate-800 font-mono focus:border-military-600 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Ubicación Específica (Opcional)
                  </label>
                  <select
                    value={formLocation}
                    onChange={(e) => setFormLocation(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 py-2 px-3 text-xs sm:text-sm text-slate-800 focus:border-military-600 focus:outline-none"
                  >
                    <option value="">Sin ubicación específica</option>
                    {(catalogs?.locations || [])
                      .filter((l: any) => !formDept || l.department_id === formDept)
                      .map((l: any) => (
                        <option key={l.id} value={l.id}>{l.name} ({l.code})</option>
                      ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Marca</label>
                  <input
                    type="text"
                    value={formBrand}
                    onChange={(e) => setFormBrand(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 py-2 px-3 text-xs sm:text-sm text-slate-800 focus:border-military-600 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Modelo</label>
                  <input
                    type="text"
                    value={formModel}
                    onChange={(e) => setFormModel(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 py-2 px-3 text-xs sm:text-sm text-slate-800 focus:border-military-600 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Condición Física</label>
                  <select
                    value={formCondition}
                    onChange={(e) => setFormCondition(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 py-2 px-3 text-xs sm:text-sm text-slate-800 focus:border-military-600 focus:outline-none"
                  >
                    <option value="NUEVO">Nuevo</option>
                    <option value="BUENO">Bueno</option>
                    <option value="USADO">Usado</option>
                    <option value="AVERIADO">Averiado</option>
                    <option value="DANADO">Dañado</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Disponibilidad Inicial</label>
                  <select
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 py-2 px-3 text-xs sm:text-sm text-slate-800 focus:border-military-600 focus:outline-none"
                  >
                    <option value="DISPONIBLE">Disponible</option>
                    <option value="EN_REVISION">En Revisión</option>
                    <option value="RESERVADO">Reservado</option>
                  </select>
                </div>
              </div>

              {/* Sección 2: Desplegable de Costos y Detalles Avanzados */}
              <div className="border-t border-slate-200 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAdvancedFields(!showAdvancedFields)}
                  className="flex items-center gap-1.5 text-xs font-bold text-military-700 hover:text-military-900"
                >
                  {showAdvancedFields ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  <span>{showAdvancedFields ? 'Ocultar Información Financiera y Garantías' : '+ Añadir Información de Costos, Factura y Garantía (Opcional)'}</span>
                </button>

                {showAdvancedFields && (
                  <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4 rounded-xl bg-slate-50 p-4 border border-slate-200">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Precio de Compra (Q GTQ)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        value={formPrice}
                        onChange={(e) => setFormPrice(e.target.value)}
                        className="w-full rounded-lg border border-slate-300 py-2 px-3 text-xs sm:text-sm text-slate-800 font-mono focus:border-military-600 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Valor de Reposición Estimado (Q GTQ)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        value={formReplacement}
                        onChange={(e) => setFormReplacement(e.target.value)}
                        className="w-full rounded-lg border border-slate-300 py-2 px-3 text-xs sm:text-sm text-slate-800 font-mono focus:border-military-600 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Área a la que se Imputa el Costo
                      </label>
                      <select
                        value={formChargedDept}
                        onChange={(e) => setFormChargedDept(e.target.value)}
                        className="w-full rounded-lg border border-slate-300 py-2 px-3 text-xs sm:text-sm text-slate-800 focus:border-military-600 focus:outline-none"
                      >
                        <option value="">Misma que el área actual</option>
                        {(catalogs?.departments || []).map((d: any) => (
                          <option key={d.id} value={d.id}>{d.name}</option>
                        ))}
                      </select>
                      <span className="text-[10px] text-slate-400">Puede diferir del área donde físicamente se ubica.</span>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Proveedor</label>
                      <input
                        type="text"
                        placeholder="ej. Dell Centroamérica"
                        value={formSupplier}
                        onChange={(e) => setFormSupplier(e.target.value)}
                        className="w-full rounded-lg border border-slate-300 py-2 px-3 text-xs sm:text-sm text-slate-800 focus:border-military-600 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">N° Factura</label>
                      <input
                        type="text"
                        placeholder="FAC-2026-..."
                        value={formInvoice}
                        onChange={(e) => setFormInvoice(e.target.value)}
                        className="w-full rounded-lg border border-slate-300 py-2 px-3 text-xs sm:text-sm text-slate-800 focus:border-military-600 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Vencimiento de Garantía</label>
                      <input
                        type="date"
                        value={formWarranty}
                        onChange={(e) => setFormWarranty(e.target.value)}
                        className="w-full rounded-lg border border-slate-300 py-2 px-3 text-xs sm:text-sm text-slate-800 focus:border-military-600 focus:outline-none"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-xs font-bold text-slate-700 mb-1">Observaciones Iniciales</label>
                      <textarea
                        rows={2}
                        value={formNotes}
                        onChange={(e) => setFormNotes(e.target.value)}
                        placeholder="Detalles sobre entrega, accesorios incluidos, estado visual..."
                        className="w-full rounded-lg border border-slate-300 py-2 px-3 text-xs sm:text-sm text-slate-800 focus:border-military-600 focus:outline-none"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Botones de acción */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => { setShowNewModal(false); resetNewForm(); }}
                  className="rounded-lg px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={formSubmitting}
                  className="flex items-center gap-1.5 rounded-lg bg-military-800 px-5 py-2 text-xs font-bold text-white shadow hover:bg-military-900 disabled:opacity-50"
                >
                  {formSubmitting ? 'Guardando...' : 'Confirmar Registro'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ASIGNACIÓN RÁPIDA DE ACTIVO */}
      {assignModalItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl ring-1 ring-black/5 overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-5 py-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Asignar Activo a Usuario</h3>
                <p className="text-xs text-slate-500 font-mono">{assignModalItem.permanent_code} - {assignModalItem.product_name}</p>
              </div>
              <button
                onClick={() => setAssignModalItem(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-200"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleAssignSubmit} className="p-5 space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Empleado Responsable *
                </label>
                <select
                  required
                  value={assignUser}
                  onChange={(e) => {
                    setAssignUser(e.target.value);
                    const u = (catalogs?.users || []).find((usr: any) => usr.id === e.target.value);
                    if (u && u.department_id) setAssignTargetDept(u.department_id);
                  }}
                  className="w-full rounded-lg border border-slate-300 py-2 px-3 text-xs sm:text-sm text-slate-800 focus:border-military-600 focus:outline-none"
                >
                  <option value="">Seleccione el empleado que recibe</option>
                  {(catalogs?.users || []).map((u: any) => (
                    <option key={u.id} value={u.id}>
                      {u.full_name} ({u.department_name || 'General'})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Área Destino
                </label>
                <select
                  value={assignTargetDept}
                  onChange={(e) => setAssignTargetDept(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 py-2 px-3 text-xs sm:text-sm text-slate-800 focus:border-military-600 focus:outline-none"
                >
                  {(catalogs?.departments || []).map((d: any) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Fecha Prevista de Devolución (Opcional)
                </label>
                <input
                  type="date"
                  value={assignExpectedReturn}
                  onChange={(e) => setAssignExpectedReturn(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 py-2 px-3 text-xs sm:text-sm text-slate-800 focus:border-military-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Observaciones de Entrega
                </label>
                <textarea
                  rows={2}
                  value={assignNotes}
                  onChange={(e) => setAssignNotes(e.target.value)}
                  placeholder="ej. Se entrega con cargador original y funda protectora..."
                  className="w-full rounded-lg border border-slate-300 py-2 px-3 text-xs text-slate-800 focus:border-military-600 focus:outline-none"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setAssignModalItem(null)}
                  className="rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-military-800 px-4 py-1.5 text-xs font-bold text-white shadow hover:bg-military-900"
                >
                  Generar Entrega
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: FICHA TÉCNICA DETALLADA CON HISTORIAL */}
      {showDetailModal && selectedItemDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm overflow-y-auto">
          <div className="w-full max-w-3xl rounded-2xl bg-white shadow-2xl ring-1 ring-black/5 overflow-hidden my-8">
            <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-6 py-4">
              <div>
                <span className="text-[10px] uppercase font-bold tracking-wider text-military-700">
                  Ficha Oficial del Activo
                </span>
                <h3 className="text-lg font-black text-slate-900 font-mono">
                  {selectedItemDetail.item.permanent_code}
                </h3>
              </div>
              <button
                onClick={() => setShowDetailModal(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-200"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
              {/* Resumen principal */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 rounded-xl bg-slate-50 p-4 border border-slate-200 text-xs">
                <div>
                  <span className="text-slate-400 block font-medium">Artículo:</span>
                  <span className="font-bold text-slate-800">{selectedItemDetail.item.product_name}</span>
                </div>
                <div>
                  <span className="text-slate-400 block font-medium">Marca y Modelo:</span>
                  <span className="font-bold text-slate-800">{selectedItemDetail.item.brand} {selectedItemDetail.item.model}</span>
                </div>
                <div>
                  <span className="text-slate-400 block font-medium">N° de Serie:</span>
                  <span className="font-mono font-bold text-slate-800">{selectedItemDetail.item.serial_number || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block font-medium">Área Actual:</span>
                  <span className="font-bold text-slate-800">{selectedItemDetail.item.department_name}</span>
                </div>
                <div>
                  <span className="text-slate-400 block font-medium">Estado:</span>
                  <span className="font-bold text-emerald-700">{selectedItemDetail.item.operational_status}</span>
                </div>
                <div>
                  <span className="text-slate-400 block font-medium">Condición:</span>
                  <span className="font-bold text-slate-800">{selectedItemDetail.item.physical_condition}</span>
                </div>
                <div>
                  <span className="text-slate-400 block font-medium">Precio Compra:</span>
                  <span className="font-mono font-bold text-slate-900">
                    {selectedItemDetail.item.purchase_price ? `Q ${selectedItemDetail.item.purchase_price.toLocaleString('es-GT', { minimumFractionDigits: 2 })}` : 'No registrado'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block font-medium">Responsable:</span>
                  <span className="font-bold text-blue-700">{selectedItemDetail.item.assigned_user_name || 'Sin asignar'}</span>
                </div>
              </div>

              {/* Historial de Asignaciones */}
              <div>
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">
                  Historial de Asignaciones ({selectedItemDetail.assignments?.length || 0})
                </h4>
                {selectedItemDetail.assignments?.length > 0 ? (
                  <div className="overflow-x-auto rounded-lg border border-slate-200">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-100 text-[10px] text-slate-600 uppercase font-semibold">
                        <tr>
                          <th className="p-2">Código Entrega</th>
                          <th className="p-2">Responsable</th>
                          <th className="p-2">Fecha Asignación</th>
                          <th className="p-2">Devolución</th>
                          <th className="p-2">Condición Dev.</th>
                          <th className="p-2">Estado</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {selectedItemDetail.assignments.map((asg: any) => (
                          <tr key={asg.id}>
                            <td className="p-2 font-mono font-bold">{asg.assignment_code}</td>
                            <td className="p-2 font-medium">{asg.user_name}</td>
                            <td className="p-2 text-slate-500">{asg.assigned_at?.slice(0, 10)}</td>
                            <td className="p-2 text-slate-500">{asg.returned_at?.slice(0, 10) || '-'}</td>
                            <td className="p-2">{asg.return_condition || '-'}</td>
                            <td className="p-2 font-bold">{asg.status}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-xs text-slate-400">Sin historial previo de asignaciones.</p>
                )}
              </div>

              {/* Historial de Mantenimientos */}
              <div>
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">
                  Historial de Mantenimiento y Averías ({selectedItemDetail.maintenance?.length || 0})
                </h4>
                {selectedItemDetail.maintenance?.length > 0 ? (
                  <div className="overflow-x-auto rounded-lg border border-slate-200">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-100 text-[10px] text-slate-600 uppercase font-semibold">
                        <tr>
                          <th className="p-2">Fecha</th>
                          <th className="p-2">Falla Reportada</th>
                          <th className="p-2">Proveedor / Técnico</th>
                          <th className="p-2">Costo Reparación</th>
                          <th className="p-2">Estado</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {selectedItemDetail.maintenance.map((mnt: any) => (
                          <tr key={mnt.id}>
                            <td className="p-2 text-slate-500">{mnt.reported_date?.slice(0, 10)}</td>
                            <td className="p-2">{mnt.fault_description}</td>
                            <td className="p-2">{mnt.technician_supplier || '-'}</td>
                            <td className="p-2 font-mono">${mnt.repair_cost?.toFixed(2) || '0.00'}</td>
                            <td className="p-2 font-bold">{mnt.status}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-xs text-slate-400">Sin reportes de avería para este activo.</p>
                )}
              </div>
            </div>

            <div className="border-t border-slate-100 bg-slate-50 px-6 py-3 flex justify-between items-center">
              <button
                onClick={() => {
                  setSelectedQrItem({
                    permanentCode: selectedItemDetail.item.permanent_code,
                    productName: selectedItemDetail.item.product_name,
                    brand: selectedItemDetail.item.brand,
                    model: selectedItemDetail.item.model,
                    serialNumber: selectedItemDetail.item.serial_number,
                    departmentName: selectedItemDetail.item.department_name,
                  });
                }}
                className="flex items-center gap-1.5 text-xs font-bold text-military-800 hover:underline"
              >
                <QrCode className="h-4 w-4" />
                <span>Ver Etiqueta QR</span>
              </button>
              <button
                onClick={() => setShowDetailModal(false)}
                className="rounded-lg px-4 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-200"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Etiqueta QR */}
      <QrCodeModal
        isOpen={Boolean(selectedQrItem)}
        onClose={() => setSelectedQrItem(null)}
        item={selectedQrItem}
      />

      {/* Modal de Confirmación de Baja */}
      <ConfirmationModal
        isOpen={Boolean(decommissionItem)}
        title="Confirmar Baja de Activo"
        message={`¿Está seguro de que desea dar de baja formalmente el activo ${decommissionItem?.permanent_code}? Se desvinculará de cualquier usuario y se registrará la transacción de baja en la bitácora del kardex.`}
        confirmText="Confirmar Baja"
        isDestructive={true}
        onConfirm={handleConfirmDecommission}
        onCancel={() => setDecommissionItem(null)}
      />
    </div>
  );
}
