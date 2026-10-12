'use client';

import React, { useState, useEffect } from 'react';
import {
  Layers,
  Plus,
  Search,
  Package,
  Boxes,
  Tag,
  AlertTriangle,
  FolderPlus,
  X,
  Check,
  UserCheck,
  MinusCircle,
  Trash2,
  Eye,
  DollarSign,
  History,
  Building,
  Image as ImageIcon,
  CheckCircle2,
  AlertCircle,
  Edit3
} from 'lucide-react';

export default function ProductosPage() {
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('');

  // Modales
  const [showProductModal, setShowProductModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showDeductModal, setShowDeductModal] = useState(false);

  // Producto activo para ver detalles / editar / asignar
  const [activeProduct, setActiveProduct] = useState<any | null>(null);
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
    minStock: 5,
    targetStock: 25,
    currentStock: 0,
    imageUrl: '',
    description: '',
    defaultSupplier: '',
  });
  const [productSuppliers, setProductSuppliers] = useState<any[]>([]);
  const [priceHistory, setPriceHistory] = useState<any[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);

  // Formulario Asignación directa a empleado
  const [assignEmployeeId, setAssignEmployeeId] = useState('');
  const [assignQuantity, setAssignQuantity] = useState('1');
  const [assignReason, setAssignReason] = useState('');

  // Formulario Descontar stock
  const [deductQuantity, setDeductQuantity] = useState('1');
  const [deductReason, setDeductReason] = useState('');

  // Formulario Nuevo Proveedor en detalle
  const [newSupplierName, setNewSupplierName] = useState('');
  const [newSupplierContact, setNewSupplierContact] = useState('');

  // Formulario Nuevo Producto
  const [pForm, setPForm] = useState({
    code: '',
    name: '',
    categoryId: '',
    brand: '',
    model: '',
    imageUrl: '',
    unitOfMeasure: 'unidad',
    currentStock: '10',
    minStock: '5',
    targetStock: '25',
    unitPrice: '0',
    boxPrice: '0',
    unitsPerBox: '1',
    defaultSupplier: '',
    description: '',
  });

  // Formulario Categoría
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
      minStock: p.min_stock ?? 5,
      targetStock: p.target_stock ?? 25,
      currentStock: p.current_stock ?? 0,
      imageUrl: p.image_url || '',
      description: p.description || '',
      defaultSupplier: p.default_supplier || '',
    });
    setShowDetailModal(true);
    setDetailLoading(true);

    try {
      const res = await fetch(`/api/products?id=${p.id}`);
      const data = await res.json();
      if (data.product) {
        setActiveProduct(data.product);
        setEditForm({
          id: data.product.id,
          name: data.product.name || '',
          brand: data.product.brand || '',
          model: data.product.model || '',
          categoryId: data.product.category_id || '',
          unitOfMeasure: data.product.unit_of_measure || 'unidad',
          unitPrice: data.product.unit_price ?? 0,
          boxPrice: data.product.box_price ?? 0,
          unitsPerBox: data.product.units_per_box ?? 1,
          minStock: data.product.min_stock ?? 5,
          targetStock: data.product.target_stock ?? 25,
          currentStock: data.product.current_stock ?? 0,
          imageUrl: data.product.image_url || '',
          description: data.product.description || '',
          defaultSupplier: data.product.default_supplier || '',
        });
      }
      if (data.suppliers) setProductSuppliers(data.suppliers);
      if (data.priceHistory) setPriceHistory(data.priceHistory);
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
      // Refrescar activo
      const resUpdated = await fetch(`/api/products?id=${editForm.id}`);
      const dataUpdated = await resUpdated.json();
      if (dataUpdated.product) setActiveProduct(dataUpdated.product);
      setFeedback({ type: 'success', message: '¡Producto modificado exitosamente!' });
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
        currentStock: '10',
        minStock: '5',
        targetStock: '25',
        unitPrice: '0',
        boxPrice: '0',
        unitsPerBox: '1',
        defaultSupplier: '',
        description: '',
      });
      loadData();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message });
    }
  };

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/catalogs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'category',
          data: cForm,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setShowCategoryModal(false);
      setCForm({ code: '', name: '', trackingType: 'INDIVIDUAL', description: '' });
      loadData();
    } catch (err: any) {
      alert(`Error: ${err.message}`);
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
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setShowAssignModal(false);
      setAssignQuantity('1');
      setAssignReason('');
      setAssignEmployeeId('');
      alert(data.message || 'Asignación realizada con éxito.');
      loadData();
      if (showDetailModal) {
        openProductDetail({ ...activeProduct, current_stock: data.newStock });
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDeductStock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeProduct) return;

    if (!deductReason.trim()) {
      alert('El motivo del descuento es obligatorio por Poka-Yoke.');
      return;
    }

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
      loadData();
      if (showDetailModal) {
        openProductDetail({ ...activeProduct, current_stock: data.newStock });
      }
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
    const reason = prompt(`¿Motivo de eliminación/inactivación del producto "${p.name}"?`);
    if (reason === null) return;
    if (!reason.trim()) {
      alert('Debe especificar un motivo válido.');
      return;
    }

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
      (p.model && p.model.toLowerCase().includes(search.toLowerCase()));

    const matchesCat = catFilter ? p.category_id === catFilter : true;
    return matchesSearch && matchesCat;
  });

  return (
    <div className="space-y-6">
        {/* Cabecera */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-5">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2.5">
              <Layers className="h-7 w-7 text-emerald-600" />
              Catálogo de Productos y Suministros
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Inventario general • Asignación directa a empleados restando de bodega • Precios unitarios y por caja en Quetzales (Q)
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowCategoryModal(true)}
              className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
            >
              <FolderPlus className="h-4 w-4 text-slate-500" />
              <span>+ Categoría</span>
            </button>
            <button
              onClick={() => setShowProductModal(true)}
              className="flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white shadow-md hover:bg-emerald-800 transition"
            >
              <Plus className="h-4 w-4" />
              <span>Nuevo Producto</span>
            </button>
          </div>
        </div>

        {/* Filtros */}
        <div className="flex flex-col md:flex-row gap-3 items-center justify-between bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por nombre, código (LAP-DELL-5440), marca o modelo..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-4 py-2 text-sm text-slate-800 focus:border-emerald-600 focus:bg-white focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto">
            <select
              value={catFilter}
              onChange={(e) => setCatFilter(e.target.value)}
              className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 focus:border-emerald-600 focus:outline-none"
            >
              <option value="">Todas las categorías</option>
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
              Cargando catálogo de productos...
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="col-span-full py-16 text-center text-slate-400">
              No se encontraron productos registrados.
            </div>
          ) : (
            filteredProducts.map((p) => {
              const isLowStock = p.current_stock <= p.min_stock;
              return (
                <div
                  key={p.id}
                  onClick={() => openProductDetail(p)}
                  className="group cursor-pointer rounded-2xl border border-slate-200 bg-white p-4 shadow-sm hover:shadow-md hover:border-emerald-600 transition flex flex-col justify-between"
                >
                  <div>
                    {/* Imagen o Placeholder */}
                    <div className="relative h-40 w-full overflow-hidden rounded-xl bg-slate-100 mb-3 flex items-center justify-center">
                      {p.image_url ? (
                        <img
                          src={p.image_url}
                          alt={p.name}
                          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                        />
                      ) : (
                        <Package className="h-12 w-12 text-slate-300" />
                      )}

                      {/* Badge de Stock Bajo con Alerta */}
                      {isLowStock && (
                        <div className="absolute top-2 right-2 flex items-center gap-1 rounded-full bg-rose-600 px-2 py-0.5 text-[10px] font-bold text-white shadow">
                          <AlertTriangle className="h-3 w-3" />
                          <span>Stock Bajo ({p.current_stock})</span>
                        </div>
                      )}

                      <span className="absolute bottom-2 left-2 rounded-md bg-slate-900/80 px-2 py-0.5 font-mono text-[10px] font-bold text-white backdrop-blur">
                        {p.code}
                      </span>
                    </div>

                    <div className="text-[11px] font-semibold text-emerald-700 uppercase tracking-wide">
                      {p.category_name}
                    </div>
                    <h3 className="font-bold text-slate-900 text-sm line-clamp-2 mt-0.5 group-hover:text-emerald-700">
                      {p.name}
                    </h3>
                    <p className="text-xs text-slate-500 mt-1">
                      {p.brand} {p.model}
                    </p>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100">
                    <div className="flex items-center justify-between text-xs mb-2">
                      <span className="text-slate-500">Stock Bodega:</span>
                      <span
                        className={`font-mono font-bold ${
                          isLowStock ? 'text-rose-600' : 'text-slate-900'
                        }`}
                      >
                        {p.current_stock} {p.unit_of_measure}s
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500">Precio Unitario:</span>
                      <span className="font-mono font-bold text-emerald-700">
                        Q{Number(p.unit_price || 0).toLocaleString('es-GT', { minimumFractionDigits: 2 })}
                      </span>
                    </div>

                    {/* Botones rápidos de acción */}
                    <div className="mt-3 flex gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveProduct(p);
                          setShowAssignModal(true);
                        }}
                        className="flex-1 flex items-center justify-center gap-1 rounded-xl bg-emerald-50 py-1.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 transition"
                        title="Asignar a empleado restando de inventario"
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
                        className="rounded-xl border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-50 transition"
                        title="Descontar unidades de stock"
                      >
                        <MinusCircle className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* MODAL DETALLES DEL PRODUCTO (Imagen, Múltiples Proveedores, Historial de Precios, Desglose y Modificación) */}
        {showDetailModal && activeProduct && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
            <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl animate-in fade-in zoom-in-95">
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
                /* FORMULARIO PARA MODIFICAR EL PRODUCTO */
                <form onSubmit={handleSaveProductEdit} className="mt-4 space-y-4 text-xs">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block font-medium text-slate-700 mb-1">Nombre del Producto *</label>
                      <input
                        type="text"
                        required
                        value={editForm.name}
                        onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-800 focus:border-emerald-600 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block font-medium text-slate-700 mb-1">Categoría</label>
                      <select
                        value={editForm.categoryId}
                        onChange={(e) => setEditForm({ ...editForm, categoryId: e.target.value })}
                        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-800 focus:border-emerald-600 focus:outline-none"
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
                        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-800 focus:border-emerald-600 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block font-medium text-slate-700 mb-1">Modelo</label>
                      <input
                        type="text"
                        value={editForm.model}
                        onChange={(e) => setEditForm({ ...editForm, model: e.target.value })}
                        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-800 focus:border-emerald-600 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block font-medium text-slate-700 mb-1">Precio Unitario (Q) *</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        required
                        value={editForm.unitPrice}
                        onChange={(e) => setEditForm({ ...editForm, unitPrice: e.target.value })}
                        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-800 focus:border-emerald-600 focus:outline-none font-mono"
                      />
                    </div>
                    <div>
                      <label className="block font-medium text-slate-700 mb-1">Precio por Caja (Q)</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={editForm.boxPrice}
                        onChange={(e) => setEditForm({ ...editForm, boxPrice: e.target.value })}
                        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-800 focus:border-emerald-600 focus:outline-none font-mono"
                      />
                    </div>
                    <div>
                      <label className="block font-medium text-slate-700 mb-1">Unidades por Caja</label>
                      <input
                        type="number"
                        min="1"
                        value={editForm.unitsPerBox}
                        onChange={(e) => setEditForm({ ...editForm, unitsPerBox: e.target.value })}
                        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-800 focus:border-emerald-600 focus:outline-none font-mono"
                      />
                    </div>
                    <div>
                      <label className="block font-medium text-slate-700 mb-1">Unidad de Medida</label>
                      <input
                        type="text"
                        value={editForm.unitOfMeasure}
                        onChange={(e) => setEditForm({ ...editForm, unitOfMeasure: e.target.value })}
                        placeholder="unidad, pieza, caja..."
                        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-800 focus:border-emerald-600 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block font-medium text-slate-700 mb-1">Stock Actual en Bodega</label>
                      <input
                        type="number"
                        min="0"
                        value={editForm.currentStock}
                        onChange={(e) => setEditForm({ ...editForm, currentStock: e.target.value })}
                        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-800 focus:border-emerald-600 focus:outline-none font-mono font-bold"
                      />
                    </div>
                    <div>
                      <label className="block font-medium text-slate-700 mb-1">Stock Mínimo (Alerta)</label>
                      <input
                        type="number"
                        min="0"
                        value={editForm.minStock}
                        onChange={(e) => setEditForm({ ...editForm, minStock: e.target.value })}
                        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-800 focus:border-emerald-600 focus:outline-none font-mono"
                      />
                    </div>
                    <div>
                      <label className="block font-medium text-slate-700 mb-1">Stock Objetivo</label>
                      <input
                        type="number"
                        min="0"
                        value={editForm.targetStock}
                        onChange={(e) => setEditForm({ ...editForm, targetStock: e.target.value })}
                        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-800 focus:border-emerald-600 focus:outline-none font-mono"
                      />
                    </div>
                    <div>
                      <label className="block font-medium text-slate-700 mb-1">Proveedor Principal</label>
                      <input
                        type="text"
                        value={editForm.defaultSupplier}
                        onChange={(e) => setEditForm({ ...editForm, defaultSupplier: e.target.value })}
                        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-800 focus:border-emerald-600 focus:outline-none"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block font-medium text-slate-700 mb-1">URL de Imagen del Producto</label>
                    <input
                      type="url"
                      value={editForm.imageUrl}
                      onChange={(e) => setEditForm({ ...editForm, imageUrl: e.target.value })}
                      placeholder="https://..."
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-800 focus:border-emerald-600 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block font-medium text-slate-700 mb-1">Descripción / Especificaciones</label>
                    <textarea
                      rows={2}
                      value={editForm.description}
                      onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-800 focus:border-emerald-600 focus:outline-none"
                    />
                  </div>

                  <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
                    <button
                      type="button"
                      onClick={() => setIsEditingProduct(false)}
                      className="rounded-xl border border-slate-200 px-4 py-2 font-semibold text-slate-600 hover:bg-slate-50"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={savingEdit}
                      className="rounded-xl bg-emerald-700 px-5 py-2 font-semibold text-white shadow-md hover:bg-emerald-800 disabled:opacity-50 flex items-center gap-1.5"
                    >
                      <Check className="h-4 w-4" />
                      <span>{savingEdit ? 'Guardando...' : 'Guardar Cambios'}</span>
                    </button>
                  </div>
                </form>
              ) : (
                /* VISTA REGULAR DE DETALLES */
                <>

              {/* Imagen del producto si existe */}
              {activeProduct.image_url && (
                <div className="mt-4 h-48 w-full overflow-hidden rounded-xl bg-slate-50 border border-slate-100">
                  <img
                    src={activeProduct.image_url}
                    alt={activeProduct.name}
                    className="h-full w-full object-cover"
                  />
                </div>
              )}

              {/* Parámetros Financieros y de Stock */}
              <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-100 text-xs">
                <div>
                  <span className="text-slate-500 block">Stock en Bodega</span>
                  <span className="text-sm font-bold font-mono text-slate-900">
                    {activeProduct.current_stock} {activeProduct.unit_of_measure}s
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">Precio Unitario</span>
                  <span className="text-sm font-bold font-mono text-emerald-700">
                    Q{Number(activeProduct.unit_price || 0).toLocaleString('es-GT', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">Precio por Caja</span>
                  <span className="text-sm font-bold font-mono text-slate-900">
                    Q{Number(activeProduct.box_price || 0).toLocaleString('es-GT', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">Unidades por Caja</span>
                  <span className="text-sm font-bold font-mono text-slate-900">
                    {activeProduct.units_per_box || 1} unids
                  </span>
                </div>
              </div>

              {/* Múltiples Proveedores Habituales */}
              <div className="mt-5">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 mb-2 flex items-center gap-1.5">
                  <Building className="h-4 w-4 text-emerald-600" />
                  Proveedores Habituales ({productSuppliers.length})
                </h4>

                <div className="space-y-1.5 mb-3">
                  {productSuppliers.length === 0 ? (
                    <p className="text-xs text-slate-400 italic">No hay proveedores registrados aún.</p>
                  ) : (
                    productSuppliers.map((s) => (
                      <div
                        key={s.id}
                        className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-xs border border-slate-100"
                      >
                        <span className="font-semibold text-slate-800">{s.supplier_name}</span>
                        <span className="text-slate-500">{s.contact_info || 'Sin contacto'}</span>
                      </div>
                    ))
                  )}
                </div>

                {/* Agregar Proveedor adicional */}
                <div className="flex gap-2 text-xs">
                  <input
                    type="text"
                    placeholder="Nuevo proveedor habitual..."
                    value={newSupplierName}
                    onChange={(e) => setNewSupplierName(e.target.value)}
                    className="flex-1 rounded-xl border border-slate-200 px-3 py-1.5 focus:border-emerald-600 focus:outline-none"
                  />
                  <input
                    type="text"
                    placeholder="Contacto / Teléfono"
                    value={newSupplierContact}
                    onChange={(e) => setNewSupplierContact(e.target.value)}
                    className="w-1/3 rounded-xl border border-slate-200 px-3 py-1.5 focus:border-emerald-600 focus:outline-none"
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

              {/* Historial de Precios de Compra */}
              <div className="mt-5">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 mb-2 flex items-center gap-1.5">
                  <History className="h-4 w-4 text-emerald-600" />
                  Historial de Precios de Compra
                </h4>

                <div className="overflow-hidden rounded-xl border border-slate-100 text-xs">
                  <table className="w-full text-left">
                    <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-100">
                      <tr>
                        <th className="py-2 px-3">Fecha</th>
                        <th className="py-2 px-3">Precio Unitario</th>
                        <th className="py-2 px-3">Proveedor</th>
                        <th className="py-2 px-3">Factura / Nota</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {priceHistory.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="py-4 text-center text-slate-400">
                            Sin historial de compras anteriores registrado.
                          </td>
                        </tr>
                      ) : (
                        priceHistory.map((ph) => (
                          <tr key={ph.id}>
                            <td className="py-2 px-3 font-mono">{ph.purchase_date}</td>
                            <td className="py-2 px-3 font-mono font-bold text-emerald-700">
                              Q{Number(ph.unit_price).toLocaleString('es-GT', { minimumFractionDigits: 2 })}
                            </td>
                            <td className="py-2 px-3">{ph.supplier_name || 'N/A'}</td>
                            <td className="py-2 px-3 text-slate-500">{ph.invoice_number || ph.notes || '-'}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
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
                    onClick={() => {
                      setShowAssignModal(true);
                    }}
                    className="flex items-center gap-1.5 rounded-xl bg-emerald-700 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-800"
                  >
                    <UserCheck className="h-4 w-4" />
                    <span>Asignar a Empleado</span>
                  </button>
                  <button
                    onClick={() => {
                      setShowDeductModal(true);
                    }}
                    className="flex items-center gap-1.5 rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    <MinusCircle className="h-4 w-4" />
                    <span>Descontar Stock</span>
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
            <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl animate-in fade-in zoom-in-95">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <UserCheck className="h-5 w-5 text-emerald-600" />
                  Asignar a Empleado
                </h3>
                <button onClick={() => setShowAssignModal(false)} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleAssignToEmployee} className="mt-4 space-y-3.5">
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 text-xs">
                  <p className="font-bold text-slate-800">{activeProduct.name}</p>
                  <p className="text-slate-500">
                    Stock disponible en Bodega: <span className="font-mono font-bold text-emerald-700">{activeProduct.current_stock}</span> unidades
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700">Seleccionar Empleado Receptor:</label>
                  <select
                    required
                    value={assignEmployeeId}
                    onChange={(e) => setAssignEmployeeId(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none"
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
                  <label className="block text-xs font-medium text-slate-700">Cantidad a Asignar (se restará de bodega):</label>
                  <input
                    type="number"
                    min="1"
                    max={activeProduct.current_stock}
                    required
                    value={assignQuantity}
                    onChange={(e) => setAssignQuantity(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-mono focus:border-emerald-600 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700">Motivo / Detalle de la entrega:</label>
                  <textarea
                    rows={2}
                    placeholder="ej. Suministro mensual para departamento de empaque..."
                    value={assignReason}
                    onChange={(e) => setAssignReason(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 text-sm focus:border-emerald-600 focus:outline-none"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowAssignModal(false)}
                    className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800"
                  >
                    Confirmar Asignación y Restar Stock
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL DESCONTAR STOCK CON MOTIVO */}
        {showDeductModal && activeProduct && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl animate-in fade-in zoom-in-95">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <MinusCircle className="h-5 w-5 text-amber-600" />
                  Descontar Unidades de Stock
                </h3>
                <button onClick={() => setShowDeductModal(false)} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleDeductStock} className="mt-4 space-y-3.5">
                <div className="bg-amber-50 p-3 rounded-xl border border-amber-100 text-xs text-amber-900">
                  <p className="font-bold">Descuento de inventario en Bodega Central</p>
                  <p>Stock actual: {activeProduct.current_stock} {activeProduct.unit_of_measure}s</p>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700">Cantidad a Descontar:</label>
                  <input
                    type="number"
                    min="1"
                    max={activeProduct.current_stock}
                    required
                    value={deductQuantity}
                    onChange={(e) => setDeductQuantity(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-mono focus:border-emerald-600 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700">
                    Motivo Obligatorio del Descuento (Poka-Yoke):
                  </label>
                  <textarea
                    rows={2}
                    required
                    placeholder="ej. Merma por daño en embalaje, consumo directo en planta..."
                    value={deductReason}
                    onChange={(e) => setDeductReason(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 text-sm focus:border-emerald-600 focus:outline-none"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowDeductModal(false)}
                    className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="rounded-xl bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700"
                  >
                    Aplicar Descuento
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL NUEVO PRODUCTO */}
        {showProductModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
            <div className="w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl animate-in fade-in zoom-in-95">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <Plus className="h-5 w-5 text-emerald-600" />
                  Registrar Nuevo Producto
                </h3>
                <button onClick={() => setShowProductModal(false)} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleCreateProduct} className="mt-4 space-y-3.5">
                <div>
                  <label className="block text-xs font-medium text-slate-700">Categoría</label>
                  <select
                    required
                    value={pForm.categoryId}
                    onChange={(e) => setPForm({ ...pForm, categoryId: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none"
                  >
                    <option value="">Seleccione una categoría</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.code})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700">Nombre del Producto / Suministro</label>
                  <input
                    type="text"
                    required
                    placeholder="ej. Laptop Dell Latitude 5440 Core i7..."
                    value={pForm.name}
                    onChange={(e) => setPForm({ ...pForm, name: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700">Marca</label>
                    <input
                      type="text"
                      placeholder="Dell, HP, Logitech..."
                      value={pForm.brand}
                      onChange={(e) => setPForm({ ...pForm, brand: e.target.value })}
                      className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700">Modelo</label>
                    <input
                      type="text"
                      placeholder="Latitude 5440, M185..."
                      value={pForm.model}
                      onChange={(e) => setPForm({ ...pForm, model: e.target.value })}
                      className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700">URL de Imagen (Opcional)</label>
                  <input
                    type="url"
                    placeholder="https://images.unsplash.com/..."
                    value={pForm.imageUrl}
                    onChange={(e) => setPForm({ ...pForm, imageUrl: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none"
                  />
                </div>

                {/* Precios Unitarios y de Caja */}
                <div className="grid grid-cols-3 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <div>
                    <label className="block text-xs font-medium text-slate-700">Precio Unitario (Q)</label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={pForm.unitPrice}
                      onChange={(e) => setPForm({ ...pForm, unitPrice: e.target.value })}
                      className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-mono focus:border-emerald-600 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700">Precio por Caja (Q)</label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={pForm.boxPrice}
                      onChange={(e) => setPForm({ ...pForm, boxPrice: e.target.value })}
                      className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-mono focus:border-emerald-600 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700">Unidades por Caja</label>
                    <input
                      type="number"
                      min="1"
                      placeholder="1"
                      value={pForm.unitsPerBox}
                      onChange={(e) => setPForm({ ...pForm, unitsPerBox: e.target.value })}
                      className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-mono focus:border-emerald-600 focus:outline-none"
                    />
                  </div>
                </div>

                {/* Stocks y Alerta Mínima para Dashboard */}
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700">Stock Inicial</label>
                    <input
                      type="number"
                      value={pForm.currentStock}
                      onChange={(e) => setPForm({ ...pForm, currentStock: e.target.value })}
                      className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-mono focus:border-emerald-600 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700">
                      Stock Mínimo (Alerta Dashboard)
                    </label>
                    <input
                      type="number"
                      value={pForm.minStock}
                      onChange={(e) => setPForm({ ...pForm, minStock: e.target.value })}
                      className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-mono focus:border-emerald-600 focus:outline-none text-rose-600 font-bold"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700">Unidad de Medida</label>
                    <select
                      value={pForm.unitOfMeasure}
                      onChange={(e) => setPForm({ ...pForm, unitOfMeasure: e.target.value })}
                      className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none"
                    >
                      <option value="unidad">Unidad</option>
                      <option value="caja">Caja</option>
                      <option value="rollo">Rollo</option>
                      <option value="paquete">Paquete</option>
                      <option value="metro">Metro</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700">Proveedor Habitual Principal</label>
                  <input
                    type="text"
                    placeholder="ej. Dell Guatemala, Intcomex, 3M..."
                    value={pForm.defaultSupplier}
                    onChange={(e) => setPForm({ ...pForm, defaultSupplier: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none"
                  />
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
                    className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800"
                  >
                    Guardar Producto
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL NUEVA CATEGORÍA */}
        {showCategoryModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl animate-in fade-in zoom-in-95">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <FolderPlus className="h-5 w-5 text-emerald-600" />
                  Nueva Categoría
                </h3>
                <button onClick={() => setShowCategoryModal(false)} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleCreateCategory} className="mt-4 space-y-3.5">
                <div>
                  <label className="block text-xs font-medium text-slate-700">Nombre de Categoría</label>
                  <input
                    type="text"
                    required
                    placeholder="ej. Herramientas, Sensores..."
                    value={cForm.name}
                    onChange={(e) => setCForm({ ...cForm, name: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700">Código (3-4 letras)</label>
                    <input
                      type="text"
                      required
                      placeholder="HERR"
                      value={cForm.code}
                      onChange={(e) => setCForm({ ...cForm, code: e.target.value.toUpperCase() })}
                      className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-mono uppercase focus:border-emerald-600 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700">Tipo de Rastreo</label>
                    <select
                      value={cForm.trackingType}
                      onChange={(e) => setCForm({ ...cForm, trackingType: e.target.value })}
                      className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none"
                    >
                      <option value="INDIVIDUAL">Individual (Serie/Código)</option>
                      <option value="QUANTITY">Por Cantidad / Consumo</option>
                      <option value="BATCH">Por Lotes</option>
                    </select>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowCategoryModal(false)}
                    className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800"
                  >
                    Crear Categoría
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
  );
}
