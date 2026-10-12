'use client';

import React, { useState, useEffect } from 'react';
import {
  PackageMinus,
  Search,
  Plus,
  AlertTriangle,
  Boxes,
  MinusCircle,
  PlusCircle,
  FileText,
  X,
  CheckCircle2
} from 'lucide-react';

export default function ConsumosPage() {
  const [data, setData] = useState<{ items: any[]; batches: any[] }>({ items: [], batches: [] });
  const [loading, setLoading] = useState(true);
  const [catalogs, setCatalogs] = useState<any>({ departments: [] });
  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('');

  // Modal Operación
  const [showOpModal, setShowOpModal] = useState(false);
  const [opType, setOpType] = useState<'CONSUMO' | 'ENTRADA' | 'AJUSTE'>('CONSUMO');
  const [selectedProduct, setSelectedProduct] = useState('');
  const [selectedDept, setSelectedDept] = useState('');
  const [selectedChargedDept, setSelectedChargedDept] = useState('');
  const [opQuantity, setOpQuantity] = useState('');
  const [opBatch, setOpBatch] = useState('');
  const [opCost, setOpCost] = useState('');
  const [opReason, setOpReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchConsumables = () => {
    setLoading(true);
    const p = new URLSearchParams();
    if (search) p.set('search', search);
    if (deptFilter) p.set('departmentId', deptFilter);

    fetch(`/api/inventory/consumables?${p.toString()}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setData({ items: d.items, batches: d.batches });
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetch('/api/catalogs')
      .then((r) => r.json())
      .then((d) => setCatalogs(d))
      .catch(console.error);

    fetchConsumables();
  }, [search, deptFilter]);

  const handleOperationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSubmitting(true);

    try {
      const res = await fetch('/api/inventory/consumables', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: selectedProduct,
          departmentId: selectedDept,
          operationType: opType,
          quantity: opQuantity,
          batchNumber: opBatch || 'LOTE-GENERAL',
          reason: opReason,
          unitCost: opCost || undefined,
          chargedDepartmentId: selectedChargedDept || selectedDept,
        }),
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error);

      setShowOpModal(false);
      resetOpForm();
      fetchConsumables();
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const resetOpForm = () => {
    setSelectedProduct('');
    setSelectedDept('');
    setSelectedChargedDept('');
    setOpQuantity('');
    setOpBatch('');
    setOpCost('');
    setOpReason('');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">
            Consumos y Materiales de Planta
          </h1>
          <p className="text-xs sm:text-sm text-slate-500">
            Control de existencias de suministros por cantidades, unidades de medida y alertas de stock mínimo.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setOpType('CONSUMO');
              setShowOpModal(true);
            }}
            className="flex items-center gap-1.5 rounded-lg bg-amber-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow hover:bg-amber-700"
          >
            <MinusCircle className="h-4 w-4" />
            <span>- Registrar Consumo</span>
          </button>
          <button
            onClick={() => {
              setOpType('ENTRADA');
              setShowOpModal(true);
            }}
            className="flex items-center gap-1.5 rounded-lg bg-military-800 px-3.5 py-1.5 text-xs font-semibold text-white shadow hover:bg-military-900"
          >
            <PlusCircle className="h-4 w-4" />
            <span>+ Ingreso / Entrada</span>
          </button>
        </div>
      </div>

      {/* Barra de Filtros */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1">Buscar Suministro</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Nombre, código o marca..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 py-1.5 pl-8 pr-3 text-xs text-slate-800 focus:border-military-600 focus:bg-white focus:outline-none"
              />
            </div>
          </div>
          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1">Bodega / Área</label>
            <select
              value={deptFilter}
              onChange={(e) => setDeptFilter(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-slate-50 py-1.5 px-2 text-xs text-slate-800 focus:border-military-600 focus:bg-white focus:outline-none"
            >
              <option value="">Todas las bodegas y almacenes</option>
              {catalogs.departments?.map((d: any) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Tabla de Existencias de Consumibles */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="border-b border-slate-200 bg-slate-50 text-[11px] uppercase font-bold text-slate-500">
              <tr>
                <th className="px-4 py-3">Código</th>
                <th className="px-4 py-3">Material / Suministro</th>
                <th className="px-4 py-3">Almacén Actual</th>
                <th className="px-4 py-3 text-center">Unidad Medida</th>
                <th className="px-4 py-3 text-center">Stock Actual</th>
                <th className="px-4 py-3 text-center">Stock Mínimo</th>
                <th className="px-4 py-3 text-center">Estado Alerta</th>
                <th className="px-4 py-3 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    Cargando existencias...
                  </td>
                </tr>
              ) : data.items.length > 0 ? (
                data.items.map((it: any) => (
                  <tr key={`${it.product_id}-${it.department_id}`} className="hover:bg-slate-50 transition">
                    <td className="px-4 py-3 font-mono font-bold text-slate-900">{it.code}</td>
                    <td className="px-4 py-3 font-semibold text-slate-800">
                      <span>{it.name}</span>
                      <span className="block text-[11px] text-slate-400 font-normal">{it.brand || ''}</span>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{it.department_name || 'Bodega Central'}</td>
                    <td className="px-4 py-3 text-center capitalize text-slate-600">{it.unit_of_measure}</td>
                    <td className="px-4 py-3 text-center font-extrabold text-sm text-slate-900">
                      {it.total_quantity}
                    </td>
                    <td className="px-4 py-3 text-center font-medium text-slate-600">{it.min_stock}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        it.stock_status === 'CRITICO'
                          ? 'bg-amber-100 text-amber-800'
                          : it.stock_status === 'AGOTADO'
                          ? 'bg-red-100 text-brandRed-700'
                          : 'bg-emerald-100 text-emerald-800'
                      }`}>
                        {it.stock_status === 'CRITICO' && <AlertTriangle className="h-3 w-3" />}
                        <span>{it.stock_status}</span>
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => {
                          setSelectedProduct(it.product_id);
                          setSelectedDept(it.department_id || 'dept-bod');
                          setOpType('CONSUMO');
                          setShowOpModal(true);
                        }}
                        className="rounded bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-200"
                      >
                        Consumir
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    No se encontraron materiales consumibles registrados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL: OPERACIÓN DE CONSUMO O ENTRADA */}
      {showOpModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl ring-1 ring-black/5 overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-6 py-4">
              <h3 className="text-sm font-bold text-slate-900">
                {opType === 'CONSUMO' ? 'Registrar Consumo de Material' : opType === 'ENTRADA' ? 'Ingreso / Entrada de Suministros' : 'Ajuste de Existencias'}
              </h3>
              <button onClick={() => setShowOpModal(false)} className="rounded p-1 text-slate-400 hover:bg-slate-200">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleOperationSubmit} className="p-6 space-y-4">
              {errorMsg && (
                <div className="rounded-lg bg-red-50 p-3 text-xs text-brandRed-700 border border-red-200 flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Tipo de Operación</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['CONSUMO', 'ENTRADA', 'AJUSTE'] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setOpType(t)}
                      className={`rounded-lg py-1.5 text-xs font-bold transition border ${
                        opType === t
                          ? 'bg-military-800 text-white border-military-800'
                          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Producto / Suministro *</label>
                <select
                  required
                  value={selectedProduct}
                  onChange={(e) => setSelectedProduct(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 py-2 px-3 text-xs sm:text-sm text-slate-800 focus:border-military-600 focus:outline-none"
                >
                  <option value="">Seleccione el suministro</option>
                  {data.items.map((it: any) => (
                    <option key={it.product_id} value={it.product_id}>
                      {it.code} - {it.name} ({it.unit_of_measure})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Almacén / Bodega *</label>
                  <select
                    required
                    value={selectedDept}
                    onChange={(e) => setSelectedDept(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 py-2 px-3 text-xs sm:text-sm text-slate-800 focus:border-military-600 focus:outline-none"
                  >
                    <option value="">Seleccione área</option>
                    {catalogs.departments?.map((d: any) => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Cantidad *</label>
                  <input
                    required
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={opQuantity}
                    onChange={(e) => setOpQuantity(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 py-2 px-3 text-xs sm:text-sm text-slate-800 font-bold focus:border-military-600 focus:outline-none"
                  />
                </div>
              </div>

              {opType === 'CONSUMO' && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Área que asume el costo del consumo
                  </label>
                  <select
                    value={selectedChargedDept}
                    onChange={(e) => setSelectedChargedDept(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 py-2 px-3 text-xs sm:text-sm text-slate-800 focus:border-military-600 focus:outline-none"
                  >
                    <option value="">Misma que el área de consumo</option>
                    {catalogs.departments?.map((d: any) => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Motivo / Vale de Salida / Observación</label>
                <textarea
                  rows={2}
                  required
                  value={opReason}
                  onChange={(e) => setOpReason(e.target.value)}
                  placeholder="ej. Reemplazo de cableado en Línea 1 según solicitud MNT-44..."
                  className="w-full rounded-lg border border-slate-300 py-2 px-3 text-xs text-slate-800 focus:border-military-600 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowOpModal(false)}
                  className="rounded px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded bg-military-800 px-4 py-1.5 text-xs font-bold text-white shadow hover:bg-military-900 disabled:opacity-50"
                >
                  {submitting ? 'Procesando...' : 'Confirmar Operación'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
