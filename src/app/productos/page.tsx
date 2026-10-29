'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Layers,
  Plus,
  Search,
  Package,
  AlertTriangle,
  FolderPlus,
  Folder,
  X,
  Check,
  UserCheck,
  MinusCircle,
  Trash2,
  History,
  Building,
  Edit3,
  Phone,
  FileText,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';

export default function ProductosPage() {
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('');
  const [rentalFilter, setRentalFilter] = useState<'ALL' | 'RENTED' | 'OWNED'>('ALL');

  // Modales
  const [showProductModal, setShowProductModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showDeductModal, setShowDeductModal] = useState(false);

  const [activeProduct, setActiveProduct] = useState<any | null>(null);
  const [productCustodians, setProductCustodians] = useState<any[]>([]);
  const [isEditingProduct, setIsEditingProduct] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editForm, setEditForm] = useState<any>({
    id: '',
    name: '',
    brand: '',
    model: '',
    categoryId: '',
    unitOfMeasure: 'unidad',
    unitPrice: 0,
    boxPrice: 0,
    unitsPerBox: 1,
    minStock: 2,
    targetStock: 10,
    backupAlertThreshold: 1,
    currentStock: 0,
    imageUrl: '',
    description: '',
    defaultSupplier: '',
    supplierPhone: '',
    contractNumber: '',
    isRented: false,
    rentalCost: 0,
    rentalPeriod: 'MENSUAL',
    rentalProvider: '',
  });
  const [productSuppliers, setProductSuppliers] = useState<any[]>([]);
  const [priceHistory, setPriceHistory] = useState<any[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);

  // Formulario Asignación directa a empleado
  const [assignEmployeeId, setAssignEmployeeId] = useState('');
  const [assignQuantity, setAssignQuantity] = useState('1');
  const [assignReason, setAssignReason] = useState('');
  const [assignSerial, setAssignSerial] = useState('');
  const [assignMac, setAssignMac] = useState('');
  const [assignImei, setAssignImei] = useState('');

  // Formulario Descontar stock / Ocupar Backup
  const [deductQuantity, setDeductQuantity] = useState('1');
  const [deductReason, setDeductReason] = useState('');

  // Formulario Nuevo Proveedor en detalle
  const [newSupplierName, setNewSupplierName] = useState('');
  const [newSupplierContact, setNewSupplierContact] = useState('');

  // Formulario Nuevo Producto con Lógica Estructural
  const [pForm, setPForm] = useState({
    code: '',
    name: '',
    categoryId: '',
    brand: '',
    model: '',
    imageUrl: '',
    unitOfMeasure: 'unidad',
    currentStock: '5',
    minStock: '2',
    targetStock: '15',
    backupAlertThreshold: '1',
    unitPrice: '0',
    boxPrice: '0',
    unitsPerBox: '1',
    defaultSupplier: '',
    supplierPhone: '',
    contractNumber: '',
    isRented: false,
    rentalCost: '0',
    rentalPeriod: 'MENSUAL',
    rentalProvider: '',
    description: '',
  });

  // Formulario Nueva Carpeta / Categoría
  const [cForm, setCForm] = useState({
    code: '',
    name: '',
    trackingType: 'INDIVIDUAL',
    description: '',
  });

  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [prodRes, catRes, empRes] = await Promise.all([
        fetch('/api/products'),
        fetch('/api/catalogs'),
        fetch('/api/employees?all=true'),
      ]);

      const prodData = await prodRes.json();
      const catData = await catRes.json();
      const empData = await empRes.json();

      if (prodData.products) setProducts(prodData.products);
      if (catData.categories) setCategories(catData.categories);
      if (empData.employees) setEmployees(empData.employees);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Sugerir estructura lógica de unidad según la categoría elegida
  const handleCategorySelectInNewProd = (catId: string) => {
    const cat = categories.find((c) => c.id === catId);
    const catName = (cat?.name || '').toLowerCase();
    let suggestedUnit = 'unidad';
    let suggestedBackup = '1';

    if (catName.includes('cable')) {
      suggestedUnit = 'm2';
      suggestedBackup = '10';
    } else if (catName.includes('tinta') || catName.includes('tóner') || catName.includes('toner')) {
      suggestedUnit = 'cartucho';
      suggestedBackup = '1';
    } else if (catName.includes('backup') || catName.includes('chip')) {
      suggestedUnit = 'backup';
      suggestedBackup = '2';
    }

    setPForm({
      ...pForm,
      categoryId: catId,
      unitOfMeasure: suggestedUnit,
      backupAlertThreshold: suggestedBackup,
    });
  };

  const openProductDetail = async (p: any) => {
    setActiveProduct(p);
    setIsEditingProduct(false);
    setEditForm({
      id: p.id,
      name: p.name || '',
      brand: p.brand || '',
      model: p.model || '',
      categoryId: p.category_id || '',
      unitOfMeasure: p.unit_of_measure || 'unidad',
      unitPrice: p.unit_price ?? 0,
      boxPrice: p.box_price ?? 0,
      unitsPerBox: p.units_per_box ?? 1,
      minStock: p.min_stock ?? 2,
      targetStock: p.target_stock ?? 10,
      backupAlertThreshold: p.backup_alert_threshold ?? 1,
      currentStock: p.current_stock ?? 0,
      imageUrl: p.image_url || '',
      description: p.description || '',
      defaultSupplier: p.default_supplier || '',
      supplierPhone: p.supplier_phone || '',
      contractNumber: p.contract_number || '',
      isRented: Boolean(p.is_rented),
      rentalCost: p.rental_cost ?? 0,
      rentalPeriod: p.rental_period || 'MENSUAL',
      rentalProvider: p.rental_provider || '',
    });
    setShowDetailModal(true);
    setDetailLoading(true);

    try {
      const res = await fetch(`/api/products?id=${p.id}`);
      const data = await res.json();
      if (data.product) {
        setActiveProduct({
          ...p,
          ...data.product,
        });
      }
      if (data.suppliers) setProductSuppliers(data.suppliers);
      if (data.priceHistory) setPriceHistory(data.priceHistory);
      if (data.custodians) setProductCustodians(data.custodians);
    } catch (err) {
      console.error(err);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleSaveProductEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingEdit(true);
    try {
      const res = await fetch('/api/products', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setIsEditingProduct(false);
      await loadData();
      setFeedback({ type: 'success', message: '¡Producto modificado exitosamente!' });
      setShowDetailModal(false);
    } catch (err: any) {
      alert(`Error al modificar producto: ${err.message}`);
    } finally {
      setSavingEdit(false);
    }
  };

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    try {
      const res = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(pForm),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setShowProductModal(false);
      setPForm({
        code: '',
        name: '',
        categoryId: '',
        brand: '',
        model: '',
        imageUrl: '',
        unitOfMeasure: 'unidad',
        currentStock: '5',
        minStock: '2',
        targetStock: '15',
        backupAlertThreshold: '1',
        unitPrice: '0',
        boxPrice: '0',
        unitsPerBox: '1',
        defaultSupplier: '',
        supplierPhone: '',
        contractNumber: '',
        isRented: false,
        rentalCost: '0',
        rentalPeriod: 'MENSUAL',
        rentalProvider: '',
        description: '',
      });
      setFeedback({ type: 'success', message: `Producto registrado exitosamente con código ${data.code}.` });
      loadData();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message });
    }
  };

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    try {
      const res = await fetch('/api/catalogs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'category',
          data: {
            ...cForm,
            code: cForm.code.trim() || cForm.name.substring(0, 4).toUpperCase(),
          },
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setShowCategoryModal(false);
      setCForm({ code: '', name: '', trackingType: 'INDIVIDUAL', description: '' });
      setFeedback({ type: 'success', message: data.message || 'Nueva carpeta de categoría creada.' });
      loadData();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message });
    }
  };

  const handleDeleteCategory = async (cat: any, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm(`¿Desea eliminar la carpeta de categoría "${cat.name}"?`)) return;
    try {
      const res = await fetch(`/api/catalogs?type=category&id=${cat.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'No se pudo eliminar la carpeta.');
      } else {
        if (catFilter === cat.id) setCatFilter('');
        loadData();
      }
    } catch {
      alert('Error al eliminar carpeta.');
    }
  };

  const handleAssignToEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeProduct || !assignEmployeeId) return;

    try {
      const res = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'ASSIGN_TO_EMPLOYEE',
          productId: activeProduct.id,
          employeeId: assignEmployeeId,
          quantity: Number(assignQuantity),
          reason: assignReason,
          serialNumber: assignSerial.trim() || null,
          macAddress: assignMac.trim() || null,
          imei: assignImei.trim() || null,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setShowAssignModal(false);
      setAssignQuantity('1');
      setAssignReason('');
      setAssignEmployeeId('');
      setAssignSerial('');
      setAssignMac('');
      setAssignImei('');
      setFeedback({ type: 'success', message: data.message || 'Asignación realizada con éxito.' });
      loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDeductStock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeProduct) return;

    try {
      const res = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'DEDUCT_STOCK',
          productId: activeProduct.id,
          quantity: Number(deductQuantity),
          reason: deductReason.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setShowDeductModal(false);
      setDeductQuantity('1');
      setDeductReason('');
      setFeedback({
        type: data.backupAlert ? 'error' : 'success',
        message: data.message || 'Stock actualizado.',
      });
      loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleAddSupplier = async () => {
    if (!activeProduct || !newSupplierName.trim()) return;
    try {
      const res = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'ADD_SUPPLIER',
          productId: activeProduct.id,
          supplierName: newSupplierName.trim(),
          contactInfo: newSupplierContact.trim(),
        }),
      });
      if (!res.ok) throw new Error('Error al agregar proveedor');
      setProductSuppliers([
        ...productSuppliers,
        {
          id: Date.now().toString(),
          supplier_name: newSupplierName.trim(),
          contact_info: newSupplierContact.trim(),
          is_preferred: 0,
        },
      ]);
      setNewSupplierName('');
      setNewSupplierContact('');
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDeleteProduct = async (p: any) => {
    const reason = prompt(`¿Motivo de eliminación del producto "${p.name}"?`, 'Eliminación autorizada');
    if (!reason || !reason.trim()) return;
    try {
      const res = await fetch(`/api/products?id=${p.id}&reason=${encodeURIComponent(reason)}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Error al eliminar producto');
      loadData();
      if (showDetailModal && activeProduct?.id === p.id) {
        setShowDetailModal(false);
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  const filteredProducts = products.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.code.toLowerCase().includes(search.toLowerCase()) ||
      (p.brand && p.brand.toLowerCase().includes(search.toLowerCase())) ||
      (p.model && p.model.toLowerCase().includes(search.toLowerCase())) ||
      (p.contract_number && p.contract_number.toLowerCase().includes(search.toLowerCase()));

    const matchesCat = catFilter ? p.category_id === catFilter : true;
    const matchesRental =
      rentalFilter === 'ALL'
        ? true
        : rentalFilter === 'RENTED'
        ? Number(p.is_rented) === 1
        : Number(p.is_rented) !== 1;

    return matchesSearch && matchesCat && matchesRental;
  });

  // Totales globales de alquileres en catálogo
  const rentedProductsCount = products.filter((p) => Number(p.is_rented) === 1).length;
  const totalMonthlyRentalCost = products
    .filter((p) => Number(p.is_rented) === 1)
    .reduce((acc, p) => acc + Number(p.rental_cost || 0) * Math.max(1, Number(p.total_company_inventory || 1)), 0);

  return (
    <div className="space-y-6">
      {/* Cabecera */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2.5">
            <Layers className="h-7 w-7 text-emerald-600" />
            Categorías, Carpetas de Inventario y Control de Productos
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Todos los productos del inventario seccionados por carpetas (Cables, Impresoras, Tintas, Backups, UPS, Monitores, Teléfonos, Chips de Backup, Cámaras), control de Alquileres y vínculos directos a Empleados y Departamentos.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setShowCategoryModal(true)}
            className="flex items-center gap-1.5 rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-2.5 text-xs font-bold text-emerald-900 shadow-sm hover:bg-emerald-100 transition"
          >
            <FolderPlus className="h-4 w-4 text-emerald-700" />
            <span>+ Nueva Carpeta (Categoría)</span>
          </button>
          <button
            onClick={() => setShowProductModal(true)}
            className="flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white shadow-md hover:bg-emerald-800 transition"
          >
            <Plus className="h-4 w-4" />
            <span>Agregar Producto</span>
          </button>
        </div>
      </div>

      {feedback && (
        <div
          className={`flex items-center justify-between rounded-xl border p-4 text-sm font-medium ${
            feedback.type === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
              : 'border-amber-300 bg-amber-50 text-amber-900'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            ) : (
              <AlertCircle className="h-5 w-5 text-amber-600" />
            )}
            <span>{feedback.message}</span>
          </div>
          <button onClick={() => setFeedback(null)}>
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Sección de Carpetas / Categorías Dinámicas con Totales */}
      <div>
        <div className="flex items-center justify-between mb-2.5">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Carpetas de Categorías ({categories.length}) — Haga clic en una carpeta para filtrar sus productos
          </h2>
          {catFilter && (
            <button
              onClick={() => setCatFilter('')}
              className="text-xs font-bold text-emerald-700 hover:underline"
            >
              Ver todas las carpetas ({products.length} productos)
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {/* Tarjeta Todas */}
          <div
            onClick={() => setCatFilter('')}
            className={`cursor-pointer rounded-2xl border p-3.5 transition ${
              catFilter === ''
                ? 'border-military-700 bg-military-900 text-white shadow-md'
                : 'border-slate-200 bg-white text-slate-800 hover:border-emerald-500'
            }`}
          >
            <div className="flex items-center justify-between">
              <Layers className={`h-5 w-5 ${catFilter === '' ? 'text-emerald-400' : 'text-military-700'}`} />
              <span className="font-mono text-xs font-bold opacity-80">TOTAL</span>
            </div>
            <div className="mt-2 font-bold text-sm truncate">Todas las Categorías</div>
            <div className="mt-1 text-xs opacity-80">
              {products.length} prod. • {products.reduce((a, b) => a + Number(b.total_company_inventory || 0), 0)} un.
            </div>
          </div>

          {categories.map((c) => {
            const catProds = products.filter((p) => p.category_id === c.id);
            const totalUnits = catProds.reduce((acc, p) => acc + Number(p.total_company_inventory || 0), 0);
            const isSelected = catFilter === c.id;

            return (
              <div
                key={c.id}
                onClick={() => setCatFilter(isSelected ? '' : c.id)}
                className={`group relative cursor-pointer rounded-2xl border p-3.5 transition ${
                  isSelected
                    ? 'border-emerald-600 bg-emerald-50 ring-2 ring-emerald-500/20'
                    : 'border-slate-200 bg-white hover:border-emerald-500 shadow-sm'
                }`}
              >
                <div className="flex items-center justify-between">
                  <Folder className={`h-5 w-5 ${isSelected ? 'text-emerald-700' : 'text-amber-500'}`} />
                  <div className="flex items-center gap-1">
                    <span className="font-mono text-[10px] font-bold text-slate-400">{c.code}</span>
                    {catProds.length === 0 && (
                      <button
                        onClick={(e) => handleDeleteCategory(c, e)}
                        className="opacity-0 group-hover:opacity-100 rounded p-0.5 text-rose-500 hover:bg-rose-50"
                        title="Eliminar carpeta vacía"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                </div>
                <div className="mt-2 font-bold text-sm text-slate-900 truncate" title={c.name}>
                  {c.name}
                </div>
                <div className="mt-1 flex items-center justify-between text-xs text-slate-500">
                  <span>{catProds.length} tipos</span>
                  <span className="font-mono font-bold text-emerald-700">{totalUnits} un.</span>
                </div>
              </div>
            );
          })}

          {/* Botón directo para crear nueva carpeta */}
          <button
            type="button"
            onClick={() => setShowCategoryModal(true)}
            className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50/60 p-3.5 text-slate-500 hover:border-emerald-500 hover:bg-emerald-50/30 hover:text-emerald-800 transition"
          >
            <FolderPlus className="h-6 w-6 mb-1" />
            <span className="text-xs font-bold">+ Nueva Carpeta</span>
          </button>
        </div>
      </div>

      {/* Barra de Búsqueda y Filtro de Alquilados */}
      <div className="flex flex-col md:flex-row gap-3 items-center justify-between bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por nombre, código, marca, modelo o número de contrato..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-4 py-2 text-sm text-slate-800 focus:border-emerald-600 focus:bg-white focus:outline-none"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          <button
            type="button"
            onClick={() => setRentalFilter(rentalFilter === 'RENTED' ? 'ALL' : 'RENTED')}
            className={`rounded-xl border px-3 py-2 text-xs font-bold transition ${
              rentalFilter === 'RENTED'
                ? 'border-purple-600 bg-purple-600 text-white'
                : 'border-purple-200 bg-purple-50 text-purple-800 hover:bg-purple-100'
            }`}
          >
            Equipos Alquilados ({rentedProductsCount}) • Q {totalMonthlyRentalCost.toFixed(2)}/mes
          </button>

          <select
            value={catFilter}
            onChange={(e) => setCatFilter(e.target.value)}
            className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 focus:border-emerald-600 focus:outline-none"
          >
            <option value="">Todas las carpetas</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Cuadrícula de Productos */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
        {loading ? (
          <div className="col-span-full py-16 text-center text-slate-400">
            Cargando catálogo y carpetas de productos...
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="col-span-full py-16 text-center text-slate-400">
            No se encontraron productos en esta carpeta. Haga clic en <strong>&quot;+ Agregar Producto&quot;</strong>.
          </div>
        ) : (
          filteredProducts.map((p) => {
            const isLowStock = p.warehouse_stock <= p.min_stock;
            const isBackupAlert = p.is_backup_alert;
            return (
              <div
                key={p.id}
                onClick={() => openProductDetail(p)}
                className="group cursor-pointer rounded-2xl border border-slate-200 bg-white p-4 shadow-sm hover:shadow-md hover:border-emerald-600 transition flex flex-col justify-between"
              >
                <div>
                  <div className="relative h-36 w-full overflow-hidden rounded-xl bg-slate-100 mb-3 flex items-center justify-center">
                    {p.image_url ? (
                      <img
                        src={p.image_url}
                        alt={p.name}
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                    ) : (
                      <Package className="h-12 w-12 text-slate-300" />
                    )}

                    {(isLowStock || isBackupAlert) && (
                      <div className="absolute top-2 right-2 flex items-center gap-1 rounded-full bg-rose-600 px-2.5 py-0.5 text-[10px] font-bold text-white shadow">
                        <AlertTriangle className="h-3 w-3" />
                        <span>
                          {p.warehouse_stock <= (p.backup_alert_threshold ?? 1)
                            ? `¡En Nivel Backup! (${p.warehouse_stock})`
                            : `Stock Bajo (${p.warehouse_stock})`}
                        </span>
                      </div>
                    )}

                    {Number(p.is_rented) === 1 && (
                      <div className="absolute top-2 left-2 rounded-full bg-purple-700 px-2.5 py-0.5 text-[10px] font-bold text-white shadow">
                        Alquilado: Q {Number(p.rental_cost || 0).toFixed(2)}
                      </div>
                    )}

                    <span className="absolute bottom-2 left-2 rounded-md bg-slate-900/80 px-2 py-0.5 font-mono text-[10px] font-bold text-white backdrop-blur">
                      {p.code}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-emerald-700 uppercase tracking-wide">
                      {p.category_name}
                    </span>
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">
                      Medida: {p.unit_of_measure}
                    </span>
                  </div>

                  <h3 className="font-bold text-slate-900 text-sm line-clamp-2 mt-0.5 group-hover:text-emerald-700">
                    {p.name}
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {p.brand} {p.model}
                  </p>

                  {(p.supplier_phone || p.contract_number) && (
                    <div className="mt-1.5 flex flex-wrap gap-1.5 text-[11px] text-slate-600">
                      {p.supplier_phone && (
                        <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-1.5 py-0.5">
                          <Phone className="h-3 w-3 text-slate-500" /> {p.supplier_phone}
                        </span>
                      )}
                      {p.contract_number && (
                        <span className="inline-flex items-center gap-1 rounded bg-amber-50 px-1.5 py-0.5 font-mono text-amber-900 border border-amber-200">
                          <FileText className="h-3 w-3 text-amber-700" /> {p.contract_number}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Links directos a Departamentos y Empleados que tienen este producto */}
                  {(p.assigned_departments_list?.length > 0 || p.assigned_employees_list?.length > 0) && (
                    <div
                      onClick={(e) => e.stopPropagation()}
                      className="mt-2 rounded-xl border border-sky-100 bg-sky-50/50 p-2 space-y-1"
                    >
                      {p.assigned_departments_list?.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1 text-[10px]">
                          <span className="font-bold text-slate-500">Áreas:</span>
                          {p.assigned_departments_list.slice(0, 2).map((d: any) => (
                            <Link
                              key={d.id}
                              href="/departamentos"
                              className="inline-flex items-center gap-0.5 rounded bg-white px-1.5 py-0.5 font-semibold text-military-800 border border-slate-200 hover:underline"
                            >
                              {d.name} <ExternalLink className="h-2.5 w-2.5" />
                            </Link>
                          ))}
                        </div>
                      )}
                      {p.assigned_employees_list?.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1 text-[10px]">
                          <span className="font-bold text-slate-500">Personal:</span>
                          {p.assigned_employees_list.slice(0, 2).map((emp: any) => (
                            <Link
                              key={emp.id}
                              href="/asignaciones"
                              className="inline-flex items-center gap-0.5 rounded bg-white px-1.5 py-0.5 font-semibold text-sky-800 border border-sky-200 hover:underline"
                            >
                              {emp.name} <ExternalLink className="h-2.5 w-2.5" />
                            </Link>
                          ))}
                          {p.assigned_employees_list.length > 2 && (
                            <Link href="/asignaciones" className="text-[10px] font-bold text-sky-700 hover:underline">
                              +{p.assigned_employees_list.length - 2} más
                            </Link>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="mt-3 pt-3 border-t border-slate-100">
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-slate-500">En Bodega:</span>
                    <span className={`font-mono font-bold ${isLowStock ? 'text-rose-600' : 'text-slate-900'}`}>
                      {p.warehouse_stock} ({p.unit_of_measure})
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-slate-500">En Empleados:</span>
                    <span className="font-mono font-bold text-blue-700">
                      {p.assigned_to_employees || 0} asignados
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs mb-2 bg-slate-50 px-2 py-1 rounded-lg border border-slate-100">
                    <span className="font-semibold text-slate-700">Inventario Total:</span>
                    <span className="font-mono font-black text-slate-900">
                      {p.total_company_inventory ?? p.current_stock} ({p.unit_of_measure})
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500">
                      {Number(p.is_rented) === 1 ? 'Pago Alquiler:' : 'Precio Unitario:'}
                    </span>
                    <span className="font-mono font-bold text-emerald-700">
                      Q{' '}
                      {Number(Number(p.is_rented) === 1 ? p.rental_cost : p.unit_price || 0).toLocaleString('es-GT', {
                        minimumFractionDigits: 2,
                      })}
                    </span>
                  </div>

                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveProduct(p);
                        setShowAssignModal(true);
                      }}
                      className="flex-1 flex items-center justify-center gap-1 rounded-xl bg-emerald-50 py-1.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 transition"
                    >
                      <UserCheck className="h-3.5 w-3.5" />
                      <span>Asignar</span>
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveProduct(p);
                        setShowDeductModal(true);
                      }}
                      className="rounded-xl border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs font-semibold text-amber-800 hover:bg-amber-100 transition"
                      title="Ocupar Backup / Descontar Consumo"
                    >
                      Ocupar / Stock
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* MODAL DETALLES Y VÍNCULOS DEL PRODUCTO */}
      {showDetailModal && activeProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-100 text-emerald-800">
                  <Package className="h-6 w-6" />
                </div>
                <div>
                  <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                    {activeProduct.code}
                  </span>
                  <h3 className="text-lg font-bold text-slate-900 mt-1">{activeProduct.name}</h3>
                  <p className="text-xs text-slate-500">
                    {activeProduct.category_name} • {activeProduct.brand} {activeProduct.model}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsEditingProduct(!isEditingProduct)}
                  className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
                >
                  <Edit3 className="h-3.5 w-3.5 text-emerald-600" />
                  <span>{isEditingProduct ? 'Ver Ficha' : 'Modificar'}</span>
                </button>
                <button
                  onClick={() => setShowDetailModal(false)}
                  className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {isEditingProduct ? (
              <form onSubmit={handleSaveProductEdit} className="mt-4 space-y-4 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-medium text-slate-700 mb-1">Nombre del Producto *</label>
                    <input
                      type="text"
                      required
                      value={editForm.name}
                      onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-800"
                    />
                  </div>
                  <div>
                    <label className="block font-medium text-slate-700 mb-1">Carpeta / Categoría</label>
                    <select
                      value={editForm.categoryId}
                      onChange={(e) => setEditForm({ ...editForm, categoryId: e.target.value })}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-800"
                    >
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block font-medium text-slate-700 mb-1">Marca</label>
                    <input
                      type="text"
                      value={editForm.brand}
                      onChange={(e) => setEditForm({ ...editForm, brand: e.target.value })}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-800"
                    />
                  </div>
                  <div>
                    <label className="block font-medium text-slate-700 mb-1">Modelo</label>
                    <input
                      type="text"
                      value={editForm.model}
                      onChange={(e) => setEditForm({ ...editForm, model: e.target.value })}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-800"
                    />
                  </div>
                  <div>
                    <label className="block font-medium text-slate-700 mb-1">Unidad de Medida Estructural</label>
                    <select
                      value={editForm.unitOfMeasure}
                      onChange={(e) => setEditForm({ ...editForm, unitOfMeasure: e.target.value })}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-800"
                    >
                      <option value="unidad">Unidad / Equipo</option>
                      <option value="m2">Metro Cuadrado (m²) — Cable Cat 6</option>
                      <option value="metro">Metro Lineal (m)</option>
                      <option value="cartucho">Cartucho / Tinta / Tóner</option>
                      <option value="backup">Unidad de Backup</option>
                      <option value="chip_sim">Chip SIM de Backup</option>
                      <option value="caja">Caja / Rollo</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-medium text-slate-700 mb-1">Precio Unitario Compra (Q)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={editForm.unitPrice}
                      onChange={(e) => setEditForm({ ...editForm, unitPrice: e.target.value })}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block font-medium text-slate-700 mb-1">Stock Actual en Bodega</label>
                    <input
                      type="number"
                      value={editForm.currentStock}
                      onChange={(e) => setEditForm({ ...editForm, currentStock: e.target.value })}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 font-mono font-bold"
                    />
                  </div>
                  <div>
                    <label className="block font-medium text-rose-700 mb-1">Umbral Alerta de Backup</label>
                    <input
                      type="number"
                      value={editForm.backupAlertThreshold}
                      onChange={(e) => setEditForm({ ...editForm, backupAlertThreshold: e.target.value })}
                      className="w-full rounded-xl border border-rose-200 px-3 py-2 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block font-medium text-slate-700 mb-1">Proveedor Principal</label>
                    <input
                      type="text"
                      value={editForm.defaultSupplier}
                      onChange={(e) => setEditForm({ ...editForm, defaultSupplier: e.target.value })}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="block font-medium text-slate-700 mb-1">Teléfono Contacto Proveedor</label>
                    <input
                      type="text"
                      value={editForm.supplierPhone}
                      onChange={(e) => setEditForm({ ...editForm, supplierPhone: e.target.value })}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block font-medium text-slate-700 mb-1">Contrato con Empresa Proveedora</label>
                    <input
                      type="text"
                      value={editForm.contractNumber}
                      onChange={(e) => setEditForm({ ...editForm, contractNumber: e.target.value })}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2"
                    />
                  </div>
                </div>

                {/* Control de Alquiler en Edición */}
                <div className="rounded-xl border border-purple-200 bg-purple-50/40 p-3 space-y-2">
                  <label className="flex items-center gap-2 font-bold text-purple-900 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editForm.isRented}
                      onChange={(e) => setEditForm({ ...editForm, isRented: e.target.checked })}
                      className="h-4 w-4 rounded border-purple-300"
                    />
                    Este producto es Alquilado
                  </label>
                  {editForm.isRented && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                      <div>
                        <label className="block font-semibold text-purple-900 mb-1">Cuánto se paga por producto (Q)</label>
                        <input
                          type="number"
                          step="0.01"
                          value={editForm.rentalCost}
                          onChange={(e) => setEditForm({ ...editForm, rentalCost: e.target.value })}
                          className="w-full rounded-xl border border-purple-200 bg-white px-3 py-1.5"
                        />
                      </div>
                      <div>
                        <label className="block font-semibold text-purple-900 mb-1">Proveedor de Alquiler</label>
                        <input
                          type="text"
                          value={editForm.rentalProvider}
                          onChange={(e) => setEditForm({ ...editForm, rentalProvider: e.target.value })}
                          className="w-full rounded-xl border border-purple-200 bg-white px-3 py-1.5"
                        />
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
                  <button
                    type="button"
                    onClick={() => setIsEditingProduct(false)}
                    className="rounded-xl border border-slate-200 px-4 py-2 font-semibold text-slate-600"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={savingEdit}
                    className="rounded-xl bg-emerald-700 px-5 py-2 font-semibold text-white hover:bg-emerald-800 flex items-center gap-1.5"
                  >
                    <Check className="h-4 w-4" />
                    <span>{savingEdit ? 'Guardando...' : 'Guardar Cambios'}</span>
                  </button>
                </div>
              </form>
            ) : (
              <>
                <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-100 text-xs">
                  <div>
                    <span className="text-slate-500 block">Stock en Bodega</span>
                    <span className="text-sm font-bold font-mono text-slate-900">
                      {activeProduct.warehouse_stock ?? activeProduct.current_stock} ({activeProduct.unit_of_measure})
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Asignados a Empleados</span>
                    <span className="text-sm font-bold font-mono text-blue-700">
                      {activeProduct.assigned_to_employees || 0} ({activeProduct.unit_of_measure})
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Inventario Total</span>
                    <span className="text-sm font-black font-mono text-emerald-800">
                      {activeProduct.total_company_inventory ?? activeProduct.current_stock} ({activeProduct.unit_of_measure})
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Modalidad / Alquiler</span>
                    <span className="text-sm font-bold text-purple-800">
                      {Number(activeProduct.is_rented) === 1
                        ? `Alquilado: Q ${Number(activeProduct.rental_cost || 0).toFixed(2)} (${activeProduct.rental_provider || 'Proveedor'})`
                        : 'Propio de la Empresa'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Contacto Proveedor</span>
                    <span className="text-sm font-semibold text-slate-800">
                      {activeProduct.supplier_phone || activeProduct.default_supplier || 'No registrado'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Contrato Asociado</span>
                    <span className="text-sm font-mono font-semibold text-amber-800">
                      {activeProduct.contract_number || 'Sin contrato'}
                    </span>
                  </div>
                </div>

                {/* Empleados y Departamentos con acceso/asignación (Links directos) */}
                <div className="mt-5">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 mb-2">
                    Departamentos y Empleados Vinculados a este Producto ({productCustodians.length})
                  </h4>
                  {productCustodians.length === 0 ? (
                    <p className="text-xs text-slate-400 italic">
                      Actualmente todas las unidades están en Bodega sin empleados asignados.
                    </p>
                  ) : (
                    <div className="space-y-1.5 max-h-40 overflow-y-auto">
                      {productCustodians.map((c, i) => (
                        <div
                          key={i}
                          className="flex flex-wrap items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs"
                        >
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-military-800">{c.permanent_code}</span>
                            {c.employee_name ? (
                              <Link
                                href="/asignaciones"
                                className="font-semibold text-sky-700 hover:underline flex items-center gap-1"
                              >
                                {c.employee_name} ({c.employee_code}) <ExternalLink className="h-3 w-3" />
                              </Link>
                            ) : (
                              <span className="text-slate-500">En Bodega</span>
                            )}
                          </div>
                          {c.department_name && (
                            <Link
                              href="/departamentos"
                              className="inline-flex items-center gap-1 rounded-lg bg-white px-2 py-0.5 font-semibold text-slate-700 border border-slate-200 hover:underline"
                            >
                              Área: {c.department_name} <ExternalLink className="h-3 w-3" />
                            </Link>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Proveedores Habituales */}
                <div className="mt-5">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 mb-2 flex items-center gap-1.5">
                    <Building className="h-4 w-4 text-emerald-600" />
                    Proveedores Habituales ({productSuppliers.length})
                  </h4>
                  <div className="space-y-1.5 mb-3">
                    {productSuppliers.map((s) => (
                      <div
                        key={s.id}
                        className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-xs border border-slate-100"
                      >
                        <span className="font-semibold text-slate-800">{s.supplier_name}</span>
                        <span className="text-slate-500">{s.contact_info || 'Sin contacto'}</span>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2 text-xs">
                    <input
                      type="text"
                      placeholder="Nuevo proveedor..."
                      value={newSupplierName}
                      onChange={(e) => setNewSupplierName(e.target.value)}
                      className="flex-1 rounded-xl border border-slate-200 px-3 py-1.5"
                    />
                    <input
                      type="text"
                      placeholder="Teléfono / Contrato"
                      value={newSupplierContact}
                      onChange={(e) => setNewSupplierContact(e.target.value)}
                      className="w-1/3 rounded-xl border border-slate-200 px-3 py-1.5"
                    />
                    <button
                      onClick={handleAddSupplier}
                      disabled={!newSupplierName.trim()}
                      className="rounded-xl bg-emerald-700 px-3 py-1.5 font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
                    >
                      + Agregar
                    </button>
                  </div>
                </div>

                {/* Botones de Acción */}
                <div className="mt-6 flex justify-between border-t border-slate-100 pt-4">
                  <button
                    onClick={() => handleDeleteProduct(activeProduct)}
                    className="flex items-center gap-1 rounded-xl text-rose-600 hover:bg-rose-50 px-3 py-2 text-xs font-semibold"
                  >
                    <Trash2 className="h-4 w-4" />
                    <span>Eliminar Producto</span>
                  </button>

                  <div className="flex gap-2">
                    <button
                      onClick={() => setShowAssignModal(true)}
                      className="flex items-center gap-1.5 rounded-xl bg-emerald-700 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-800"
                    >
                      <UserCheck className="h-4 w-4" />
                      <span>Asignar a Empleado</span>
                    </button>
                    <button
                      onClick={() => setShowDeductModal(true)}
                      className="flex items-center gap-1.5 rounded-xl border border-amber-300 bg-amber-50 px-4 py-2 text-xs font-semibold text-amber-900 hover:bg-amber-100"
                    >
                      <MinusCircle className="h-4 w-4" />
                      <span>Ocupar Backup / Stock</span>
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* MODAL ASIGNAR PRODUCTO A EMPLEADO */}
      {showAssignModal && activeProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <UserCheck className="h-5 w-5 text-emerald-600" />
                Asignar Producto a Empleado
              </h3>
              <button onClick={() => setShowAssignModal(false)} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleAssignToEmployee} className="mt-4 space-y-3.5">
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 text-xs">
                <p className="font-bold text-slate-800">{activeProduct.name}</p>
                <p className="text-slate-500">
                  Disponible en Bodega: <span className="font-mono font-bold text-emerald-700">{activeProduct.current_stock}</span> ({activeProduct.unit_of_measure})
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700">Empleado Receptor:</label>
                <select
                  required
                  value={assignEmployeeId}
                  onChange={(e) => setAssignEmployeeId(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                >
                  <option value="">Seleccione el empleado</option>
                  {employees.filter((e) => e.status === 'ACTIVO').map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.full_name} ({e.employee_code}) - {e.department_name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700">Cantidad ({activeProduct.unit_of_measure}):</label>
                <input
                  type="number"
                  min="1"
                  required
                  value={assignQuantity}
                  onChange={(e) => setAssignQuantity(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-mono"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 bg-slate-50 p-3 rounded-xl border border-slate-100">
                <div>
                  <label className="block text-[11px] text-slate-600">N° de Serie</label>
                  <input
                    type="text"
                    placeholder="S/N..."
                    value={assignSerial}
                    onChange={(e) => setAssignSerial(e.target.value)}
                    className="mt-0.5 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-600">MAC</label>
                  <input
                    type="text"
                    placeholder="00:1A..."
                    value={assignMac}
                    onChange={(e) => setAssignMac(e.target.value)}
                    className="mt-0.5 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-600">IMEI</label>
                  <input
                    type="text"
                    placeholder="35489..."
                    value={assignImei}
                    onChange={(e) => setAssignImei(e.target.value)}
                    className="mt-0.5 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700">Motivo / Detalle:</label>
                <textarea
                  rows={2}
                  value={assignReason}
                  onChange={(e) => setAssignReason(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 text-sm"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAssignModal(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800"
                >
                  Confirmar Asignación
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL OCUPAR BACKUP / DESCONTAR STOCK */}
      {showDeductModal && activeProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <MinusCircle className="h-5 w-5 text-amber-600" />
                Ocupar Unidad de Backup / Descontar Consumo
              </h3>
              <button onClick={() => setShowDeductModal(false)} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleDeductStock} className="mt-4 space-y-3.5">
              <div className="bg-amber-50 p-3 rounded-xl border border-amber-200 text-xs text-amber-900">
                <p className="font-bold">{activeProduct.name}</p>
                <p>
                  Stock actual: <strong>{activeProduct.current_stock} {activeProduct.unit_of_measure}</strong> • Si ocupa el backup, el sistema emitirá alerta de reposición automática.
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700">Cantidad a Ocupar / Descontar:</label>
                <input
                  type="number"
                  min="1"
                  max={Math.max(1, activeProduct.current_stock)}
                  required
                  value={deductQuantity}
                  onChange={(e) => setDeductQuantity(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Motivo / En qué equipo o área se ocupó el Backup o Tinta *:
                </label>
                <textarea
                  rows={2}
                  required
                  placeholder="Ej. Se ocupó tinta de backup en Impresora Contabilidad / Se usaron 15m2 de Cable Cat 6..."
                  value={deductReason}
                  onChange={(e) => setDeductReason(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 text-sm"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowDeductModal(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700"
                >
                  Confirmar Uso / Descuento
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL AGREGAR NUEVO PRODUCTO CON ESTRUCTURA INTELIGENTE */}
      {showProductModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl max-h-[92vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <Plus className="h-5 w-5 text-emerald-600" />
                  Agregar Producto a Categoría
                </h3>
                <p className="text-xs text-slate-500">
                  Configure la estructura del producto (por unidad, metro cuadrado para Cable Cat 6, alerta de Backup para tintas/chips, o si es Alquilado).
                </p>
              </div>
              <button onClick={() => setShowProductModal(false)} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateProduct} className="mt-4 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700">Carpeta / Categoría *</label>
                  <select
                    required
                    value={pForm.categoryId}
                    onChange={(e) => handleCategorySelectInNewProd(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  >
                    <option value="">Seleccione una carpeta...</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.code})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700">Estructura / Unidad de Medida *</label>
                  <select
                    value={pForm.unitOfMeasure}
                    onChange={(e) => setPForm({ ...pForm, unitOfMeasure: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-emerald-300 bg-emerald-50/30 px-3 py-2 text-sm font-semibold"
                  >
                    <option value="unidad">Por Unidad / Dispositivo Individual</option>
                    <option value="m2">Por Metro Cuadrado (m²) — Ej. Cable Cat 6</option>
                    <option value="metro">Por Metro Lineal (m)</option>
                    <option value="cartucho">Cartucho / Tinta (Aviso al usar Backup)</option>
                    <option value="backup">Equipo / Batería de Backup</option>
                    <option value="chip_sim">Chip SIM de Backup</option>
                    <option value="caja">Caja / Bobina</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">Nombre del Producto / Dispositivo *</label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Cable UTP Cat 6 Exterior / Tinta Epson T544 Negra / Impresora Ricoh MP305..."
                  value={pForm.name}
                  onChange={(e) => setPForm({ ...pForm, name: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700">Marca</label>
                  <input
                    type="text"
                    placeholder="Dell, Epson, Panduit, APC, Hikvision..."
                    value={pForm.brand}
                    onChange={(e) => setPForm({ ...pForm, brand: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700">Modelo</label>
                  <input
                    type="text"
                    placeholder="Cat 6 / L3250 / Pro..."
                    value={pForm.model}
                    onChange={(e) => setPForm({ ...pForm, model: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  />
                </div>
              </div>

              {/* Control de Alquiler (¿Es Alquilado y cuánto se paga?) */}
              <div className="rounded-xl border border-purple-200 bg-purple-50/40 p-3.5 space-y-3">
                <label className="flex items-center gap-2 text-xs font-bold text-purple-900 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={pForm.isRented}
                    onChange={(e) => setPForm({ ...pForm, isRented: e.target.checked })}
                    className="h-4 w-4 rounded border-purple-300 text-purple-700"
                  />
                  ¿Este producto es Alquilado? (Marcar para controlar cuánto se paga por cada producto)
                </label>

                {pForm.isRented && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-purple-900">Pago por Producto (Q) *</label>
                      <input
                        type="number"
                        step="0.01"
                        value={pForm.rentalCost}
                        onChange={(e) => setPForm({ ...pForm, rentalCost: e.target.value })}
                        placeholder="Ej. 450.00"
                        className="mt-1 w-full rounded-xl border border-purple-200 bg-white px-3 py-1.5 text-sm font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-purple-900">Frecuencia de Pago</label>
                      <select
                        value={pForm.rentalPeriod}
                        onChange={(e) => setPForm({ ...pForm, rentalPeriod: e.target.value })}
                        className="mt-1 w-full rounded-xl border border-purple-200 bg-white px-3 py-1.5 text-sm"
                      >
                        <option value="MENSUAL">Mensual</option>
                        <option value="ANUAL">Anual</option>
                        <option value="POR_USO">Por Uso / Impresión</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-purple-900">Empresa Arrendadora</label>
                      <input
                        type="text"
                        value={pForm.rentalProvider}
                        onChange={(e) => setPForm({ ...pForm, rentalProvider: e.target.value })}
                        placeholder="Ej. CopyRent / Ricoh"
                        className="mt-1 w-full rounded-xl border border-purple-200 bg-white px-3 py-1.5 text-sm"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Stocks y Alerta de Backup */}
              <div className="grid grid-cols-3 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
                <div>
                  <label className="block text-xs font-semibold text-slate-700">
                    Cantidad Inicial ({pForm.unitOfMeasure})
                  </label>
                  <input
                    type="number"
                    value={pForm.currentStock}
                    onChange={(e) => setPForm({ ...pForm, currentStock: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-rose-700">
                    Unidades de Backup (Avisar al ocupar)
                  </label>
                  <input
                    type="number"
                    value={pForm.backupAlertThreshold}
                    onChange={(e) => setPForm({ ...pForm, backupAlertThreshold: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-rose-200 bg-white px-3 py-2 text-sm font-mono text-rose-700 font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700">Precio Compra (Q)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={pForm.unitPrice}
                    onChange={(e) => setPForm({ ...pForm, unitPrice: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-mono"
                  />
                </div>
              </div>

              {/* Proveedor, Número de Contacto Opcional y Contrato Opcional */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700">Proveedor / Empresa</label>
                  <input
                    type="text"
                    placeholder="Ej. Intcomex, Claro, Steren..."
                    value={pForm.defaultSupplier}
                    onChange={(e) => setPForm({ ...pForm, defaultSupplier: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700">Número de Contacto (Opcional)</label>
                  <input
                    type="text"
                    placeholder="+502 2233-4455"
                    value={pForm.supplierPhone}
                    onChange={(e) => setPForm({ ...pForm, supplierPhone: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700">Contrato con la Empresa (Opcional)</label>
                  <input
                    type="text"
                    placeholder="CTR-2026-001"
                    value={pForm.contractNumber}
                    onChange={(e) => setPForm({ ...pForm, contractNumber: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-mono"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowProductModal(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-emerald-700 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-800"
                >
                  Guardar Producto en Categoría
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL NUEVA CARPETA / CATEGORÍA */}
      {showCategoryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <FolderPlus className="h-5 w-5 text-emerald-600" />
                Crear Nueva Carpeta de Categoría
              </h3>
              <button onClick={() => setShowCategoryModal(false)} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateCategory} className="mt-4 space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700">Nombre de la Carpeta / Categoría *</label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Cables, Impresoras, Tintas, Backups, UPS, Monitores, Cámaras..."
                  value={cForm.name}
                  onChange={(e) =>
                    setCForm({
                      ...cForm,
                      name: e.target.value,
                      code: cForm.code || e.target.value.substring(0, 4).toUpperCase().replace(/[^A-Z0-9]/g, ''),
                    })
                  }
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700">Prefijo Código (Opcional)</label>
                  <input
                    type="text"
                    placeholder="CAB / IMP / UPS"
                    value={cForm.code}
                    onChange={(e) => setCForm({ ...cForm, code: e.target.value.toUpperCase() })}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-mono uppercase"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700">Tipo de Control</label>
                  <select
                    value={cForm.trackingType}
                    onChange={(e) => setCForm({ ...cForm, trackingType: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  >
                    <option value="INDIVIDUAL">Por Serie / Equipo Individual</option>
                    <option value="QUANTITY">Por Cantidad / Metros / Tintas</option>
                    <option value="BATCH">Por Lotes / Cajas</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700">Descripción de la Carpeta</label>
                <input
                  type="text"
                  placeholder="Qué productos se almacenan en esta categoría..."
                  value={cForm.description}
                  onChange={(e) => setCForm({ ...cForm, description: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowCategoryModal(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800"
                >
                  Crear Carpeta
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
