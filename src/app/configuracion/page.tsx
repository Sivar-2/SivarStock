'use client';

import React, { useState, useEffect } from 'react';
import {
  Settings,
  Database,
  Download,
  Moon,
  Sun,
  QrCode,
  Printer,
  Search,
  CheckCircle,
  AlertCircle,
  ArrowRightLeft,
  Smartphone,
  Layers,
  LayoutGrid,
  Sparkles,
  RefreshCw,
  Eye,
  Sliders,
  AlertTriangle,
  Trash2
} from 'lucide-react';
import Link from 'next/link';

export default function ConfiguracionPage() {
  const [activeTab, setActiveTab] = useState<'apariencia' | 'respaldos' | 'qr_generator' | 'scanner_validator' | 'menu_nombres' | 'dock_shortcuts'>('apariencia');

  // Purga de Base de Datos
  const [showPurgeModal, setShowPurgeModal] = useState(false);
  const [purgeConfirmText, setPurgeConfirmText] = useState('');
  const [purging, setPurging] = useState(false);
  const [purgeResult, setPurgeResult] = useState<{ success: boolean; message: string } | null>(null);

  // Modo Nocturno
  const [isDarkMode, setIsDarkMode] = useState(false);

  // Departamentos y Empleados para QR Batch
  const [departments, setDepartments] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [selectedDept, setSelectedDept] = useState('');
  const [selectedEmp, setSelectedEmp] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [qrItems, setQrItems] = useState<any[]>([]);
  const [loadingQr, setLoadingQr] = useState(false);

  // Escáner / Validador de Códigos
  const [searchCode, setSearchCode] = useState('');
  const [scannedAsset, setScannedAsset] = useState<any | null>(null);
  const [loadingScan, setLoadingScan] = useState(false);
  const [scanMessage, setScanMessage] = useState<string | null>(null);

  // Sustitución de producto
  const [showReplaceModal, setShowReplaceModal] = useState(false);
  const [availableReplacements, setAvailableReplacements] = useState<any[]>([]);
  const [selectedReplacementId, setSelectedReplacementId] = useState('');
  const [replaceReason, setReplaceReason] = useState('');

  // Personalización de Nombres de Pestañas
  const defaultTabNames: Record<string, string> = {
    DASHBOARD: 'Inicio / Dashboard',
    INVENTARIO: 'Inventario físico',
    CELULARES: 'Celulares y líneas',
    PRODUCTOS: 'Categorías y productos',
    MOVIMIENTOS: 'Entradas y movimientos',
    ASIGNACIONES: 'Asignaciones a personal',
    MANTENIMIENTO: 'Averías y mantenimiento',
    SERVICIOS: 'Licencias y servicios',
    COSTOS: 'Costos y facturas',
    REPORTES: 'Reportes y métricas',
    DEPARTAMENTOS: 'Áreas y departamentos',
    USUARIOS: 'Usuarios y permisos',
    AUDITORIA: 'Historial de auditoría',
    CONFIGURACION: 'Configuración',
  };

  const [tabNames, setTabNames] = useState<Record<string, string>>(defaultTabNames);

  // Atajos de la Burbuja Flotante iPhone
  const [dockShortcuts, setDockShortcuts] = useState({
    left1: { name: 'Inicio', href: '/' },
    left2: { name: 'Inventario', href: '/inventario' },
    right1: { name: 'Costos', href: '/costos' },
    right2: { name: 'Reportes', href: '/reportes' },
  });

  useEffect(() => {
    // Cargar Tema
    const savedTheme = localStorage.getItem('sivarstock_theme');
    if (savedTheme === 'dark') {
      setIsDarkMode(true);
      document.documentElement.classList.add('dark');
    }

    // Cargar Nombres de Pestañas
    const savedTabs = localStorage.getItem('sivarstock_tab_names');
    if (savedTabs) {
      try {
        setTabNames(JSON.parse(savedTabs));
      } catch (e) {
        console.error(e);
      }
    }

    // Cargar Atajos del Dock
    const savedDock = localStorage.getItem('sivarstock_dock_shortcuts');
    if (savedDock) {
      try {
        setDockShortcuts(JSON.parse(savedDock));
      } catch (e) {
        console.error(e);
      }
    }

    // Cargar Catálogos
    fetch('/api/catalogs')
      .then((r) => r.json())
      .then((d) => {
        if (d.departments) setDepartments(d.departments);
        if (d.employees) setEmployees(d.employees);
      })
      .catch(console.error);
  }, []);

  // Alternar Modo Nocturno
  const toggleDarkMode = () => {
    const nextState = !isDarkMode;
    setIsDarkMode(nextState);
    if (nextState) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('sivarstock_theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('sivarstock_theme', 'light');
    }
  };

  // Guardar Nombres de Pestañas Personalizados
  const handleSaveTabNames = () => {
    localStorage.setItem('sivarstock_tab_names', JSON.stringify(tabNames));
    alert('Nombres de pestañas actualizados correctamente en el menú.');
  };

  // Guardar Atajos del Dock
  const handleSaveDockShortcuts = () => {
    localStorage.setItem('sivarstock_dock_shortcuts', JSON.stringify(dockShortcuts));
    alert('Atajos de la barra flotante guardados correctamente.');
  };

  // Generar Lote de QR
  const handleFetchBatchQr = () => {
    setLoadingQr(true);
    const params = new URLSearchParams();
    if (selectedDept) params.append('department_id', selectedDept);
    if (selectedEmp) params.append('employee_id', selectedEmp);
    if (selectedCategory) params.append('device_type', selectedCategory);

    fetch(`/api/qr/batch?${params.toString()}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.items) setQrItems(d.items);
      })
      .catch(console.error)
      .finally(() => setLoadingQr(false));
  };

  // Escanear / Validar Código
  const handleScanLookup = async (codeToSearch?: string) => {
    const code = (codeToSearch || searchCode).trim();
    if (!code) return;
    setLoadingScan(true);
    setScanMessage(null);
    setScannedAsset(null);

    try {
      const res = await fetch(`/api/inventory?search=${encodeURIComponent(code)}`);
      const data = await res.json();
      if (data.items && data.items.length > 0) {
        // Encontrado
        const item = data.items.find((i: any) => i.permanent_code?.toUpperCase() === code.toUpperCase()) || data.items[0];
        setScannedAsset(item);
      } else {
        setScanMessage(`El código ${code} no fue encontrado en la base de datos.`);
      }
    } catch (err: any) {
      setScanMessage(`Error al buscar activo: ${err.message}`);
    } finally {
      setLoadingScan(false);
    }
  };

  // Abrir Modal de Sustitución
  const openReplaceModal = () => {
    if (!scannedAsset) return;
    fetch('/api/inventory?status=DISPONIBLE')
      .then((r) => r.json())
      .then((d) => {
        if (d.items) {
          // Filtrar equipos de la misma categoría o compatibles
          setAvailableReplacements(d.items.filter((i: any) => i.id !== scannedAsset.id));
        }
        setShowReplaceModal(true);
      })
      .catch(console.error);
  };

  // Ejecutar Cambio / Sustitución de Producto en SQL
  const handleExecuteReplacement = async () => {
    if (!selectedReplacementId || !replaceReason.trim()) {
      alert('Debes seleccionar el producto sustituto de bodega y escribir el motivo.');
      return;
    }

    try {
      // 1. Dar de baja o marcar averiado el producto original
      // 2. Asignar el nuevo producto al empleado del producto anterior
      const res = await fetch('/api/maintenance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          item_id: scannedAsset.id,
          reported_date: new Date().toISOString().slice(0, 10),
          fault_description: `Sustitución de equipo solicitada: ${replaceReason}`,
          severity: 'MEDIA',
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      // Asignar el nuevo equipo al empleado
      if (scannedAsset.assigned_employee_id) {
        await fetch('/api/inventory', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: selectedReplacementId,
            action: 'ASSIGN',
            employee_id: scannedAsset.assigned_employee_id,
            reason: `Reemplazo de equipo ${scannedAsset.permanent_code}: ${replaceReason}`,
          }),
        });
      }

      alert('¡Sustitución completada! El nuevo equipo ha sido asignado y registrado en el historial.');
      setShowReplaceModal(false);
      handleScanLookup(scannedAsset.permanent_code);
    } catch (err: any) {
      alert(`Error al sustituir equipo: ${err.message}`);
    }
  };

  // Purgar todos los datos de prueba e iniciar inventario de cero
  const handlePurgeAllData = async () => {
    if (purgeConfirmText.trim() !== 'LIMPIAR') {
      alert('Debes escribir la palabra exacta LIMPIAR para confirmar.');
      return;
    }

    setPurging(true);
    try {
      const res = await fetch('/api/backup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'PURGE_ALL_DATA' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al purgar los datos');
      
      setPurgeResult({ success: true, message: data.message });
      setShowPurgeModal(false);
      setPurgeConfirmText('');
      alert('¡Base de datos de prueba purgada exitosamente! El sistema ha iniciado de cero.');
      window.location.reload();
    } catch (err: any) {
      alert(`Error durante la purga: ${err.message}`);
    } finally {
      setPurging(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Encabezado */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">
              Configuración del Sistema
            </h1>
            <span className="rounded-full bg-military-800 px-2.5 py-0.5 text-[11px] font-bold text-white">
              SivarStock Enterprise
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Copias de seguridad, generador e impresión de códigos QR, modo nocturno, escáner validador y personalización visual.
          </p>
        </div>
      </div>

      {/* Navegación por Pestañas */}
      <div className="flex overflow-x-auto border-b border-slate-200 bg-white px-2 pt-2 rounded-t-xl">
        {[
          { id: 'apariencia', label: 'Modo Nocturno y Vista', icon: Moon },
          { id: 'respaldos', label: 'Copias de Seguridad (BD)', icon: Database },
          { id: 'qr_generator', label: 'Generador de Códigos QR/Barra', icon: QrCode },
          { id: 'scanner_validator', label: 'Escáner Validador y Cambio', icon: Search },
          { id: 'menu_nombres', label: 'Nombres de Menú Lateral', icon: Layers },
          { id: 'dock_shortcuts', label: 'Atajos Burbuja iPhone', icon: Smartphone },
        ].map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 border-b-2 px-4 py-3 text-xs font-bold whitespace-nowrap transition ${
                activeTab === tab.id
                  ? 'border-military-800 text-military-800 bg-military-50/50'
                  : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50'
              }`}
            >
              <Icon className="h-4 w-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* 1. Modo Nocturno y Apariencia */}
      {activeTab === 'apariencia' && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-6">
          <div>
            <h2 className="text-base font-bold text-slate-900">Personalización de Apariencia</h2>
            <p className="text-xs text-slate-500">
              Adapta la interfaz para jornadas de manufactura en planta o trabajo de oficina en horarios nocturnos.
            </p>
          </div>

          <div className="flex items-center justify-between p-4 rounded-xl border border-slate-200 bg-slate-50 max-w-xl">
            <div className="flex items-center gap-3">
              <div className={`p-2.5 rounded-lg ${isDarkMode ? 'bg-slate-900 text-amber-400' : 'bg-amber-100 text-amber-700'}`}>
                {isDarkMode ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
              </div>
              <div>
                <span className="font-bold text-xs text-slate-800 block">
                  {isDarkMode ? 'Modo Oscuro (Activado)' : 'Modo Claro (Activado)'}
                </span>
                <span className="text-[11px] text-slate-500">
                  {isDarkMode
                    ? 'Paleta oscura de alto contraste con tonos verde militar y zinc.'
                    : 'Paleta limpia diurna de alta legibilidad.'}
                </span>
              </div>
            </div>

            <button
              onClick={toggleDarkMode}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                isDarkMode ? 'bg-military-800' : 'bg-slate-300'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  isDarkMode ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        </div>
      )}

      {/* 2. Copias de Seguridad de Base de Datos */}
      {activeTab === 'respaldos' && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-6">
          <div>
            <h2 className="text-base font-bold text-slate-900">Copias de Seguridad y Respaldo de Información</h2>
            <p className="text-xs text-slate-500">
              Descarga la base de datos relacional completa para resguardo seguro contra pérdida de información.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 max-w-3xl">
            {/* Opción 1: SQLite Binario */}
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-5 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 text-military-800 font-bold text-xs uppercase mb-1">
                  <Database className="h-4 w-4" />
                  <span>Base de Datos Completa (.db)</span>
                </div>
                <p className="text-xs text-slate-600 mt-2">
                  Archivo SQLite binario completo (`sivarstock.db`) con todas las tablas relacionales, índices y claves foráneas.
                </p>
              </div>
              <a
                href="/api/backup?format=sqlite"
                download
                className="mt-4 flex items-center justify-center gap-2 rounded-lg bg-military-800 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-military-900 transition"
              >
                <Download className="h-4 w-4" />
                <span>Descargar Archivo .db</span>
              </a>
            </div>

            {/* Opción 2: JSON Estructurado */}
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-5 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 text-blue-700 font-bold text-xs uppercase mb-1">
                  <Download className="h-4 w-4" />
                  <span>Respaldo Estructurado (.json)</span>
                </div>
                <p className="text-xs text-slate-600 mt-2">
                  Dumping JSON con activos, consumibles, celulares, empleados, movimientos kardex, facturas y auditoría.
                </p>
              </div>
              <a
                href="/api/backup?format=json"
                download
                className="mt-4 flex items-center justify-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-blue-800 transition"
              >
                <Download className="h-4 w-4" />
                <span>Exportar JSON Completo</span>
              </a>
            </div>

            {/* Zona de Peligro: Limpiar Datos de Prueba */}
            <div className="rounded-xl border border-rose-200 bg-rose-50/70 p-5 col-span-1 sm:col-span-2">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-rose-100 text-rose-700 shrink-0 mt-0.5">
                  <AlertTriangle className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <h3 className="text-sm font-bold text-rose-900">
                    Zona de Mantenimiento de Datos: Iniciar Inventario Real de Cero
                  </h3>
                  <p className="text-xs text-rose-700 mt-1 leading-relaxed">
                    Esta acción vacía con un solo clic todos los datos de prueba (activos individuales, productos, asignaciones, consumibles, celulares, movimientos y empleados de prueba), conservando intactos los departamentos, categorías base y el usuario administrador actual.
                  </p>
                  <div className="mt-4 flex items-center gap-3">
                    <button
                      onClick={() => setShowPurgeModal(true)}
                      className="flex items-center gap-2 rounded-lg bg-rose-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-rose-700 transition"
                    >
                      <Trash2 className="h-4 w-4" />
                      <span>Limpiar Base de Datos de Prueba (Iniciar Inventario de Cero)</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. Generador e Impresión de Códigos QR o Barra */}
      {activeTab === 'qr_generator' && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Generador de Códigos QR y Etiquetas de Activos
              </h2>
              <p className="text-xs text-slate-500">
                Filtra por departamento, por persona o por tipo de dispositivo para exportar e imprimir etiquetas.
              </p>
            </div>
            {qrItems.length > 0 && (
              <button
                onClick={() => window.print()}
                className="flex items-center gap-2 rounded-lg bg-military-800 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-military-900 transition"
              >
                <Printer className="h-4 w-4" />
                <span>Imprimir Hoja de Etiquetas ({qrItems.length})</span>
              </button>
            )}
          </div>

          {/* Filtros de Selección Poka-Yoke */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Por Departamento</label>
              <select
                value={selectedDept}
                onChange={(e) => setSelectedDept(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-military-600"
              >
                <option value="">Todos los departamentos</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({d.code})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Por Persona / Empleado</label>
              <select
                value={selectedEmp}
                onChange={(e) => setSelectedEmp(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-military-600"
              >
                <option value="">Todos los empleados</option>
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.full_name} ({e.employee_code})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Por Dispositivo</label>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-military-600"
              >
                <option value="">Todas las categorías</option>
                <option value="LAPTOPS">Laptops / Portátiles</option>
                <option value="DESKTOPS">Computadoras de Escritorio</option>
                <option value="IMPRESORAS">Impresoras y Escáneres</option>
                <option value="SERVIDORES">Servidores y Redes</option>
                <option value="HERRAMIENTAS">Herramientas y Maquinaria</option>
              </select>
            </div>

            <div className="flex items-end">
              <button
                onClick={handleFetchBatchQr}
                disabled={loadingQr}
                className="w-full flex items-center justify-center gap-1.5 rounded-lg bg-military-800 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-military-900 transition disabled:opacity-50"
              >
                <QrCode className="h-4 w-4" />
                <span>{loadingQr ? 'Generando...' : 'Generar Códigos'}</span>
              </button>
            </div>
          </div>

          {/* Cuadrícula de Etiquetas para Impresión */}
          <div className="printable-qr-grid grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {qrItems.map((item) => (
              <div
                key={item.id}
                className="rounded-xl border border-slate-300 bg-white p-4 shadow-sm flex flex-col items-center text-center relative print:border-black print:shadow-none"
              >
                <div className="w-full flex items-center justify-between border-b border-slate-100 pb-1.5 mb-2">
                  <span className="text-[10px] font-bold text-slate-700 uppercase">SIVARSTOCK</span>
                  <span className="text-[10px] font-bold text-military-800">{item.department_code || 'BOD'}</span>
                </div>

                {item.qrDataUrl && (
                  <img
                    src={item.qrDataUrl}
                    alt={item.permanent_code}
                    className="h-28 w-28 my-1"
                  />
                )}

                <span className="font-mono text-xs font-black text-slate-900 tracking-wider">
                  {item.permanent_code}
                </span>
                <span className="text-xs font-bold text-slate-800 mt-1 line-clamp-1">
                  {item.product_name}
                </span>
                <span className="text-[11px] text-slate-500">
                  {item.employee_name ? `Custodio: ${item.employee_name}` : 'En Bodega Central'}
                </span>
                <span className="text-[10px] text-slate-400 mt-1">
                  Ingreso: {item.created_at ? new Date(item.created_at).toLocaleDateString('es-GT') : 'N/A'}
                </span>
              </div>
            ))}
          </div>

          {qrItems.length === 0 && !loadingQr && (
            <div className="py-12 text-center text-xs text-slate-400">
              Selecciona un departamento, empleado o categoría y presiona "Generar Códigos" para previsualizar las etiquetas imprimibles.
            </div>
          )}
        </div>
      )}

      {/* 4. Escáner Validador y Cambio de Producto */}
      {activeTab === 'scanner_validator' && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-6">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Escáner Validador y Módulo de Cambio de Producto
            </h2>
            <p className="text-xs text-slate-500">
              Escanea o ingresa el código del producto para ver su fecha, custodio, estado, y sustituirlo en caso de avería o cambio.
            </p>
          </div>

          {/* Buscador de Código */}
          <div className="flex gap-2 max-w-lg">
            <input
              type="text"
              placeholder="Ingresa o escanea código ej. SIV-IT-000001..."
              value={searchCode}
              onChange={(e) => setSearchCode(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleScanLookup()}
              className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs text-slate-800 focus:bg-white focus:border-military-600 focus:outline-none"
            />
            <button
              onClick={() => handleScanLookup()}
              disabled={loadingScan}
              className="flex items-center gap-1.5 rounded-xl bg-military-800 px-5 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-military-900 transition disabled:opacity-50"
            >
              <Search className="h-4 w-4" />
              <span>Validar</span>
            </button>
          </div>

          {scanMessage && (
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800 flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{scanMessage}</span>
            </div>
          )}

          {/* Ficha del Producto Escaneado */}
          {scannedAsset && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-5 max-w-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-black text-military-800">
                      {scannedAsset.permanent_code}
                    </span>
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                      {scannedAsset.operational_status}
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-slate-900 mt-1">
                    {scannedAsset.product_name}
                  </h3>
                </div>
                <Link
                  href={`/inventario?search=${encodeURIComponent(scannedAsset.permanent_code)}`}
                  className="text-xs font-bold text-military-700 hover:underline"
                >
                  Ver en Inventario →
                </Link>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-[11px] text-slate-500 block">Número de Serie:</span>
                  <span className="font-semibold text-slate-800">{scannedAsset.serial_number || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-[11px] text-slate-500 block">Fecha de Registro:</span>
                  <span className="font-semibold text-slate-800">
                    {scannedAsset.created_at ? new Date(scannedAsset.created_at).toLocaleDateString('es-GT') : 'N/A'}
                  </span>
                </div>
                <div>
                  <span className="text-[11px] text-slate-500 block">Departamento:</span>
                  <span className="font-semibold text-slate-800">{scannedAsset.department_name || 'En Bodega'}</span>
                </div>
                <div>
                  <span className="text-[11px] text-slate-500 block">Custodio Asignado:</span>
                  <span className="font-semibold text-slate-800">{scannedAsset.employee_name || 'Sin Asignar'}</span>
                </div>
              </div>

              {/* Botón de Cambio / Sustitución */}
              <div className="pt-3 border-t border-slate-200 flex gap-3">
                <button
                  onClick={openReplaceModal}
                  className="flex items-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-amber-700 transition"
                >
                  <ArrowRightLeft className="h-4 w-4" />
                  <span>Cambiar / Sustituir por otro de Bodega</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 5. Personalización de Nombres de Pestañas (Front-End) */}
      {activeTab === 'menu_nombres' && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-slate-900">Personalizar Nombres de Pestañas del Menú</h2>
              <p className="text-xs text-slate-500">
                Cambia el texto mostrado en el frontend conservando el orden de las categorías.
              </p>
            </div>
            <button
              onClick={handleSaveTabNames}
              className="flex items-center gap-1.5 rounded-lg bg-military-800 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-military-900 transition"
            >
              <span>Guardar Nombres de Menú</span>
            </button>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 max-w-3xl">
            {Object.keys(defaultTabNames).map((key) => (
              <div key={key} className="p-3 rounded-xl border border-slate-100 bg-slate-50">
                <span className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                  Pestaña: {key}
                </span>
                <input
                  type="text"
                  value={tabNames[key] || ''}
                  onChange={(e) => setTabNames({ ...tabNames, [key]: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-military-600"
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 6. Atajos de la Burbuja Flotante iPhone */}
      {activeTab === 'dock_shortcuts' && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-slate-900">Atajos de la Burbuja Flotante (Estilo iPhone)</h2>
              <p className="text-xs text-slate-500">
                Configura los atajos laterales de la burbuja (el escáner siempre ocupa la posición central).
              </p>
            </div>
            <button
              onClick={handleSaveDockShortcuts}
              className="flex items-center gap-1.5 rounded-lg bg-military-800 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-military-900 transition"
            >
              <span>Guardar Atajos</span>
            </button>
          </div>

          <div className="max-w-xl space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50">
                <span className="text-xs font-bold text-slate-700 block mb-2">Atajo Izquierdo 1</span>
                <input
                  type="text"
                  value={dockShortcuts.left1.name}
                  onChange={(e) => setDockShortcuts({ ...dockShortcuts, left1: { ...dockShortcuts.left1, name: e.target.value } })}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs mb-2"
                />
                <input
                  type="text"
                  value={dockShortcuts.left1.href}
                  onChange={(e) => setDockShortcuts({ ...dockShortcuts, left1: { ...dockShortcuts.left1, href: e.target.value } })}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-mono"
                />
              </div>

              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50">
                <span className="text-xs font-bold text-slate-700 block mb-2">Atajo Izquierdo 2</span>
                <input
                  type="text"
                  value={dockShortcuts.left2.name}
                  onChange={(e) => setDockShortcuts({ ...dockShortcuts, left2: { ...dockShortcuts.left2, name: e.target.value } })}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs mb-2"
                />
                <input
                  type="text"
                  value={dockShortcuts.left2.href}
                  onChange={(e) => setDockShortcuts({ ...dockShortcuts, left2: { ...dockShortcuts.left2, href: e.target.value } })}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-mono"
                />
              </div>
            </div>

            <div className="p-3 text-center rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-bold text-emerald-800">
              Posición Central: Escáner QR / Barra (Fijo para lectura rápida)
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50">
                <span className="text-xs font-bold text-slate-700 block mb-2">Atajo Derecho 1</span>
                <input
                  type="text"
                  value={dockShortcuts.right1.name}
                  onChange={(e) => setDockShortcuts({ ...dockShortcuts, right1: { ...dockShortcuts.right1, name: e.target.value } })}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs mb-2"
                />
                <input
                  type="text"
                  value={dockShortcuts.right1.href}
                  onChange={(e) => setDockShortcuts({ ...dockShortcuts, right1: { ...dockShortcuts.right1, href: e.target.value } })}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-mono"
                />
              </div>

              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50">
                <span className="text-xs font-bold text-slate-700 block mb-2">Atajo Derecho 2</span>
                <input
                  type="text"
                  value={dockShortcuts.right2.name}
                  onChange={(e) => setDockShortcuts({ ...dockShortcuts, right2: { ...dockShortcuts.right2, name: e.target.value } })}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs mb-2"
                />
                <input
                  type="text"
                  value={dockShortcuts.right2.href}
                  onChange={(e) => setDockShortcuts({ ...dockShortcuts, right2: { ...dockShortcuts.right2, href: e.target.value } })}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-mono"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal para Sustituir Producto */}
      {showReplaceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900">
                Sustituir {scannedAsset?.permanent_code}
              </h3>
              <button
                onClick={() => setShowReplaceModal(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
              >
                ✕
              </button>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Seleccionar Producto Sustituto de Bodega *
              </label>
              <select
                value={selectedReplacementId}
                onChange={(e) => setSelectedReplacementId(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white p-2 text-xs text-slate-800"
              >
                <option value="">Selecciona un activo disponible...</option>
                {availableReplacements.map((rep) => (
                  <option key={rep.id} value={rep.id}>
                    {rep.permanent_code} - {rep.product_name} (Serie: {rep.serial_number || 'S/N'})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Motivo del Cambio o Reemplazo *
              </label>
              <textarea
                rows={3}
                required
                value={replaceReason}
                onChange={(e) => setReplaceReason(e.target.value)}
                placeholder="Ej. Equipo anterior presentó falla irreversible en tarjeta madre; se sustituye por activo de bodega."
                className="w-full rounded-lg border border-slate-200 p-2 text-xs text-slate-800 focus:outline-none focus:border-military-600"
              />
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                onClick={() => setShowReplaceModal(false)}
                className="rounded-lg px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100"
              >
                Cancelar
              </button>
              <button
                onClick={handleExecuteReplacement}
                className="rounded-lg bg-military-800 px-5 py-2 text-xs font-bold text-white hover:bg-military-900 shadow-sm"
              >
                Confirmar Sustitución
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Confirmación de Seguridad: Limpiar Base de Datos */}
      {showPurgeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl space-y-4 border border-rose-200">
            <div className="flex items-center gap-3 border-b border-rose-100 pb-3 text-rose-700">
              <AlertTriangle className="h-6 w-6 shrink-0" />
              <div>
                <h3 className="text-base font-black text-rose-900">
                  ¿Reiniciar Base de Datos a Cero?
                </h3>
                <span className="text-[11px] text-rose-600 font-semibold">
                  Acción irreversible de alto impacto
                </span>
              </div>
            </div>

            <div className="space-y-2 text-xs text-slate-700">
              <p>
                Esta acción eliminará de forma permanente todos los datos de prueba registrados en el sistema:
              </p>
              <ul className="list-disc pl-5 space-y-1 text-slate-600 font-mono text-[11px]">
                <li>Activos físicos individuales y movimientos kardex</li>
                <li>Catálogo de productos y stocks consumibles</li>
                <li>Historial de celulares y asignaciones a personal</li>
                <li>Registros de mantenimiento, servicios y costos</li>
                <li>Empleados de prueba creados durante la demostración</li>
              </ul>
              <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-2.5 text-[11px] text-emerald-800 font-medium">
                ✓ Se conservarán tus Áreas / Departamentos, Categorías base y tu cuenta de Administrador.
              </div>
            </div>

            <div className="rounded-lg bg-slate-50 border border-slate-200 p-3">
              <label className="block text-xs font-bold text-slate-800 mb-1">
                Para confirmar, escribe la palabra <span className="text-rose-600 font-mono">LIMPIAR</span> en mayúsculas:
              </label>
              <input
                type="text"
                placeholder="LIMPIAR"
                value={purgeConfirmText}
                onChange={(e) => setPurgeConfirmText(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:border-rose-600"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  setShowPurgeModal(false);
                  setPurgeConfirmText('');
                }}
                disabled={purging}
                className="rounded-lg px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handlePurgeAllData}
                disabled={purging || purgeConfirmText.trim() !== 'LIMPIAR'}
                className="flex items-center gap-1.5 rounded-lg bg-rose-600 px-4 py-2 text-xs font-bold text-white hover:bg-rose-700 shadow-sm disabled:opacity-50 transition"
              >
                <Trash2 className="h-4 w-4" />
                <span>{purging ? 'Limpiando base...' : 'Confirmar y Purgar Todo'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
