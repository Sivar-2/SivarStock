'use client';

import React, { useState, useEffect } from 'react';
import {
  FileBarChart2,
  Play,
  Save,
  Download,
  Filter,
  Layers,
  Columns,
  Table as TableIcon,
  BarChart2,
  FileSpreadsheet,
  FileText,
  Calendar,
  Building,
  RefreshCw,
  Bookmark,
  Trash2,
  Check,
  ExternalLink,
  Database,
  Copy,
  CheckCircle2,
  HelpCircle,
  TrendingUp,
  Cpu,
  Package,
  Clock,
  Smartphone,
  Wrench,
  Server,
  DollarSign
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts';

export default function ReportesPage() {
  const [activeTab, setActiveTab] = useState<'BUILDER' | 'LOOKER_STUDIO'>('BUILDER');
  const [savedReports, setSavedReports] = useState<any[]>([]);
  const [catalogs, setCatalogs] = useState<any>({ departments: [], categories: [], users: [] });

  // Parámetros del constructor de reporte
  const [selectedModule, setSelectedModule] = useState<'INVENTARIO' | 'COSTOS' | 'MOVIMIENTOS' | 'SERVICIOS' | 'ASIGNACIONES' | 'CELULARES' | 'MANTENIMIENTO' | 'BODEGA'>('INVENTARIO');
  const [reportTitle, setReportTitle] = useState('Reporte Personalizado de Inventario');
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

  // Columnas disponibles por módulo (en Quetzales de Guatemala Q GTQ)
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
      { key: 'ip_address', label: 'Dirección IP' },
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
    CELULARES: [
      { key: 'device_code', label: 'Código' },
      { key: 'brand', label: 'Marca' },
      { key: 'model', label: 'Modelo' },
      { key: 'phone_number', label: 'N° Teléfono' },
      { key: 'carrier', label: 'Operadora' },
      { key: 'plan_name', label: 'Plan Contratado' },
      { key: 'monthly_cost', label: 'Cuota Mensual (Q)' },
      { key: 'contract_number', label: 'N° Contrato' },
      { key: 'contract_end_date', label: 'Vencimiento Contrato' },
      { key: 'imei', label: 'IMEI' },
      { key: 'serial_number', label: 'N° Serie' },
      { key: 'employee_name', label: 'Empleado Asignado' },
      { key: 'department_name', label: 'Departamento' },
      { key: 'delivered_date', label: 'Fecha Entrega' },
      { key: 'status', label: 'Estado' },
    ],
    MANTENIMIENTO: [
      { key: 'permanent_code', label: 'Código Activo' },
      { key: 'product_name', label: 'Equipo' },
      { key: 'reported_date', label: 'Fecha Reporte' },
      { key: 'fault_description', label: 'Falla Reportada' },
      { key: 'severity', label: 'Severidad' },
      { key: 'status', label: 'Estado' },
      { key: 'solution_type', label: 'Tipo Solución' },
      { key: 'replacement_code', label: 'Sustituido Por' },
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
      { key: 'from_dept_name', label: 'Origen' },
      { key: 'to_dept_name', label: 'Destino' },
      { key: 'reason', label: 'Motivo / Detalle' },
      { key: 'executed_by_name', label: 'Ejecutado Por' },
    ],
    SERVICIOS: [
      { key: 'name', label: 'Servicio / Contrato' },
      { key: 'contract_type', label: 'Tipo Contrato' },
      { key: 'contract_number', label: 'N° Contrato' },
      { key: 'category', label: 'Categoría' },
      { key: 'provider', label: 'Proveedor' },
      { key: 'contact_name', label: 'Contacto Proveedor' },
      { key: 'contact_phone', label: 'Teléfono Proveedor' },
      { key: 'cost_period', label: 'Periodicidad' },
      { key: 'amount', label: 'Importe' },
      { key: 'currency', label: 'Moneda' },
      { key: 'expiration_date', label: 'Vencimiento' },
      { key: 'seats_used', label: 'Usuarios / Asientos' },
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
    const defaultCols = (availableColumnsByModule[selectedModule] || []).slice(0, 8).map((c) => c.key);
    setSelectedColumns(defaultCols);
  }, [selectedModule]);

  useEffect(() => {
    fetchCatalogs();
    fetchSavedReports();
    handleRunReport();
  }, []);

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

  // Selector de Períodos Preconfigurados (Semanal, Mensual, Trimestral)
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

  const handleRunReport = async () => {
    setExecuting(true);
    try {
      const filters: any = {};
      if (filterDept) filters.departmentId = filterDept;
      if (filterStatus) filters.status = filterStatus;

      const res = await fetch('/api/reports/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          module: selectedModule,
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
              Reportes y Análisis Económico
            </h1>
            <span className="rounded-full bg-military-800 px-2.5 py-0.5 text-[11px] font-bold text-white">
              Guatemala (GTQ / Q)
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Filtros semanales, mensuales y trimestrales con exportación a Excel, PDF, Google Looker Studio y Power BI.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {activeTab === 'BUILDER' && (
            <>
              <button
                onClick={handleSaveReportConfig}
                disabled={saving}
                className="flex items-center gap-1.5 rounded-lg border border-military-200 bg-military-50 px-3 py-1.5 text-xs font-bold text-military-800 shadow-sm hover:bg-military-100"
              >
                {saveSuccess ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Save className="h-3.5 w-3.5" />}
                <span>{saveSuccess ? 'Guardado' : 'Guardar Plantilla'}</span>
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
                <span>PDF</span>
              </button>
              <button
                onClick={() => handleExport('csv')}
                className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
              >
                <span>CSV</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Pestañas de Vista */}
      <div className="flex border-b border-slate-200 bg-white px-2 pt-2 rounded-t-xl">
        <button
          onClick={() => setActiveTab('BUILDER')}
          className={`flex items-center gap-2 border-b-2 px-4 py-3 text-xs font-bold transition ${
            activeTab === 'BUILDER'
              ? 'border-military-800 text-military-900 bg-military-50/50'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <FileBarChart2 className="h-4 w-4" />
          <span>Constructor Analítico y Presets</span>
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
          <span>Conexión Google Looker Studio & Power BI</span>
          <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-extrabold text-blue-700">
            PostgreSQL / Supabase
          </span>
        </button>
      </div>

      {/* VISTA 1: CONSTRUCTOR VISUAL Y PRESETS */}
      {activeTab === 'BUILDER' && (
        <div className="space-y-6">
          {/* Presets Rápidos de Análisis Económico */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
            <div>
              <span className="text-xs font-bold uppercase text-slate-500 block mb-2">
                Plantillas Rápidas para el Economista y Gerencia:
              </span>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => {
                    setSelectedModule('BODEGA');
                    setReportTitle('Reporte de Existencias en Bodega Central (Cuarto de Servidores)');
                    setGroupBy('');
                    applyDatePreset('historico');
                  }}
                  className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-military-50 hover:border-military-600"
                >
                  <Server className="h-3.5 w-3.5 text-military-800" />
                  <span>Bodega Central (Cuarto Servidores)</span>
                </button>

                <button
                  onClick={() => {
                    setSelectedModule('COSTOS');
                    setReportTitle('Inversión y Compras por Departamento (GTQ)');
                    setGroupBy('charged_dept_name');
                    applyDatePreset('mensual');
                  }}
                  className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-military-50 hover:border-military-600"
                >
                  <DollarSign className="h-3.5 w-3.5 text-emerald-600" />
                  <span>Costos y Compras Mensuales (Q)</span>
                </button>

                <button
                  onClick={() => {
                    setSelectedModule('MOVIMIENTOS');
                    setReportTitle('Rotación de Inventario y Movimientos de Suministros');
                    setGroupBy('movement_type');
                    applyDatePreset('trimestral');
                  }}
                  className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-military-50 hover:border-military-600"
                >
                  <TrendingUp className="h-3.5 w-3.5 text-blue-600" />
                  <span>Flujo de Movimientos Trimestral</span>
                </button>

                <button
                  onClick={() => {
                    setSelectedModule('CELULARES');
                    setReportTitle('Parque de Celulares, Líneas y Vencimiento de Contratos');
                    setGroupBy('department_name');
                    applyDatePreset('historico');
                  }}
                  className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-military-50 hover:border-military-600"
                >
                  <Smartphone className="h-3.5 w-3.5 text-purple-600" />
                  <span>Líneas Móviles y Contratos</span>
                </button>

                <button
                  onClick={() => {
                    setSelectedModule('SERVICIOS');
                    setReportTitle('Contratos con Proveedores, Licencias y Vencimientos');
                    setGroupBy('contract_type');
                    applyDatePreset('historico');
                  }}
                  className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-military-50 hover:border-military-600"
                >
                  <Clock className="h-3.5 w-3.5 text-rose-600" />
                  <span>Contratos con Proveedores</span>
                </button>

                <button
                  onClick={() => {
                    setSelectedModule('MANTENIMIENTO');
                    setReportTitle('Averías y Reparaciones de Computadoras e Impresoras');
                    setGroupBy('status');
                    applyDatePreset('mensual');
                  }}
                  className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-military-50 hover:border-military-600"
                >
                  <Wrench className="h-3.5 w-3.5 text-amber-600" />
                  <span>Historial de Averías y Sustituciones</span>
                </button>
              </div>
            </div>

            {savedReports.length > 0 && (
              <div className="pt-2 border-t border-slate-100">
                <span className="text-[11px] font-bold uppercase text-slate-400 block mb-1.5">
                  Tus Reportes Personalizados Guardados:
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
                  <option value="INVENTARIO">Inventario Físico de Activos (Serie, MAC, IMEI)</option>
                  <option value="BODEGA">Bodega Central (Cuarto de Servidores)</option>
                  <option value="CELULARES">Celulares, Líneas y Contratos Móviles</option>
                  <option value="SERVICIOS">Contratos con Proveedores y Licencias</option>
                  <option value="ASIGNACIONES">Asignaciones a Personal</option>
                  <option value="MANTENIMIENTO">Averías y Mantenimiento</option>
                  <option value="COSTOS">Costos y Facturas</option>
                  <option value="MOVIMIENTOS">Kardex y Movimientos</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Filtrar por Área / Depto</label>
                <select
                  value={filterDept}
                  onChange={(e) => setFilterDept(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 py-1.5 px-2 text-xs text-slate-900 focus:border-military-600 focus:outline-none"
                >
                  <option value="">Todas las áreas (11 departamentos)</option>
                  {catalogs.departments?.map((d: any) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
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

            {/* Presets de Fecha */}
            <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-700">Rango de Tiempo:</span>
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => applyDatePreset('semanal')}
                    className="px-2.5 py-1 rounded bg-white border border-slate-200 text-[11px] font-semibold text-slate-700 hover:bg-slate-100"
                  >
                    Semanal (7d)
                  </button>
                  <button
                    type="button"
                    onClick={() => applyDatePreset('mensual')}
                    className="px-2.5 py-1 rounded bg-white border border-slate-200 text-[11px] font-semibold text-slate-700 hover:bg-slate-100"
                  >
                    Mensual (30d)
                  </button>
                  <button
                    type="button"
                    onClick={() => applyDatePreset('trimestral')}
                    className="px-2.5 py-1 rounded bg-white border border-slate-200 text-[11px] font-semibold text-slate-700 hover:bg-slate-100"
                  >
                    Trimestral (90d)
                  </button>
                  <button
                    type="button"
                    onClick={() => applyDatePreset('historico')}
                    className="px-2.5 py-1 rounded bg-white border border-slate-200 text-[11px] font-semibold text-slate-700 hover:bg-slate-100"
                  >
                    Histórico
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2 text-xs">
                <span>Desde:</span>
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="rounded border border-slate-200 bg-white px-2 py-1 text-xs"
                />
                <span>Hasta:</span>
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="rounded border border-slate-200 bg-white px-2 py-1 text-xs"
                />
              </div>
            </div>

            {/* Selector de Columnas */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <Columns className="h-3.5 w-3.5 text-military-700" />
                  <span>Columnas a Incluir:</span>
                </span>
                <span className="text-[11px] text-slate-400">
                  {selectedColumns.length} de {(availableColumnsByModule[selectedModule] || []).length}
                </span>
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

            {/* Botón de Ejecutar */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setVisualization('TABLE')}
                  className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold border ${
                    visualization === 'TABLE' ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200'
                  }`}
                >
                  <TableIcon className="h-3.5 w-3.5" />
                  <span>Tabla de Filas</span>
                </button>
                <button
                  type="button"
                  onClick={() => setVisualization('BAR_CHART')}
                  className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold border ${
                    visualization === 'BAR_CHART' ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200'
                  }`}
                >
                  <BarChart2 className="h-3.5 w-3.5" />
                  <span>Gráfico Analítico</span>
                </button>
              </div>

              <button
                type="button"
                onClick={handleRunReport}
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
              <h3 className="text-sm font-bold text-slate-900 mb-4">Gráfico Analítico Agrupado</h3>
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
                <span className="text-xs font-bold text-slate-700">
                  Resultados: {reportData.length} registro(s) encontrados
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

      {/* VISTA 2: CONEXIÓN LOOKER STUDIO & POWER BI */}
      {activeTab === 'LOOKER_STUDIO' && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Conexión Nativa: PostgreSQL Supabase a Google Looker Studio y Power BI
              </h2>
              <p className="text-xs text-slate-500">
                La estructura relacional de SivarStock está optimizada para conectarse de forma directa con Google Looker Studio sin intermediarios.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-2">
              <span className="font-bold text-xs uppercase text-military-800 block">1. Conector Oficial</span>
              <p className="text-xs text-slate-600">
                En Looker Studio (Data Studio), añade una fuente de datos seleccionando el conector oficial de <strong>PostgreSQL</strong>.
              </p>
            </div>

            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-2">
              <span className="font-bold text-xs uppercase text-blue-700 block">2. Credenciales Supabase</span>
              <p className="text-xs text-slate-600">
                Ingresa el Host, Puerto (5432), Base de datos (postgres), Usuario y Contraseña proporcionados en tu panel de Supabase.
              </p>
            </div>

            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-2">
              <span className="font-bold text-xs uppercase text-emerald-700 block">3. Inventario, Empleados y Contratos</span>
              <p className="text-xs text-slate-600">
                Consulta todas las tablas (`inventory_items`, `employees`, `mobile_devices`, `digital_services`) sincronizadas desde tu servidor local.
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-900 p-4 text-slate-100 font-mono text-xs">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-3">
              <span className="text-emerald-400 font-bold">Consulta SQL Sugerida para Looker Studio:</span>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(`SELECT 
  i.permanent_code,
  p.name AS producto,
  c.name AS categoria,
  i.serial_number,
  i.mac_address,
  i.imei,
  d.name AS departamento,
  e.full_name AS custodio,
  i.operational_status AS estado,
  i.purchase_price AS precio_quetzales,
  i.purchase_date AS fecha_compra
FROM inventory_items i
JOIN products p ON i.product_id = p.id
LEFT JOIN categories c ON p.category_id = c.id
LEFT JOIN departments d ON i.current_department_id = d.id
LEFT JOIN employees e ON i.current_employee_id = e.id;`);
                  alert('Consulta SQL copiada al portapapeles');
                }}
                className="text-[11px] text-slate-400 hover:text-white"
              >
                Copiar SQL
              </button>
            </div>
            <pre className="text-slate-300 overflow-x-auto">
{`SELECT 
  i.permanent_code,
  p.name AS producto,
  c.name AS categoria,
  i.serial_number,
  i.mac_address,
  i.imei,
  d.name AS departamento,
  e.full_name AS custodio,
  i.operational_status AS estado,
  i.purchase_price AS precio_quetzales,
  i.purchase_date AS fecha_compra
FROM inventory_items i
JOIN products p ON i.product_id = p.id
LEFT JOIN categories c ON p.category_id = c.id
LEFT JOIN departments d ON i.current_department_id = d.id
LEFT JOIN employees e ON i.current_employee_id = e.id;`}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
