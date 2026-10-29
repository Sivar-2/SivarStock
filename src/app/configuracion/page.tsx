'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
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
  RefreshCw,
  AlertTriangle,
  Trash2,
  Server,
  CloudUpload,
  CloudDownload,
  Wifi,
  CheckCircle2,
  Copy,
  PenTool,
  RotateCcw,
  Save,
  UserCheck
} from 'lucide-react';
import Link from 'next/link';

export default function ConfiguracionPage() {
  const [activeTab, setActiveTab] = useState<
    'firma_actas' | 'servidor_sync' | 'apariencia' | 'respaldos' | 'qr_generator' | 'scanner_validator' | 'menu_nombres' | 'dock_shortcuts'
  >('firma_actas');

  // Configuración de Firma y Emisor de Actas Digitales (Por defecto: Alexander Turcios Melendez)
  const [issuerName, setIssuerName] = useState('Alexander Turcios Melendez');
  const [issuerRole, setIssuerRole] = useState('Jefe de IT / Administración de Inventario');
  const [issuerSignatureData, setIssuerSignatureData] = useState<string>('');
  const [savingIssuer, setSavingIssuer] = useState(false);
  const [issuerSavedMsg, setIssuerSavedMsg] = useState<string | null>(null);
  const sigCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawingIssuerSig, setIsDrawingIssuerSig] = useState(false);

  // Servidor Local y Sincronización Nube
  const [syncInfo, setSyncInfo] = useState<any>(null);
  const [cloudUrlInput, setCloudUrlInput] = useState('');
  const [syncLoading, setSyncLoading] = useState(false);
  const [syncStatusMsg, setSyncStatusMsg] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  // Purga de Base de Datos
  const [showPurgeModal, setShowPurgeModal] = useState(false);
  const [purgeConfirmText, setPurgeConfirmText] = useState('');
  const [purging, setPurging] = useState(false);

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
    SERVICIOS: 'Licencias y contratos',
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
    right1: { name: 'Asignaciones', href: '/asignaciones' },
    right2: { name: 'Reportes', href: '/reportes' },
  });

  const loadSyncStatus = () => {
    fetch('/api/sync')
      .then((r) => r.json())
      .then((d) => {
        setSyncInfo(d);
      })
      .catch(console.error);
  };

  const loadIssuerConfig = () => {
    fetch('/api/actas')
      .then((r) => r.json())
      .then((d) => {
        if (d.issuerConfig) {
          setIssuerName(d.issuerConfig.issuerName || 'Alexander Turcios Melendez');
          setIssuerRole(d.issuerConfig.issuerRole || 'Jefe de IT / Administración de Inventario');
          setIssuerSignatureData(d.issuerConfig.issuerSignatureData || '');
        }
      })
      .catch(console.error);
  };

  useEffect(() => {
    const savedTheme = localStorage.getItem('sivarstock_theme');
    if (savedTheme === 'dark') {
      setIsDarkMode(true);
      document.documentElement.classList.add('dark');
    }

    const savedTabs = localStorage.getItem('sivarstock_tab_names');
    if (savedTabs) {
      try {
        setTabNames(JSON.parse(savedTabs));
      } catch (e) {
        console.error(e);
      }
    }

    const savedDock = localStorage.getItem('sivarstock_dock_shortcuts');
    if (savedDock) {
      try {
        setDockShortcuts(JSON.parse(savedDock));
      } catch (e) {
        console.error(e);
      }
    }

    loadSyncStatus();
    loadIssuerConfig();

    fetch('/api/catalogs')
      .then((r) => r.json())
      .then((d) => {
        if (d.departments) setDepartments(d.departments);
        if (d.employees) setEmployees(d.employees);
      })
      .catch(console.error);
  }, []);

  // Funciones para dibujar firma personalizada del responsable en Ajustes
  const getCanvasPoint = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = sigCanvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    if ('touches' in e) {
      const touch = e.touches[0] || e.changedTouches[0];
      return {
        x: ((touch.clientX - rect.left) * canvas.width) / rect.width,
        y: ((touch.clientY - rect.top) * canvas.height) / rect.height,
      };
    }
    return {
      x: ((e.clientX - rect.left) * canvas.width) / rect.width,
      y: ((e.clientY - rect.top) * canvas.height) / rect.height,
    };
  };

  const startIssuerDraw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const canvas = sigCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { x, y } = getCanvasPoint(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineWidth = 2.4;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#0f172a';
    setIsDrawingIssuerSig(true);
  };

  const moveIssuerDraw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawingIssuerSig) return;
    e.preventDefault();
    const canvas = sigCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { x, y } = getCanvasPoint(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const endIssuerDraw = () => {
    if (!isDrawingIssuerSig) return;
    setIsDrawingIssuerSig(false);
    const canvas = sigCanvasRef.current;
    if (canvas) {
      setIssuerSignatureData(canvas.toDataURL('image/png'));
    }
  };

  const clearIssuerCanvas = () => {
    const canvas = sigCanvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    setIssuerSignatureData('');
  };

  const handleSaveIssuerSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingIssuer(true);
    setIssuerSavedMsg(null);
    try {
      const res = await fetch('/api/actas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'SAVE_ISSUER_SETTINGS',
          issuerName: issuerName.trim() || 'Alexander Turcios Melendez',
          issuerRole: issuerRole.trim() || 'Jefe de IT / Administración de Inventario',
          issuerSignatureData: issuerSignatureData || '',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al guardar firma');
      setIssuerSavedMsg('¡Configuración de Firma y Responsable guardada exitosamente! Todas las actas nuevas usarán estos datos.');
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSavingIssuer(false);
    }
  };

  // Ejecutar Acción de Sincronización Nube / Servidor Local
  const handleSyncAction = async (action: 'SAVE_URL' | 'TEST_CONNECTION' | 'PUSH_TO_CLOUD' | 'PULL_FROM_CLOUD') => {
    setSyncLoading(true);
    setSyncStatusMsg(null);
    try {
      const res = await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          remotePostgresUrl: cloudUrlInput.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error en la operación de sincronización');
      setSyncStatusMsg({ type: 'success', text: data.message || 'Operación completada exitosamente.' });
      loadSyncStatus();
    } catch (err: any) {
      setSyncStatusMsg({ type: 'error', text: err.message });
    } finally {
      setSyncLoading(false);
    }
  };

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

  const handleSaveTabNames = () => {
    localStorage.setItem('sivarstock_tab_names', JSON.stringify(tabNames));
    window.dispatchEvent(new Event('storage'));
    alert('Nombres de pestañas actualizados correctamente en el menú lateral.');
  };

  const handleSaveDockShortcuts = () => {
    localStorage.setItem('sivarstock_dock_shortcuts', JSON.stringify(dockShortcuts));
    window.dispatchEvent(new Event('storage'));
    alert('Atajos de la barra flotante guardados correctamente.');
  };

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

  const handleScanLookup = async (codeToSearch?: string) => {
    const code = (codeToSearch || searchCode).trim();
    if (!code) return;
    setLoadingScan(true);
    setScanMessage(null);
    setScannedAsset(null);

    try {
      const res = await fetch(`/api/inventory/items?search=${encodeURIComponent(code)}`);
      const data = await res.json();
      if (data.items && data.items.length > 0) {
        const item =
          data.items.find(
            (i: any) =>
              i.permanent_code?.toUpperCase() === code.toUpperCase() ||
              i.serial_number?.toUpperCase() === code.toUpperCase() ||
              i.imei?.toUpperCase() === code.toUpperCase() ||
              i.mac_address?.toUpperCase() === code.toUpperCase()
          ) || data.items[0];
        setScannedAsset(item);
      } else {
        setScanMessage(`El código, serie o IMEI "${code}" no fue encontrado en la base de datos.`);
      }
    } catch (err: any) {
      setScanMessage(`Error al buscar activo: ${err.message}`);
    } finally {
      setLoadingScan(false);
    }
  };

  const openReplaceModal = () => {
    if (!scannedAsset) return;
    fetch('/api/inventory/items?status=DISPONIBLE')
      .then((r) => r.json())
      .then((d) => {
        if (d.items) {
          setAvailableReplacements(d.items.filter((i: any) => i.id !== scannedAsset.id));
        }
        setShowReplaceModal(true);
      })
      .catch(console.error);
  };

  const handleExecuteReplacement = async () => {
    if (!selectedReplacementId || !replaceReason.trim()) {
      alert('Debes seleccionar el producto sustituto de bodega y escribir el motivo.');
      return;
    }

    try {
      const res = await fetch('/api/inventory/lifecycle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'REPLACE_BROKEN_ITEM',
          brokenItemId: scannedAsset.id,
          replacementItemId: selectedReplacementId,
          reason: replaceReason,
          severity: 'MODERADA',
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al sustituir equipo');

      alert('¡Sustitución completada! El equipo anterior pasó a revisión/avería y el nuevo equipo de bodega fue asignado al custodio.');
      setShowReplaceModal(false);
      setReplaceReason('');
      setSelectedReplacementId('');
      handleScanLookup(scannedAsset.permanent_code);
    } catch (err: any) {
      alert(`Error al sustituir equipo: ${err.message}`);
    }
  };

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
              Ajustes y Configuración General
            </h1>
            <span className="rounded-full bg-military-800 px-2.5 py-0.5 text-[11px] font-bold text-white">
              SivarStock Enterprise
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Firma electrónica para Actas de Entrega, Servidor Local (Windows Server / LAN), respaldos, QR y personalización.
          </p>
        </div>
      </div>

      {/* Navegación por Pestañas */}
      <div className="flex overflow-x-auto border-b border-slate-200 bg-white px-2 pt-2 rounded-t-xl">
        {[
          { id: 'firma_actas', label: 'Firma y Responsable de Entregas', icon: PenTool },
          { id: 'servidor_sync', label: 'Servidor Local (LAN) y Nube', icon: Server },
          { id: 'respaldos', label: 'Copias de Seguridad (BD)', icon: Database },
          { id: 'qr_generator', label: 'Generador de Códigos QR/Barra', icon: QrCode },
          { id: 'scanner_validator', label: 'Escáner Validador y Cambio', icon: Search },
          { id: 'apariencia', label: 'Modo Nocturno y Vista', icon: Moon },
          { id: 'menu_nombres', label: 'Nombres de Menú Lateral', icon: Layers },
          { id: 'dock_shortcuts', label: 'Atajos Burbuja Celular', icon: Smartphone },
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

      {/* 0A. FIRMA Y RESPONSABLE DE ENTREGAS DIGITALES (Por defecto: Alexander Turcios Melendez) */}
      {activeTab === 'firma_actas' && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-6">
          <div className="border-b border-slate-100 pb-4">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <PenTool className="h-5 w-5 text-emerald-700" />
              <span>Firma Automática y Responsable de Entrega de Equipos</span>
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Por defecto, todas las Actas Digitales de Entrega y Cambio enviadas por WhatsApp salen firmadas automáticamente a nombre de <strong>Alexander Turcios Melendez</strong>. Si en el futuro ingresa personal nuevo, aquí puedes cambiar el nombre, cargo o dibujar una nueva firma.
            </p>
          </div>

          {issuerSavedMsg && (
            <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-bold text-emerald-800 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
              <span>{issuerSavedMsg}</span>
            </div>
          )}

          <form onSubmit={handleSaveIssuerSettings} className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nombre Completo de Quien Entrega los Equipos *
                </label>
                <input
                  type="text"
                  required
                  value={issuerName}
                  onChange={(e) => setIssuerName(e.target.value)}
                  placeholder="Alexander Turcios Melendez"
                  className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm font-bold text-slate-900 focus:border-emerald-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Cargo / Puesto del Responsable de Entrega *
                </label>
                <input
                  type="text"
                  required
                  value={issuerRole}
                  onChange={(e) => setIssuerRole(e.target.value)}
                  placeholder="Jefe de IT / Administración de Inventario"
                  className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-800 focus:border-emerald-600 focus:outline-none"
                />
              </div>

              <div className="rounded-xl bg-emerald-50/70 border border-emerald-200 p-4 space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold text-emerald-900">
                  <UserCheck className="h-4 w-4 text-emerald-700" />
                  <span>Vista Previa de Firma Automática en el Acta Digital:</span>
                </div>
                <div className="rounded-lg bg-white border border-slate-200 p-4 text-center">
                  {issuerSignatureData ? (
                    <img
                      src={issuerSignatureData}
                      alt="Firma personalizada"
                      className="max-h-20 mx-auto object-contain"
                    />
                  ) : (
                    <p className="font-serif italic text-2xl text-slate-800 tracking-wide py-2">
                      {issuerName || 'Alexander Turcios Melendez'}
                    </p>
                  )}
                  <div className="border-t border-slate-300 mt-2 pt-1.5">
                    <p className="text-xs font-black text-slate-900">{issuerName || 'Alexander Turcios Melendez'}</p>
                    <p className="text-[11px] text-slate-500">{issuerRole || 'Jefe de IT / Administración de Inventario'}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold text-slate-700">
                  Dibujar Firma Manuscrita (Opcional - Si se deja en blanco usa la firma caligráfica automática):
                </label>
                <button
                  type="button"
                  onClick={clearIssuerCanvas}
                  className="flex items-center gap-1 text-xs font-bold text-rose-600 hover:underline"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span>Limpiar / Usar Automática</span>
                </button>
              </div>

              <div className="rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 p-2">
                <canvas
                  ref={sigCanvasRef}
                  width={500}
                  height={170}
                  onMouseDown={startIssuerDraw}
                  onMouseMove={moveIssuerDraw}
                  onMouseUp={endIssuerDraw}
                  onMouseLeave={endIssuerDraw}
                  onTouchStart={startIssuerDraw}
                  onTouchMove={moveIssuerDraw}
                  onTouchEnd={endIssuerDraw}
                  className="w-full h-40 bg-white rounded-lg cursor-crosshair touch-none"
                />
              </div>

              <p className="text-[11px] text-slate-500">
                Puedes firmar aquí desde la pantalla táctil de tu <strong>Honor 400</strong> o con el mouse. Si no dibujas nada, el sistema estampará automáticamente la firma elegante de <strong>{issuerName || 'Alexander Turcios Melendez'}</strong>.
              </p>

              <div className="pt-2 flex justify-end">
                <button
                  type="submit"
                  disabled={savingIssuer}
                  className="flex items-center gap-2 rounded-xl bg-emerald-700 px-5 py-2.5 text-xs font-bold text-white shadow-md hover:bg-emerald-800 transition disabled:opacity-50"
                >
                  <Save className="h-4 w-4" />
                  <span>{savingIssuer ? 'Guardando...' : 'Guardar Responsable y Firma por Defecto'}</span>
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* 0B. Servidor Local (LAN) y Sincronización con la Nube */}
      {activeTab === 'servidor_sync' && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Server className="h-5 w-5 text-military-800" />
                <span>Alojamiento en Windows Server Local (`serverlocal`) y Sincronización</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Trabaja desde tu Honor 400 o PC en la base de datos local (`data/sivarstock.db`). Si haces cambios fuera del Wi-Fi de la empresa, tu celular los guarda en cola y los confirma automáticamente al detectar el Wi-Fi corporativo.
              </p>
            </div>
            <button
              onClick={loadSyncStatus}
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span>Refrescar Red</span>
            </button>
          </div>

          {syncStatusMsg && (
            <div
              className={`p-3.5 rounded-xl border text-xs font-semibold flex items-center gap-2 ${
                syncStatusMsg.type === 'success'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : syncStatusMsg.type === 'error'
                  ? 'bg-rose-50 border-rose-200 text-rose-800'
                  : 'bg-blue-50 border-blue-200 text-blue-800'
              }`}
            >
              {syncStatusMsg.type === 'success' ? (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
              ) : (
                <AlertCircle className="h-4 w-4 shrink-0" />
              )}
              <span>{syncStatusMsg.text}</span>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Tarjeta 1: Servidor Local en la Red de la Empresa (LAN) */}
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-military-800 font-bold text-xs uppercase">
                  <Wifi className="h-4 w-4 text-emerald-600" />
                  <span>Direcciones IP del Servidor Local en el Wi-Fi de la Empresa</span>
                </div>
                <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-bold text-emerald-800">
                  Motor: {syncInfo?.engine === 'POSTGRESQL' ? 'PostgreSQL Directo' : 'SQLite Local Rápido'}
                </span>
              </div>

              <p className="text-xs text-slate-600 leading-relaxed">
                Abre cualquiera de estas direcciones en el navegador de tu <strong>Honor 400</strong> o en cualquier PC conectada al Wi-Fi de la empresa (también usa este enlace para enviar las Actas por WhatsApp dentro de la red):
              </p>

              <div className="space-y-2">
                {syncInfo?.lanIps && syncInfo.lanIps.length > 0 ? (
                  syncInfo.lanIps.map((ip: string, idx: number) => {
                    const fullUrl = `http://${ip}:${syncInfo.port || 3000}`;
                    return (
                      <div
                        key={idx}
                        className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs"
                      >
                        <div>
                          <span className="font-mono font-bold text-slate-900">{fullUrl}</span>
                          <span className="ml-2 text-[11px] text-emerald-700 font-semibold">(Red Local LAN)</span>
                        </div>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(fullUrl);
                            alert(`Dirección copiada: ${fullUrl}`);
                          }}
                          className="flex items-center gap-1 text-[11px] font-bold text-military-700 hover:underline"
                        >
                          <Copy className="h-3 w-3" />
                          <span>Copiar</span>
                        </button>
                      </div>
                    );
                  })
                ) : (
                  <div className="rounded-lg border border-slate-200 bg-white p-3 text-xs text-slate-500">
                    Ejecutando en <span className="font-mono font-bold">http://localhost:3000</span>
                  </div>
                )}
              </div>

              {syncInfo?.counts && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-2 border-t border-slate-200 text-center">
                  <div className="rounded-lg bg-white p-2 border border-slate-200">
                    <span className="block text-[10px] text-slate-400 uppercase font-bold">Empleados</span>
                    <span className="text-sm font-black text-slate-800">{syncInfo.counts.employees}</span>
                  </div>
                  <div className="rounded-lg bg-white p-2 border border-slate-200">
                    <span className="block text-[10px] text-slate-400 uppercase font-bold">Activos Físicos</span>
                    <span className="text-sm font-black text-slate-800">{syncInfo.counts.inventory_items}</span>
                  </div>
                  <div className="rounded-lg bg-white p-2 border border-slate-200">
                    <span className="block text-[10px] text-slate-400 uppercase font-bold">Líneas Móviles</span>
                    <span className="text-sm font-black text-slate-800">{syncInfo.counts.mobile_devices}</span>
                  </div>
                  <div className="rounded-lg bg-white p-2 border border-slate-200">
                    <span className="block text-[10px] text-slate-400 uppercase font-bold">Contratos/Lic.</span>
                    <span className="text-sm font-black text-slate-800">{syncInfo.counts.digital_services}</span>
                  </div>
                  <div className="rounded-lg bg-white p-2 border border-slate-200">
                    <span className="block text-[10px] text-slate-400 uppercase font-bold">Actas Digitales</span>
                    <span className="text-sm font-black text-emerald-700">{syncInfo.counts.delivery_actas ?? 0}</span>
                  </div>
                  <div className="rounded-lg bg-white p-2 border border-slate-200">
                    <span className="block text-[10px] text-slate-400 uppercase font-bold">Movimientos</span>
                    <span className="text-sm font-black text-slate-800">{syncInfo.counts.movements}</span>
                  </div>
                </div>
              )}

              <div className="rounded-lg bg-slate-900 p-3 text-[11px] text-slate-200 font-mono">
                <span className="text-emerald-400 font-bold block mb-1">Archivo automático incluido para tu Windows Server:</span>
                <code>Iniciar-Servidor-Local-SivarStock.bat</code>
              </div>
            </div>

            {/* Tarjeta 2: Sincronización con Base de Datos en la Nube (Supabase / PostgreSQL) */}
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-5 space-y-4 flex flex-col justify-between">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-blue-800 font-bold text-xs uppercase">
                    <CloudUpload className="h-4 w-4 text-blue-600" />
                    <span>Respaldo / Sincronización Nube (PostgreSQL / Supabase)</span>
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                      syncInfo?.hasRemoteConfigured
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {syncInfo?.hasRemoteConfigured ? 'Nube Configurada' : 'Opcional'}
                  </span>
                </div>

                <p className="text-xs text-slate-600 leading-relaxed">
                  Además de tu base de datos local en Windows Server, puedes vincular una base PostgreSQL/Supabase en la nube para subir o descargar copias sincronizadas cuando lo desees.
                </p>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    URL de Conexión PostgreSQL / Supabase (Cloud Database URL):
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="password"
                      placeholder={
                        syncInfo?.savedRemoteUrlMasked
                          ? `Actual: ${syncInfo.savedRemoteUrlMasked}`
                          : 'postgresql://postgres:[PASSWORD]@db.[REF].supabase.co:5432/postgres'
                      }
                      value={cloudUrlInput}
                      onChange={(e) => setCloudUrlInput(e.target.value)}
                      className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-mono text-slate-800 focus:outline-none focus:border-blue-600"
                    />
                    <button
                      type="button"
                      disabled={syncLoading || !cloudUrlInput.trim()}
                      onClick={() => handleSyncAction('SAVE_URL')}
                      className="rounded-lg bg-slate-800 px-3 py-2 text-xs font-bold text-white hover:bg-slate-900 disabled:opacity-50"
                    >
                      Guardar URL
                    </button>
                  </div>
                </div>

                {syncInfo?.lastSync && (
                  <div className="text-[11px] text-slate-500 bg-white p-2.5 rounded-lg border border-slate-200">
                    <strong>Última sincronización nube:</strong> {syncInfo.lastSync}
                  </div>
                )}
              </div>

              <div className="space-y-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  disabled={syncLoading}
                  onClick={() => handleSyncAction('TEST_CONNECTION')}
                  className="w-full flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 transition disabled:opacity-50"
                >
                  <CheckCircle className="h-4 w-4 text-emerald-600" />
                  <span>1. Probar Conexión con Servidor en la Nube</span>
                </button>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    type="button"
                    disabled={syncLoading}
                    onClick={() => {
                      if (confirm('¿Deseas subir y sincronizar todos los cambios de este servidor local hacia la base de datos en la nube?')) {
                        handleSyncAction('PUSH_TO_CLOUD');
                      }
                    }}
                    className="flex items-center justify-center gap-1.5 rounded-lg bg-military-800 px-3 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-military-900 transition disabled:opacity-50"
                  >
                    <CloudUpload className="h-4 w-4" />
                    <span>Subir Cambios a Nube (Push)</span>
                  </button>

                  <button
                    type="button"
                    disabled={syncLoading}
                    onClick={() => {
                      if (confirm('¿Deseas descargar los registros de la nube para actualizar tu base de datos local?')) {
                        handleSyncAction('PULL_FROM_CLOUD');
                      }
                    }}
                    className="flex items-center justify-center gap-1.5 rounded-lg bg-blue-700 px-3 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-blue-800 transition disabled:opacity-50"
                  >
                    <CloudDownload className="h-4 w-4" />
                    <span>Bajar de Nube a Local (Pull)</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

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
              Descarga la base de datos relacional completa (incluyendo Actas Digitales firmadas, empleados, DPI, líneas y contratos) para resguardo seguro.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 max-w-3xl">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-5 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 text-military-800 font-bold text-xs uppercase mb-1">
                  <Database className="h-4 w-4" />
                  <span>Base de Datos Completa (.db)</span>
                </div>
                <p className="text-xs text-slate-600 mt-2">
                  Archivo SQLite binario completo (`sivarstock.db`) con todas las tablas relacionales, actas firmadas, índices y claves foráneas.
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

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-5 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 text-blue-700 font-bold text-xs uppercase mb-1">
                  <Download className="h-4 w-4" />
                  <span>Respaldo Estructurado (.json)</span>
                </div>
                <p className="text-xs text-slate-600 mt-2">
                  Dumping JSON con activos, consumibles, celulares, empleados, actas digitales de entrega, movimientos kardex y auditoría.
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
                    Esta acción vacía con un solo clic todos los datos de prueba (activos individuales, productos, asignaciones, actas, consumibles, celulares, movimientos y empleados de prueba), conservando intactos los departamentos, categorías base y el usuario administrador actual.
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
              Selecciona un departamento, empleado o categoría y presiona &quot;Generar Códigos&quot; para previsualizar las etiquetas imprimibles.
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
              Escanea o ingresa el código permanente, número de serie, MAC o IMEI del equipo para ver su ficha y sustituirlo en caso de avería.
            </p>
          </div>

          <div className="flex gap-2 max-w-lg">
            <input
              type="text"
              placeholder="Ingresa código SIV-IT-000001, Serie, MAC o IMEI..."
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

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                <div>
                  <span className="text-[11px] text-slate-500 block">Número de Serie:</span>
                  <span className="font-mono font-semibold text-slate-800">{scannedAsset.serial_number || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-[11px] text-slate-500 block">MAC / IMEI:</span>
                  <span className="font-mono font-semibold text-slate-800">
                    {scannedAsset.mac_address || scannedAsset.imei || 'N/A'}
                  </span>
                </div>
                <div>
                  <span className="text-[11px] text-slate-500 block">IP / Hostname:</span>
                  <span className="font-mono font-semibold text-slate-800">
                    {scannedAsset.ip_address || scannedAsset.hostname || 'N/A'}
                  </span>
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
                  <span className="font-semibold text-slate-800">
                    {scannedAsset.employee_name || scannedAsset.assigned_user_name || 'Sin Asignar (En Bodega)'}
                  </span>
                </div>
              </div>

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

      {/* 5. Personalización de Nombres de Pestañas */}
      {activeTab === 'menu_nombres' && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-slate-900">Personalizar Nombres de Pestañas del Menú</h2>
              <p className="text-xs text-slate-500">
                Cambia el texto mostrado en el menú lateral conservando el orden de las categorías.
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

      {/* 6. Atajos de la Burbuja Flotante */}
      {activeTab === 'dock_shortcuts' && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-slate-900">Atajos de la Burbuja Flotante para Celular</h2>
              <p className="text-xs text-slate-500">
                Configura los atajos laterales de la burbuja inferior en tu Honor 400 (el escáner siempre ocupa la posición central).
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
                <li>Historial de celulares, actas y asignaciones a personal</li>
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
