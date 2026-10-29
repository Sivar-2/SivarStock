'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Boxes,
  Plus,
  Search,
  Filter,
  QrCode,
  ArrowUpRight,
  RotateCcw,
  Eye,
  Edit3,
  Trash2,
  X,
  FileSpreadsheet,
  FileText,
  CheckCircle2,
  AlertCircle,
  Tag,
  Cpu,
  Wifi,
  ClipboardCheck,
  Users,
  Warehouse,
  Wrench,
} from 'lucide-react';
import QrCodeModal from '@/components/QrCodeModal';
import { generateCsv, generateExcelBuffer, generatePdfDoc } from '@/lib/export';

export default function InventarioPage() {
  const [items, setItems] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [catalogs, setCatalogs] = useState<any>({
    departments: [],
    categories: [],
    products: [],
    users: [],
    locations: [],
  });
  const [loading, setLoading] = useState(true);

  // Filtros
  const [search, setSearch] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [status, setStatus] = useState('');
  const [condition, setCondition] = useState('');

  // Modales
  const [showNewModal, setShowNewModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);
  const [showReconcileModal, setShowReconcileModal] = useState(false);

  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [itemDetail, setItemDetail] = useState<any>(null);
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Estado del formulario Nuevo Activo
  const [newForm, setNewForm] = useState({
    productId: '',
    departmentId: 'dept-bod',
    employeeId: '',
    serialNumber: '',
    macAddress: '',
    imei: '',
    ipAddress: '',
    hostname: '',
    specifications: '',
    brand: '',
    model: '',
    physicalCondition: 'NUEVO',
    purchaseDate: new Date().toISOString().split('T')[0],
    supplier: '',
    purchasePrice: '',
    replacementValue: '',
    warrantyExpiration: '',
    invoiceNumber: '',
    notes: '',
    chargedDepartmentId: '',
  });

  // Estado del formulario Editar Activo
  const [editForm, setEditForm] = useState({
    id: '',
    permanentCode: '',
    serialNumber: '',
    macAddress: '',
    imei: '',
    ipAddress: '',
    hostname: '',
    specifications: '',
    brand: '',
    model: '',
    currentDepartmentId: '',
    currentEmployeeId: '',
    operationalStatus: 'DISPONIBLE',
    physicalCondition: 'BUENO',
    purchasePrice: '',
    replacementValue: '',
    warrantyExpiration: '',
    invoiceNumber: '',
    supplier: '',
    notes: '',
  });

  // Creación rápida de producto dentro del modal de Nuevo Activo
  const [showInlineNewProduct, setShowInlineNewProduct] = useState(false);
  const [inlineProdName, setInlineProdName] = useState('');
  const [inlineProdCategory, setInlineProdCategory] = useState('');
  const [inlineCreating, setInlineCreating] = useState(false);

  // Estado formulario Asignación (a Empleado)
  const [assignForm, setAssignForm] = useState({
    employeeId: '',
    targetDepartmentId: '',
    chargedDepartmentId: '',
    expectedReturnDate: '',
    notes: '',
  });

  // Estado formulario Devolución
  const [returnForm, setReturnForm] = useState({
    assignmentId: '',
    returnCondition: 'BUENO',
    newDepartmentId: 'dept-bod',
    sendToMaintenance: false,
    returnNotes: '',
  });

  // Estado del modal de Recuento y Conciliación Física de Inventario
  const [reconcileMatrix, setReconcileMatrix] = useState<any[]>([]);
  const [reconcileHistory, setReconcileHistory] = useState<any[]>([]);
  const [reconcileCounts, setReconcileCounts] = useState<Record<string, { countedBodega: number; itemNotes: string }>>({});
  const [reconcileNotes, setReconcileNotes] = useState('');
  const [reconcileApplyAdjustments, setReconcileApplyAdjustments] = useState(true);
  const [reconcileSubmitting, setReconcileSubmitting] = useState(false);
  const [reconcileTab, setReconcileTab] = useState<'CONTEO' | 'HISTORIAL'>('CONTEO');

  const fetchCatalogs = async () => {
    try {
      const [resCat, resEmp] = await Promise.all([
        fetch('/api/catalogs'),
        fetch('/api/employees?all=true'),
      ]);
      const dataCat = await resCat.json();
      const dataEmp = await resEmp.json();
      if (dataCat.success) setCatalogs(dataCat);
      if (dataEmp.employees) setEmployees(dataEmp.employees);
    } catch (err) {
      console.error('Error cargando catálogos:', err);
    }
  };

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (departmentId) params.set('departmentId', departmentId);
      if (categoryId) params.set('categoryId', categoryId);
      if (status) params.set('status', status);
      if (condition) params.set('condition', condition);

      const res = await fetch(`/api/inventory/items?${params.toString()}`);
      const data = await res.json();
      if (data.success) {
        setItems(data.items);
      }
    } catch (err) {
      console.error('Error cargando inventario:', err);
    } finally {
      setLoading(false);
    }
  }, [search, departmentId, categoryId, status, condition]);

  useEffect(() => {
    fetchCatalogs();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchItems();
    }, 200);
    return () => clearTimeout(timer);
  }, [fetchItems]);

  const openDetail = async (id: string) => {
    try {
      const res = await fetch(`/api/inventory/items/${id}`);
      const data = await res.json();
      if (data.success) {
        setItemDetail(data);
        setShowDetailModal(true);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const openEditModal = (item: any) => {
    setEditForm({
      id: item.id,
      permanentCode: item.permanent_code,
      serialNumber: item.serial_number || '',
      macAddress: item.mac_address || '',
      imei: item.imei || '',
      ipAddress: item.ip_address || '',
      hostname: item.hostname || '',
      specifications: item.specifications || '',
      brand: item.brand || '',
      model: item.model || '',
      currentDepartmentId: item.current_department_id || item.department_id || 'dept-bod',
      currentEmployeeId: item.current_employee_id || '',
      operationalStatus: item.operational_status || 'DISPONIBLE',
      physicalCondition: item.physical_condition || 'BUENO',
      purchasePrice: item.purchase_price !== null && item.purchase_price !== undefined ? String(item.purchase_price) : '',
      replacementValue: item.replacement_value !== null && item.replacement_value !== undefined ? String(item.replacement_value) : '',
      warrantyExpiration: item.warranty_expiration || '',
      invoiceNumber: item.invoice_number || '',
      supplier: item.supplier || '',
      notes: item.notes || '',
    });
    setShowEditModal(true);
  };

  const handleUpdateAsset = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionMessage(null);
    try {
      const res = await fetch(`/api/inventory/items/${editForm.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      });
      const data = await res.json();
      if (!res.ok) {
        setActionMessage({ type: 'error', text: data.error || 'Error al actualizar activo' });
        return;
      }
      setActionMessage({ type: 'success', text: `Activo ${editForm.permanentCode} actualizado correctamente.` });
      setShowEditModal(false);
      fetchItems();
    } catch {
      setActionMessage({ type: 'error', text: 'Error de red al actualizar activo' });
    }
  };

  const handleDecommissionAsset = async (item: any) => {
    const reason = window.prompt(`Ingrese el motivo obligatorio para dar de baja el activo ${item.permanent_code}:`, 'Equipo obsoleto / daño irreparable');
    if (!reason || !reason.trim()) return;

    try {
      const res = await fetch(`/api/inventory/items/${item.id}?reason=${encodeURIComponent(reason.trim())}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) {
        setActionMessage({ type: 'error', text: data.error || 'No se pudo dar de baja el activo' });
      } else {
        setActionMessage({ type: 'success', text: data.message });
        fetchItems();
      }
    } catch {
      setActionMessage({ type: 'error', text: 'Error al dar de baja el activo' });
    }
  };

  const handleInlineCreateProduct = async () => {
    if (!inlineProdName.trim() || !inlineProdCategory) return;
    setInlineCreating(true);
    try {
      const res = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: inlineProdName.trim(),
          categoryId: inlineProdCategory,
          brand: newForm.brand || null,
          model: newForm.model || null,
          unitPrice: newForm.purchasePrice ? Number(newForm.purchasePrice) : 0,
        }),
      });
      const data = await res.json();
      if (res.ok && data.id) {
        await fetchCatalogs();
        setNewForm({ ...newForm, productId: data.id });
        setShowInlineNewProduct(false);
        setInlineProdName('');
      }
    } catch (e) {
      console.error(e);
    } finally {
      setInlineCreating(false);
    }
  };

  const handleCreateAsset = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionMessage(null);
    try {
      const res = await fetch('/api/inventory/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newForm),
      });
      const data = await res.json();
      if (!res.ok) {
        setActionMessage({ type: 'error', text: data.error || 'Error al crear activo' });
        return;
      }
      setActionMessage({ type: 'success', text: data.message });
      setShowNewModal(false);
      setNewForm({
        productId: '',
        departmentId: 'dept-bod',
        employeeId: '',
        serialNumber: '',
        macAddress: '',
        imei: '',
        ipAddress: '',
        hostname: '',
        specifications: '',
        brand: '',
        model: '',
        physicalCondition: 'NUEVO',
        purchaseDate: new Date().toISOString().split('T')[0],
        supplier: '',
        purchasePrice: '',
        replacementValue: '',
        warrantyExpiration: '',
        invoiceNumber: '',
        notes: '',
        chargedDepartmentId: '',
      });
      fetchItems();
    } catch {
      setActionMessage({ type: 'error', text: 'Error de red' });
    }
  };

  const handleAssignAsset = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionMessage(null);
    try {
      const res = await fetch('/api/inventory/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemId: selectedItem.id,
          ...assignForm,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setActionMessage({ type: 'error', text: data.error });
        return;
      }
      setActionMessage({ type: 'success', text: data.message });
      setShowAssignModal(false);
      fetchItems();
    } catch {
      setActionMessage({ type: 'error', text: 'Error al asignar activo' });
    }
  };

  const handleReturnAsset = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionMessage(null);
    try {
      const res = await fetch('/api/inventory/return', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...returnForm,
          itemId: selectedItem?.id,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setActionMessage({ type: 'error', text: data.error });
        return;
      }
      setActionMessage({ type: 'success', text: data.message });
      setShowReturnModal(false);
      fetchItems();
    } catch {
      setActionMessage({ type: 'error', text: 'Error al devolver activo' });
    }
  };

  const openReconcileModal = async () => {
    setShowReconcileModal(true);
    try {
      const res = await fetch('/api/inventory/reconcile');
      const data = await res.json();
      if (data.success) {
        setReconcileMatrix(data.matrix || []);
        setReconcileHistory(data.history || []);
        const initCounts: Record<string, { countedBodega: number; itemNotes: string }> = {};
        (data.matrix || []).forEach((row: any) => {
          initCounts[row.product_id] = {
            countedBodega: Number(row.expected_bodega || 0),
            itemNotes: '',
          };
        });
        setReconcileCounts(initCounts);
      }
    } catch (e) {
      console.error('Error cargando recuento:', e);
    }
  };

  const handleSaveReconcile = async (e: React.FormEvent) => {
    e.preventDefault();
    setReconcileSubmitting(true);
    setActionMessage(null);
    try {
      const payloadItems = reconcileMatrix.map((row) => ({
        productId: row.product_id,
        expectedBodega: Number(row.expected_bodega || 0),
        countedBodega: Number(reconcileCounts[row.product_id]?.countedBodega ?? row.expected_bodega ?? 0),
        assignedEmployees: Number(row.assigned_employees || 0),
        itemNotes: reconcileCounts[row.product_id]?.itemNotes || '',
      }));

      const res = await fetch('/api/inventory/reconcile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          departmentId: 'dept-bod',
          applyAdjustments: reconcileApplyAdjustments,
          notes: reconcileNotes || 'Recuento físico y conciliación de inventario total',
          items: payloadItems,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setActionMessage({ type: 'error', text: data.error || 'Error al registrar recuento' });
      } else {
        setActionMessage({ type: 'success', text: data.message });
        setShowReconcileModal(false);
        fetchItems();
      }
    } catch {
      setActionMessage({ type: 'error', text: 'Error al procesar recuento de inventario' });
    } finally {
      setReconcileSubmitting(false);
    }
  };

  // Exportación
  const exportColumns = [
    { key: 'permanent_code', header: 'Código Permanente' },
    { key: 'product_name', header: 'Producto / Equipo' },
    { key: 'category_name', header: 'Categoría' },
    { key: 'brand', header: 'Marca' },
    { key: 'model', header: 'Modelo' },
    { key: 'serial_number', header: 'No. Serie' },
    { key: 'mac_address', header: 'Dirección MAC' },
    { key: 'imei', header: 'IMEI' },
    { key: 'ip_address', header: 'Dirección IP' },
    { key: 'hostname', header: 'Hostname' },
    { key: 'department_name', header: 'Área / Ubicación' },
    { key: 'assigned_user_name', header: 'Empleado Asignado' },
    { key: 'operational_status', header: 'Estado Operativo' },
    { key: 'physical_condition', header: 'Condición Física' },
    { key: 'purchase_price', header: 'Costo Adquisición (GTQ)' },
  ];

  const handleExportCsv = () => {
    const csv = generateCsv(exportColumns, items);
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `inventario_sivarstock_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  const handleExportExcel = () => {
    const buf = generateExcelBuffer('Inventario Activos', exportColumns, items);
    const blob = new Blob([buf as any], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `inventario_sivarstock_${new Date().toISOString().split('T')[0]}.xlsx`;
    a.click();
  };

  const handleExportPdf = () => {
    const doc = generatePdfDoc(
      'Reporte General de Activos de Inventario',
      `Total de unidades: ${items.length} | Incluye Serie, MAC, IMEI, IP y Custodio`,
      exportColumns,
      items
    );
    doc.save(`inventario_sivarstock_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  const statusBadge = (st: string) => {
    switch (st) {
      case 'DISPONIBLE':
        return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'ASIGNADO':
        return 'bg-sky-100 text-sky-800 border-sky-200';
      case 'DEVOLUCION_PENDIENTE':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'EN_REVISION':
      case 'AVERIADO':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'DADO_DE_BAJA':
      case 'PERDIDO':
        return 'bg-rose-100 text-rose-800 border-rose-200';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  // Cálculos de Inventario Total = En Bodega + Asignados a Empleados + En Revisión
  const activeItems = items.filter((i) => i.operational_status !== 'DADO_DE_BAJA');
  const bodegaCount = items.filter((i) => i.operational_status === 'DISPONIBLE').length;
  const assignedCount = items.filter((i) => i.operational_status === 'ASIGNADO').length;
  const revisionCount = items.filter((i) => ['EN_REVISION', 'AVERIADO', 'DEVOLUCION_PENDIENTE'].includes(i.operational_status)).length;
  const totalValueGtq = activeItems.reduce((acc, i) => acc + Number(i.purchase_price || 0), 0);

  return (
    <div className="space-y-6">
      {/* Encabezado y Acciones */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2.5">
            <Boxes className="h-7 w-7 text-military-700" />
            Inventario Físico Total y Control Técnico de Activos
          </h1>
          <p className="text-sm text-slate-500">
            Trazabilidad por código permanente <code className="font-mono font-semibold text-military-700">SIV-XX-XXXXXX</code>, Número de Serie, MAC, IMEI, IP, Recuento Físico y Asignación a Empleados.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleExportCsv}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50"
          >
            CSV
          </button>
          <button
            onClick={handleExportExcel}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-emerald-700 shadow-sm hover:bg-emerald-50"
          >
            <FileSpreadsheet className="h-4 w-4" /> Excel
          </button>
          <button
            onClick={handleExportPdf}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-rose-700 shadow-sm hover:bg-rose-50"
          >
            <FileText className="h-4 w-4" /> PDF
          </button>
          <button
            onClick={openReconcileModal}
            className="inline-flex items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-3.5 py-2.5 text-xs font-bold text-amber-900 shadow-sm hover:bg-amber-100 transition"
          >
            <ClipboardCheck className="h-4 w-4 text-amber-700" /> Recuento de Inventario
          </button>
          <button
            onClick={() => setShowNewModal(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-military-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-military-800 transition"
          >
            <Plus className="h-4 w-4" /> Nuevo Activo
          </button>
        </div>
      </div>

      {/* Tarjetas Resumen: Inventario Total = Bodega + Empleados + En Revisión */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <div
          onClick={() => setStatus('')}
          className="cursor-pointer rounded-2xl border border-slate-200 bg-white p-4 shadow-sm hover:border-military-500 transition"
        >
          <div className="flex items-center justify-between text-xs font-bold uppercase text-slate-500">
            <span>Inventario Total Activo</span>
            <Boxes className="h-4 w-4 text-military-700" />
          </div>
          <div className="mt-1 text-2xl font-black text-slate-900">{activeItems.length}</div>
          <div className="mt-1 text-[11px] text-slate-500">Bodega + Empleados + Taller</div>
        </div>

        <div
          onClick={() => setStatus('DISPONIBLE')}
          className="cursor-pointer rounded-2xl border border-emerald-200 bg-emerald-50/40 p-4 shadow-sm hover:border-emerald-500 transition"
        >
          <div className="flex items-center justify-between text-xs font-bold uppercase text-emerald-700">
            <span>Disponibles en Bodega</span>
            <Warehouse className="h-4 w-4 text-emerald-600" />
          </div>
          <div className="mt-1 text-2xl font-black text-emerald-800">{bodegaCount}</div>
          <div className="mt-1 text-[11px] text-emerald-600">En Cuarto de Servidores / Áreas</div>
        </div>

        <div
          onClick={() => setStatus('ASIGNADO')}
          className="cursor-pointer rounded-2xl border border-sky-200 bg-sky-50/40 p-4 shadow-sm hover:border-sky-500 transition"
        >
          <div className="flex items-center justify-between text-xs font-bold uppercase text-sky-700">
            <span>Asignados a Empleados</span>
            <Users className="h-4 w-4 text-sky-600" />
          </div>
          <div className="mt-1 text-2xl font-black text-sky-800">{assignedCount}</div>
          <div className="mt-1 text-[11px] text-sky-600">En expedientes de personal</div>
        </div>

        <div
          onClick={() => setStatus('EN_REVISION')}
          className="cursor-pointer rounded-2xl border border-amber-200 bg-amber-50/40 p-4 shadow-sm hover:border-amber-500 transition"
        >
          <div className="flex items-center justify-between text-xs font-bold uppercase text-amber-800">
            <span>Revisión / Pendientes</span>
            <Wrench className="h-4 w-4 text-amber-600" />
          </div>
          <div className="mt-1 text-2xl font-black text-amber-900">{revisionCount}</div>
          <div className="mt-1 text-[11px] text-amber-700">En soporte o devolución</div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-900 p-4 text-white shadow-sm">
          <div className="text-xs font-bold uppercase text-emerald-400">Valor Total Inventario</div>
          <div className="mt-1 text-2xl font-black">
            Q {totalValueGtq.toLocaleString('es-GT', { minimumFractionDigits: 2 })}
          </div>
          <div className="mt-1 text-[11px] text-slate-400">Activos en Bodega + Empleados</div>
        </div>
      </div>

      {/* Mensaje de confirmación/error */}
      {actionMessage && (
        <div
          className={`flex items-center justify-between rounded-xl border p-4 text-sm font-medium ${
            actionMessage.type === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border-rose-200 bg-rose-50 text-rose-800'
          }`}
        >
          <div className="flex items-center gap-2">
            {actionMessage.type === 'success' ? (
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            ) : (
              <AlertCircle className="h-5 w-5 text-rose-600" />
            )}
            <span>{actionMessage.text}</span>
          </div>
          <button onClick={() => setActionMessage(null)}>
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Barra de Búsqueda y Filtros */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div className="relative lg:col-span-2">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por código SIV, Serie, MAC, IMEI, IP, Hostname, Empleado..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-4 text-sm text-slate-800 focus:border-military-600 focus:bg-white focus:outline-none"
            />
          </div>

          <select
            value={departmentId}
            onChange={(e) => setDepartmentId(e.target.value)}
            className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 focus:border-military-600 focus:bg-white focus:outline-none"
          >
            <option value="">Todas las Áreas / Bodega</option>
            {catalogs.departments.map((d: any) => (
              <option key={d.id} value={d.id}>
                {d.name} ({d.code})
              </option>
            ))}
          </select>

          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 focus:border-military-600 focus:bg-white focus:outline-none"
          >
            <option value="">Todas las Categorías</option>
            {catalogs.categories.map((c: any) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 focus:border-military-600 focus:bg-white focus:outline-none"
          >
            <option value="">Todos los Estados</option>
            <option value="DISPONIBLE">Disponible (En Bodega)</option>
            <option value="ASIGNADO">Asignado a Empleado</option>
            <option value="DEVOLUCION_PENDIENTE">Devolución Pendiente</option>
            <option value="EN_REVISION">En Revisión / Taller</option>
            <option value="AVERIADO">Averiado</option>
            <option value="DADO_DE_BAJA">Dado de Baja</option>
          </select>
        </div>
      </div>

      {/* Tabla de Inventario */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <th className="px-4 py-3.5">Código Permanente</th>
                <th className="px-4 py-3.5">Equipo / Producto</th>
                <th className="px-4 py-3.5">Identificadores (Serie / MAC / IMEI)</th>
                <th className="px-4 py-3.5">Área / Ubicación</th>
                <th className="px-4 py-3.5">Empleado Custodio</th>
                <th className="px-4 py-3.5">Estado / Condición</th>
                <th className="px-4 py-3.5 text-right">Valor (GTQ)</th>
                <th className="px-4 py-3.5 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    Cargando registros de inventario...
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    No se encontraron activos que coincidan con los filtros seleccionados.
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/90 transition">
                    <td className="px-4 py-3.5 font-mono text-xs font-bold text-military-800 whitespace-nowrap">
                      {item.permanent_code}
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="font-semibold text-slate-900">{item.product_name}</div>
                      <div className="text-xs text-slate-500">
                        {item.brand || '-'} {item.model ? `• ${item.model}` : ''}
                      </div>
                      {item.specifications && (
                        <div className="text-[11px] text-slate-400 truncate max-w-[200px]" title={item.specifications}>
                          {item.specifications}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3.5 font-mono text-xs text-slate-600 space-y-0.5">
                      <div>
                        <span className="font-bold text-slate-400">S/N:</span> {item.serial_number || 'N/A'}
                      </div>
                      {item.mac_address && (
                        <div>
                          <span className="font-bold text-slate-400">MAC:</span> {item.mac_address}
                        </div>
                      )}
                      {item.imei && (
                        <div>
                          <span className="font-bold text-slate-400">IMEI:</span> {item.imei}
                        </div>
                      )}
                      {(item.ip_address || item.hostname) && (
                        <div className="text-[11px] text-sky-700">
                          {item.hostname ? `${item.hostname} ` : ''}{item.ip_address ? `(${item.ip_address})` : ''}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                        {item.department_name || 'Bodega'}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-xs text-slate-700">
                      {item.assigned_user_name ? (
                        <div>
                          <span className="font-semibold text-slate-900 block">{item.assigned_user_name}</span>
                          {item.assigned_employee_code && (
                            <span className="text-[11px] text-slate-400 font-mono">{item.assigned_employee_code}</span>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-400 italic">Disponible en Bodega</span>
                      )}
                    </td>
                    <td className="px-4 py-3.5">
                      <span
                        className={`inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${statusBadge(
                          item.operational_status
                        )}`}
                      >
                        {item.operational_status}
                      </span>
                      <div className="mt-1 text-[11px] text-slate-500">Condición: {item.physical_condition}</div>
                    </td>
                    <td className="px-4 py-3.5 text-right font-mono text-xs font-semibold text-slate-800 whitespace-nowrap">
                      {item.purchase_price
                        ? `Q ${Number(item.purchase_price).toLocaleString('es-GT', { minimumFractionDigits: 2 })}`
                        : <span className="text-slate-400 font-normal">No reg.</span>}
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center justify-center gap-1">
                        {/* Ver Ficha Técnica e Historial */}
                        <button
                          onClick={() => openDetail(item.id)}
                          className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                          title="Ver Ficha e Historial Completo"
                        >
                          <Eye className="h-4 w-4" />
                        </button>

                        {/* Editar Activo (Serie, MAC, IMEI, IP, Precio, etc.) */}
                        <button
                          onClick={() => openEditModal(item)}
                          className="rounded-lg p-1.5 text-slate-600 hover:bg-slate-100 hover:text-military-700"
                          title="Editar Serie, MAC, IMEI, IP, Estado o Precio"
                        >
                          <Edit3 className="h-4 w-4" />
                        </button>

                        {/* Etiqueta QR */}
                        <button
                          onClick={() => {
                            setSelectedItem({
                              permanentCode: item.permanent_code,
                              productName: item.product_name,
                              brand: item.brand,
                              model: item.model,
                              serialNumber: item.serial_number,
                              departmentName: item.department_name,
                            });
                            setShowQrModal(true);
                          }}
                          className="rounded-lg p-1.5 text-military-700 hover:bg-military-50"
                          title="Generar Etiqueta QR"
                        >
                          <QrCode className="h-4 w-4" />
                        </button>

                        {/* Asignar a Empleado (si está DISPONIBLE) */}
                        {item.operational_status === 'DISPONIBLE' && (
                          <button
                            onClick={() => {
                              setSelectedItem(item);
                              setAssignForm({
                                employeeId: '',
                                targetDepartmentId: item.department_id || '',
                                chargedDepartmentId: item.department_id || '',
                                expectedReturnDate: '',
                                notes: '',
                              });
                              setShowAssignModal(true);
                            }}
                            className="rounded-lg p-1.5 text-sky-600 hover:bg-sky-50"
                            title="Asignar Activo a Empleado"
                          >
                            <ArrowUpRight className="h-4 w-4" />
                          </button>
                        )}

                        {/* Devolver a Bodega (si está ASIGNADO o DEVOLUCION_PENDIENTE) */}
                        {(item.operational_status === 'ASIGNADO' || item.operational_status === 'DEVOLUCION_PENDIENTE') && (
                          <button
                            onClick={async () => {
                              setSelectedItem(item);
                              const res = await fetch(`/api/inventory/items/${item.id}`);
                              const detail = await res.json();
                              const activeAsg = detail.assignments?.find((a: any) => a.status === 'ACTIVA' || a.status === 'DEVOLUCION_PENDIENTE');
                              setReturnForm({
                                assignmentId: activeAsg?.id || item.permanent_code,
                                returnCondition: item.physical_condition || 'BUENO',
                                newDepartmentId: 'dept-bod',
                                sendToMaintenance: false,
                                returnNotes: '',
                              });
                              setShowReturnModal(true);
                            }}
                            className="rounded-lg p-1.5 text-amber-600 hover:bg-amber-50"
                            title="Registrar Devolución a Bodega"
                          >
                            <RotateCcw className="h-4 w-4" />
                          </button>
                        )}

                        {/* Dar de Baja */}
                        {item.operational_status !== 'DADO_DE_BAJA' && (
                          <button
                            onClick={() => handleDecommissionAsset(item)}
                            className="rounded-lg p-1.5 text-rose-500 hover:bg-rose-50"
                            title="Dar de Baja Formal"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal QR */}
      <QrCodeModal
        isOpen={showQrModal}
        onClose={() => setShowQrModal(false)}
        item={selectedItem}
      />

      {/* Modal Nuevo Activo */}
      {showNewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Registrar Nuevo Activo Individual</h2>
                <p className="text-xs text-slate-500">
                  Se generará un código permanente <code className="font-mono font-bold text-military-700">SIV-XX-XXXXXX</code> y se sumará automáticamente al Inventario Total.
                </p>
              </div>
              <button onClick={() => setShowNewModal(false)} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateAsset} className="mt-4 space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-semibold text-slate-700">Producto / Equipo *</label>
                    <button
                      type="button"
                      onClick={() => setShowInlineNewProduct(!showInlineNewProduct)}
                      className="text-[11px] font-bold text-military-700 hover:underline flex items-center gap-0.5"
                    >
                      <Plus className="h-3 w-3" /> {showInlineNewProduct ? 'Cancelar' : 'Crear nuevo tipo'}
                    </button>
                  </div>

                  {showInlineNewProduct ? (
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-2.5 space-y-2">
                      <input
                        type="text"
                        placeholder="Nombre ej. Laptop Dell Latitude 5440"
                        value={inlineProdName}
                        onChange={(e) => setInlineProdName(e.target.value)}
                        className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs"
                      />
                      <div className="flex gap-2">
                        <select
                          value={inlineProdCategory}
                          onChange={(e) => setInlineProdCategory(e.target.value)}
                          className="flex-1 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs"
                        >
                          <option value="">Categoría...</option>
                          {catalogs.categories.map((c: any) => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={handleInlineCreateProduct}
                          disabled={inlineCreating}
                          className="rounded-lg bg-military-700 px-3 py-1.5 text-xs font-bold text-white hover:bg-military-800"
                        >
                          {inlineCreating ? '...' : 'Guardar'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <select
                      required
                      value={newForm.productId}
                      onChange={(e) => setNewForm({ ...newForm, productId: e.target.value })}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                    >
                      <option value="">Seleccione un producto...</option>
                      {catalogs.products
                        .filter((p: any) => !p.is_consumable)
                        .map((p: any) => (
                          <option key={p.id} value={p.id}>
                            {p.name} ({p.code})
                          </option>
                        ))}
                    </select>
                  )}
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">Área / Bodega Destino *</label>
                  <select
                    required
                    value={newForm.departmentId}
                    onChange={(e) => setNewForm({ ...newForm, departmentId: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  >
                    {catalogs.departments.map((d: any) => (
                      <option key={d.id} value={d.id}>
                        {d.name} ({d.code})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-sky-700">Asignar a Empleado (Opcional)</label>
                  <select
                    value={newForm.employeeId}
                    onChange={(e) => {
                      const empId = e.target.value;
                      const emp = employees.find((ep) => ep.id === empId);
                      setNewForm({
                        ...newForm,
                        employeeId: empId,
                        departmentId: emp?.department_id || newForm.departmentId,
                      });
                    }}
                    className="w-full rounded-xl border border-sky-200 bg-sky-50/30 px-3 py-2 text-sm"
                  >
                    <option value="">-- Dejar Disponible en Bodega --</option>
                    {employees.map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.full_name} ({emp.employee_code})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Bloque Técnico: Serie, MAC, IMEI, IP, Hostname */}
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <Cpu className="h-4 w-4 text-military-700" /> Identificadores Técnicos del Dispositivo (Serie, MAC, IMEI, Red)
                </h3>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-700">Número de Serie (S/N)</label>
                    <input
                      type="text"
                      value={newForm.serialNumber}
                      onChange={(e) => setNewForm({ ...newForm, serialNumber: e.target.value })}
                      placeholder="Ej. SN-9823412"
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-mono"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-700">Dirección MAC (Wi-Fi / LAN)</label>
                    <input
                      type="text"
                      value={newForm.macAddress}
                      onChange={(e) => setNewForm({ ...newForm, macAddress: e.target.value })}
                      placeholder="Ej. 00:1B:44:11:3A:B7"
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-mono"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-700">Código IMEI (Si aplica)</label>
                    <input
                      type="text"
                      value={newForm.imei}
                      onChange={(e) => setNewForm({ ...newForm, imei: e.target.value })}
                      placeholder="15 dígitos para tablets/módems"
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-700">Dirección IP Fija / Red</label>
                    <input
                      type="text"
                      value={newForm.ipAddress}
                      onChange={(e) => setNewForm({ ...newForm, ipAddress: e.target.value })}
                      placeholder="Ej. 192.168.1.45"
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-mono"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-700">Hostname / Nombre PC</label>
                    <input
                      type="text"
                      value={newForm.hostname}
                      onChange={(e) => setNewForm({ ...newForm, hostname: e.target.value })}
                      placeholder="Ej. PC-FINANZAS-01"
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-mono"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-700">Especificaciones (RAM/CPU/Disco)</label>
                    <input
                      type="text"
                      value={newForm.specifications}
                      onChange={(e) => setNewForm({ ...newForm, specifications: e.target.value })}
                      placeholder="Ej. Core i7, 16GB RAM, 512GB SSD"
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">Marca</label>
                  <input
                    type="text"
                    value={newForm.brand}
                    onChange={(e) => setNewForm({ ...newForm, brand: e.target.value })}
                    placeholder="Dell, HP, Zebra..."
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">Modelo</label>
                  <input
                    type="text"
                    value={newForm.model}
                    onChange={(e) => setNewForm({ ...newForm, model: e.target.value })}
                    placeholder="Latitude 5430..."
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">Condición Física</label>
                  <select
                    value={newForm.physicalCondition}
                    onChange={(e) => setNewForm({ ...newForm, physicalCondition: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  >
                    <option value="NUEVO">Nuevo</option>
                    <option value="BUENO">Bueno</option>
                    <option value="USADO">Usado</option>
                    <option value="NO_EVALUADO">No Evaluado</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">Costo Adquisición (GTQ)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={newForm.purchasePrice}
                    onChange={(e) => setNewForm({ ...newForm, purchasePrice: e.target.value })}
                    placeholder="0.00"
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">Proveedor</label>
                  <input
                    type="text"
                    value={newForm.supplier}
                    onChange={(e) => setNewForm({ ...newForm, supplier: e.target.value })}
                    placeholder="Nombre del proveedor..."
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">No. Factura / OC</label>
                  <input
                    type="text"
                    value={newForm.invoiceNumber}
                    onChange={(e) => setNewForm({ ...newForm, invoiceNumber: e.target.value })}
                    placeholder="FAC-00123"
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">Observaciones / Notas</label>
                <textarea
                  rows={2}
                  value={newForm.notes}
                  onChange={(e) => setNewForm({ ...newForm, notes: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  placeholder="Detalles adicionales, accesorios incluidos..."
                />
              </div>

              <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
                <button
                  type="button"
                  onClick={() => setShowNewModal(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-military-700 px-5 py-2 text-sm font-semibold text-white hover:bg-military-800"
                >
                  Guardar y Generar Código Permanente
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Editar Activo Existente */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <span className="font-mono text-xs font-bold text-military-700">{editForm.permanentCode}</span>
                <h2 className="text-lg font-bold text-slate-900">Editar Ficha Técnica y Datos del Activo</h2>
              </div>
              <button onClick={() => setShowEditModal(false)} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateAsset} className="mt-4 space-y-4">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Identificadores Técnicos (Serie, MAC, IMEI, IP, Hostname)
                </h3>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-700">Número de Serie (S/N)</label>
                    <input
                      type="text"
                      value={editForm.serialNumber}
                      onChange={(e) => setEditForm({ ...editForm, serialNumber: e.target.value })}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-mono"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-700">Dirección MAC</label>
                    <input
                      type="text"
                      value={editForm.macAddress}
                      onChange={(e) => setEditForm({ ...editForm, macAddress: e.target.value })}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-mono"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-700">Código IMEI</label>
                    <input
                      type="text"
                      value={editForm.imei}
                      onChange={(e) => setEditForm({ ...editForm, imei: e.target.value })}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-mono"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-700">Dirección IP</label>
                    <input
                      type="text"
                      value={editForm.ipAddress}
                      onChange={(e) => setEditForm({ ...editForm, ipAddress: e.target.value })}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-mono"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-700">Hostname</label>
                    <input
                      type="text"
                      value={editForm.hostname}
                      onChange={(e) => setEditForm({ ...editForm, hostname: e.target.value })}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-mono"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-700">Especificaciones</label>
                    <input
                      type="text"
                      value={editForm.specifications}
                      onChange={(e) => setEditForm({ ...editForm, specifications: e.target.value })}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">Marca</label>
                  <input
                    type="text"
                    value={editForm.brand}
                    onChange={(e) => setEditForm({ ...editForm, brand: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">Modelo</label>
                  <input
                    type="text"
                    value={editForm.model}
                    onChange={(e) => setEditForm({ ...editForm, model: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">Estado Operativo</label>
                  <select
                    value={editForm.operationalStatus}
                    onChange={(e) => setEditForm({ ...editForm, operationalStatus: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  >
                    <option value="DISPONIBLE">DISPONIBLE (Bodega)</option>
                    <option value="ASIGNADO">ASIGNADO</option>
                    <option value="DEVOLUCION_PENDIENTE">DEVOLUCIÓN PENDIENTE</option>
                    <option value="EN_REVISION">EN REVISIÓN</option>
                    <option value="AVERIADO">AVERIADO</option>
                    <option value="DADO_DE_BAJA">DADO DE BAJA</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">Condición Física</label>
                  <select
                    value={editForm.physicalCondition}
                    onChange={(e) => setEditForm({ ...editForm, physicalCondition: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  >
                    <option value="NUEVO">NUEVO</option>
                    <option value="BUENO">BUENO</option>
                    <option value="USADO">USADO</option>
                    <option value="AVERIADO">AVERIADO</option>
                    <option value="EN_REPARACION">EN REPARACIÓN</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">Área / Departamento</label>
                  <select
                    value={editForm.currentDepartmentId}
                    onChange={(e) => setEditForm({ ...editForm, currentDepartmentId: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  >
                    {catalogs.departments.map((d: any) => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">Costo Adquisición (GTQ)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={editForm.purchasePrice}
                    onChange={(e) => setEditForm({ ...editForm, purchasePrice: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">Proveedor</label>
                  <input
                    type="text"
                    value={editForm.supplier}
                    onChange={(e) => setEditForm({ ...editForm, supplier: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">Notas / Observaciones</label>
                <textarea
                  rows={2}
                  value={editForm.notes}
                  onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                />
              </div>

              <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-military-700 px-5 py-2 text-sm font-semibold text-white hover:bg-military-800"
                >
                  Guardar Cambios
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Asignar Activo a Empleado */}
      {showAssignModal && selectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Asignar Activo a Empleado</h2>
                <p className="text-xs font-mono font-semibold text-military-700">
                  {selectedItem.permanent_code} — {selectedItem.product_name}
                </p>
              </div>
              <button onClick={() => setShowAssignModal(false)}>
                <X className="h-5 w-5 text-slate-400" />
              </button>
            </div>

            <form onSubmit={handleAssignAsset} className="mt-4 space-y-4">
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">Empleado Responsable (Custodio) *</label>
                <select
                  required
                  value={assignForm.employeeId}
                  onChange={(e) => {
                    const empId = e.target.value;
                    const emp = employees.find((ep) => ep.id === empId);
                    setAssignForm({
                      ...assignForm,
                      employeeId: empId,
                      targetDepartmentId: emp?.department_id || assignForm.targetDepartmentId,
                      chargedDepartmentId: emp?.department_id || assignForm.chargedDepartmentId,
                    });
                  }}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                >
                  <option value="">Seleccione un empleado...</option>
                  {employees.map((emp: any) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.full_name} ({emp.employee_code} - {emp.department_name || 'Sin área'})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">Departamento Destino</label>
                <select
                  value={assignForm.targetDepartmentId}
                  onChange={(e) => setAssignForm({ ...assignForm, targetDepartmentId: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                >
                  {catalogs.departments.map((d: any) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">Fecha Estimada Retorno (Opcional)</label>
                <input
                  type="date"
                  value={assignForm.expectedReturnDate}
                  onChange={(e) => setAssignForm({ ...assignForm, expectedReturnDate: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">Notas de Entrega</label>
                <textarea
                  rows={2}
                  value={assignForm.notes}
                  onChange={(e) => setAssignForm({ ...assignForm, notes: e.target.value })}
                  placeholder="Se entrega con cargador original y maletín..."
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAssignModal(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700"
                >
                  Confirmar Asignación y Generar Acta
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Devolución */}
      {showReturnModal && selectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Procesar Devolución de Equipo</h2>
                <p className="text-xs font-mono text-slate-500">{selectedItem.permanent_code}</p>
              </div>
              <button onClick={() => setShowReturnModal(false)}>
                <X className="h-5 w-5 text-slate-400" />
              </button>
            </div>

            <form onSubmit={handleReturnAsset} className="mt-4 space-y-4">
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">Condición Física al Recibir</label>
                <select
                  value={returnForm.returnCondition}
                  onChange={(e) => setReturnForm({ ...returnForm, returnCondition: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                >
                  <option value="BUENO">Bueno (Listo para reasignar en Bodega)</option>
                  <option value="USADO">Usado con desgaste normal</option>
                  <option value="DANADO">Dañado</option>
                  <option value="AVERIADO">Averiado (Requiere soporte)</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">Área / Bodega que Recibe</label>
                <select
                  value={returnForm.newDepartmentId}
                  onChange={(e) => setReturnForm({ ...returnForm, newDepartmentId: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                >
                  {catalogs.departments.map((d: any) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>

              <label className="flex items-center gap-2 text-xs font-medium text-slate-700">
                <input
                  type="checkbox"
                  checked={returnForm.sendToMaintenance}
                  onChange={(e) => setReturnForm({ ...returnForm, sendToMaintenance: e.target.checked })}
                  className="rounded border-slate-300 text-military-700"
                />
                Enviar inmediatamente a revisión / mantenimiento técnico
              </label>

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">Observaciones de Recepción</label>
                <textarea
                  rows={2}
                  value={returnForm.returnNotes}
                  onChange={(e) => setReturnForm({ ...returnForm, returnNotes: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowReturnModal(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700"
                >
                  Registrar Devolución
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Ficha Detallada e Historial del Activo */}
      {showDetailModal && itemDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 pb-4">
              <div>
                <span className="inline-flex items-center gap-1.5 rounded-lg bg-military-900 px-3 py-1 font-mono text-xs font-bold text-emerald-400">
                  <Tag className="h-3.5 w-3.5" />
                  {itemDetail.item.permanent_code}
                </span>
                <h2 className="mt-1.5 text-xl font-bold text-slate-900">{itemDetail.item.product_name}</h2>
              </div>
              <button onClick={() => setShowDetailModal(false)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-4 rounded-xl bg-slate-50 p-4 text-xs sm:grid-cols-4">
              <div>
                <span className="text-slate-400 block">Marca / Modelo</span>
                <span className="font-semibold text-slate-800">
                  {itemDetail.item.brand || '-'} {itemDetail.item.model || ''}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block">No. Serie (S/N)</span>
                <span className="font-mono font-semibold text-slate-800">{itemDetail.item.serial_number || 'N/A'}</span>
              </div>
              <div>
                <span className="text-slate-400 block">Dirección MAC</span>
                <span className="font-mono font-semibold text-slate-800">{itemDetail.item.mac_address || 'N/A'}</span>
              </div>
              <div>
                <span className="text-slate-400 block">Código IMEI</span>
                <span className="font-mono font-semibold text-slate-800">{itemDetail.item.imei || 'N/A'}</span>
              </div>
              <div>
                <span className="text-slate-400 block">IP / Hostname</span>
                <span className="font-mono font-semibold text-slate-800">
                  {itemDetail.item.ip_address || '-'} {itemDetail.item.hostname ? `(${itemDetail.item.hostname})` : ''}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block">Área Actual</span>
                <span className="font-semibold text-slate-800">{itemDetail.item.department_name}</span>
              </div>
              <div>
                <span className="text-slate-400 block">Empleado Custodio</span>
                <span className="font-semibold text-slate-800">{itemDetail.item.assigned_user_name || 'En Bodega'}</span>
              </div>
              <div>
                <span className="text-slate-400 block">Valor Adquisición</span>
                <span className="font-mono font-semibold text-emerald-700">
                  {itemDetail.item.purchase_price ? `Q ${Number(itemDetail.item.purchase_price).toFixed(2)}` : 'No registrado'}
                </span>
              </div>
            </div>

            {/* Historial de Asignaciones */}
            <div className="mt-6">
              <h3 className="text-sm font-bold text-slate-800 mb-2">Historial de Asignaciones (Códigos de Entrega)</h3>
              {itemDetail.assignments.length === 0 ? (
                <p className="text-xs text-slate-400">Este activo no registra asignaciones previas.</p>
              ) : (
                <div className="space-y-2">
                  {itemDetail.assignments.map((a: any) => (
                    <div key={a.id} className="flex items-center justify-between rounded-xl border border-slate-200 p-3 text-xs">
                      <div>
                        <span className="font-mono font-bold text-sky-700">{a.assignment_code}</span>
                        <span className="mx-2 text-slate-300">|</span>
                        <span className="font-semibold text-slate-800">{a.user_name}</span>
                        <p className="text-slate-500 mt-0.5">{a.notes || 'Sin observaciones'}</p>
                      </div>
                      <div className="text-right">
                        <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          a.status === 'ACTIVA' ? 'bg-sky-100 text-sky-800' : 'bg-slate-100 text-slate-600'
                        }`}>
                          {a.status}
                        </span>
                        <div className="text-[11px] text-slate-400 mt-0.5">{a.assigned_at}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Historial de Kardex */}
            <div className="mt-6">
              <h3 className="text-sm font-bold text-slate-800 mb-2">Trazabilidad de Movimientos (Kardex)</h3>
              <div className="space-y-2">
                {itemDetail.movements.map((m: any) => (
                  <div key={m.id} className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 text-xs">
                    <div>
                      <span className="font-bold text-military-800">{m.movement_type}</span>
                      <span className="mx-2 text-slate-400">•</span>
                      <span className="text-slate-700">{m.reason}</span>
                    </div>
                    <div className="text-right text-[11px] text-slate-400">
                      {m.created_at} ({m.user_name || 'Sistema'})
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Recuento Físico y Conciliación de Inventario Total */}
      {showReconcileModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 pb-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <ClipboardCheck className="h-5 w-5 text-amber-600" />
                  Recuento Físico y Conciliación de Inventario Total
                </h2>
                <p className="text-xs text-slate-500">
                  Verifique las existencias físicas en Bodega. El sistema suma automáticamente <strong>En Bodega + Asignados a Empleados = Inventario Total</strong>.
                </p>
              </div>
              <button onClick={() => setShowReconcileModal(false)} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-4 flex gap-2 border-b border-slate-200 pb-3">
              <button
                type="button"
                onClick={() => setReconcileTab('CONTEO')}
                className={`rounded-xl px-4 py-2 text-xs font-bold transition ${
                  reconcileTab === 'CONTEO' ? 'bg-military-700 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Nuevo Conteo Físico ({reconcileMatrix.length} productos)
              </button>
              <button
                type="button"
                onClick={() => setReconcileTab('HISTORIAL')}
                className={`rounded-xl px-4 py-2 text-xs font-bold transition ${
                  reconcileTab === 'HISTORIAL' ? 'bg-military-700 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Historial de Auditorías ({reconcileHistory.length})
              </button>
            </div>

            {reconcileTab === 'CONTEO' ? (
              <form onSubmit={handleSaveReconcile} className="mt-4 space-y-4">
                <div className="overflow-x-auto rounded-xl border border-slate-200 max-h-[50vh]">
                  <table className="w-full text-left text-xs">
                    <thead className="sticky top-0 bg-slate-100 font-bold uppercase text-slate-600 border-b border-slate-200">
                      <tr>
                        <th className="px-3 py-2.5">Código / Producto</th>
                        <th className="px-3 py-2.5 text-center">Esperado en Bodega</th>
                        <th className="px-3 py-2.5 text-center bg-amber-50 text-amber-900">Conteo Físico Bodega</th>
                        <th className="px-3 py-2.5 text-center bg-sky-50 text-sky-900">+ Asignado a Empleados</th>
                        <th className="px-3 py-2.5 text-center bg-emerald-50 text-emerald-900">= Inventario Total</th>
                        <th className="px-3 py-2.5 text-center">Diferencia</th>
                        <th className="px-3 py-2.5">Observación</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {reconcileMatrix.map((row) => {
                        const counted = Number(reconcileCounts[row.product_id]?.countedBodega ?? row.expected_bodega ?? 0);
                        const expected = Number(row.expected_bodega || 0);
                        const assigned = Number(row.assigned_employees || 0);
                        const diff = counted - expected;
                        const totalReal = counted + assigned;

                        return (
                          <tr key={row.product_id} className="hover:bg-slate-50">
                            <td className="px-3 py-2">
                              <span className="font-mono font-bold text-military-700">{row.product_code}</span>
                              <div className="font-semibold text-slate-900">{row.product_name}</div>
                            </td>
                            <td className="px-3 py-2 text-center font-mono font-bold text-slate-700">
                              {expected}
                            </td>
                            <td className="px-3 py-2 text-center bg-amber-50/40">
                              <input
                                type="number"
                                min="0"
                                value={counted}
                                onChange={(e) =>
                                  setReconcileCounts({
                                    ...reconcileCounts,
                                    [row.product_id]: {
                                      countedBodega: Number(e.target.value),
                                      itemNotes: reconcileCounts[row.product_id]?.itemNotes || '',
                                    },
                                  })
                                }
                                className="w-20 rounded-lg border border-amber-300 bg-white px-2 py-1 text-center font-mono font-bold text-slate-900"
                              />
                            </td>
                            <td className="px-3 py-2 text-center font-mono font-bold text-sky-700 bg-sky-50/30">
                              {assigned}
                            </td>
                            <td className="px-3 py-2 text-center font-mono font-black text-emerald-800 bg-emerald-50/30">
                              {totalReal}
                            </td>
                            <td className="px-3 py-2 text-center font-mono font-bold">
                              {diff === 0 ? (
                                <span className="text-emerald-600">Cuadrado (0)</span>
                              ) : diff > 0 ? (
                                <span className="text-sky-600">+{diff} sobrante</span>
                              ) : (
                                <span className="text-rose-600">{diff} faltante</span>
                              )}
                            </td>
                            <td className="px-3 py-2">
                              <input
                                type="text"
                                placeholder="Nota..."
                                value={reconcileCounts[row.product_id]?.itemNotes || ''}
                                onChange={(e) =>
                                  setReconcileCounts({
                                    ...reconcileCounts,
                                    [row.product_id]: {
                                      countedBodega: counted,
                                      itemNotes: e.target.value,
                                    },
                                  })
                                }
                                className="w-full rounded-lg border border-slate-200 px-2 py-1 text-xs"
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 items-center bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <div>
                    <label className="flex items-center gap-2 text-xs font-bold text-slate-800 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={reconcileApplyAdjustments}
                        onChange={(e) => setReconcileApplyAdjustments(e.target.checked)}
                        className="h-4 w-4 rounded border-slate-300 text-military-700"
                      />
                      Ajustar automáticamente el stock en Bodega y generar movimiento en Kardex si hay diferencias
                    </label>
                  </div>
                  <div>
                    <input
                      type="text"
                      placeholder="Observación general de la auditoría de recuento..."
                      value={reconcileNotes}
                      onChange={(e) => setReconcileNotes(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowReconcileModal(false)}
                    className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={reconcileSubmitting}
                    className="rounded-xl bg-military-700 px-5 py-2 text-sm font-semibold text-white hover:bg-military-800 disabled:opacity-50"
                  >
                    {reconcileSubmitting ? 'Procesando Recuento...' : 'Guardar Recuento y Conciliar Inventario'}
                  </button>
                </div>
              </form>
            ) : (
              <div className="mt-4 space-y-3">
                {reconcileHistory.length === 0 ? (
                  <p className="py-8 text-center text-xs text-slate-400">Aún no se han registrado recuentos físicos de inventario.</p>
                ) : (
                  reconcileHistory.map((h: any) => (
                    <div key={h.id} className="rounded-xl border border-slate-200 p-4 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <span className="font-mono font-bold text-military-800 bg-military-50 px-2 py-0.5 rounded">
                          {h.count_code}
                        </span>
                        <span className="ml-2 font-semibold text-slate-800">{h.notes}</span>
                        <div className="mt-1 text-slate-500">
                          Ejecutado por: <strong>{h.executed_by_name || 'Administrador'}</strong> • Fecha: {h.created_at}
                        </div>
                      </div>
                      <div className="flex items-center gap-3 text-right">
                        <div className="rounded-lg bg-slate-100 px-3 py-1.5">
                          <div className="text-[10px] text-slate-500 uppercase">En Bodega</div>
                          <div className="font-mono font-bold text-slate-800">{h.total_bodega}</div>
                        </div>
                        <div className="rounded-lg bg-sky-50 px-3 py-1.5">
                          <div className="text-[10px] text-sky-600 uppercase">Empleados</div>
                          <div className="font-mono font-bold text-sky-800">{h.total_assigned_employees}</div>
                        </div>
                        <div className="rounded-lg bg-emerald-50 px-3 py-1.5">
                          <div className="text-[10px] text-emerald-700 uppercase">Total Conciliado</div>
                          <div className="font-mono font-black text-emerald-900">{h.total_counted}</div>
                        </div>
                        <div className="rounded-lg bg-amber-50 px-3 py-1.5">
                          <div className="text-[10px] text-amber-700 uppercase">Diferencias</div>
                          <div className="font-mono font-bold text-amber-900">{h.discrepancies_count}</div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
