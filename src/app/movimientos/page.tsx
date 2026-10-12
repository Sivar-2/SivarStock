'use client';

import React, { useState, useEffect } from 'react';
import {
  ArrowLeftRight,
  Filter,
  Search,
  Plus,
  Calendar,
  Download,
  Boxes,
  FileText,
  User,
  Building,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  X
} from 'lucide-react';

export default function MovimientosPage() {
  const [movements, setMovements] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Filtros
  const [movementType, setMovementType] = useState('');
  const [search, setSearch] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  // Modal registrar entrada / movimiento
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    productId: '',
    movementType: 'ENTRADA',
    quantity: '1',
    unitCost: '',
    date: new Date().toISOString().split('T')[0],
    reason: '',
    referenceCode: '',
    fromDepartmentId: '',
    toDepartmentId: 'dept-bod',
  });

  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const queryParams = new URLSearchParams();
      if (movementType) queryParams.set('movementType', movementType);
      if (fromDate) queryParams.set('fromDate', fromDate);
      if (toDate) queryParams.set('toDate', toDate);

      const [movRes, prodRes, deptRes] = await Promise.all([
        fetch(`/api/movements?${queryParams.toString()}`),
        fetch('/api/products'),
        fetch('/api/catalogs'),
      ]);

      const movData = await movRes.json();
      const prodData = await prodRes.json();
      const deptData = await deptRes.json();

      if (movData.movements) setMovements(movData.movements);
      if (prodData.products) setProducts(prodData.products);
      if (deptData.departments) setDepartments(deptData.departments);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [movementType, fromDate, toDate]);

  const handleCreateMovement = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    if (!formData.reason.trim()) {
      setFeedback({ type: 'error', message: 'El motivo del movimiento es obligatorio por Poka-Yoke.' });
      return;
    }

    try {
      const res = await fetch('/api/movements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setFeedback({ type: 'success', message: 'Movimiento registrado con éxito.' });
      setTimeout(() => {
        setShowModal(false);
        setFeedback(null);
        setFormData({
          productId: '',
          movementType: 'ENTRADA',
          quantity: '1',
          unitCost: '',
          date: new Date().toISOString().split('T')[0],
          reason: '',
          referenceCode: '',
          fromDepartmentId: '',
          toDepartmentId: 'dept-bod',
        });
        loadData();
      }, 500);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message });
    }
  };

  const filtered = movements.filter(
    (m) =>
      m.product_name?.toLowerCase().includes(search.toLowerCase()) ||
      m.product_code?.toLowerCase().includes(search.toLowerCase()) ||
      m.reason?.toLowerCase().includes(search.toLowerCase()) ||
      m.reference_code?.toLowerCase().includes(search.toLowerCase()) ||
      m.executed_by_name?.toLowerCase().includes(search.toLowerCase())
  );

  const handleExport = async (fmt: 'excel' | 'csv') => {
    const cols = [
      { key: 'created_at', header: 'Fecha y Hora' },
      { key: 'movement_type', header: 'Tipo Movimiento' },
      { key: 'product_code', header: 'Código Producto' },
      { key: 'product_name', header: 'Producto' },
      { key: 'quantity', header: 'Cantidad' },
      { key: 'unit_cost', header: 'Costo Unitario (Q)' },
      { key: 'total_cost', header: 'Costo Total (Q)' },
      { key: 'reason', header: 'Motivo / Detalle' },
      { key: 'reference_code', header: 'Referencia / Doc' },
      { key: 'executed_by_name', header: 'Quién Realizó Movimiento' },
    ];

    const res = await fetch('/api/reports/export', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        format: fmt,
        title: 'Historial de Kardex y Movimientos de Inventario',
        columns: cols,
        data: filtered,
      }),
    });

    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `kardex_movimientos_${new Date().toISOString().slice(0, 10)}.${fmt === 'excel' ? 'xlsx' : 'csv'}`;
    a.click();
  };

  return (
    <div className="space-y-6">
        {/* Cabecera */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-5">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2.5">
              <ArrowLeftRight className="h-7 w-7 text-emerald-600" />
              Entradas y Movimientos de Inventario
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Kardex auditable • Registro de entradas con fecha, motivo y usuario responsable • Trazabilidad completa
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => handleExport('excel')}
              className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
            >
              <Download className="h-4 w-4 text-slate-500" />
              <span>Exportar Excel</span>
            </button>
            <button
              onClick={() => setShowModal(true)}
              className="flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white shadow-md hover:bg-emerald-800 transition"
            >
              <Plus className="h-4 w-4" />
              <span>Registrar Entrada / Movimiento</span>
            </button>
          </div>
        </div>

        {/* Barra de Filtros */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
          <div className="md:col-span-5 relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por producto, motivo, factura o usuario..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-4 py-2 text-sm text-slate-800 focus:border-emerald-600 focus:bg-white focus:outline-none"
            />
          </div>

          <div className="md:col-span-3">
            <select
              value={movementType}
              onChange={(e) => setMovementType(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 focus:border-emerald-600 focus:outline-none"
            >
              <option value="">Todos los tipos</option>
              <option value="ENTRADA">Entrada / Recepción</option>
              <option value="ASIGNACION">Asignación a Empleado</option>
              <option value="CONSUMO">Consumo Interno</option>
              <option value="REPARACION">Envío a Reparación</option>
              <option value="AJUSTE_AUTORIZADO">Ajuste Autorizado</option>
              <option value="BAJA">Baja de Activo</option>
            </select>
          </div>

          <div className="md:col-span-2">
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700 focus:border-emerald-600 focus:outline-none"
              title="Fecha inicial"
            />
          </div>

          <div className="md:col-span-2">
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700 focus:border-emerald-600 focus:outline-none"
              title="Fecha final"
            />
          </div>
        </div>

        {/* Tabla de Movimientos */}
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="border-b border-slate-200 bg-slate-50/75 text-xs uppercase font-semibold text-slate-700">
                <tr>
                  <th className="py-3.5 px-4">Fecha y Hora</th>
                  <th className="py-3.5 px-4">Tipo Movimiento</th>
                  <th className="py-3.5 px-4">Producto</th>
                  <th className="py-3.5 px-4">Cantidad</th>
                  <th className="py-3.5 px-4">Costo Total</th>
                  <th className="py-3.5 px-4">Motivo / Justificación</th>
                  <th className="py-3.5 px-4">Referencia / Doc</th>
                  <th className="py-3.5 px-4">Ejecutado Por</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-400">
                      Cargando movimientos...
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-400">
                      No se encontraron movimientos registrados.
                    </td>
                  </tr>
                ) : (
                  filtered.map((m) => {
                    const isPositive = ['ENTRADA', 'COMPRA', 'RECEPCION', 'DEVOLUCION'].includes(m.movement_type);
                    return (
                      <tr key={m.id} className="hover:bg-slate-50/70 transition">
                        <td className="py-3.5 px-4 font-mono text-xs text-slate-500">
                          {m.created_at}
                        </td>

                        <td className="py-3.5 px-4">
                          <span
                            className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                              isPositive
                                ? 'bg-emerald-100 text-emerald-800'
                                : m.movement_type === 'ASIGNACION'
                                ? 'bg-blue-100 text-blue-800'
                                : m.movement_type === 'CONSUMO'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-rose-100 text-rose-800'
                            }`}
                          >
                            {m.movement_type}
                          </span>
                        </td>

                        <td className="py-3.5 px-4">
                          <div className="font-semibold text-slate-900">{m.product_name}</div>
                          <div className="font-mono text-xs text-slate-400">{m.product_code}</div>
                        </td>

                        <td className="py-3.5 px-4 font-mono font-bold">
                          <span className={isPositive ? 'text-emerald-700' : 'text-slate-900'}>
                            {isPositive ? `+${m.quantity}` : `-${m.quantity}`} {m.unit_of_measure}
                          </span>
                        </td>

                        <td className="py-3.5 px-4 font-mono text-xs font-bold text-slate-900">
                          {m.total_cost > 0
                            ? `Q${Number(m.total_cost).toLocaleString('es-GT', { minimumFractionDigits: 2 })}`
                            : '-'}
                        </td>

                        <td className="py-3.5 px-4 text-xs text-slate-800 max-w-xs truncate" title={m.reason}>
                          {m.reason}
                        </td>

                        <td className="py-3.5 px-4 font-mono text-xs text-slate-500">
                          {m.reference_code || '-'}
                        </td>

                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-1.5 text-xs font-medium text-slate-700">
                            <User className="h-3.5 w-3.5 text-slate-400" />
                            <span>{m.executed_by_name || m.executed_by_username || 'Sistema'}</span>
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

        {/* MODAL REGISTRAR ENTRADA / MOVIMIENTO */}
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
            <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl animate-in fade-in zoom-in-95">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <ArrowLeftRight className="h-5 w-5 text-emerald-600" />
                  Registrar Entrada o Movimiento
                </h3>
                <button onClick={() => setShowModal(false)} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100">
                  <X className="h-5 w-5" />
                </button>
              </div>

              {feedback && (
                <div
                  className={`mt-4 flex items-center gap-2 rounded-xl p-3 text-xs ${
                    feedback.type === 'success' ? 'bg-emerald-50 text-emerald-800' : 'bg-rose-50 text-rose-800'
                  }`}
                >
                  {feedback.type === 'success' ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                  <span>{feedback.message}</span>
                </div>
              )}

              <form onSubmit={handleCreateMovement} className="mt-4 space-y-3.5">
                <div>
                  <label className="block text-xs font-medium text-slate-700">Producto / Suministro</label>
                  <select
                    required
                    value={formData.productId}
                    onChange={(e) => setFormData({ ...formData, productId: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none"
                  >
                    <option value="">Seleccione el producto</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.code}) • Stock: {p.current_stock}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700">Tipo de Operación</label>
                    <select
                      value={formData.movementType}
                      onChange={(e) => setFormData({ ...formData, movementType: e.target.value })}
                      className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none"
                    >
                      <option value="ENTRADA">Entrada / Recepción de Compra</option>
                      <option value="CONSUMO">Consumo Interno</option>
                      <option value="DEVOLUCION">Devolución a Bodega</option>
                      <option value="AJUSTE_AUTORIZADO">Ajuste Autorizado</option>
                      <option value="BAJA">Baja por Daño</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700">Fecha del Movimiento</label>
                    <input
                      type="date"
                      required
                      value={formData.date}
                      onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                      className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700">Cantidad</label>
                    <input
                      type="number"
                      min="1"
                      required
                      value={formData.quantity}
                      onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                      className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-mono focus:border-emerald-600 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700">Costo Unitario (Q - Opcional)</label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={formData.unitCost}
                      onChange={(e) => setFormData({ ...formData, unitCost: e.target.value })}
                      className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-mono focus:border-emerald-600 focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700">N° Factura / Orden / Referencia</label>
                  <input
                    type="text"
                    placeholder="FAC-2026-001 o Vale N° 45"
                    value={formData.referenceCode}
                    onChange={(e) => setFormData({ ...formData, referenceCode: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-mono focus:border-emerald-600 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700">
                    Motivo o Justificación Obligatoria (Poka-Yoke):
                  </label>
                  <textarea
                    rows={2}
                    required
                    placeholder="ej. Recepción de compra mensual de tintas y suministros autorizada..."
                    value={formData.reason}
                    onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 text-sm focus:border-emerald-600 focus:outline-none"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800"
                  >
                    Registrar Movimiento
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
  );
}
