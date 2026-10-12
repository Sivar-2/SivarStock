'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  DollarSign,
  Search,
  Filter,
  Plus,
  Calendar,
  Building,
  FileText,
  ShieldCheck,
  ExternalLink,
  Edit,
  Boxes,
  FileCheck,
  Download,
  AlertCircle,
  CheckCircle2,
  X,
  FileUp,
  Receipt
} from 'lucide-react';

export default function CostosPage() {
  const [costs, setCosts] = useState<any[]>([]);
  const [inventoryItems, setInventoryItems] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [totals, setTotals] = useState<any>({ totalGeneral: 0, totalImpuestos: 0 });
  const [loading, setLoading] = useState(true);

  // Filtros
  const [search, setSearch] = useState('');
  const [costNature, setCostNature] = useState('');
  const [deptFilter, setDeptFilter] = useState('');

  // Modales
  const [showNewCostModal, setShowNewCostModal] = useState(false);
  const [showEditItemCostModal, setShowEditItemCostModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedCost, setSelectedCost] = useState<any | null>(null);

  // Formulario buscar y modificar inventario
  const [itemSearchText, setItemSearchText] = useState('');
  const [selectedInventoryItem, setSelectedInventoryItem] = useState<any | null>(null);
  const [itemCostForm, setItemCostForm] = useState({
    purchasePrice: '',
    invoiceNumber: '',
    purchaseOrder: '',
    warrantyExpiration: '',
    warrantyDocumentUrl: '',
    invoiceDocumentUrl: '',
    supplier: '',
  });

  // Formulario nuevo gasto directo
  const [newCostForm, setNewCostForm] = useState({
    concept: '',
    amount: '',
    costNature: 'ADQUISICION',
    chargedDepartmentId: '',
    supplier: '',
    invoiceNumber: '',
    purchaseOrder: '',
    warrantyDocumentUrl: '',
    invoiceDocumentUrl: '',
    expenseDate: new Date().toISOString().split('T')[0],
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const queryParams = new URLSearchParams();
      if (search) queryParams.set('search', search);
      if (costNature) queryParams.set('costNature', costNature);
      if (deptFilter) queryParams.set('chargedDeptId', deptFilter);

      const [costRes, invRes, deptRes] = await Promise.all([
        fetch(`/api/costs?${queryParams.toString()}`),
        fetch('/api/inventory/items'),
        fetch('/api/catalogs'),
      ]);

      const costData = await costRes.json();
      const invData = await invRes.json();
      const deptData = await deptRes.json();

      if (costData.costs) setCosts(costData.costs);
      if (costData.totals) setTotals(costData.totals);
      if (invData.items) setInventoryItems(invData.items);
      if (deptData.departments) setDepartments(deptData.departments);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [costNature, deptFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadData();
  };

  // Guardar modificación de costo y factura para un activo de inventario
  const handleSaveInventoryCost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInventoryItem) return;

    try {
      const res = await fetch('/api/costs', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'UPDATE_INVENTORY_COST',
          itemId: selectedInventoryItem.id,
          ...itemCostForm,
        }),
      });

      const d = await res.json();
      if (!res.ok) throw new Error(d.error);

      setShowEditItemCostModal(false);
      setSelectedInventoryItem(null);
      alert('Costo, factura y garantía del inventario actualizados con éxito.');
      loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleCreateCost = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/costs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newCostForm),
      });

      const d = await res.json();
      if (!res.ok) throw new Error(d.error);

      setShowNewCostModal(false);
      setNewCostForm({
        concept: '',
        amount: '',
        costNature: 'ADQUISICION',
        chargedDepartmentId: '',
        supplier: '',
        invoiceNumber: '',
        purchaseOrder: '',
        warrantyDocumentUrl: '',
        invoiceDocumentUrl: '',
        expenseDate: new Date().toISOString().split('T')[0],
      });
      loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const filteredInventoryForModal = inventoryItems.filter(
    (i) =>
      i.permanent_code.toLowerCase().includes(itemSearchText.toLowerCase()) ||
      i.brand.toLowerCase().includes(itemSearchText.toLowerCase()) ||
      i.model.toLowerCase().includes(itemSearchText.toLowerCase()) ||
      (i.serial_number && i.serial_number.toLowerCase().includes(itemSearchText.toLowerCase()))
  );

  return (
    <div className="space-y-6">
        {/* Cabecera */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-5">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2.5">
              <DollarSign className="h-7 w-7 text-emerald-600" />
              Gestión de Costos, Facturas y Garantías
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Control financiero • Búsqueda de inventario para asignar costos y facturas • Documentos adjuntos (PDF / Imagen)
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* Botón Buscar Inventario y Modificar Costo */}
            <button
              onClick={() => {
                setItemSearchText('');
                setSelectedInventoryItem(null);
                setShowEditItemCostModal(true);
              }}
              className="flex items-center gap-2 rounded-xl border border-emerald-600 bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-emerald-800 shadow-sm hover:bg-emerald-100 transition"
              title="Buscar activo del inventario para agregar costo, n° factura y garantía"
            >
              <Boxes className="h-4 w-4 text-emerald-700" />
              <span>Buscar Inventario & Costear</span>
            </button>

            <button
              onClick={() => setShowNewCostModal(true)}
              className="flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white shadow-md hover:bg-emerald-800 transition"
            >
              <Plus className="h-4 w-4" />
              <span>Registrar Gasto Directo</span>
            </button>
          </div>
        </div>

        {/* Tarjetas de Totales Financieros */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
              Gasto Total Registrado
            </span>
            <span className="mt-1 block text-2xl font-extrabold text-slate-900 font-mono">
              Q{Number(totals.totalGeneral || 0).toLocaleString('es-GT', { minimumFractionDigits: 2 })}
            </span>
            <span className="text-xs text-slate-500 mt-1 block">Moneda oficial de Guatemala (GTQ)</span>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
              IVA Acumulado (12% GT)
            </span>
            <span className="mt-1 block text-2xl font-extrabold text-emerald-700 font-mono">
              Q{Number(totals.totalImpuestos || 0).toLocaleString('es-GT', { minimumFractionDigits: 2 })}
            </span>
            <span className="text-xs text-slate-500 mt-1 block">Crédito fiscal tributario</span>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
              Registros Contables
            </span>
            <span className="mt-1 block text-2xl font-extrabold text-slate-900 font-mono">
              {costs.length} operaciones
            </span>
            <span className="text-xs text-slate-500 mt-1 block">Activos, compras y servicios</span>
          </div>
        </div>

        {/* Filtros */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
          <div className="md:col-span-6 relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por concepto, N° factura, proveedor, activo (SIV-IT-000001)..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-4 py-2 text-sm text-slate-800 focus:border-emerald-600 focus:bg-white focus:outline-none"
            />
          </div>

          <div className="md:col-span-3">
            <select
              value={costNature}
              onChange={(e) => setCostNature(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 focus:border-emerald-600 focus:outline-none"
            >
              <option value="">Todas las naturalezas</option>
              <option value="ADQUISICION">Adquisición de Activo</option>
              <option value="OPERATIVO">Gasto Operativo / Suministros</option>
              <option value="MANTENIMIENTO">Mantenimiento y Reparación</option>
              <option value="LICENCIA_SUSCRIPCION">Licencia / Suscripción</option>
            </select>
          </div>

          <div className="md:col-span-3">
            <select
              value={deptFilter}
              onChange={(e) => setDeptFilter(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 focus:border-emerald-600 focus:outline-none"
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

        {/* Tabla de Costos y Facturas */}
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="border-b border-slate-200 bg-slate-50/75 text-xs uppercase font-semibold text-slate-700">
                <tr>
                  <th className="py-3.5 px-4">Fecha</th>
                  <th className="py-3.5 px-4">Concepto / Activo</th>
                  <th className="py-3.5 px-4">Proveedor</th>
                  <th className="py-3.5 px-4">N° Factura & OC</th>
                  <th className="py-3.5 px-4">Área Imputada</th>
                  <th className="py-3.5 px-4">Importe (Q)</th>
                  <th className="py-3.5 px-4 text-center">Garantía / Doc</th>
                  <th className="py-3.5 px-4 text-right">Ver / Enlace</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-400">
                      Cargando registros contables...
                    </td>
                  </tr>
                ) : costs.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-400">
                      No se encontraron costos o facturas registradas.
                    </td>
                  </tr>
                ) : (
                  costs.map((c) => (
                    <tr
                      key={c.id}
                      onClick={() => {
                        setSelectedCost(c);
                        setShowDetailModal(true);
                      }}
                      className="hover:bg-slate-50/70 cursor-pointer transition"
                    >
                      <td className="py-3.5 px-4 font-mono text-xs text-slate-500">
                        {c.expense_date}
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-900">{c.concept}</div>
                        {c.item_permanent_code && (
                          <div className="font-mono text-[11px] text-emerald-700 flex items-center gap-1 mt-0.5">
                            <Boxes className="h-3 w-3" />
                            <span>{c.item_permanent_code} ({c.item_brand} {c.item_model})</span>
                          </div>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-xs font-medium text-slate-800">
                        {c.supplier || 'N/A'}
                      </td>

                      <td className="py-3.5 px-4 font-mono text-xs">
                        <div className="font-bold text-slate-900">{c.invoice_number || 'S/N'}</div>
                        {c.purchase_order && (
                          <div className="text-[11px] text-slate-400">OC: {c.purchase_order}</div>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-xs">
                        <span className="rounded-md bg-slate-100 px-2 py-1 text-slate-700 font-medium">
                          {c.charged_dept_name || 'General'}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                        Q{Number(c.total_amount || 0).toLocaleString('es-GT', { minimumFractionDigits: 2 })}
                      </td>

                      <td className="py-3.5 px-4 text-center">
                        {c.warranty_document_url || c.invoice_document_url || c.item_warranty_url ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-bold text-emerald-800">
                            <FileCheck className="h-3 w-3" />
                            Adjunto
                          </span>
                        ) : (
                          <span className="text-[11px] text-slate-400">Sin archivo</span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        {c.item_permanent_code ? (
                          <Link
                            href={`/inventario?search=${encodeURIComponent(c.item_permanent_code)}`}
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-emerald-700 hover:bg-slate-50 shadow-sm"
                            title="Hipervínculo directo al inventario físico"
                          >
                            <span>Ver Activo</span>
                            <ExternalLink className="h-3 w-3" />
                          </Link>
                        ) : (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedCost(c);
                              setShowDetailModal(true);
                            }}
                            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 text-xs"
                          >
                            Detalle
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* MODAL DETALLES DEL COSTO / FACTURA CON HIPERVÍNCULOS */}
        {showDetailModal && selectedCost && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
            <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl animate-in fade-in zoom-in-95">
              <div className="flex items-start justify-between border-b border-slate-100 pb-3">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">{selectedCost.concept}</h3>
                  <p className="text-xs text-slate-500">Proveedor: {selectedCost.supplier || 'N/A'}</p>
                </div>
                <button onClick={() => setShowDetailModal(false)} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="mt-4 space-y-3.5 text-xs">
                <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-100">
                  <div>
                    <span className="text-slate-400 block text-[11px]">Importe Total (Q):</span>
                    <span className="text-base font-bold font-mono text-emerald-700">
                      Q{Number(selectedCost.total_amount || 0).toLocaleString('es-GT', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Fecha del Gasto:</span>
                    <span className="font-semibold text-slate-800 font-mono">{selectedCost.expense_date}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span className="text-slate-400 block">N° Factura:</span>
                    <span className="font-mono font-bold text-slate-900">{selectedCost.invoice_number || 'Sin factura'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">N° Orden de Compra:</span>
                    <span className="font-mono text-slate-800">{selectedCost.purchase_order || 'N/A'}</span>
                  </div>
                </div>

                {/* Hipervínculo al Inventario Físico */}
                {selectedCost.item_permanent_code && (
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 p-3.5">
                    <span className="text-[11px] font-bold text-emerald-900 block mb-1">
                      Hipervínculo Conectado al Inventario Físico:
                    </span>
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-mono font-bold text-sm text-emerald-950">
                          {selectedCost.item_permanent_code}
                        </span>
                        <div className="text-xs text-emerald-800">{selectedCost.item_brand} {selectedCost.item_model}</div>
                      </div>
                      <Link
                        href={`/inventario?search=${encodeURIComponent(selectedCost.item_permanent_code)}`}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-800 shadow-sm"
                      >
                        <span>Ir al Activo en Bodega</span>
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Link>
                    </div>
                  </div>
                )}

                {/* Documentos de Garantía y Factura */}
                <div className="space-y-2 border-t border-slate-100 pt-3">
                  <span className="font-semibold text-slate-700 block">Documentos Respaldatorios:</span>
                  {(selectedCost.invoice_document_url || selectedCost.item_invoice_url) ? (
                    <a
                      href={selectedCost.invoice_document_url || selectedCost.item_invoice_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-slate-700 hover:bg-slate-100"
                    >
                      <span className="flex items-center gap-2">
                        <Receipt className="h-4 w-4 text-emerald-600" />
                        <span>Ver Factura (PDF / Imagen)</span>
                      </span>
                      <ExternalLink className="h-3.5 w-3.5 text-slate-400" />
                    </a>
                  ) : (
                    <p className="text-slate-400 italic">No se ha subido archivo de factura.</p>
                  )}

                  {(selectedCost.warranty_document_url || selectedCost.item_warranty_url) ? (
                    <a
                      href={selectedCost.warranty_document_url || selectedCost.item_warranty_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-slate-700 hover:bg-slate-100"
                    >
                      <span className="flex items-center gap-2">
                        <ShieldCheck className="h-4 w-4 text-emerald-600" />
                        <span>Ver Certificado de Garantía (PDF / Imagen)</span>
                      </span>
                      <ExternalLink className="h-3.5 w-3.5 text-slate-400" />
                    </a>
                  ) : (
                    <p className="text-slate-400 italic">No se ha subido certificado de garantía.</p>
                  )}
                </div>
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

        {/* MODAL BUSCAR INVENTARIO Y MODIFICAR COSTO / FACTURA / GARANTÍA */}
        {showEditItemCostModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
            <div className="w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl animate-in fade-in zoom-in-95">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <Boxes className="h-5 w-5 text-emerald-600" />
                  Buscar Inventario y Asignar Costos / Factura
                </h3>
                <button onClick={() => setShowEditItemCostModal(false)} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100">
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Paso 1: Buscar Activo si aún no se seleccionó */}
              {!selectedInventoryItem ? (
                <div className="mt-4 space-y-3">
                  <label className="block text-xs font-semibold text-slate-700">
                    Buscar activo por código, serie, marca o modelo:
                  </label>
                  <div className="relative">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <input
                      type="text"
                      placeholder="ej. SIV-IT-000001, Dell, Latitude..."
                      value={itemSearchText}
                      onChange={(e) => setItemSearchText(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-4 py-2 text-sm focus:border-emerald-600 focus:outline-none"
                    />
                  </div>

                  <div className="max-h-60 overflow-y-auto space-y-2 mt-2">
                    {filteredInventoryForModal.length === 0 ? (
                      <p className="text-center py-6 text-xs text-slate-400">No se encontraron activos.</p>
                    ) : (
                      filteredInventoryForModal.map((item) => (
                        <div
                          key={item.id}
                          onClick={() => {
                            setSelectedInventoryItem(item);
                            setItemCostForm({
                              purchasePrice: item.purchase_price ? String(item.purchase_price) : '',
                              invoiceNumber: item.invoice_number || '',
                              purchaseOrder: item.purchase_order || '',
                              warrantyExpiration: item.warranty_expiration || '',
                              warrantyDocumentUrl: item.warranty_document_url || '',
                              invoiceDocumentUrl: item.invoice_document_url || '',
                              supplier: item.supplier || '',
                            });
                          }}
                          className="flex items-center justify-between p-3 rounded-xl border border-slate-200 bg-slate-50 hover:bg-emerald-50 hover:border-emerald-500 cursor-pointer transition text-xs"
                        >
                          <div>
                            <div className="font-mono font-bold text-slate-900">{item.permanent_code}</div>
                            <div className="text-slate-600">{item.brand} {item.model}</div>
                            <div className="text-[11px] text-slate-400">Serie: {item.serial_number || 'S/N'}</div>
                          </div>
                          <div className="text-right">
                            <span className="font-mono font-bold text-emerald-700">
                              Q{Number(item.purchase_price || 0).toLocaleString('es-GT', { minimumFractionDigits: 2 })}
                            </span>
                            <div className="text-[11px] text-slate-400">Fac: {item.invoice_number || 'Pendiente'}</div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              ) : (
                /* Paso 2: Formulario de Modificación de Costo y Factura */
                <form onSubmit={handleSaveInventoryCost} className="mt-4 space-y-3.5">
                  <div className="bg-emerald-50 p-3 rounded-xl border border-emerald-100 text-xs flex items-center justify-between">
                    <div>
                      <span className="font-mono font-bold text-emerald-950 text-sm">
                        {selectedInventoryItem.permanent_code}
                      </span>
                      <div className="text-emerald-800">{selectedInventoryItem.brand} {selectedInventoryItem.model}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedInventoryItem(null)}
                      className="text-xs text-emerald-700 font-semibold hover:underline"
                    >
                      Cambiar Activo
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-700">Costo de Adquisición (Q)</label>
                      <input
                        type="number"
                        step="0.01"
                        required
                        value={itemCostForm.purchasePrice}
                        onChange={(e) => setItemCostForm({ ...itemCostForm, purchasePrice: e.target.value })}
                        className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-mono focus:border-emerald-600 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-700">Proveedor</label>
                      <input
                        type="text"
                        placeholder="Dell Guatemala, Intcomex..."
                        value={itemCostForm.supplier}
                        onChange={(e) => setItemCostForm({ ...itemCostForm, supplier: e.target.value })}
                        className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-700">N° Factura</label>
                      <input
                        type="text"
                        placeholder="FAC-2025-001"
                        value={itemCostForm.invoiceNumber}
                        onChange={(e) => setItemCostForm({ ...itemCostForm, invoiceNumber: e.target.value })}
                        className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-mono focus:border-emerald-600 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-700">N° Orden de Compra</label>
                      <input
                        type="text"
                        placeholder="OC-IT-101"
                        value={itemCostForm.purchaseOrder}
                        onChange={(e) => setItemCostForm({ ...itemCostForm, purchaseOrder: e.target.value })}
                        className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-mono focus:border-emerald-600 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700">Fecha Vencimiento Garantía</label>
                    <input
                      type="date"
                      value={itemCostForm.warrantyExpiration}
                      onChange={(e) => setItemCostForm({ ...itemCostForm, warrantyExpiration: e.target.value })}
                      className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none"
                    />
                  </div>

                  {/* Subida o Enlace de PDF / Imagen de Factura y Garantía */}
                  <div className="space-y-2 border-t border-slate-100 pt-3">
                    <span className="font-semibold text-xs text-slate-700 block">
                      Enlaces o Archivos Adjuntos (PDF o Imagen):
                    </span>

                    <div>
                      <label className="block text-[11px] text-slate-600">URL / Archivo Factura (PDF/Imagen)</label>
                      <input
                        type="text"
                        placeholder="https://... o ruta del archivo de factura"
                        value={itemCostForm.invoiceDocumentUrl}
                        onChange={(e) => setItemCostForm({ ...itemCostForm, invoiceDocumentUrl: e.target.value })}
                        className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-1.5 text-xs focus:border-emerald-600 focus:outline-none font-mono"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] text-slate-600">URL / Archivo Garantía (PDF/Imagen)</label>
                      <input
                        type="text"
                        placeholder="https://... o certificado de garantía"
                        value={itemCostForm.warrantyDocumentUrl}
                        onChange={(e) => setItemCostForm({ ...itemCostForm, warrantyDocumentUrl: e.target.value })}
                        className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-1.5 text-xs focus:border-emerald-600 focus:outline-none font-mono"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => setSelectedInventoryItem(null)}
                      className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
                    >
                      Atrás
                    </button>
                    <button
                      type="submit"
                      className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800"
                    >
                      Guardar en Inventario & Costos
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        )}

        {/* MODAL REGISTRAR GASTO DIRECTO */}
        {showNewCostModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
            <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl animate-in fade-in zoom-in-95">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <Plus className="h-5 w-5 text-emerald-600" />
                  Registrar Gasto o Factura Directa
                </h3>
                <button onClick={() => setShowNewCostModal(false)} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleCreateCost} className="mt-4 space-y-3.5">
                <div>
                  <label className="block text-xs font-medium text-slate-700">Concepto del Gasto</label>
                  <input
                    type="text"
                    required
                    placeholder="ej. Renovación de bobinas de red, flete de importación..."
                    value={newCostForm.concept}
                    onChange={(e) => setNewCostForm({ ...newCostForm, concept: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700">Importe (Q)</label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      placeholder="0.00"
                      value={newCostForm.amount}
                      onChange={(e) => setNewCostForm({ ...newCostForm, amount: e.target.value })}
                      className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-mono focus:border-emerald-600 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700">Naturaleza</label>
                    <select
                      value={newCostForm.costNature}
                      onChange={(e) => setNewCostForm({ ...newCostForm, costNature: e.target.value })}
                      className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none"
                    >
                      <option value="ADQUISICION">Adquisición</option>
                      <option value="OPERATIVO">Operativo</option>
                      <option value="MANTENIMIENTO">Mantenimiento</option>
                      <option value="LICENCIA_SUSCRIPCION">Licencia / Suscripción</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700">Departamento Imputado</label>
                    <select
                      required
                      value={newCostForm.chargedDepartmentId}
                      onChange={(e) => setNewCostForm({ ...newCostForm, chargedDepartmentId: e.target.value })}
                      className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none"
                    >
                      <option value="">Seleccione área</option>
                      {departments.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700">Proveedor</label>
                    <input
                      type="text"
                      placeholder="Nombre del proveedor"
                      value={newCostForm.supplier}
                      onChange={(e) => setNewCostForm({ ...newCostForm, supplier: e.target.value })}
                      className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700">N° Factura</label>
                    <input
                      type="text"
                      placeholder="FAC-2026-..."
                      value={newCostForm.invoiceNumber}
                      onChange={(e) => setNewCostForm({ ...newCostForm, invoiceNumber: e.target.value })}
                      className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-mono focus:border-emerald-600 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700">N° Orden de Compra</label>
                    <input
                      type="text"
                      placeholder="OC-..."
                      value={newCostForm.purchaseOrder}
                      onChange={(e) => setNewCostForm({ ...newCostForm, purchaseOrder: e.target.value })}
                      className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-mono focus:border-emerald-600 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowNewCostModal(false)}
                    className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800"
                  >
                    Registrar Costo
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
  );
}
