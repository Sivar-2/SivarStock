'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  DollarSign,
  Search,
  Plus,
  FileText,
  ShieldCheck,
  ExternalLink,
  Boxes,
  FileCheck,
  Download,
  X,
  FileUp,
  Receipt,
  Printer,
  ShieldAlert,
  Eye,
  Upload,
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
  const [previewDoc, setPreviewDoc] = useState<{ title: string; data: string; name: string } | null>(null);
  const [savingDetailFiles, setSavingDetailFiles] = useState(false);

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
    invoiceFileData: '',
    invoiceFileName: '',
    warrantyFileData: '',
    warrantyFileName: '',
    insuranceFileData: '',
    insuranceFileName: '',
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
    warrantyExpiration: '',
    warrantyDocumentUrl: '',
    invoiceDocumentUrl: '',
    invoiceFileData: '',
    invoiceFileName: '',
    warrantyFileData: '',
    warrantyFileName: '',
    insuranceFileData: '',
    insuranceFileName: '',
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

  const readFileAsDataUrl = (file: File): Promise<{ dataUrl: string; name: string }> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve({ dataUrl: String(reader.result || ''), name: file.name });
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  // Subir archivo directamente desde el modal de Detalle (para adjuntar factura, garantía o aseguranza después)
  const handleAttachFileToSelectedCost = async (
    docType: 'INVOICE' | 'WARRANTY' | 'INSURANCE',
    file: File
  ) => {
    if (!selectedCost) return;
    setSavingDetailFiles(true);
    try {
      const { dataUrl, name } = await readFileAsDataUrl(file);
      const payload: any = {
        action: 'UPDATE_COST_RECORD',
        costId: selectedCost.id,
      };
      if (docType === 'INVOICE') {
        payload.invoiceFileData = dataUrl;
        payload.invoiceFileName = name;
      } else if (docType === 'WARRANTY') {
        payload.warrantyFileData = dataUrl;
        payload.warrantyFileName = name;
      } else if (docType === 'INSURANCE') {
        payload.insuranceFileData = dataUrl;
        payload.insuranceFileName = name;
      }

      const res = await fetch('/api/costs', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Error al adjuntar documento');

      if (d.cost) setSelectedCost(d.cost);
      await loadData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSavingDetailFiles(false);
    }
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
      alert('Costo, factura, garantía y aseguranza actualizados con éxito.');
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
        warrantyExpiration: '',
        warrantyDocumentUrl: '',
        invoiceDocumentUrl: '',
        invoiceFileData: '',
        invoiceFileName: '',
        warrantyFileData: '',
        warrantyFileName: '',
        insuranceFileData: '',
        insuranceFileName: '',
        expenseDate: new Date().toISOString().split('T')[0],
      });
      loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const filteredInventoryForModal = inventoryItems.filter(
    (i) =>
      (i.permanent_code || '').toLowerCase().includes(itemSearchText.toLowerCase()) ||
      (i.brand || '').toLowerCase().includes(itemSearchText.toLowerCase()) ||
      (i.model || '').toLowerCase().includes(itemSearchText.toLowerCase()) ||
      (i.serial_number && i.serial_number.toLowerCase().includes(itemSearchText.toLowerCase()))
  );

  const hasAnyDoc = (c: any) =>
    Boolean(
      c.invoice_file_data ||
        c.invoice_document_url ||
        c.item_invoice_url ||
        c.warranty_file_data ||
        c.warranty_document_url ||
        c.item_warranty_url ||
        c.insurance_file_data
    );

  return (
    <div className="space-y-6">
      {/* Cabecera */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2.5">
            <DollarSign className="h-7 w-7 text-emerald-600" />
            Costos, Facturas, Garantías y Aseguranza
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Control financiero • Adjunta PDF o Foto de Factura, Garantía del Producto y Aseguranza (opcional al crear o editable después)
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => {
              setItemSearchText('');
              setSelectedInventoryItem(null);
              setShowEditItemCostModal(true);
            }}
            className="flex items-center gap-2 rounded-xl border border-emerald-600 bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-emerald-800 shadow-sm hover:bg-emerald-100 transition"
            title="Buscar activo del inventario para agregar costo, factura, garantía y aseguranza"
          >
            <Boxes className="h-4 w-4 text-emerald-700" />
            <span>Buscar Inventario & Costear</span>
          </button>

          <button
            onClick={() => setShowNewCostModal(true)}
            className="flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white shadow-md hover:bg-emerald-800 transition"
          >
            <Plus className="h-4 w-4" />
            <span>Registrar Gasto / Factura</span>
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
          <span className="text-xs text-slate-500 mt-1 block">Facturas, garantías y aseguranzas</span>
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
            onKeyDown={(e) => e.key === 'Enter' && loadData()}
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
                <th className="py-3.5 px-4 text-center">Documentos (PDF / Foto)</th>
                <th className="py-3.5 px-4 text-right">Acciones</th>
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
                costs.map((c) => {
                  const hasInvoice = Boolean(c.invoice_file_data || c.invoice_document_url || c.item_invoice_url);
                  const hasWarranty = Boolean(c.warranty_file_data || c.warranty_document_url || c.item_warranty_url);
                  const hasInsurance = Boolean(c.insurance_file_data);

                  return (
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
                            <span>
                              {c.item_permanent_code} ({c.item_brand} {c.item_model})
                            </span>
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
                        <div className="flex flex-wrap items-center justify-center gap-1">
                          {hasInvoice && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                              <Receipt className="h-3 w-3" /> Factura
                            </span>
                          )}
                          {hasWarranty && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-800">
                              <ShieldCheck className="h-3 w-3" /> Garantía
                            </span>
                          )}
                          {hasInsurance && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-bold text-purple-800">
                              <ShieldAlert className="h-3 w-3" /> Aseguranza
                            </span>
                          )}
                          {!hasAnyDoc(c) && (
                            <span className="text-[11px] text-slate-400">Click para adjuntar</span>
                          )}
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedCost(c);
                              setShowDetailModal(true);
                            }}
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-sm"
                          >
                            <Eye className="h-3 w-3 text-emerald-600" />
                            <span>Ver / Adjuntar</span>
                          </button>

                          {c.item_permanent_code && (
                            <Link
                              href={`/inventario?search=${encodeURIComponent(c.item_permanent_code)}`}
                              onClick={(e) => e.stopPropagation()}
                              className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-800 hover:bg-emerald-100"
                              title="Ver en Bodega"
                            >
                              <ExternalLink className="h-3 w-3" />
                            </Link>
                          )}
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

      {/* MODAL DETALLES DEL COSTO / FACTURA / GARANTÍA / ASEGURANZA E IMPRESIÓN */}
      {showDetailModal && selectedCost && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl max-h-[92vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-start justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-lg font-bold text-slate-900">{selectedCost.concept}</h3>
                <p className="text-xs text-slate-500">
                  Proveedor: <span className="font-semibold text-slate-700">{selectedCost.supplier || 'N/A'}</span> • Fecha: {selectedCost.expense_date}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800"
                >
                  <Printer className="h-3.5 w-3.5" />
                  <span>Imprimir Comprobante</span>
                </button>
                <button
                  onClick={() => setShowDetailModal(false)}
                  className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="mt-4 space-y-4 text-xs">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-100">
                <div>
                  <span className="text-slate-400 block text-[11px]">Importe Total (Q):</span>
                  <span className="text-base font-bold font-mono text-emerald-700">
                    Q{Number(selectedCost.total_amount || 0).toLocaleString('es-GT', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">N° Factura:</span>
                  <span className="font-mono font-bold text-slate-900">{selectedCost.invoice_number || 'Sin factura'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Orden de Compra:</span>
                  <span className="font-mono text-slate-800">{selectedCost.purchase_order || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Vence Garantía:</span>
                  <span className="font-mono font-semibold text-slate-800">
                    {selectedCost.item_warranty_expiration || 'No especificada'}
                  </span>
                </div>
              </div>

              {/* Hipervínculo al Inventario Físico */}
              {selectedCost.item_permanent_code && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 p-3.5">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-[11px] font-bold text-emerald-900 block">
                        Activo Vinculado en Bodega / Inventario:
                      </span>
                      <span className="font-mono font-bold text-sm text-emerald-950">
                        {selectedCost.item_permanent_code}
                      </span>
                      <span className="ml-2 text-xs text-emerald-800">
                        {selectedCost.item_brand} {selectedCost.item_model} (S/N: {selectedCost.item_serial_number || 'N/A'})
                      </span>
                    </div>
                    <Link
                      href={`/inventario?search=${encodeURIComponent(selectedCost.item_permanent_code)}`}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-800 shadow-sm"
                    >
                      <span>Ir al Activo</span>
                      <ExternalLink className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                </div>
              )}

              {/* Tarjetas de Documentos Adjuntos (Factura, Garantía y Aseguranza) con subida inmediata */}
              <div className="space-y-3 border-t border-slate-100 pt-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-800 text-sm">
                    Documentos Respaldatorios (PDF o Fotografía)
                  </span>
                  {savingDetailFiles && (
                    <span className="text-xs font-semibold text-emerald-600 animate-pulse">
                      Guardando archivo...
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {/* 1. FACTURA */}
                  <div className="rounded-xl border border-slate-200 p-3.5 bg-slate-50/60 flex flex-col justify-between space-y-3">
                    <div>
                      <div className="flex items-center gap-2 font-bold text-slate-900">
                        <Receipt className="h-4 w-4 text-emerald-600" />
                        <span>1. Factura</span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-1 truncate">
                        {selectedCost.invoice_file_name ||
                          (selectedCost.invoice_document_url || selectedCost.item_invoice_url
                            ? 'Enlace / Documento registrado'
                            : 'Sin archivo adjunto')}
                      </p>
                    </div>

                    <div className="space-y-1.5">
                      {(selectedCost.invoice_file_data ||
                        selectedCost.invoice_document_url ||
                        selectedCost.item_invoice_url) && (
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() =>
                              setPreviewDoc({
                                title: `Factura - ${selectedCost.concept}`,
                                data:
                                  selectedCost.invoice_file_data ||
                                  selectedCost.invoice_document_url ||
                                  selectedCost.item_invoice_url,
                                name: selectedCost.invoice_file_name || 'factura.pdf',
                              })
                            }
                            className="flex-1 inline-flex items-center justify-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1.5 text-[11px] font-semibold text-white hover:bg-emerald-700"
                          >
                            <Eye className="h-3.5 w-3.5" /> Ver
                          </button>
                          <a
                            href={
                              selectedCost.invoice_file_data ||
                              selectedCost.invoice_document_url ||
                              selectedCost.item_invoice_url
                            }
                            download={selectedCost.invoice_file_name || 'factura'}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-100"
                            title="Descargar Factura"
                          >
                            <Download className="h-3.5 w-3.5" />
                          </a>
                        </div>
                      )}

                      <label className="flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-emerald-400 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-50 cursor-pointer transition">
                        <Upload className="h-3.5 w-3.5" />
                        <span>Subir PDF / Foto</span>
                        <input
                          type="file"
                          accept="application/pdf,image/*"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleAttachFileToSelectedCost('INVOICE', file);
                          }}
                        />
                      </label>
                    </div>
                  </div>

                  {/* 2. GARANTÍA DEL PRODUCTO */}
                  <div className="rounded-xl border border-slate-200 p-3.5 bg-slate-50/60 flex flex-col justify-between space-y-3">
                    <div>
                      <div className="flex items-center gap-2 font-bold text-slate-900">
                        <ShieldCheck className="h-4 w-4 text-blue-600" />
                        <span>2. Garantía</span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-1 truncate">
                        {selectedCost.warranty_file_name ||
                          (selectedCost.warranty_document_url || selectedCost.item_warranty_url
                            ? 'Certificado registrado'
                            : 'Sin archivo adjunto')}
                      </p>
                    </div>

                    <div className="space-y-1.5">
                      {(selectedCost.warranty_file_data ||
                        selectedCost.warranty_document_url ||
                        selectedCost.item_warranty_url) && (
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() =>
                              setPreviewDoc({
                                title: `Garantía - ${selectedCost.concept}`,
                                data:
                                  selectedCost.warranty_file_data ||
                                  selectedCost.warranty_document_url ||
                                  selectedCost.item_warranty_url,
                                name: selectedCost.warranty_file_name || 'garantia.pdf',
                              })
                            }
                            className="flex-1 inline-flex items-center justify-center gap-1 rounded-lg bg-blue-600 px-2.5 py-1.5 text-[11px] font-semibold text-white hover:bg-blue-700"
                          >
                            <Eye className="h-3.5 w-3.5" /> Ver
                          </button>
                          <a
                            href={
                              selectedCost.warranty_file_data ||
                              selectedCost.warranty_document_url ||
                              selectedCost.item_warranty_url
                            }
                            download={selectedCost.warranty_file_name || 'garantia'}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-100"
                            title="Descargar Garantía"
                          >
                            <Download className="h-3.5 w-3.5" />
                          </a>
                        </div>
                      )}

                      <label className="flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-blue-400 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-blue-700 hover:bg-blue-50 cursor-pointer transition">
                        <Upload className="h-3.5 w-3.5" />
                        <span>Subir PDF / Foto</span>
                        <input
                          type="file"
                          accept="application/pdf,image/*"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleAttachFileToSelectedCost('WARRANTY', file);
                          }}
                        />
                      </label>
                    </div>
                  </div>

                  {/* 3. ASEGURANZA / PÓLIZA */}
                  <div className="rounded-xl border border-slate-200 p-3.5 bg-slate-50/60 flex flex-col justify-between space-y-3">
                    <div>
                      <div className="flex items-center gap-2 font-bold text-slate-900">
                        <ShieldAlert className="h-4 w-4 text-purple-600" />
                        <span>3. Aseguranza</span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-1 truncate">
                        {selectedCost.insurance_file_name || 'Sin póliza adjunta'}
                      </p>
                    </div>

                    <div className="space-y-1.5">
                      {selectedCost.insurance_file_data && (
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() =>
                              setPreviewDoc({
                                title: `Aseguranza - ${selectedCost.concept}`,
                                data: selectedCost.insurance_file_data,
                                name: selectedCost.insurance_file_name || 'aseguranza.pdf',
                              })
                            }
                            className="flex-1 inline-flex items-center justify-center gap-1 rounded-lg bg-purple-600 px-2.5 py-1.5 text-[11px] font-semibold text-white hover:bg-purple-700"
                          >
                            <Eye className="h-3.5 w-3.5" /> Ver
                          </button>
                          <a
                            href={selectedCost.insurance_file_data}
                            download={selectedCost.insurance_file_name || 'aseguranza'}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-100"
                            title="Descargar Aseguranza"
                          >
                            <Download className="h-3.5 w-3.5" />
                          </a>
                        </div>
                      )}

                      <label className="flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-purple-400 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-purple-700 hover:bg-purple-50 cursor-pointer transition">
                        <Upload className="h-3.5 w-3.5" />
                        <span>Subir PDF / Foto</span>
                        <input
                          type="file"
                          accept="application/pdf,image/*"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleAttachFileToSelectedCost('INSURANCE', file);
                          }}
                        />
                      </label>
                    </div>
                  </div>
                </div>
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

      {/* VISOR DE DOCUMENTO ADJUNTO (PDF O IMAGEN) */}
      {previewDoc && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="w-full max-w-4xl h-[88vh] flex flex-col rounded-2xl bg-white p-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3 mb-3">
              <div>
                <h4 className="font-bold text-slate-900 text-sm">{previewDoc.title}</h4>
                <p className="text-xs text-slate-500">{previewDoc.name}</p>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={previewDoc.data}
                  download={previewDoc.name}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-800"
                >
                  <Download className="h-3.5 w-3.5" /> Descargar
                </a>
                <button
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800"
                >
                  <Printer className="h-3.5 w-3.5" /> Imprimir
                </button>
                <button
                  onClick={() => setPreviewDoc(null)}
                  className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-auto bg-slate-100 rounded-xl flex items-center justify-center p-2">
              {previewDoc.data.startsWith('data:image/') ||
              /\.(png|jpg|jpeg|webp|gif)$/i.test(previewDoc.data) ? (
                <img
                  src={previewDoc.data}
                  alt={previewDoc.title}
                  className="max-h-full max-w-full object-contain rounded-lg shadow"
                />
              ) : (
                <iframe
                  src={previewDoc.data}
                  title={previewDoc.title}
                  className="w-full h-full rounded-lg border-0 bg-white"
                />
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL BUSCAR INVENTARIO Y MODIFICAR COSTO / FACTURA / GARANTÍA / ASEGURANZA */}
      {showEditItemCostModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Boxes className="h-5 w-5 text-emerald-600" />
                Buscar Inventario y Asignar Costos / Documentos
              </h3>
              <button
                onClick={() => setShowEditItemCostModal(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

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
                            invoiceFileData: '',
                            invoiceFileName: '',
                            warrantyFileData: '',
                            warrantyFileName: '',
                            insuranceFileData: '',
                            insuranceFileName: '',
                            supplier: item.supplier || '',
                          });
                        }}
                        className="flex items-center justify-between p-3 rounded-xl border border-slate-200 bg-slate-50 hover:bg-emerald-50 hover:border-emerald-500 cursor-pointer transition text-xs"
                      >
                        <div>
                          <div className="font-mono font-bold text-slate-900">{item.permanent_code}</div>
                          <div className="text-slate-600">
                            {item.brand} {item.model}
                          </div>
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
              <form onSubmit={handleSaveInventoryCost} className="mt-4 space-y-3.5">
                <div className="bg-emerald-50 p-3 rounded-xl border border-emerald-100 text-xs flex items-center justify-between">
                  <div>
                    <span className="font-mono font-bold text-emerald-950 text-sm">
                      {selectedInventoryItem.permanent_code}
                    </span>
                    <div className="text-emerald-800">
                      {selectedInventoryItem.brand} {selectedInventoryItem.model}
                    </div>
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
                      placeholder="FAC-2026-001"
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
                  <label className="block text-xs font-medium text-slate-700">Fecha Vencimiento Garantía (Opcional)</label>
                  <input
                    type="date"
                    value={itemCostForm.warrantyExpiration}
                    onChange={(e) => setItemCostForm({ ...itemCostForm, warrantyExpiration: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none"
                  />
                </div>

                {/* Subida de Archivos PDF o Imagen (Opcionales) */}
                <div className="space-y-2.5 border-t border-slate-100 pt-3">
                  <span className="font-semibold text-xs text-slate-700 block">
                    Subir PDF o Foto (Opcional — también puedes adjuntarlos después):
                  </span>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <label className="flex flex-col items-center justify-center rounded-xl border border-dashed border-emerald-300 bg-emerald-50/40 p-2.5 text-center cursor-pointer hover:bg-emerald-50">
                      <Receipt className="h-4 w-4 text-emerald-600 mb-1" />
                      <span className="text-[11px] font-bold text-slate-800">Factura (PDF/Foto)</span>
                      <span className="text-[10px] text-slate-500 truncate max-w-full">
                        {itemCostForm.invoiceFileName || 'Seleccionar'}
                      </span>
                      <input
                        type="file"
                        accept="application/pdf,image/*"
                        className="hidden"
                        onChange={async (e) => {
                          const f = e.target.files?.[0];
                          if (f) {
                            const { dataUrl, name } = await readFileAsDataUrl(f);
                            setItemCostForm((prev) => ({
                              ...prev,
                              invoiceFileData: dataUrl,
                              invoiceFileName: name,
                            }));
                          }
                        }}
                      />
                    </label>

                    <label className="flex flex-col items-center justify-center rounded-xl border border-dashed border-blue-300 bg-blue-50/40 p-2.5 text-center cursor-pointer hover:bg-blue-50">
                      <ShieldCheck className="h-4 w-4 text-blue-600 mb-1" />
                      <span className="text-[11px] font-bold text-slate-800">Garantía (PDF/Foto)</span>
                      <span className="text-[10px] text-slate-500 truncate max-w-full">
                        {itemCostForm.warrantyFileName || 'Seleccionar'}
                      </span>
                      <input
                        type="file"
                        accept="application/pdf,image/*"
                        className="hidden"
                        onChange={async (e) => {
                          const f = e.target.files?.[0];
                          if (f) {
                            const { dataUrl, name } = await readFileAsDataUrl(f);
                            setItemCostForm((prev) => ({
                              ...prev,
                              warrantyFileData: dataUrl,
                              warrantyFileName: name,
                            }));
                          }
                        }}
                      />
                    </label>

                    <label className="flex flex-col items-center justify-center rounded-xl border border-dashed border-purple-300 bg-purple-50/40 p-2.5 text-center cursor-pointer hover:bg-purple-50">
                      <ShieldAlert className="h-4 w-4 text-purple-600 mb-1" />
                      <span className="text-[11px] font-bold text-slate-800">Aseguranza (PDF/Foto)</span>
                      <span className="text-[10px] text-slate-500 truncate max-w-full">
                        {itemCostForm.insuranceFileName || 'Seleccionar'}
                      </span>
                      <input
                        type="file"
                        accept="application/pdf,image/*"
                        className="hidden"
                        onChange={async (e) => {
                          const f = e.target.files?.[0];
                          if (f) {
                            const { dataUrl, name } = await readFileAsDataUrl(f);
                            setItemCostForm((prev) => ({
                              ...prev,
                              insuranceFileData: dataUrl,
                              insuranceFileName: name,
                            }));
                          }
                        }}
                      />
                    </label>
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
          <div className="w-full max-w-lg max-h-[92vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Plus className="h-5 w-5 text-emerald-600" />
                Registrar Gasto o Factura Directa
              </h3>
              <button
                onClick={() => setShowNewCostModal(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateCost} className="mt-4 space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-slate-700">Concepto del Gasto</label>
                <input
                  type="text"
                  required
                  placeholder="ej. Compra de switch, renovación de póliza, flete..."
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
                  <label className="block text-xs font-medium text-slate-700">N° Factura (Opcional)</label>
                  <input
                    type="text"
                    placeholder="FAC-2026-..."
                    value={newCostForm.invoiceNumber}
                    onChange={(e) => setNewCostForm({ ...newCostForm, invoiceNumber: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-mono focus:border-emerald-600 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700">N° Orden de Compra (Opcional)</label>
                  <input
                    type="text"
                    placeholder="OC-..."
                    value={newCostForm.purchaseOrder}
                    onChange={(e) => setNewCostForm({ ...newCostForm, purchaseOrder: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-mono focus:border-emerald-600 focus:outline-none"
                  />
                </div>
              </div>

              {/* Adjuntar PDF o Foto (Factura, Garantía, Aseguranza) */}
              <div className="space-y-2 border-t border-slate-100 pt-3">
                <span className="block text-xs font-semibold text-slate-700">
                  Adjuntar PDF o Foto (Opcional — también puedes subirlos después):
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <label className="flex flex-col items-center justify-center rounded-xl border border-dashed border-emerald-300 bg-emerald-50/40 p-2.5 text-center cursor-pointer hover:bg-emerald-50">
                    <Receipt className="h-4 w-4 text-emerald-600 mb-1" />
                    <span className="text-[11px] font-bold text-slate-800">Factura</span>
                    <span className="text-[10px] text-slate-500 truncate max-w-full">
                      {newCostForm.invoiceFileName || 'PDF / Foto'}
                    </span>
                    <input
                      type="file"
                      accept="application/pdf,image/*"
                      className="hidden"
                      onChange={async (e) => {
                        const f = e.target.files?.[0];
                        if (f) {
                          const { dataUrl, name } = await readFileAsDataUrl(f);
                          setNewCostForm((prev) => ({
                            ...prev,
                            invoiceFileData: dataUrl,
                            invoiceFileName: name,
                          }));
                        }
                      }}
                    />
                  </label>

                  <label className="flex flex-col items-center justify-center rounded-xl border border-dashed border-blue-300 bg-blue-50/40 p-2.5 text-center cursor-pointer hover:bg-blue-50">
                    <ShieldCheck className="h-4 w-4 text-blue-600 mb-1" />
                    <span className="text-[11px] font-bold text-slate-800">Garantía</span>
                    <span className="text-[10px] text-slate-500 truncate max-w-full">
                      {newCostForm.warrantyFileName || 'PDF / Foto'}
                    </span>
                    <input
                      type="file"
                      accept="application/pdf,image/*"
                      className="hidden"
                      onChange={async (e) => {
                        const f = e.target.files?.[0];
                        if (f) {
                          const { dataUrl, name } = await readFileAsDataUrl(f);
                          setNewCostForm((prev) => ({
                            ...prev,
                            warrantyFileData: dataUrl,
                            warrantyFileName: name,
                          }));
                        }
                      }}
                    />
                  </label>

                  <label className="flex flex-col items-center justify-center rounded-xl border border-dashed border-purple-300 bg-purple-50/40 p-2.5 text-center cursor-pointer hover:bg-purple-50">
                    <ShieldAlert className="h-4 w-4 text-purple-600 mb-1" />
                    <span className="text-[11px] font-bold text-slate-800">Aseguranza</span>
                    <span className="text-[10px] text-slate-500 truncate max-w-full">
                      {newCostForm.insuranceFileName || 'PDF / Foto'}
                    </span>
                    <input
                      type="file"
                      accept="application/pdf,image/*"
                      className="hidden"
                      onChange={async (e) => {
                        const f = e.target.files?.[0];
                        if (f) {
                          const { dataUrl, name } = await readFileAsDataUrl(f);
                          setNewCostForm((prev) => ({
                            ...prev,
                            insuranceFileData: dataUrl,
                            insuranceFileName: name,
                          }));
                        }
                      }}
                    />
                  </label>
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
