'use client';

import React, { useState, useEffect } from 'react';
import {
  FileBarChart2,
  Play,
  Save,
  Columns,
  Table as TableIcon,
  BarChart2,
  FileSpreadsheet,
  FileText,
  Bookmark,
  Trash2,
  Check,
  ExternalLink,
  TrendingUp,
  Smartphone,
  Wrench,
  Server,
  DollarSign,
  Printer,
  AlertTriangle,
  ShieldCheck,
  Repeat,
  Download,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

export default function ReportesPage() {
  const [activeTab, setActiveTab] = useState<'EXECUTIVE' | 'BUILDER' | 'LOOKER_STUDIO'>('EXECUTIVE');
  const [savedReports, setSavedReports] = useState<any[]>([]);
  const [catalogs, setCatalogs] = useState<any>({ departments: [], categories: [], users: [] });
  const [execSummary, setExecSummary] = useState<any | null>(null);
  const [loadingExec, setLoadingExec] = useState(true);

  // Parámetros del constructor de reporte
  const [selectedModule, setSelectedModule] = useState<
    'INVENTARIO' | 'COSTOS' | 'MOVIMIENTOS' | 'SERVICIOS' | 'ASIGNACIONES' | 'CELULARES' | 'MANTENIMIENTO' | 'BODEGA' | 'ALQUILERES'
  >('INVENTARIO');
  const [reportTitle, setReportTitle] = useState('Reporte Ejecutivo de Inventario y Operaciones');
  const [selectedColumns, setSelectedColumns] = useState<string[]>([]);
  const [filterDept, setFilterDept] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [groupBy, setGroupBy] = useState('');
  const [visualization, setVisualization] = useState<'TABLE' | 'BAR_CHART'>('TABLE');

  // Resultados
  const [reportData, setReportData] = useState<any[]>([]);
  const [groupedSummary, setGroupedSummary] = useState<any>(null);
  const [executing, setExecuting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const availableColumnsByModule: Record<string, { key: string; label: string }[]> = {
    INVENTARIO: [
      { key: 'permanent_code', label: 'Código Permanente' },
      { key: 'product_name', label: 'Producto' },
      { key: 'category_name', label: 'Categoría' },
      { key: 'brand', label: 'Marca' },
      { key: 'model', label: 'Modelo' },
      { key: 'serial_number', label: 'N° Serie' },
      { key: 'mac_address', label: 'MAC Address' },
      { key: 'imei', label: 'IMEI' },
      { key: 'department_name', label: 'Área Actual' },
      { key: 'assigned_user_name', label: 'Custodio' },
      { key: 'operational_status', label: 'Disponibilidad' },
      { key: 'purchase_price', label: 'Precio Compra (Q)' },
      { key: 'supplier', label: 'Proveedor' },
      { key: 'warranty_expiration', label: 'Garantía' },
    ],
    BODEGA: [
      { key: 'permanent_code', label: 'Código Activo' },
      { key: 'product_name', label: 'Producto' },
      { key: 'category_name', label: 'Categoría' },
      { key: 'brand', label: 'Marca' },
      { key: 'model', label: 'Modelo' },
      { key: 'serial_number', label: 'N° Serie' },
      { key: 'mac_address', label: 'MAC Address' },
      { key: 'operational_status', label: 'Estado' },
      { key: 'purchase_price', label: 'Valor Adquisición (Q)' },
      { key: 'supplier', label: 'Proveedor' },
    ],
    ALQUILERES: [
      { key: 'product_code', label: 'Código' },
      { key: 'product_name', label: 'Producto Alquilado' },
      { key: 'category_name', label: 'Categoría' },
      { key: 'brand', label: 'Marca' },
      { key: 'model', label: 'Modelo' },
      { key: 'rental_cost', label: 'Pago Alquiler (Q)' },
      { key: 'rental_period', label: 'Periodo' },
      { key: 'supplier', label: 'Proveedor Arrendador' },
      { key: 'supplier_phone', label: 'Teléfono Contacto' },
      { key: 'supplier_contract', label: 'Contrato' },
    ],
    CELULARES: [
      { key: 'device_code', label: 'Código' },
      { key: 'employee_name', label: 'Empleado Asignado' },
      { key: 'department_name', label: 'Departamento' },
      { key: 'phone_number', label: 'N° Teléfono' },
      { key: 'carrier', label: 'Operadora' },
      { key: 'assignment_mode', label: 'Modalidad (Plan / Sin Plan / Chip)' },
      { key: 'brand', label: 'Marca' },
      { key: 'model', label: 'Modelo' },
      { key: 'plan_name', label: 'Plan Contratado' },
      { key: 'monthly_cost', label: 'Cuota Mensual (Q)' },
      { key: 'contract_end_date', label: 'Vencimiento Contrato' },
      { key: 'incident_type', label: 'Incidente (Robo / Pérdida)' },
      { key: 'waiting_days', label: 'Días Esperando Claro' },
      { key: 'status', label: 'Estado' },
    ],
    MANTENIMIENTO: [
      { key: 'permanent_code', label: 'Código Activo' },
      { key: 'product_name', label: 'Equipo' },
      { key: 'reported_date', label: 'Fecha Reporte' },
      { key: 'fault_description', label: 'Falla Reportada' },
      { key: 'repair_source', label: 'Reparación (Tercero / Interna)' },
      { key: 'status', label: 'Estado (Incl. En Observación)' },
      { key: 'observation_end_date', label: 'Fin Prueba 7 Días' },
      { key: 'cost', label: 'Costo Reparación (Q)' },
    ],
    COSTOS: [
      { key: 'expense_date', label: 'Fecha de Gasto' },
      { key: 'concept', label: 'Concepto' },
      { key: 'cost_nature', label: 'Naturaleza' },
      { key: 'total_amount', label: 'Total (Q GTQ)' },
      { key: 'charged_dept_name', label: 'Área Imputada' },
      { key: 'supplier', label: 'Proveedor' },
      { key: 'invoice_number', label: 'N° Factura' },
      { key: 'purchase_order', label: 'N° Orden Compra' },
    ],
    MOVIMIENTOS: [
      { key: 'created_at', label: 'Fecha' },
      { key: 'movement_type', label: 'Tipo Movimiento' },
      { key: 'product_name', label: 'Producto' },
      { key: 'quantity', label: 'Cantidad' },
      { key: 'recipient_name', label: 'Entregado A' },
      { key: 'acta_status', label: 'Estado Acta Digital' },
      { key: 'from_dept_name', label: 'Origen' },
      { key: 'to_dept_name', label: 'Destino' },
      { key: 'reason', label: 'Motivo / Detalle' },
    ],
    SERVICIOS: [
      { key: 'name', label: 'Servicio / Licencia / Contrato' },
      { key: 'category', label: 'Categoría' },
      { key: 'contract_type', label: 'Tipo Registro' },
      { key: 'provider', label: 'Proveedor' },
      { key: 'employee_name', label: 'Asignado A' },
      { key: 'cost_period', label: 'Periodicidad' },
      { key: 'amount', label: 'Importe (Q)' },
      { key: 'expiration_date', label: 'Vencimiento / Sin Renovación' },
      { key: 'last_renewal_date', label: 'Última Renovación' },
      { key: 'renewal_count', label: 'N° Renovaciones' },
      { key: 'status', label: 'Estado' },
    ],
    ASIGNACIONES: [
      { key: 'assignment_code', label: 'Código Acta' },
      { key: 'user_name', label: 'Empleado Custodio' },
      { key: 'product_name', label: 'Producto' },
      { key: 'permanent_code', label: 'Activo' },
      { key: 'assigned_at', label: 'Fecha Asignación' },
      { key: 'target_dept_name', label: 'Departamento' },
      { key: 'status', label: 'Estado' },
    ],
  };

  useEffect(() => {
    const defaultCols = (availableColumnsByModule[selectedModule] || []).slice(0, 9).map((c) => c.key);
    setSelectedColumns(defaultCols);
  }, [selectedModule]);

  useEffect(() => {
    fetchExecutiveSummary();
    fetchCatalogs();
    fetchSavedReports();
    handleRunReport();
  }, []);

  const fetchExecutiveSummary = async () => {
    setLoadingExec(true);
    try {
      const res = await fetch('/api/reports/query?mode=SUMMARY');
      const d = await res.json();
      if (d.success) setExecSummary(d);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingExec(false);
    }
  };

  const fetchCatalogs = async () => {
    try {
      const res = await fetch('/api/catalogs');
      const d = await res.json();
      setCatalogs(d);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchSavedReports = async () => {
    try {
      const res = await fetch('/api/reports/saved');
      const d = await res.json();
      if (d.reports) setSavedReports(d.reports);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSaveReportConfig = async () => {
    if (!reportTitle.trim()) return;
    setSaving(true);
    try {
      const res = await fetch('/api/reports/saved', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: reportTitle.trim(),
          description: `Reporte de ${selectedModule}`,
          module: selectedModule,
          columns: selectedColumns,
          filters: { departmentId: filterDept, status: filterStatus, fromDate, toDate },
          groupBy: groupBy || null,
          visualizationType: visualization,
        }),
      });
      if (res.ok) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 2500);
        fetchSavedReports();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleLoadSavedReport = (rep: any) => {
    setActiveTab('BUILDER');
    setReportTitle(rep.name);
    if (rep.module) setSelectedModule(rep.module);
    if (Array.isArray(rep.columns) && rep.columns.length > 0) {
      setTimeout(() => setSelectedColumns(rep.columns), 50);
    }
    if (rep.group_by !== undefined) setGroupBy(rep.group_by || '');
    if (rep.visualization_type) setVisualization(rep.visualization_type);
    setTimeout(() => handleRunReport(), 100);
  };

  const handleDeleteSavedReport = async (id: string) => {
    try {
      await fetch(`/api/reports/saved?id=${id}`, { method: 'DELETE' });
      fetchSavedReports();
    } catch (err) {
      console.error(err);
    }
  };

  const applyDatePreset = (preset: 'semanal' | 'mensual' | 'trimestral' | 'historico') => {
    const today = new Date();
    const toStr = today.toISOString().slice(0, 10);
    setToDate(toStr);

    if (preset === 'semanal') {
      const d = new Date();
      d.setDate(d.getDate() - 7);
      setFromDate(d.toISOString().slice(0, 10));
    } else if (preset === 'mensual') {
      const d = new Date();
      d.setDate(d.getDate() - 30);
      setFromDate(d.toISOString().slice(0, 10));
    } else if (preset === 'trimestral') {
      const d = new Date();
      d.setDate(d.getDate() - 90);
      setFromDate(d.toISOString().slice(0, 10));
    } else {
      setFromDate('');
      setToDate('');
    }
    setTimeout(() => handleRunReport(), 50);
  };

  const handleRunReport = async (customFilters?: any, customModule?: any) => {
    setExecuting(true);
    try {
      const mod = customModule || selectedModule;
      const filters: any = customFilters || {};
      if (filterDept && !customFilters) filters.departmentId = filterDept;
      if (filterStatus && !customFilters) filters.status = filterStatus;

      const res = await fetch('/api/reports/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          module: mod,
          columns: selectedColumns,
          filters,
          groupBy: groupBy || null,
          startDate: fromDate || null,
          endDate: toDate || null,
        }),
      });

      const d = await res.json();
      setReportData(d.data || []);
      setGroupedSummary(d.groupedSummary || null);
    } catch (err) {
      console.error(err);
    } finally {
      setExecuting(false);
    }
  };

  const handleToggleColumn = (colKey: string) => {
    if (selectedColumns.includes(colKey)) {
      if (selectedColumns.length > 1) {
        setSelectedColumns(selectedColumns.filter((c) => c !== colKey));
      }
    } else {
      setSelectedColumns([...selectedColumns, colKey]);
    }
  };

  const handleExport = async (fmt: 'excel' | 'csv' | 'pdf') => {
    const activeCols = (availableColumnsByModule[selectedModule] || [])
      .filter((c) => selectedColumns.includes(c.key))
      .map((c) => ({ key: c.key, header: c.label }));

    const res = await fetch('/api/reports/export', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        format: fmt,
        title: reportTitle,
        subtitle: `Módulo: ${selectedModule} | Moneda: Quetzales (GTQ) | Fecha: ${fromDate || 'Inicio'} a ${toDate || 'Hoy'}`,
        columns: activeCols,
        data: reportData,
      }),
    });

    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const ext = fmt === 'excel' ? 'xlsx' : fmt === 'pdf' ? 'pdf' : 'csv';
    a.download = `${reportTitle.replace(/[^a-z0-9]/gi, '_')}_${new Date().toISOString().slice(0, 10)}.${ext}`;
    a.click();
  };

  const barChartData = groupedSummary
    ? Object.entries(groupedSummary).map(([name, item]: [string, any]) => ({
        name,
        total: item.totalAmount || item.count,
        count: item.count,
      }))
    : [];

  return (
    <div className="space-y-6">
      {/* Encabezado Principal */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">
              Centro Analítico de Reportes y Métricas
            </h1>
            <span className="rounded-full bg-military-800 px-2.5 py-0.5 text-[11px] font-bold text-white">
              Data Analytics • GTQ (Q)
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Tablas ejecutivas concisas y bien explicadas: Licencias, Contratos, Teléfonos (sin plan / reposición Claro), Renovaciones, Bodega, Alquileres, Costos y Movimientos.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-slate-800"
          >
            <Printer className="h-3.5 w-3.5" />
            <span>Imprimir / Guardar PDF</span>
          </button>
          <button
            onClick={() => handleExport('excel')}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
          >
            <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
            <span>Excel (.xlsx)</span>
          </button>
          <button
            onClick={() => handleExport('pdf')}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
          >
            <FileText className="h-3.5 w-3.5 text-brandRed-600" />
            <span>Exportar PDF</span>
          </button>
          <button
            onClick={() => handleExport('csv')}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
          >
            <Download className="h-3.5 w-3.5 text-blue-600" />
            <span>CSV / SaaS</span>
          </button>
        </div>
      </div>

      {/* Pestañas de Vista */}
      <div className="flex flex-wrap border-b border-slate-200 bg-white px-2 pt-2 rounded-t-xl">
        <button
          onClick={() => setActiveTab('EXECUTIVE')}
          className={`flex items-center gap-2 border-b-2 px-4 py-3 text-xs font-bold transition ${
            activeTab === 'EXECUTIVE'
              ? 'border-military-800 text-military-900 bg-military-50/50'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <TrendingUp className="h-4 w-4 text-emerald-600" />
          <span>Resumen Ejecutivo 360° (Tablas Concisas)</span>
        </button>
        <button
          onClick={() => setActiveTab('BUILDER')}
          className={`flex items-center gap-2 border-b-2 px-4 py-3 text-xs font-bold transition ${
            activeTab === 'BUILDER'
              ? 'border-military-800 text-military-900 bg-military-50/50'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <FileBarChart2 className="h-4 w-4" />
          <span>Constructor Personalizado de Reportes</span>
        </button>
        <button
          onClick={() => setActiveTab('LOOKER_STUDIO')}
          className={`flex items-center gap-2 border-b-2 px-4 py-3 text-xs font-bold transition ${
            activeTab === 'LOOKER_STUDIO'
              ? 'border-military-800 text-military-900 bg-military-50/50'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <ExternalLink className="h-4 w-4 text-blue-600" />
          <span>Conexión SaaS / Looker Studio / Power BI</span>
        </button>
      </div>

      {/* VISTA 0: RESUMEN EJECUTIVO 360 CON TABLAS CONCISAS Y EXPLICADAS */}
      {activeTab === 'EXECUTIVE' && (
        <div className="space-y-6">
          {loadingExec || !execSummary ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-xs text-slate-400">
              Consolidando métricas de Bodega, Teléfonos, Licencias, Alquileres, Costos y Movimientos...
            </div>
          ) : (
            <>
              {/* KPIs Globales */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <span className="text-[11px] font-bold uppercase text-slate-400 block">Stock en Bodega</span>
                  <span className="text-2xl font-black text-slate-900 font-mono mt-1 block">
                    {execSummary.kpis.bodegaItems} uds
                  </span>
                  <span className="text-xs text-emerald-700 font-semibold">
                    Valor: Q{Number(execSummary.kpis.bodegaValue || 0).toLocaleString('es-GT', { minimumFractionDigits: 2 })}
                  </span>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <span className="text-[11px] font-bold uppercase text-slate-400 block">Teléfonos y Líneas</span>
                  <span className="text-2xl font-black text-slate-900 font-mono mt-1 block">
                    {execSummary.kpis.mobilesCount} líneas
                  </span>
                  <span className="text-xs text-purple-700 font-semibold">
                    Sin plan: {execSummary.kpis.personalNoPlanCount} • Reposición Claro: {execSummary.kpis.waitingClaroCount}
                  </span>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <span className="text-[11px] font-bold uppercase text-slate-400 block">Licencias y Contratos</span>
                  <span className="text-2xl font-black text-slate-900 font-mono mt-1 block">
                    {execSummary.kpis.servicesCount} activos
                  </span>
                  <span className="text-xs text-blue-700 font-semibold">
                    Sin renovación: {execSummary.kpis.servicesNoExpirationCount} • Q{Number(execSummary.kpis.servicesMonthlyCost || 0).toLocaleString('es-GT')}/mes
                  </span>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <span className="text-[11px] font-bold uppercase text-slate-400 block">Alquileres y Costos</span>
                  <span className="text-2xl font-black text-slate-900 font-mono mt-1 block">
                    {execSummary.kpis.rentedProductsCount} alquilados
                  </span>
                  <span className="text-xs text-amber-700 font-semibold">
                    Renta: Q{Number(execSummary.kpis.rentedMonthlyTotal || 0).toLocaleString('es-GT')} • Movs: {execSummary.kpis.totalMovements}
                  </span>
                </div>
              </div>

              {/* Tabla 1: Personal con Número Personal (Sin Plan Corporativo) y Esperando Reposición Claro */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                        <Smartphone className="h-4 w-4 text-purple-600" />
                        Personal con Número Personal (Sin Plan Corporativo)
                      </h3>
                      <p className="text-[11px] text-slate-500">
                        Colaboradores registrados que utilizan su propio número telefónico sin plan de la empresa.
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        setActiveTab('BUILDER');
                        setSelectedModule('CELULARES');
                        setReportTitle('Personal con Número Propio (Sin Plan Corporativo)');
                        handleRunReport({ assignmentMode: 'PERSONAL_SIN_PLAN' }, 'CELULARES');
                      }}
                      className="text-xs font-bold text-purple-700 hover:underline"
                    >
                      Exportar tabla →
                    </button>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-[10px] uppercase text-slate-500 font-bold">
                        <tr>
                          <th className="p-2">Empleado</th>
                          <th className="p-2">Área</th>
                          <th className="p-2">N° Personal</th>
                          <th className="p-2">Equipo</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {execSummary.personalSinPlan.length === 0 ? (
                          <tr>
                            <td colSpan={4} className="p-4 text-center text-slate-400">
                              No hay personal registrado bajo modalidad "Número Personal Sin Plan".
                            </td>
                          </tr>
                        ) : (
                          execSummary.personalSinPlan.map((m: any) => (
                            <tr key={m.id}>
                              <td className="p-2 font-semibold text-slate-900">{m.employee_name || 'Sin asignar'}</td>
                              <td className="p-2 text-slate-600">{m.department_name || 'General'}</td>
                              <td className="p-2 font-mono font-bold text-purple-700">{m.phone_number}</td>
                              <td className="p-2 text-slate-500">{m.brand} {m.model}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Tabla 2: Esperando Reposición de Claro (Asalto / Robo / Pérdida) */}
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-amber-600" />
                        Esperando Reposición de Equipo Claro (Robo / Pérdida)
                      </h3>
                      <p className="text-[11px] text-slate-500">
                        Control del tiempo transcurrido desde el reporte del incidente hasta la entrega por Claro Guatemala.
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        setActiveTab('BUILDER');
                        setSelectedModule('CELULARES');
                        setReportTitle('Equipos Móviles Esperando Reposición de Claro');
                        handleRunReport({ waitingClaroOnly: true }, 'CELULARES');
                      }}
                      className="text-xs font-bold text-amber-700 hover:underline"
                    >
                      Exportar tabla →
                    </button>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-[10px] uppercase text-slate-500 font-bold">
                        <tr>
                          <th className="p-2">Empleado</th>
                          <th className="p-2">Línea</th>
                          <th className="p-2">Motivo</th>
                          <th className="p-2">Tiempo Espera</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {execSummary.esperandoReposicionClaro.length === 0 ? (
                          <tr>
                            <td colSpan={4} className="p-4 text-center text-slate-400">
                              Ninguna línea pendiente de reposición en este momento.
                            </td>
                          </tr>
                        ) : (
                          execSummary.esperandoReposicionClaro.map((m: any) => (
                            <tr key={m.id}>
                              <td className="p-2 font-semibold text-slate-900">{m.employee_name || 'Sin asignar'}</td>
                              <td className="p-2 font-mono">{m.phone_number}</td>
                              <td className="p-2 text-rose-700 font-bold">{m.incident_type || m.status}</td>
                              <td className="p-2 font-mono font-bold text-amber-800">
                                ⏳ {Math.max(0, Number(m.waiting_days || 0))} día(s)
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Tabla 3: Licencias, Contratos y Renovaciones & Tabla 4: Productos Alquilados */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                        <Repeat className="h-4 w-4 text-blue-600" />
                        Licencias, Contratos y Renovaciones Recientes
                      </h3>
                      <p className="text-[11px] text-slate-500">
                        Control de vencimientos, licencias perpetuas (sin renovación) e historial de renovaciones.
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        setActiveTab('BUILDER');
                        setSelectedModule('SERVICIOS');
                        setReportTitle('Reporte General de Licencias, Contratos y Renovaciones');
                        handleRunReport({}, 'SERVICIOS');
                      }}
                      className="text-xs font-bold text-blue-700 hover:underline"
                    >
                      Ver todo →
                    </button>
                  </div>

                  <div className="overflow-x-auto max-h-64">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-[10px] uppercase text-slate-500 font-bold">
                        <tr>
                          <th className="p-2">Licencia / Contrato</th>
                          <th className="p-2">Categoría</th>
                          <th className="p-2">Vencimiento</th>
                          <th className="p-2">Renovaciones</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {execSummary.licenciasYRenovaciones.length === 0 ? (
                          <tr>
                            <td colSpan={4} className="p-4 text-center text-slate-400">
                              Sin licencias o contratos registrados.
                            </td>
                          </tr>
                        ) : (
                          execSummary.licenciasYRenovaciones.slice(0, 8).map((s: any) => (
                            <tr key={s.id}>
                              <td className="p-2 font-semibold text-slate-900">{s.name}</td>
                              <td className="p-2 text-slate-600">{s.category}</td>
                              <td className="p-2 font-mono text-[11px]">
                                {s.no_expiration === 1 ? (
                                  <span className="text-emerald-700 font-bold">Sin renovación</span>
                                ) : (
                                  s.expiration_date || 'N/A'
                                )}
                              </td>
                              <td className="p-2 font-mono font-bold text-blue-700">
                                {s.renewal_count || 0} ({s.last_renewal_date || 'Inicial'})
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Tabla 4: Productos y Equipos Alquilados */}
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                        <DollarSign className="h-4 w-4 text-emerald-600" />
                        Control de Equipos y Productos Alquilados
                      </h3>
                      <p className="text-[11px] text-slate-500">
                        Impresoras, enlaces o equipos bajo contrato de arrendamiento y su cuota periódica.
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        setActiveTab('BUILDER');
                        setSelectedModule('ALQUILERES');
                        setReportTitle('Reporte de Equipos Alquilados y Contratos de Renta');
                        handleRunReport({}, 'ALQUILERES');
                      }}
                      className="text-xs font-bold text-emerald-700 hover:underline"
                    >
                      Exportar tabla →
                    </button>
                  </div>

                  <div className="overflow-x-auto max-h-64">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-[10px] uppercase text-slate-500 font-bold">
                        <tr>
                          <th className="p-2">Producto</th>
                          <th className="p-2">Proveedor</th>
                          <th className="p-2">Periodo</th>
                          <th className="p-2">Costo Renta</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {execSummary.alquileresActivos.length === 0 ? (
                          <tr>
                            <td colSpan={4} className="p-4 text-center text-slate-400">
                              No hay productos marcados como alquilados actualmente.
                            </td>
                          </tr>
                        ) : (
                          execSummary.alquileresActivos.map((r: any) => (
                            <tr key={r.id}>
                              <td className="p-2 font-semibold text-slate-900">{r.name}</td>
                              <td className="p-2 text-slate-600">{r.rental_provider || 'N/A'}</td>
                              <td className="p-2 text-slate-500">{r.rental_period || 'MENSUAL'}</td>
                              <td className="p-2 font-mono font-bold text-emerald-700">
                                Q{Number(r.rental_cost || 0).toLocaleString('es-GT', { minimumFractionDigits: 2 })}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* VISTA 1: CONSTRUCTOR VISUAL Y PRESETS */}
      {activeTab === 'BUILDER' && (
        <div className="space-y-6">
          {/* Presets Rápidos de Análisis Económico */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
            <div>
              <span className="text-xs font-bold uppercase text-slate-500 block mb-2">
                Plantillas Directas de Auditoría y Análisis de Datos:
              </span>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => {
                    setSelectedModule('BODEGA');
                    setReportTitle('Reporte de Existencias en Bodega Central');
                    setGroupBy('');
                    applyDatePreset('historico');
                  }}
                  className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-military-50 hover:border-military-600"
                >
                  <Server className="h-3.5 w-3.5 text-military-800" />
                  <span>Bodega Central</span>
                </button>

                <button
                  onClick={() => {
                    setSelectedModule('ALQUILERES');
                    setReportTitle('Equipos Alquilados y Tarifas de Arrendamiento');
                    setGroupBy('');
                    handleRunReport({}, 'ALQUILERES');
                  }}
                  className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-military-50 hover:border-military-600"
                >
                  <DollarSign className="h-3.5 w-3.5 text-emerald-600" />
                  <span>Productos Alquilados</span>
                </button>

                <button
                  onClick={() => {
                    setSelectedModule('CELULARES');
                    setReportTitle('Personal con Número Propio (Sin Plan Corporativo)');
                    setGroupBy('');
                    handleRunReport({ assignmentMode: 'PERSONAL_SIN_PLAN' }, 'CELULARES');
                  }}
                  className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-military-50 hover:border-military-600"
                >
                  <Smartphone className="h-3.5 w-3.5 text-purple-600" />
                  <span>Personal Sin Plan Corporativo</span>
                </button>

                <button
                  onClick={() => {
                    setSelectedModule('CELULARES');
                    setReportTitle('Teléfonos Esperando Reposición de Claro (Robo / Pérdida)');
                    setGroupBy('');
                    handleRunReport({ waitingClaroOnly: true }, 'CELULARES');
                  }}
                  className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-military-50 hover:border-military-600"
                >
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
                  <span>Esperando Reposición Claro</span>
                </button>

                <button
                  onClick={() => {
                    setSelectedModule('SERVICIOS');
                    setReportTitle('Licencias, Contratos y Renovaciones');
                    setGroupBy('category');
                    applyDatePreset('historico');
                  }}
                  className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-military-50 hover:border-military-600"
                >
                  <ShieldCheck className="h-3.5 w-3.5 text-blue-600" />
                  <span>Licencias y Renovaciones</span>
                </button>

                <button
                  onClick={() => {
                    setSelectedModule('MOVIMIENTOS');
                    setReportTitle('Bitácora de Entradas, Movimientos y Actas');
                    setGroupBy('movement_type');
                    applyDatePreset('mensual');
                  }}
                  className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-military-50 hover:border-military-600"
                >
                  <TrendingUp className="h-3.5 w-3.5 text-indigo-600" />
                  <span>Entradas y Movimientos</span>
                </button>

                <button
                  onClick={() => {
                    setSelectedModule('MANTENIMIENTO');
                    setReportTitle('Averías, Reparaciones (Terceros / Internas) y En Observación');
                    setGroupBy('status');
                    applyDatePreset('mensual');
                  }}
                  className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-military-50 hover:border-military-600"
                >
                  <Wrench className="h-3.5 w-3.5 text-rose-600" />
                  <span>Averías y Mantenimiento</span>
                </button>
              </div>
            </div>

            {savedReports.length > 0 && (
              <div className="pt-2 border-t border-slate-100">
                <span className="text-[11px] font-bold uppercase text-slate-400 block mb-1.5">
                  Tus Reportes Guardados:
                </span>
                <div className="flex flex-wrap gap-2">
                  {savedReports.map((rep) => (
                    <div
                      key={rep.id}
                      className="flex items-center gap-1.5 rounded-lg border border-military-200 bg-military-50/60 px-2.5 py-1 text-xs font-semibold text-military-900"
                    >
                      <button
                        type="button"
                        onClick={() => handleLoadSavedReport(rep)}
                        className="flex items-center gap-1 hover:underline"
                      >
                        <Bookmark className="h-3 w-3 text-military-700" />
                        <span>{rep.name}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteSavedReport(rep.id)}
                        className="text-slate-400 hover:text-rose-600 ml-1"
                        title="Eliminar reporte guardado"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* PARÁMETROS DEL REPORTE */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Nombre del Reporte</label>
                <input
                  type="text"
                  value={reportTitle}
                  onChange={(e) => setReportTitle(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 py-1.5 px-3 text-xs font-semibold text-slate-900 focus:border-military-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Módulo a Consultar</label>
                <select
                  value={selectedModule}
                  onChange={(e) => setSelectedModule(e.target.value as any)}
                  className="w-full rounded-lg border border-slate-300 py-1.5 px-2 text-xs font-semibold text-slate-900 focus:border-military-600 focus:outline-none"
                >
                  <option value="INVENTARIO">Inventario General de Activos</option>
                  <option value="BODEGA">Bodega Central</option>
                  <option value="ALQUILERES">Productos y Equipos Alquilados</option>
                  <option value="CELULARES">Celulares, Líneas y Planes</option>
                  <option value="SERVICIOS">Licencias, Contratos y Renovaciones</option>
                  <option value="ASIGNACIONES">Asignaciones a Personal</option>
                  <option value="MANTENIMIENTO">Averías y Mantenimiento</option>
                  <option value="COSTOS">Costos, Facturas y Garantías</option>
                  <option value="MOVIMIENTOS">Entradas y Movimientos</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Filtrar por Área / Depto</label>
                <select
                  value={filterDept}
                  onChange={(e) => setFilterDept(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 py-1.5 px-2 text-xs text-slate-900 focus:border-military-600 focus:outline-none"
                >
                  <option value="">Todas las áreas</option>
                  {catalogs.departments?.map((d: any) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Agrupar Datos Por</label>
                <select
                  value={groupBy}
                  onChange={(e) => setGroupBy(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 py-1.5 px-2 text-xs text-slate-900 focus:border-military-600 focus:outline-none"
                >
                  <option value="">Sin agrupación (Detallado)</option>
                  <option value="department_name">Por Departamento</option>
                  <option value="category_name">Por Categoría</option>
                  <option value="operational_status">Por Estado / Condición</option>
                  <option value="movement_type">Por Tipo de Movimiento</option>
                </select>
              </div>
            </div>

            {/* Selector de Columnas */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <Columns className="h-3.5 w-3.5 text-military-700" />
                  <span>Columnas a Mostrar / Exportar:</span>
                </span>
                <button
                  onClick={handleSaveReportConfig}
                  disabled={saving}
                  className="flex items-center gap-1 text-xs font-bold text-emerald-700 hover:underline"
                >
                  {saveSuccess ? <Check className="h-3.5 w-3.5" /> : <Save className="h-3.5 w-3.5" />}
                  <span>{saveSuccess ? 'Plantilla guardada' : 'Guardar vista actual'}</span>
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5 p-3 rounded-xl bg-slate-50 border border-slate-200">
                {(availableColumnsByModule[selectedModule] || []).map((col) => {
                  const isChecked = selectedColumns.includes(col.key);
                  return (
                    <button
                      key={col.key}
                      type="button"
                      onClick={() => handleToggleColumn(col.key)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition ${
                        isChecked
                          ? 'bg-military-800 text-white border-military-800 shadow-sm'
                          : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      {col.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setVisualization('TABLE')}
                  className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold border ${
                    visualization === 'TABLE'
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'bg-white text-slate-600 border-slate-200'
                  }`}
                >
                  <TableIcon className="h-3.5 w-3.5" />
                  <span>Tabla Detallada</span>
                </button>
                <button
                  type="button"
                  onClick={() => setVisualization('BAR_CHART')}
                  className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold border ${
                    visualization === 'BAR_CHART'
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'bg-white text-slate-600 border-slate-200'
                  }`}
                >
                  <BarChart2 className="h-3.5 w-3.5" />
                  <span>Gráfico Analítico</span>
                </button>
              </div>

              <button
                type="button"
                onClick={() => handleRunReport()}
                disabled={executing}
                className="flex items-center gap-1.5 rounded-lg bg-military-800 px-5 py-2 text-xs font-bold text-white shadow hover:bg-military-900 disabled:opacity-50"
              >
                <Play className={`h-3.5 w-3.5 ${executing ? 'animate-spin' : ''}`} />
                <span>{executing ? 'Generando...' : 'Ejecutar Consulta'}</span>
              </button>
            </div>
          </div>

          {/* RESULTADOS DEL REPORTE */}
          {visualization === 'BAR_CHART' && barChartData.length > 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="text-sm font-bold text-slate-900 mb-4">{reportTitle}</h3>
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={barChartData} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748B' }} />
                    <YAxis tick={{ fontSize: 11, fill: '#64748B' }} />
                    <Tooltip />
                    <Bar dataKey="total" fill="#244034" radius={[4, 4, 0, 0]} name="Total / Conteo" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-3">
                <span className="text-xs font-bold text-slate-800">
                  {reportTitle} — {reportData.length} registro(s)
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-700">
                  <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold uppercase text-slate-500">
                    <tr>
                      {selectedColumns.map((colKey) => {
                        const colDef = (availableColumnsByModule[selectedModule] || []).find((c) => c.key === colKey);
                        return (
                          <th key={colKey} className="px-4 py-3 whitespace-nowrap">
                            {colDef?.label || colKey}
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {reportData.length === 0 ? (
                      <tr>
                        <td colSpan={selectedColumns.length} className="py-8 text-center text-slate-400">
                          No se encontraron registros con los filtros seleccionados.
                        </td>
                      </tr>
                    ) : (
                      reportData.map((row, idx) => (
                        <tr key={idx} className="hover:bg-slate-50">
                          {selectedColumns.map((colKey) => (
                            <td key={colKey} className="px-4 py-2.5 whitespace-nowrap">
                              {row[colKey] !== null && row[colKey] !== undefined ? String(row[colKey]) : '—'}
                            </td>
                          ))}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* VISTA 2: CONEXIÓN SAAS / LOOKER STUDIO & POWER BI */}
      {activeTab === 'LOOKER_STUDIO' && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Exportación y Feed en Vivo para SaaS de Análisis, Power BI y Google Looker Studio
              </h2>
              <p className="text-xs text-slate-500">
                Conecta tu sistema o descarga el feed estructurado JSON/CSV para visualizar todas las métricas en tu SaaS externo.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <a
                href="/api/reports/query?mode=FEED&format=json"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-700 px-3.5 py-2 text-xs font-bold text-white hover:bg-emerald-800"
              >
                <Download className="h-3.5 w-3.5" /> Abrir Feed JSON (API)
              </a>
              <a
                href="/api/reports/query?mode=FEED&format=csv"
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-bold text-slate-800 hover:bg-slate-100"
              >
                <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" /> Descargar KPIs CSV
              </a>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-2">
              <span className="font-bold text-xs uppercase text-military-800 block">1. Endpoint REST para SaaS</span>
              <p className="text-xs text-slate-600">
                Consume <code className="font-mono bg-white px-1 py-0.5 rounded">/api/reports/query?mode=FEED</code> desde cualquier plataforma BI o SaaS de análisis.
              </p>
            </div>

            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-2">
              <span className="font-bold text-xs uppercase text-blue-700 block">2. Excel / CSV / PDF Directo</span>
              <p className="text-xs text-slate-600">
                Usa los botones superiores para descargar cualquier tabla en formato <strong>.xlsx</strong>, <strong>.csv</strong> o <strong>.pdf</strong> listo para dirección.
              </p>
            </div>

            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-2">
              <span className="font-bold text-xs uppercase text-emerald-700 block">3. Base de Datos Unificada</span>
              <p className="text-xs text-slate-600">
                Incluye métricas en tiempo real de Bodega, Alquileres, Celulares sin plan, Reposiciones Claro, Licencias y Costos.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
