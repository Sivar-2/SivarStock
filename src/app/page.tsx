'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Boxes,
  CheckCircle2,
  AlertTriangle,
  Wrench,
  DollarSign,
  Globe,
  Clock,
  ArrowRight,
  TrendingUp,
  Package,
  Layers,
  ShieldCheck,
  RefreshCw,
  SlidersHorizontal,
  FileSpreadsheet,
  FileText,
  BarChart3,
  Server,
  Building2,
  Calendar,
  Check,
  Eye,
  ArrowUpRight,
  ArrowDownRight,
  Smartphone,
  Users
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';

export default function DashboardPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<'semanal' | 'mensual' | 'trimestral' | 'historico'>('mensual');
  const [showCustomizeModal, setShowCustomizeModal] = useState(false);

  // Widgets personalizables guardados en localStorage
  const [widgets, setWidgets] = useState({
    kpis: true,
    costsChart: true,
    assetStatus: true,
    movementsChart: true,
    bodegaCard: true,
    lowStockTable: true,
    expiringServices: true,
    movementsLog: true,
    maintenanceAlerts: true,
  });

  useEffect(() => {
    const saved = localStorage.getItem('sivarstock_dashboard_widgets');
    if (saved) {
      try {
        setWidgets(JSON.parse(saved));
      } catch (e) {
        console.error(e);
      }
    }
  }, []);

  const saveWidgets = (newWidgets: typeof widgets) => {
    setWidgets(newWidgets);
    localStorage.setItem('sivarstock_dashboard_widgets', JSON.stringify(newWidgets));
  };

  const toggleWidget = (key: keyof typeof widgets) => {
    const updated = { ...widgets, [key]: !widgets[key] };
    saveWidgets(updated);
  };

  const fetchStats = (p = period) => {
    setLoading(true);
    fetch(`/api/dashboard/stats?period=${p}`)
      .then((res) => res.json())
      .then((d) => setData(d))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchStats(period);
  }, [period]);

  const items = data?.stats?.items || {};
  const digital = data?.stats?.digital || {};
  const movementsStats = data?.stats?.movements || {};
  const bodega = data?.stats?.bodega || {};
  const employeesAndMobiles = data?.stats?.employeesAndMobiles || {};
  const lowStock = data?.lowStockList || [];
  const expiring = data?.expiringServices || [];
  const expiringMobileContracts = data?.expiringMobileContracts || [];
  const costsByDept = data?.costsByDept || [];
  const movements = data?.recentMovements || [];
  const maintenance = data?.maintenanceAlerts || [];

  // Formateador de moneda en Quetzales de Guatemala (Q)
  const formatGTQ = (amount: number) => {
    return new Intl.NumberFormat('es-GT', {
      style: 'currency',
      currency: 'GTQ',
      minimumFractionDigits: 2,
    }).format(amount || 0);
  };

  // Formateador de moneda en Dólares (USD)
  const formatUSD = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(amount || 0);
  };

  const statusPieData = [
    { name: 'En Bodega (Disponibles)', value: items.available_items || 0, color: '#10B981' },
    { name: 'En Empleados (Asignados)', value: items.assigned_items || 0, color: '#3B82F6' },
    { name: 'En Revisión/Rep.', value: items.in_revision_items || 0, color: '#F59E0B' },
    { name: 'Dados de Baja', value: items.decommissioned_items || 0, color: '#EF4444' },
  ].filter((d) => d.value > 0);

  return (
    <div className="space-y-6">
      {/* Encabezado y Filtros de Período */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">
              Panel de Control y Métricas
            </h1>
            <span className="rounded-full bg-military-100 px-2.5 py-0.5 text-[11px] font-bold text-military-800">
              Guatemala (GTQ / Q)
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Control total de inventario (Bodega + Empleados), líneas móviles, contratos de proveedores, licencias y finanzas.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Selector de Período: Semanal, Mensual, Trimestral */}
          <div className="flex rounded-lg border border-slate-200 bg-white p-0.5 shadow-sm">
            {[
              { id: 'semanal', label: 'Semanal (7d)' },
              { id: 'mensual', label: 'Mensual (30d)' },
              { id: 'trimestral', label: 'Trimestral (90d)' },
              { id: 'historico', label: 'Histórico' },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => setPeriod(t.id as any)}
                className={`rounded-md px-2.5 py-1 text-xs font-semibold transition ${
                  period === t.id
                    ? 'bg-military-800 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Botón Personalizar Gráficas */}
          <button
            onClick={() => setShowCustomizeModal(true)}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
            title="Personalizar qué gráficas y secciones ver"
          >
            <SlidersHorizontal className="h-3.5 w-3.5 text-slate-500" />
            <span className="hidden sm:inline">Personalizar</span>
          </button>

          {/* Botón Refrescar */}
          <button
            onClick={() => fetchStats(period)}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Actualizar</span>
          </button>

          {/* Enlace rápido a Reportes / Exportación */}
          <Link
            href="/reportes"
            className="flex items-center gap-1.5 rounded-lg bg-military-800 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-military-900"
          >
            <BarChart3 className="h-3.5 w-3.5" />
            <span>Ver Reportes</span>
          </Link>
        </div>
      </div>

      {/* 1. Tarjetas Clave Requeridas por el Usuario */}
      {widgets.kpis && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* KPI 1: Suministros en Stock Bajo */}
          <Link
            href="/productos"
            className={`group relative overflow-hidden rounded-xl border p-5 shadow-sm transition hover:shadow-md ${
              lowStock.length > 0
                ? 'border-amber-300 bg-amber-50/50 hover:border-amber-500'
                : 'border-slate-200 bg-white hover:border-military-600'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Suministros Stock Bajo
              </span>
              <div className={`rounded-lg p-2 ${lowStock.length > 0 ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>
                <AlertTriangle className="h-5 w-5" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className={`text-2xl sm:text-3xl font-extrabold ${lowStock.length > 0 ? 'text-amber-800' : 'text-slate-900'}`}>
                {lowStock.length}
              </span>
              <span className="text-xs text-slate-500">artículos críticos</span>
            </div>
            <div className="mt-3 text-xs">
              {lowStock.length > 0 ? (
                <span className="font-bold text-amber-700 flex items-center gap-1">
                  • Requiere reposición inmediata
                </span>
              ) : (
                <span className="text-emerald-600 font-medium flex items-center gap-1">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Niveles de stock óptimos
                </span>
              )}
            </div>
          </Link>

          {/* KPI 2: Servicios, Licencias y Contratos con Proveedores */}
          <Link
            href="/servicios-digitales"
            className="group relative overflow-hidden rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-military-600 hover:shadow-md"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Contratos & Licencias
              </span>
              <div className="rounded-lg bg-blue-50 p-2 text-blue-700">
                <Globe className="h-5 w-5" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-extrabold text-slate-900">
                {digital.active_services || 0}
              </span>
              <span className="text-xs text-slate-500">
                activas ({digital.supplier_contracts_count || 0} contratos prov.)
              </span>
            </div>
            <div className="mt-3 flex flex-col gap-0.5 text-xs text-slate-600">
              <div className="flex justify-between">
                <span>Gasto GTQ:</span>
                <span className="font-bold text-slate-900">{formatGTQ(digital.monthly_gtq_spend)}/mes</span>
              </div>
              {digital.monthly_usd_spend > 0 && (
                <div className="flex justify-between text-[11px] text-blue-600">
                  <span>En Dólares:</span>
                  <span className="font-bold">{formatUSD(digital.monthly_usd_spend)}/mes</span>
                </div>
              )}
            </div>
          </Link>

          {/* KPI 3: Valor de Adquisición + Inventario Total (Bodega + Empleados) */}
          <Link
            href="/inventario"
            className="group relative overflow-hidden rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-military-600 hover:shadow-md"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Inventario Total Activos
              </span>
              <div className="rounded-lg bg-emerald-50 p-2 text-emerald-700">
                <DollarSign className="h-5 w-5" />
              </div>
            </div>
            <div className="mt-2">
              <span className="text-xl sm:text-2xl font-black text-slate-900 block truncate">
                {formatGTQ(items.total_acquisition_cost_gtq)}
              </span>
              <span className="text-xs text-slate-500">
                {items.total_items || 0} activos ({items.available_items || 0} Bodega + {items.assigned_items || 0} Empleados)
              </span>
            </div>
            <div className="mt-3 text-[11px] text-slate-500 flex justify-between">
              <span>{employeesAndMobiles.active_employees || 0} empleados activos</span>
              <span className="text-emerald-700 font-semibold">Ver conciliación →</span>
            </div>
          </Link>

          {/* KPI 4: Líneas de Teléfono y Contratos Móviles */}
          <Link
            href="/celulares"
            className="group relative overflow-hidden rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-military-600 hover:shadow-md"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Líneas Móviles & Planes
              </span>
              <div className="rounded-lg bg-purple-50 p-2 text-purple-700">
                <Smartphone className="h-5 w-5" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-extrabold text-slate-900">
                {employeesAndMobiles.total_mobile_lines || 0}
              </span>
              <span className="text-xs text-slate-500">
                líneas ({employeesAndMobiles.assigned_mobile_lines || 0} asignadas)
              </span>
            </div>
            <div className="mt-3 flex items-center justify-between text-xs text-slate-600">
              <span>Canon mensual:</span>
              <span className="font-bold text-purple-700">
                {formatGTQ(employeesAndMobiles.monthly_mobile_spend_gtq)}/mes
              </span>
            </div>
          </Link>
        </div>
      )}

      {/* Tarjeta Especial Bodega Central (Cuarto de Servidores) */}
      {widgets.bodegaCard && (
        <div className="rounded-2xl border border-military-200 bg-gradient-to-r from-military-900 to-slate-900 p-5 text-white shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-white/10 p-3 text-emerald-400">
              <Server className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                  Área de Bodega Principal
                </span>
                <span className="rounded bg-white/20 px-2 py-0.5 text-[10px] font-semibold text-white">
                  Cuarto de Servidores
                </span>
              </div>
              <h2 className="text-lg font-bold text-white mt-1">
                Inventario Físico en Custodia + Equipos en Empleados
              </h2>
              <p className="text-xs text-slate-300">
                Todo equipo asignado a un empleado se suma automáticamente al inventario total de la empresa.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-5 border-t border-white/10 pt-3 md:border-t-0 md:pt-0">
            <div>
              <span className="text-[11px] text-slate-400 block uppercase">En Bodega</span>
              <span className="text-xl font-black text-white">{bodega.bodega_available_items || 0} un.</span>
            </div>
            <div className="h-8 w-px bg-white/10" />
            <div>
              <span className="text-[11px] text-slate-400 block uppercase">En Empleados</span>
              <span className="text-xl font-black text-blue-300">{items.assigned_items || 0} un.</span>
            </div>
            <div className="h-8 w-px bg-white/10" />
            <div>
              <span className="text-[11px] text-slate-400 block uppercase">Valor en Bodega</span>
              <span className="text-xl font-black text-emerald-400">{formatGTQ(bodega.bodega_items_value)}</span>
            </div>
            <div className="h-8 w-px bg-white/10" />
            <Link
              href="/inventario"
              className="rounded-lg bg-emerald-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-emerald-500 transition shadow-sm"
            >
              Inventario y Recuento
            </Link>
          </div>
        </div>
      )}

      {/* 2. Sección Gráficos y Distribución */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Gráfico de Costos por Departamento Imputado */}
        {widgets.costsChart && (
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-2">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-sm font-bold text-slate-900">Costos Imputados por Departamento (GTQ)</h2>
                <p className="text-xs text-slate-500">Distribución de compras y gastos según área de manufactura</p>
              </div>
              <Link
                href="/costos"
                className="text-xs font-semibold text-military-700 hover:text-military-900 flex items-center gap-1"
              >
                <span>Ver detalle</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            <div className="mt-4 h-64 w-full">
              {costsByDept.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={costsByDept} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                    <XAxis dataKey="dept_code" tick={{ fontSize: 11, fill: '#64748B' }} />
                    <YAxis tick={{ fontSize: 11, fill: '#64748B' }} tickFormatter={(val) => `Q${val}`} />
                    <Tooltip
                      formatter={(val: any) => [formatGTQ(val), 'Costo Imputado']}
                      labelFormatter={(label) => `Departamento: ${label}`}
                    />
                    <Bar dataKey="total_charged" fill="#244034" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center text-xs text-slate-400">
                  Sin registros de costos suficientes
                </div>
              )}
            </div>
          </div>
        )}

        {/* Distribución de Estado de Activos (Donut Chart) */}
        {widgets.assetStatus && (
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm flex flex-col justify-between">
            <div className="border-b border-slate-100 pb-3">
              <h2 className="text-sm font-bold text-slate-900">Estado Operativo de Activos</h2>
              <p className="text-xs text-slate-500">Bodega vs Asignados a Empleados</p>
            </div>

            <div className="my-2 h-48 w-full flex items-center justify-center">
              {statusPieData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={statusPieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={75}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {statusPieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(val: any) => [val, 'Unidades']} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <span className="text-xs text-slate-400">Sin activos registrados</span>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              {statusPieData.map((st) => (
                <div key={st.name} className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: st.color }} />
                  <span className="text-slate-600 truncate">{st.name}:</span>
                  <span className="font-bold text-slate-900">{st.value}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 3. Sección Operativa: Tabla de Alertas de Stock Bajo y Averías */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Alertas de Stock Mínimo en Suministros */}
        {widgets.lowStockTable && (
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                <h2 className="text-sm font-bold text-slate-900">Suministros Bajo Stock Mínimo</h2>
              </div>
              <Link
                href="/productos"
                className="text-xs font-semibold text-military-700 hover:text-military-900"
              >
                Ir a Catálogo
              </Link>
            </div>

            <div className="mt-3 divide-y divide-slate-100">
              {lowStock.length > 0 ? (
                lowStock.slice(0, 5).map((prod: any) => (
                  <div key={prod.product_id} className="flex items-center justify-between py-2.5 text-xs">
                    <div>
                      <span className="font-bold text-slate-800">{prod.name}</span>
                      <span className="block text-[11px] text-slate-500">
                        Código: {prod.code} • Proveedor: {prod.default_supplier || 'N/A'}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="inline-block rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-bold text-red-700">
                        Stock: {prod.current_quantity} / Mín: {prod.min_stock}
                      </span>
                      <span className="block text-[10px] text-slate-400 mt-0.5">
                        Faltante: {Math.max(0, prod.min_stock - prod.current_quantity)} {prod.unit_of_measure}
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-6 text-center text-xs text-slate-400">
                  Excelente: No hay suministros por debajo del stock mínimo.
                </div>
              )}
            </div>
          </div>
        )}

        {/* Equipos en Avería y Mantenimiento */}
        {widgets.maintenanceAlerts && (
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Wrench className="h-4 w-4 text-brandRed-600" />
                <h2 className="text-sm font-bold text-slate-900">Averías y Mantenimientos Activos</h2>
              </div>
              <Link
                href="/mantenimiento"
                className="text-xs font-semibold text-military-700 hover:text-military-900"
              >
                Gestionar Averías
              </Link>
            </div>

            <div className="mt-3 divide-y divide-slate-100">
              {maintenance.length > 0 ? (
                maintenance.slice(0, 5).map((rec: any) => (
                  <div key={rec.id} className="flex items-center justify-between py-2.5 text-xs">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-slate-800">{rec.product_name}</span>
                        <span className="rounded bg-slate-100 px-1.5 py-0.2 text-[10px] font-mono text-slate-600">
                          {rec.permanent_code}
                        </span>
                      </div>
                      <span className="block text-[11px] text-slate-500 mt-0.5">
                        {rec.fault_description}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="inline-block rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                        {rec.status}
                      </span>
                      <span className="block text-[10px] text-slate-400 mt-0.5">
                        Reportado: {rec.reported_date}
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-6 text-center text-xs text-slate-400">
                  No hay computadoras o impresoras reportadas con averías activas.
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 4. Próximos Vencimientos (Contratos Proveedores, Licencias y Líneas Móviles) y Movimientos */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Alertas de Vencimiento de Licencias, Contratos de Proveedores y Líneas Móviles */}
        {widgets.expiringServices && (
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-brandRed-600" />
                <h2 className="text-sm font-bold text-slate-900">
                  Vencimientos Próximos: Contratos Proveedores, Licencias y Líneas
                </h2>
              </div>
              <Link
                href="/servicios-digitales"
                className="text-xs font-semibold text-military-700 hover:text-military-900"
              >
                Ver contratos
              </Link>
            </div>

            <div className="mt-3 divide-y divide-slate-100">
              {expiring.length === 0 && expiringMobileContracts.length === 0 ? (
                <div className="py-6 text-center text-xs text-slate-400">
                  No hay contratos con proveedores, licencias ni planes móviles próximos a vencer.
                </div>
              ) : (
                <>
                  {expiring.map((srv: any) => (
                    <div key={srv.id} className="flex items-center justify-between py-2.5 text-xs">
                      <div>
                        <span className="font-bold text-slate-800">{srv.name}</span>
                        <span className="block text-[11px] text-slate-500">
                          Proveedor: {srv.provider} • {srv.cost_period} (
                          {srv.currency === 'USD' ? formatUSD(srv.amount) : formatGTQ(srv.amount)})
                        </span>
                      </div>
                      <div className="text-right">
                        <span
                          className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-bold ${
                            srv.days_remaining <= 7
                              ? 'bg-red-100 text-brandRed-700 animate-pulse'
                              : srv.days_remaining <= 15
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-blue-100 text-blue-700'
                          }`}
                        >
                          {srv.days_remaining} días restantes
                        </span>
                        <span className="block text-[10px] text-slate-400 mt-0.5">
                          Vence: {srv.expiration_date}
                        </span>
                      </div>
                    </div>
                  ))}
                  {expiringMobileContracts.map((mob: any) => (
                    <div key={mob.id} className="flex items-center justify-between py-2.5 text-xs">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <Smartphone className="h-3.5 w-3.5 text-purple-600" />
                          <span className="font-bold text-slate-800">
                            Línea {mob.phone_number} ({mob.carrier || 'Operadora'})
                          </span>
                        </div>
                        <span className="block text-[11px] text-slate-500">
                          {mob.employee_name || 'Sin asignar'} • {mob.brand} {mob.model}
                        </span>
                      </div>
                      <div className="text-right">
                        <span
                          className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-bold ${
                            mob.days_remaining < 0
                              ? 'bg-rose-100 text-rose-700'
                              : mob.days_remaining <= 15
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-purple-100 text-purple-800'
                          }`}
                        >
                          {mob.days_remaining < 0
                            ? `Vencido hace ${Math.abs(mob.days_remaining)}d`
                            : `${mob.days_remaining} días restantes`}
                        </span>
                        <span className="block text-[10px] text-slate-400 mt-0.5">
                          Fin contrato: {mob.contract_end_date}
                        </span>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>
        )}

        {/* Movimientos Recientes de Kardex */}
        {widgets.movementsLog && (
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <RefreshCw className="h-4 w-4 text-military-700" />
                <h2 className="text-sm font-bold text-slate-900">Bitácora de Movimientos Recientes</h2>
              </div>
              <Link
                href="/movimientos"
                className="text-xs font-semibold text-military-700 hover:text-military-900"
              >
                Ver historial
              </Link>
            </div>

            <div className="mt-3 divide-y divide-slate-100">
              {movements.length > 0 ? (
                movements.slice(0, 6).map((mov: any) => (
                  <div key={mov.id} className="flex items-center justify-between py-2.5 text-xs">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="inline-block rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-700">
                          {mov.movement_type}
                        </span>
                        <span className="font-semibold text-slate-800">{mov.product_name}</span>
                      </div>
                      <span className="block text-[11px] text-slate-500 mt-0.5">
                        {mov.reason}
                      </span>
                    </div>
                    <div className="text-right text-[11px] text-slate-500">
                      <span className="font-bold text-slate-700">{mov.quantity} un.</span>
                      <span className="block text-[10px] text-slate-400">
                        {new Date(mov.created_at).toLocaleDateString('es-GT')}
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-6 text-center text-xs text-slate-400">
                  Sin movimientos recientes registrados.
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Modal de Personalización de Gráficas y Secciones */}
      {showCustomizeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">Personalizar Dashboard</h3>
                <p className="text-xs text-slate-500">Elige qué tarjetas y gráficos deseas visualizar</p>
              </div>
              <button
                onClick={() => setShowCustomizeModal(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 space-y-2.5 max-h-96 overflow-y-auto pr-1">
              {[
                { key: 'kpis', label: 'Tarjetas Resumen (Stock bajo, Contratos, Inventario Total, Líneas)' },
                { key: 'bodegaCard', label: 'Resumen Cuarto de Servidores (Bodega + Empleados)' },
                { key: 'costsChart', label: 'Gráfico: Costos Imputados por Departamento (GTQ)' },
                { key: 'assetStatus', label: 'Gráfico: Estado Operativo de Activos' },
                { key: 'lowStockTable', label: 'Tabla: Suministros Bajo Stock Mínimo' },
                { key: 'maintenanceAlerts', label: 'Tabla: Averías y Mantenimientos Activos' },
                { key: 'expiringServices', label: 'Tabla: Vencimientos de Contratos, Licencias y Líneas' },
                { key: 'movementsLog', label: 'Bitácora: Movimientos Recientes de Kardex' },
              ].map((item) => (
                <label
                  key={item.key}
                  className="flex items-center justify-between p-2.5 rounded-lg border border-slate-100 hover:bg-slate-50 cursor-pointer"
                >
                  <span className="text-xs font-medium text-slate-700">{item.label}</span>
                  <input
                    type="checkbox"
                    checked={(widgets as any)[item.key]}
                    onChange={() => toggleWidget(item.key as any)}
                    className="h-4 w-4 rounded border-slate-300 text-military-800 focus:ring-military-700"
                  />
                </label>
              ))}
            </div>

            <div className="mt-5 flex justify-end gap-2 border-t border-slate-100 pt-3">
              <button
                onClick={() => {
                  saveWidgets({
                    kpis: true,
                    costsChart: true,
                    assetStatus: true,
                    movementsChart: true,
                    bodegaCard: true,
                    lowStockTable: true,
                    expiringServices: true,
                    movementsLog: true,
                    maintenanceAlerts: true,
                  });
                }}
                className="rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100"
              >
                Restablecer Todo
              </button>
              <button
                onClick={() => setShowCustomizeModal(false)}
                className="rounded-lg bg-military-800 px-4 py-1.5 text-xs font-bold text-white hover:bg-military-900"
              >
                Listo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
