'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Database,
  Download,
  Moon,
  Sun,
  QrCode,
  Printer,
  CheckCircle,
  AlertCircle,
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
  UserCheck,
  Mail,
  CheckSquare,
  Square,
  RectangleHorizontal,
  Maximize2,
} from 'lucide-react';

export default function ConfiguracionPage() {
  const [activeTab, setActiveTab] = useState<
    | 'firma_actas'
    | 'qr_generator'
    | 'comunicaciones'
    | 'servidor_sync'
    | 'respaldos'
    | 'apariencia'
    | 'menu_nombres'
    | 'dock_shortcuts'
  >('firma_actas');

  // Configuración de Firma y Emisor de Actas Digitales (Por defecto: Alexander Turcios Melendez)
  const [issuerName, setIssuerName] = useState('Alexander Turcios Melendez');
  const [issuerRole, setIssuerRole] = useState(
    'Especialista de Tecnología, Sistemas e Innovación — Departamento de Tecnología e Innovación (IT)'
  );
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

  // Generador de Etiquetas QR y Códigos
  const [departments, setDepartments] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [selectedDept, setSelectedDept] = useState('');
  const [selectedEmp, setSelectedEmp] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [qrUnassignedOnly, setQrUnassignedOnly] = useState(false);
  const [qrPrintStatusFilter, setQrPrintStatusFilter] = useState<'' | 'PRINTED' | 'UNPRINTED'>('');
  const [labelOrientation, setLabelOrientation] = useState<'HORIZONTAL' | 'CUADRADO'>('HORIZONTAL');
  const [qrSearchText, setQrSearchText] = useState('');
  const [qrItems, setQrItems] = useState<any[]>([]);
  const [selectedQrIds, setSelectedQrIds] = useState<string[]>([]);
  const [loadingQr, setLoadingQr] = useState(false);

  // Configuración de Correo (Outlook) y Plantillas WhatsApp
  const [commsConfig, setCommsConfig] = useState({
    itSupportEmail: 'depto.sistemas@grupofpc.com',
    ccEmail: 'depto.sistemas@grupofpc.com',
    companyLegalName: 'FÁBRICA DE PERSIANAS Y COMPLEMENTOS, S.A.',
    whatsappGreeting:
      'Hola {EMPLEADO}, el Departamento de Tecnología e Innovación (IT) te comparte tu Acta Digital de Entrega ({ACTA}) para revisión y firma electrónica:',
  });

  // Personalización de Nombres de Pestañas
  const defaultTabNames: Record<string, string> = {
    DASHBOARD: 'Inicio / Dashboard',
    INVENTARIO: 'Bodega',
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
    AUDITORIA: 'Bitácora',
    CONFIGURACION: 'Configuración',
  };

  const [tabNames, setTabNames] = useState<Record<string, string>>(defaultTabNames);

  // Atajos de la Burbuja Flotante
  const [dockShortcuts, setDockShortcuts] = useState({
    left1: { name: 'Inicio', href: '/' },
    left2: { name: 'Bodega', href: '/inventario' },
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
          setIssuerRole(
            d.issuerConfig.issuerRole ||
              'Especialista de Tecnología, Sistemas e Innovación — Departamento de Tecnología e Innovación (IT)'
          );
          setIssuerSignatureData(d.issuerConfig.issuerSignatureData || '');
        }
      })
      .catch(console.error);
  };

  const handleFetchBatchQr = async () => {
    setLoadingQr(true);
    try {
      const params = new URLSearchParams();
      if (selectedDept) params.append('department_id', selectedDept);
      if (selectedEmp) params.append('employee_id', selectedEmp);
      if (selectedCategory) params.append('category_id', selectedCategory);
      if (qrUnassignedOnly) params.append('unassigned', 'true');
      if (qrPrintStatusFilter) params.append('print_status', qrPrintStatusFilter);

      const r = await fetch(`/api/qr/batch?${params.toString()}`);
      const d = await r.json();
      if (d.items) {
        setQrItems(d.items);
        setSelectedQrIds(d.items.map((i: any) => i.id));
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingQr(false);
    }
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
        setTabNames({ ...defaultTabNames, ...JSON.parse(savedTabs) });
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

    const savedComms = localStorage.getItem('sivarstock_comms_config');
    if (savedComms) {
      try {
        setCommsConfig((prev) => ({ ...prev, ...JSON.parse(savedComms) }));
      } catch (e) {
        console.error(e);
      }
    }

    loadSyncStatus();
    loadIssuerConfig();
    handleFetchBatchQr();

    Promise.all([
      fetch('/api/catalogs').then((r) => r.json()),
      fetch('/api/employees?all=true').then((r) => r.json()),
    ])
      .then(([catData, empData]) => {
        if (catData.departments) setDepartments(catData.departments);
        if (catData.categories) setCategories(catData.categories);
        if (empData.employees) setEmployees(empData.employees);
      })
      .catch(console.error);
  }, []);

  useEffect(() => {
    if (activeTab === 'qr_generator') {
      handleFetchBatchQr();
    }
  }, [selectedDept, selectedEmp, selectedCategory, qrUnassignedOnly, qrPrintStatusFilter, activeTab]);

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
          issuerRole:
            issuerRole.trim() ||
            'Especialista de Tecnología, Sistemas e Innovación — Departamento de Tecnología e Innovación (IT)',
          issuerSignatureData: issuerSignatureData || '',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al guardar firma');
      setIssuerSavedMsg(
        '¡Configuración de Firma y Responsable guardada exitosamente! Todas las actas nuevas usarán estos datos.'
      );
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSavingIssuer(false);
    }
  };

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

  const handleMarkQrPrintedStatus = async (ids: string[], printed: boolean) => {
    if (ids.length === 0) {
      alert('Selecciona al menos un dispositivo de la lista.');
      return;
    }
    try {
      const res = await fetch('/api/inventory/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'MARK_QR_PRINTED',
          itemIds: ids,
          printed,
          labelOrientation,
        }),
      });
      if (res.ok) {
        await handleFetchBatchQr();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handlePrintSelectedQr = async () => {
    if (selectedQrIds.length === 0) {
      alert('Selecciona al menos un dispositivo para imprimir su etiqueta.');
      return;
    }
    await handleMarkQrPrintedStatus(selectedQrIds, true);
    setTimeout(() => {
      window.print();
    }, 150);
  };

  const handleExportSelectedQrCsv = () => {
    const selectedItems = qrItems.filter((i) => selectedQrIds.includes(i.id));
    if (selectedItems.length === 0) {
      alert('Selecciona al menos un dispositivo para exportar.');
      return;
    }
    const headers = [
      'Codigo_Permanente',
      'Modelo_Dispositivo',
      'Numero_Serie_SN',
      'Fecha_Entrega_Ingreso',
      'Codigo_Empleado',
      'Nombre_Empleado',
      'Estado_Etiqueta',
      'Orientacion',
    ];
    const rows = selectedItems.map((i) => [
      `"${i.permanent_code || ''}"`,
      `"${`${i.brand || ''} ${i.model || i.product_name || ''}`.trim()}"`,
      `"${i.serial_number || 'S/N'}"`,
      `"${(i.delivery_date || i.created_at || '').slice(0, 10)}"`,
      `"${i.employee_code || 'EN_BODEGA'}"`,
      `"${i.employee_name || 'En Bodega'}"`,
      `"${Number(i.qr_printed) === 1 ? 'IMPRESO' : 'NO_IMPRESO'}"`,
      `"${labelOrientation}"`,
    ]);
    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `etiquetas_qr_sivarstock_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
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

  const filteredQrItems = qrItems.filter((item) => {
    if (!qrSearchText.trim()) return true;
    const q = qrSearchText.toLowerCase();
    return (
      (item.permanent_code || '').toLowerCase().includes(q) ||
      (item.product_name || '').toLowerCase().includes(q) ||
      (item.model || '').toLowerCase().includes(q) ||
      (item.serial_number || '').toLowerCase().includes(q) ||
      (item.employee_name || '').toLowerCase().includes(q) ||
      (item.employee_code || '').toLowerCase().includes(q)
    );
  });

  const qrItemsToRender = filteredQrItems.filter((i) => selectedQrIds.includes(i.id));

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
              FÁBRICA DE PERSIANAS Y COMPLEMENTOS, S.A.
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Firma electrónica, Estudio de Etiquetas QR (Horizontal/Cuadrado con control de impresos), Correo/WhatsApp y Servidor Local.
          </p>
        </div>
      </div>

      {/* Navegación por Pestañas (Sin la pestaña "Escáner Validador y Cambio") */}
      <div className="flex overflow-x-auto border-b border-slate-200 bg-white px-2 pt-2 rounded-t-xl">
        {[
          { id: 'firma_actas', label: 'Firma y Responsable de Entregas', icon: PenTool },
          { id: 'qr_generator', label: 'Etiquetas QR y Códigos (Impresos / Lotes)', icon: QrCode },
          { id: 'comunicaciones', label: 'Correo (Outlook) y Plantillas WhatsApp', icon: Mail },
          { id: 'servidor_sync', label: 'Servidor Local (LAN) y Nube', icon: Server },
          { id: 'respaldos', label: 'Copias de Seguridad (BD)', icon: Database },
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

      {/* 1. FIRMA Y RESPONSABLE DE ENTREGAS DIGITALES */}
      {activeTab === 'firma_actas' && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-6">
          <div className="border-b border-slate-100 pb-4">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <PenTool className="h-5 w-5 text-emerald-700" />
              <span>Firma Automática y Responsable de Entrega de Equipos</span>
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Por defecto, todas las Actas Digitales salen preseleccionadas a nombre de{' '}
              <strong>Alexander Turcios Melendez</strong> (
              <em>Especialista de Tecnología, Sistemas e Innovación — Departamento de Tecnología e Innovación (IT)</em>
              ).
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
                  placeholder="Especialista de Tecnología, Sistemas e Innovación — Departamento de Tecnología e Innovación (IT)"
                  className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-800 focus:border-emerald-600 focus:outline-none"
                />
              </div>

              <div className="rounded-xl bg-emerald-50/70 border border-emerald-200 p-4 space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold text-emerald-900">
                  <UserCheck className="h-4 w-4 text-emerald-700" />
                  <span>Vista Previa de Firma Automática en el Acta Oficial de 2 Páginas:</span>
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
                    <p className="text-[11px] text-slate-500">
                      {issuerRole ||
                        'Especialista de Tecnología, Sistemas e Innovación — Departamento de Tecnología e Innovación (IT)'}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold text-slate-700">
                  Dibujar Firma Manuscrita (Opcional):
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

      {/* 2. ESTUDIO DE ETIQUETAS QR Y CÓDIGOS (HORIZONTAL / CUADRADO + CONTROL DE IMPRESOS) */}
      {activeTab === 'qr_generator' && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <QrCode className="h-5 w-5 text-emerald-700" />
                <span>Estudio de Etiquetas QR y Códigos de Activos</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Cada etiqueta incluye: <strong>Modelo, Código Permanente, Fecha de Entrega/Ingreso, S/N y Código del Empleado</strong>. Elige tamaño Horizontal o Cuadrado y lleva el control de qué etiquetas ya fueron impresas.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Selector de Orientación / Tamaño: Horizontal vs Cuadrado */}
              <div className="flex items-center rounded-xl border border-slate-200 bg-slate-50 p-1">
                <button
                  type="button"
                  onClick={() => setLabelOrientation('HORIZONTAL')}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                    labelOrientation === 'HORIZONTAL'
                      ? 'bg-slate-900 text-white shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <RectangleHorizontal className="h-3.5 w-3.5" />
                  <span>Horizontal</span>
                </button>
                <button
                  type="button"
                  onClick={() => setLabelOrientation('CUADRADO')}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                    labelOrientation === 'CUADRADO'
                      ? 'bg-slate-900 text-white shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Maximize2 className="h-3.5 w-3.5" />
                  <span>Cuadrado</span>
                </button>
              </div>

              <button
                type="button"
                onClick={handleExportSelectedQrCsv}
                className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 shadow-sm"
              >
                <Download className="h-4 w-4 text-blue-600" />
                <span>Exportar CSV ({selectedQrIds.length})</span>
              </button>

              <button
                type="button"
                onClick={handlePrintSelectedQr}
                className="flex items-center gap-1.5 rounded-xl bg-emerald-700 px-4 py-2 text-xs font-bold text-white shadow-md hover:bg-emerald-800 transition"
              >
                <Printer className="h-4 w-4" />
                <span>Imprimir / Descargar PDF ({selectedQrIds.length})</span>
              </button>
            </div>
          </div>

          {/* Filtros de Etiquetas QR */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Buscar Dispositivo / Serie</label>
              <input
                type="text"
                placeholder="SIV-IT-..., Serie, Modelo..."
                value={qrSearchText}
                onChange={(e) => setQrSearchText(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-emerald-600"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Estado de Impresión</label>
              <select
                value={qrPrintStatusFilter}
                onChange={(e) => setQrPrintStatusFilter(e.target.value as any)}
                className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800"
              >
                <option value="">Todos (Impresos y No Impresos)</option>
                <option value="UNPRINTED">Pendientes de Imprimir (No Impresos)</option>
                <option value="PRINTED">Ya Impresos</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Por Departamento</label>
              <select
                value={selectedDept}
                onChange={(e) => setSelectedDept(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800"
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
              <label className="block text-xs font-bold text-slate-700 mb-1">Por Empleado</label>
              <select
                value={selectedEmp}
                onChange={(e) => setSelectedEmp(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800"
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
              <label className="block text-xs font-bold text-slate-700 mb-1">Por Categoría</label>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800"
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

          {/* Barra de Selección Rápida */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs">
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => setSelectedQrIds(filteredQrItems.map((i) => i.id))}
                className="font-bold text-emerald-700 hover:underline"
              >
                Seleccionar todos ({filteredQrItems.length})
              </button>
              <span>•</span>
              <button
                type="button"
                onClick={() =>
                  setSelectedQrIds(filteredQrItems.filter((i) => Number(i.qr_printed) === 0).map((i) => i.id))
                }
                className="font-bold text-amber-700 hover:underline"
              >
                Seleccionar solo NO impresos ({filteredQrItems.filter((i) => Number(i.qr_printed) === 0).length})
              </button>
              <span>•</span>
              <button
                type="button"
                onClick={() => setQrUnassignedOnly(!qrUnassignedOnly)}
                className={`rounded-lg px-2.5 py-1 font-bold border ${
                  qrUnassignedOnly
                    ? 'bg-emerald-700 text-white border-emerald-700'
                    : 'bg-slate-50 text-slate-700 border-slate-200'
                }`}
              >
                {qrUnassignedOnly ? '✓ Mostrando solo Sin Asignar (En Bodega)' : 'Filtrar solo Sin Asignar (Bodega)'}
              </button>
              <span>•</span>
              <button
                type="button"
                onClick={() => setSelectedQrIds([])}
                className="text-slate-500 hover:underline"
              >
                Limpiar selección
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleMarkQrPrintedStatus(selectedQrIds, true)}
                className="rounded-lg bg-emerald-50 border border-emerald-200 px-2.5 py-1 font-bold text-emerald-800 hover:bg-emerald-100"
              >
                Marcar como Impresos
              </button>
              <button
                type="button"
                onClick={() => handleMarkQrPrintedStatus(selectedQrIds, false)}
                className="rounded-lg bg-slate-100 px-2.5 py-1 font-semibold text-slate-700 hover:bg-slate-200"
              >
                Marcar como No Impresos
              </button>
            </div>
          </div>

          {/* Tabla de Control de Dispositivos e Impresión */}
          <div className="max-h-64 overflow-y-auto rounded-xl border border-slate-200">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-[10px] uppercase font-bold text-slate-500 sticky top-0">
                <tr>
                  <th className="p-2.5 w-8">Sel.</th>
                  <th className="p-2.5">Código Permanente</th>
                  <th className="p-2.5">Modelo / Producto</th>
                  <th className="p-2.5">S/N (Serie)</th>
                  <th className="p-2.5">Cód. Empleado</th>
                  <th className="p-2.5">Fecha Entrega / Ingreso</th>
                  <th className="p-2.5 text-center">Estado Etiqueta</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredQrItems.map((item) => {
                  const isSelected = selectedQrIds.includes(item.id);
                  const isPrinted = Number(item.qr_printed) === 1;
                  return (
                    <tr
                      key={item.id}
                      onClick={() => {
                        setSelectedQrIds((prev) =>
                          prev.includes(item.id) ? prev.filter((id) => id !== item.id) : [...prev, item.id]
                        );
                      }}
                      className={`cursor-pointer transition ${
                        isSelected ? 'bg-emerald-50/60' : 'hover:bg-slate-50'
                      }`}
                    >
                      <td className="p-2.5">
                        {isSelected ? (
                          <CheckSquare className="h-4 w-4 text-emerald-600" />
                        ) : (
                          <Square className="h-4 w-4 text-slate-300" />
                        )}
                      </td>
                      <td className="p-2.5 font-mono font-bold text-slate-900">{item.permanent_code}</td>
                      <td className="p-2.5 font-semibold text-slate-800">
                        {item.brand} {item.model || item.product_name}
                      </td>
                      <td className="p-2.5 font-mono text-slate-600">{item.serial_number || 'S/N'}</td>
                      <td className="p-2.5 font-mono font-bold text-emerald-800">
                        {item.employee_code ? `${item.employee_code} (${item.employee_name})` : 'EN BODEGA'}
                      </td>
                      <td className="p-2.5 font-mono text-slate-500">
                        {(item.delivery_date || item.created_at || '').slice(0, 10) || 'N/A'}
                      </td>
                      <td className="p-2.5 text-center">
                        {isPrinted ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-bold text-emerald-800">
                            ✓ Impreso
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-[10px] font-bold text-amber-800">
                            No Impreso
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Vista Previa Imprimible de Etiquetas (Horizontal vs Cuadrado) */}
          <div>
            <h3 className="text-xs font-bold uppercase text-slate-500 mb-3">
              Vista Previa de Impresión ({qrItemsToRender.length} etiquetas en formato {labelOrientation}):
            </h3>

            {labelOrientation === 'HORIZONTAL' ? (
              <div className="printable-qr-grid grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {qrItemsToRender.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-xl border-2 border-slate-800 bg-white p-3 shadow-sm flex items-center gap-3 print:border-black print:shadow-none"
                  >
                    {item.qrDataUrl && (
                      <img
                        src={item.qrDataUrl}
                        alt={item.permanent_code}
                        className="h-24 w-24 shrink-0 border border-slate-200 rounded p-0.5"
                      />
                    )}
                    <div className="flex-1 min-w-0 text-left space-y-0.5">
                      <div className="text-[9px] font-black tracking-wider uppercase text-slate-500 border-b border-slate-200 pb-0.5">
                        GRUPO FPC • IT INVENTARIO
                      </div>
                      <div className="text-xs font-black text-slate-900 truncate">
                        {`${item.brand || ''} ${item.model || item.product_name || ''}`.trim()}
                      </div>
                      <div className="font-mono text-xs font-black text-emerald-800">
                        CÓD: {item.permanent_code}
                      </div>
                      <div className="font-mono text-[10px] text-slate-700 truncate">
                        <strong>S/N:</strong> {item.serial_number || 'S/N'}
                      </div>
                      <div className="font-mono text-[10px] text-slate-700">
                        <strong>FECHA:</strong> {(item.delivery_date || item.created_at || '').slice(0, 10) || 'N/A'}
                      </div>
                      <div className="font-mono text-[10px] font-bold text-slate-900 bg-slate-100 px-1.5 py-0.5 rounded inline-block">
                        EMP: {item.employee_code || 'EN BODEGA'}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="printable-qr-grid grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {qrItemsToRender.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-xl border-2 border-slate-800 bg-white p-3 shadow-sm flex flex-col items-center text-center print:border-black print:shadow-none"
                  >
                    <div className="w-full text-[9px] font-black uppercase text-slate-600 border-b border-slate-200 pb-1 mb-1">
                      GRUPO FPC • {item.department_code || 'IT'}
                    </div>
                    {item.qrDataUrl && (
                      <img src={item.qrDataUrl} alt={item.permanent_code} className="h-24 w-24 my-1" />
                    )}
                    <span className="font-mono text-xs font-black text-slate-900">
                      {item.permanent_code}
                    </span>
                    <span className="text-[11px] font-bold text-slate-800 line-clamp-1 mt-0.5">
                      {`${item.brand || ''} ${item.model || item.product_name || ''}`.trim()}
                    </span>
                    <span className="font-mono text-[10px] text-slate-600 mt-0.5">
                      S/N: {item.serial_number || 'S/N'}
                    </span>
                    <span className="font-mono text-[10px] text-slate-500">
                      Fecha: {(item.delivery_date || item.created_at || '').slice(0, 10) || 'N/A'}
                    </span>
                    <span className="font-mono text-[10px] font-black text-emerald-900 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded mt-1">
                      EMP: {item.employee_code || 'BODEGA'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 3. AUTOMATIZACIÓN DE CORREO (OUTLOOK) Y PLANTILLAS WHATSAPP */}
      {activeTab === 'comunicaciones' && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-6">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Mail className="h-5 w-5 text-blue-600" />
              <span>Automatización de Correo (Outlook) y Plantillas de WhatsApp</span>
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Configura el correo oficial de soporte IT y el mensaje predeterminado al enviar Actas Digitales por WhatsApp o abrir tu cliente de Outlook.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-3xl">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Razón Social en Actas Oficiales
              </label>
              <input
                type="text"
                value={commsConfig.companyLegalName}
                onChange={(e) => setCommsConfig({ ...commsConfig, companyLegalName: e.target.value })}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs font-bold text-slate-900"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Correo Oficial del Departamento IT (Cláusulas y Copias Outlook)
              </label>
              <input
                type="email"
                value={commsConfig.itSupportEmail}
                onChange={(e) => setCommsConfig({ ...commsConfig, itSupportEmail: e.target.value })}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs font-mono text-slate-900"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Plantilla de Mensaje para Envío de Acta Digital por WhatsApp
              </label>
              <textarea
                rows={3}
                value={commsConfig.whatsappGreeting}
                onChange={(e) => setCommsConfig({ ...commsConfig, whatsappGreeting: e.target.value })}
                className="w-full rounded-xl border border-slate-300 p-3 text-xs text-slate-800"
              />
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              localStorage.setItem('sivarstock_comms_config', JSON.stringify(commsConfig));
              alert('Configuración de Outlook y WhatsApp guardada correctamente.');
            }}
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-5 py-2.5 text-xs font-bold text-white hover:bg-emerald-800 shadow-sm"
          >
            <Save className="h-4 w-4" />
            <span>Guardar Plantillas de Correo y WhatsApp</span>
          </button>
        </div>
      )}

      {/* 4. Servidor Local (LAN) y Sincronización con la Nube */}
      {activeTab === 'servidor_sync' && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Server className="h-5 w-5 text-military-800" />
                <span>Alojamiento en Windows Server Local (`serverlocal`) y Sincronización</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Trabaja desde tu Honor 400 o PC en la base de datos local (`data/sivarstock.db`).
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
                  : 'bg-rose-50 border-rose-200 text-rose-800'
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
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-military-800 font-bold text-xs uppercase">
                  <Wifi className="h-4 w-4 text-emerald-600" />
                  <span>Direcciones IP del Servidor Local en el Wi-Fi de la Empresa</span>
                </div>
              </div>

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
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-5 space-y-4 flex flex-col justify-between">
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-blue-800 font-bold text-xs uppercase">
                  <CloudUpload className="h-4 w-4 text-blue-600" />
                  <span>Respaldo / Sincronización Nube (PostgreSQL / Supabase)</span>
                </div>

                <div className="flex gap-2">
                  <input
                    type="password"
                    placeholder="postgresql://postgres:[PASSWORD]@db.[REF].supabase.co:5432/postgres"
                    value={cloudUrlInput}
                    onChange={(e) => setCloudUrlInput(e.target.value)}
                    className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-mono text-slate-800"
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

              <div className="space-y-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  disabled={syncLoading}
                  onClick={() => handleSyncAction('TEST_CONNECTION')}
                  className="w-full flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100"
                >
                  <CheckCircle className="h-4 w-4 text-emerald-600" />
                  <span>1. Probar Conexión con Servidor en la Nube</span>
                </button>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    type="button"
                    disabled={syncLoading}
                    onClick={() => handleSyncAction('PUSH_TO_CLOUD')}
                    className="flex items-center justify-center gap-1.5 rounded-lg bg-military-800 px-3 py-2.5 text-xs font-bold text-white hover:bg-military-900"
                  >
                    <CloudUpload className="h-4 w-4" />
                    <span>Subir a Nube (Push)</span>
                  </button>

                  <button
                    type="button"
                    disabled={syncLoading}
                    onClick={() => handleSyncAction('PULL_FROM_CLOUD')}
                    className="flex items-center justify-center gap-1.5 rounded-lg bg-blue-700 px-3 py-2.5 text-xs font-bold text-white hover:bg-blue-800"
                  >
                    <CloudDownload className="h-4 w-4" />
                    <span>Bajar de Nube (Pull)</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 5. Modo Nocturno y Apariencia */}
      {activeTab === 'apariencia' && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-6">
          <div className="flex items-center justify-between p-4 rounded-xl border border-slate-200 bg-slate-50 max-w-xl">
            <div className="flex items-center gap-3">
              <div
                className={`p-2.5 rounded-lg ${
                  isDarkMode ? 'bg-slate-900 text-amber-400' : 'bg-amber-100 text-amber-700'
                }`}
              >
                {isDarkMode ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
              </div>
              <div>
                <span className="font-bold text-xs text-slate-800 block">
                  {isDarkMode ? 'Modo Oscuro (Activado)' : 'Modo Claro (Activado)'}
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

      {/* 6. Copias de Seguridad de Base de Datos */}
      {activeTab === 'respaldos' && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 max-w-3xl">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-5 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 text-military-800 font-bold text-xs uppercase mb-1">
                  <Database className="h-4 w-4" />
                  <span>Base de Datos Completa (.db)</span>
                </div>
                <p className="text-xs text-slate-600 mt-2">
                  Archivo SQLite binario completo (`sivarstock.db`) con todas las tablas relacionales y actas firmadas.
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
                  Exportación completa en JSON de todos los activos, empleados, actas y bitácora.
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

            <div className="rounded-xl border border-rose-200 bg-rose-50/70 p-5 col-span-1 sm:col-span-2">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-rose-100 text-rose-700 shrink-0 mt-0.5">
                  <AlertTriangle className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <h3 className="text-sm font-bold text-rose-900">
                    Zona de Mantenimiento de Datos: Iniciar Inventario Real de Cero
                  </h3>
                  <div className="mt-3">
                    <button
                      onClick={() => setShowPurgeModal(true)}
                      className="flex items-center gap-2 rounded-lg bg-rose-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-rose-700 transition"
                    >
                      <Trash2 className="h-4 w-4" />
                      <span>Limpiar Base de Datos de Prueba</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 7. Personalización de Nombres de Pestañas */}
      {activeTab === 'menu_nombres' && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-slate-900">Personalizar Nombres de Pestañas del Menú</h2>
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
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-800"
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 8. Atajos de la Burbuja Flotante */}
      {activeTab === 'dock_shortcuts' && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-slate-900">Atajos de la Burbuja Flotante para Celular</h2>
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
                  onChange={(e) =>
                    setDockShortcuts({ ...dockShortcuts, left1: { ...dockShortcuts.left1, name: e.target.value } })
                  }
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs mb-2"
                />
                <input
                  type="text"
                  value={dockShortcuts.left1.href}
                  onChange={(e) =>
                    setDockShortcuts({ ...dockShortcuts, left1: { ...dockShortcuts.left1, href: e.target.value } })
                  }
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-mono"
                />
              </div>

              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50">
                <span className="text-xs font-bold text-slate-700 block mb-2">Atajo Izquierdo 2</span>
                <input
                  type="text"
                  value={dockShortcuts.left2.name}
                  onChange={(e) =>
                    setDockShortcuts({ ...dockShortcuts, left2: { ...dockShortcuts.left2, name: e.target.value } })
                  }
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs mb-2"
                />
                <input
                  type="text"
                  value={dockShortcuts.left2.href}
                  onChange={(e) =>
                    setDockShortcuts({ ...dockShortcuts, left2: { ...dockShortcuts.left2, href: e.target.value } })
                  }
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-mono"
                />
              </div>
            </div>

            <div className="p-3 text-center rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-bold text-emerald-800">
              Posición Central: Escáner QR / Barra (Al escanear abre la ficha del producto y permite hacer movimientos inmediatos)
            </div>
          </div>
        </div>
      )}

      {/* Modal de Confirmación de Seguridad: Limpiar Base de Datos */}
      {showPurgeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl space-y-4 border border-rose-200">
            <h3 className="text-base font-black text-rose-900">¿Reiniciar Base de Datos a Cero?</h3>
            <div className="rounded-lg bg-slate-50 border border-slate-200 p-3">
              <label className="block text-xs font-bold text-slate-800 mb-1">
                Escribe <span className="text-rose-600 font-mono">LIMPIAR</span> en mayúsculas:
              </label>
              <input
                type="text"
                placeholder="LIMPIAR"
                value={purgeConfirmText}
                onChange={(e) => setPurgeConfirmText(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-mono font-bold text-slate-900"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  setShowPurgeModal(false);
                  setPurgeConfirmText('');
                }}
                className="rounded-lg px-4 py-2 text-xs font-semibold text-slate-600"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handlePurgeAllData}
                disabled={purging || purgeConfirmText.trim() !== 'LIMPIAR'}
                className="rounded-lg bg-rose-600 px-4 py-2 text-xs font-bold text-white disabled:opacity-50"
              >
                Confirmar y Purgar Todo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
