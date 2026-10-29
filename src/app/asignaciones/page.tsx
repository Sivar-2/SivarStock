'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  UserCheck,
  Search,
  Users,
  Laptop,
  Smartphone,
  Building2,
  QrCode,
  FileText,
  Download,
  Mail,
  Phone,
  ShieldAlert,
  Plus,
  RotateCcw,
  X,
  CheckCircle2,
  AlertCircle,
  UserPlus,
  FileSignature,
  Share2,
  Printer,
  Clock,
  RefreshCw,
  Edit3,
  CreditCard
} from 'lucide-react';
import QrCodeModal from '@/components/QrCodeModal';
import { generateExcelBuffer, generatePdfDoc } from '@/lib/export';

export default function AsignacionesPage() {
  const [employees, setEmployees] = useState<any[]>([]);
  const [inventoryItems, setInventoryItems] = useState<any[]>([]);
  const [mobileDevices, setMobileDevices] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [actas, setActas] = useState<any[]>([]);
  const [issuerConfig, setIssuerConfig] = useState<any>({
    issuerName: 'Alexander Turcios Melendez',
    issuerRole: 'Jefe de IT / Administración de Inventario',
  });
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [filterDept, setFilterDept] = useState('');
  const [activeTab, setActiveTab] = useState<'EMPLEADOS' | 'ACTAS_DIGITALES' | 'CODIGOS'>('EMPLEADOS');
  const [actaStatusFilter, setActaStatusFilter] = useState<'TODAS' | 'FIRMADA' | 'PENDIENTE_FIRMA'>('TODAS');

  const [selectedQrItem, setSelectedQrItem] = useState<any | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Modal: Asignar o Registrar Nuevo Artículo directamente a un Empleado
  const [assignModalEmp, setAssignModalEmp] = useState<any | null>(null);
  const [assignMode, setAssignMode] = useState<'FROM_BODEGA' | 'NEW_ASSET'>('FROM_BODEGA');
  const [selectedBodegaItemId, setSelectedBodegaItemId] = useState('');
  const [bodegaReceiveCondition, setBodegaReceiveCondition] = useState<'NUEVO' | 'USADO_BUEN_ESTADO' | 'USADO_MAL_ESTADO'>('USADO_BUEN_ESTADO');
  const [newAssetForm, setNewAssetForm] = useState({
    productId: '',
    brand: '',
    model: '',
    serialNumber: '',
    macAddress: '',
    imei: '',
    ipAddress: '',
    hostname: '',
    purchasePrice: '',
    supplier: '',
    physicalCondition: 'NUEVO',
    receiveCondition: 'NUEVO',
    notes: '',
  });
  const [submittingAssign, setSubmittingAssign] = useState(false);

  // Modal: Crear / Editar Empleado con DPI y Jefe Inmediato
  const [showNewEmpModal, setShowNewEmpModal] = useState(false);
  const [editingEmp, setEditingEmp] = useState<any | null>(null);
  const [empForm, setEmpForm] = useState({
    employeeCode: '',
    fullName: '',
    dpi: '',
    jobTitle: '',
    email: '',
    phone: '+502 ',
    departmentId: '',
    immediateSupervisorId: '',
    companyName: 'Persiluz / SivarStock',
  });

  // Modal: Generar Acta Digital de Entrega o Cambio de Equipo (Para enviar por WhatsApp / Firmar / Imprimir)
  const [actaModalEmp, setActaModalEmp] = useState<any | null>(null);
  const [actaType, setActaType] = useState<'ENTREGA_INICIAL' | 'CAMBIO_EQUIPO'>('ENTREGA_INICIAL');
  const [actaDpi, setActaDpi] = useState('');
  const [actaNotes, setActaNotes] = useState('');
  const [actaItemsSelection, setActaItemsSelection] = useState<Record<string, { selected: boolean; condition: 'NUEVO' | 'USADO_BUEN_ESTADO' | 'USADO_MAL_ESTADO'; notes: string }>>({});
  const [replacedDeviceInfo, setReplacedDeviceInfo] = useState({ code: '', name: '', serial_number: '' });
  const [creatingActa, setCreatingActa] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [resEmp, resInv, resCel, resCat, resActas] = await Promise.all([
        fetch('/api/employees?all=true'),
        fetch('/api/inventory/items'),
        fetch('/api/celulares'),
        fetch('/api/catalogs'),
        fetch('/api/actas'),
      ]);

      const dataEmp = await resEmp.json();
      const dataInv = await resInv.json();
      const dataCel = await resCel.json();
      const dataCat = await resCat.json();
      const dataActas = await resActas.json();

      setEmployees(dataEmp.employees || []);
      setInventoryItems(dataInv.items || []);
      setMobileDevices(dataCel.devices || []);
      setDepartments(dataCat.departments || []);
      setProducts(dataCat.products || []);
      setActas(dataActas.actas || []);
      if (dataActas.issuerConfig) setIssuerConfig(dataActas.issuerConfig);
    } catch (e) {
      console.error('Error cargando asignaciones:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const availableBodegaItems = inventoryItems.filter((i) => i.operational_status === 'DISPONIBLE');

  const openAssignToEmployeeModal = (emp: any) => {
    setAssignModalEmp(emp);
    setAssignMode(availableBodegaItems.length > 0 ? 'FROM_BODEGA' : 'NEW_ASSET');
    setSelectedBodegaItemId('');
    setBodegaReceiveCondition('USADO_BUEN_ESTADO');
    setNewAssetForm({
      productId: '',
      brand: '',
      model: '',
      serialNumber: '',
      macAddress: '',
      imei: '',
      ipAddress: '',
      hostname: '',
      purchasePrice: '',
      supplier: '',
      physicalCondition: 'NUEVO',
      receiveCondition: 'NUEVO',
      notes: '',
    });
  };

  // Abrir Modal de Generación de Acta Digital (Completa o por Cambio de Dispositivo)
  const openCreateActaModal = (emp: any, mode: 'ENTREGA_INICIAL' | 'CAMBIO_EQUIPO' = 'ENTREGA_INICIAL') => {
    setActaModalEmp(emp);
    setActaType(mode);
    setActaDpi(emp.dpi || '');
    setActaNotes('');
    setReplacedDeviceInfo({ code: '', name: '', serial_number: '' });

    const allEmpDevices = [
      ...(emp.assignedItems || []).map((i: any) => ({
        key: `item-${i.id}`,
        defaultCond: i.physical_condition === 'NUEVO' ? 'NUEVO' : i.physical_condition === 'DANADO' ? 'USADO_MAL_ESTADO' : 'USADO_BUEN_ESTADO',
      })),
      ...(emp.assignedMobiles || []).map((m: any) => ({
        key: `mob-${m.id}`,
        defaultCond: 'USADO_BUEN_ESTADO',
      })),
    ];

    const initMap: Record<string, { selected: boolean; condition: 'NUEVO' | 'USADO_BUEN_ESTADO' | 'USADO_MAL_ESTADO'; notes: string }> = {};
    allEmpDevices.forEach((d, idx) => {
      initMap[d.key] = {
        selected: mode === 'ENTREGA_INICIAL' ? true : idx === 0,
        condition: d.defaultCond as any,
        notes: '',
      };
    });
    setActaItemsSelection(initMap);
  };

  const handleGenerateActa = async (sendWhatsAppAfter: boolean) => {
    if (!actaModalEmp) return;

    const selectedItemsList: any[] = [];

    for (const item of actaModalEmp.assignedItems || []) {
      const sel = actaItemsSelection[`item-${item.id}`];
      if (sel?.selected) {
        selectedItemsList.push({
          id: item.id,
          code: item.permanent_code,
          name: item.product_name,
          brand: item.brand || '',
          model: item.model || '',
          serial_number: item.serial_number || '',
          mac_address: item.mac_address || '',
          imei: item.imei || '',
          receive_condition: sel.condition,
          notes: sel.notes || '',
        });
      }
    }

    for (const mob of actaModalEmp.assignedMobiles || []) {
      const sel = actaItemsSelection[`mob-${mob.id}`];
      if (sel?.selected) {
        selectedItemsList.push({
          id: mob.id,
          code: mob.device_code,
          name: `Celular / Línea ${mob.carrier || 'Corporativa'}`,
          brand: mob.brand || '',
          model: mob.model || '',
          serial_number: mob.serial_number || '',
          mac_address: mob.mac_address || '',
          imei: mob.imei || '',
          phone_number: mob.phone_number || '',
          receive_condition: sel.condition,
          notes: sel.notes || '',
        });
      }
    }

    if (selectedItemsList.length === 0) {
      alert('Selecciona al menos un dispositivo para incluir en el Acta Digital.');
      return;
    }

    setCreatingActa(true);
    try {
      const res = await fetch('/api/actas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          actaType,
          employeeId: actaModalEmp.id,
          employeeCode: actaModalEmp.employee_code,
          employeeName: actaModalEmp.full_name,
          employeeDpi: actaDpi.trim() || null,
          employeeEmail: actaModalEmp.email || null,
          employeePhone: actaModalEmp.phone || null,
          departmentName: actaModalEmp.department_name || 'General',
          supervisorName: actaModalEmp.supervisor_name || null,
          items: selectedItemsList,
          replacedItem:
            actaType === 'CAMBIO_EQUIPO' && (replacedDeviceInfo.code || replacedDeviceInfo.name)
              ? replacedDeviceInfo
              : null,
          notes: actaNotes.trim() || null,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al generar acta');

      const shareUrl = `${window.location.origin}/acta/${data.actaCode}?token=${data.publicToken}`;

      if (sendWhatsAppAfter) {
        const condLabel = (c: string) =>
          c === 'NUEVO' ? 'Nuevo' : c === 'USADO_MAL_ESTADO' ? 'Usado en mal estado' : 'Usado en buen estado';
        const itemsText = selectedItemsList
          .map((i) => `• ${i.name} (${i.code}) - Recibe: ${condLabel(i.receive_condition)}`)
          .join('\n');

        const waMsg =
          `Hola *${actaModalEmp.full_name}*, te comparto tu *${
            actaType === 'CAMBIO_EQUIPO' ? 'Acta por Cambio de Dispositivo' : 'Acta Digital de Entrega de Equipos'
          } (${data.actaCode})* emitida por *${issuerConfig.issuerName}*.\n\n` +
          `*Dispositivos registrados:*\n${itemsText}\n\n` +
          `Por favor ingresa al siguiente enlace para revisarla y firmarla digitalmente desde tu teléfono:\n${shareUrl}`;

        const cleanPhone = (actaModalEmp.phone || '').replace(/[^0-9]/g, '');
        const waUrl = cleanPhone
          ? `https://wa.me/${cleanPhone.startsWith('502') ? cleanPhone : `502${cleanPhone}`}?text=${encodeURIComponent(waMsg)}`
          : `https://wa.me/?text=${encodeURIComponent(waMsg)}`;

        window.open(waUrl, '_blank');
      } else {
        window.open(shareUrl, '_blank');
      }

      setActaModalEmp(null);
      setFeedback({
        type: 'success',
        text: `Acta digital ${data.actaCode} generada y guardada en base de datos.`,
      });
      fetchData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setCreatingActa(false);
    }
  };

  const handleAssignOrCreateForEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignModalEmp) return;
    setSubmittingAssign(true);
    setFeedback(null);

    try {
      if (assignMode === 'FROM_BODEGA') {
        if (!selectedBodegaItemId) {
          setFeedback({ type: 'error', text: 'Seleccione un equipo disponible de Bodega.' });
          setSubmittingAssign(false);
          return;
        }
        const res = await fetch('/api/inventory/assign', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            itemId: selectedBodegaItemId,
            employeeId: assignModalEmp.id,
            targetDepartmentId: assignModalEmp.department_id,
            chargedDepartmentId: assignModalEmp.department_id,
            notes: `${newAssetForm.notes || `Asignado a ${assignModalEmp.full_name}`} [Recibido: ${bodegaReceiveCondition}]`,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          setFeedback({ type: 'error', text: data.error || 'Error al asignar activo.' });
        } else {
          setFeedback({ type: 'success', text: data.message });
          setAssignModalEmp(null);
          fetchData();
        }
      } else {
        if (!newAssetForm.productId) {
          setFeedback({ type: 'error', text: 'Seleccione el tipo de producto/equipo del catálogo.' });
          setSubmittingAssign(false);
          return;
        }
        const mappedCondition =
          newAssetForm.receiveCondition === 'NUEVO'
            ? 'NUEVO'
            : newAssetForm.receiveCondition === 'USADO_MAL_ESTADO'
            ? 'DANADO'
            : 'BUENO';

        const res = await fetch('/api/inventory/items', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            productId: newAssetForm.productId,
            departmentId: assignModalEmp.department_id || 'dept-bod',
            employeeId: assignModalEmp.id,
            brand: newAssetForm.brand,
            model: newAssetForm.model,
            serialNumber: newAssetForm.serialNumber,
            macAddress: newAssetForm.macAddress,
            imei: newAssetForm.imei,
            ipAddress: newAssetForm.ipAddress,
            hostname: newAssetForm.hostname,
            purchasePrice: newAssetForm.purchasePrice,
            supplier: newAssetForm.supplier,
            physicalCondition: mappedCondition,
            notes: newAssetForm.notes || `Equipo registrado en poder de ${assignModalEmp.full_name} (${newAssetForm.receiveCondition})`,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          setFeedback({ type: 'error', text: data.error || 'Error al registrar activo para el empleado.' });
        } else {
          setFeedback({ type: 'success', text: data.message });
          setAssignModalEmp(null);
          fetchData();
        }
      }
    } catch {
      setFeedback({ type: 'error', text: 'Error de red al procesar la asignación.' });
    } finally {
      setSubmittingAssign(false);
    }
  };

  const handleReturnItemToBodega = async (item: any, empName: string) => {
    if (!window.confirm(`¿Desea retornar el activo ${item.permanent_code} (${item.product_name}) de ${empName} a Bodega Central como DISPONIBLE?`)) {
      return;
    }
    try {
      const res = await fetch('/api/inventory/return', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemId: item.id,
          assignmentId: item.permanent_code,
          returnCondition: 'BUENO',
          newDepartmentId: 'dept-bod',
          returnNotes: `Devuelto a Bodega desde expediente de ${empName}`,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setFeedback({ type: 'success', text: data.message });
        fetchData();
      } else {
        setFeedback({ type: 'error', text: data.error || 'Error al devolver equipo.' });
      }
    } catch {
      setFeedback({ type: 'error', text: 'Error de red al devolver equipo.' });
    }
  };

  const handleSaveEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const method = editingEmp ? 'PUT' : 'POST';
      const payload = editingEmp ? { ...empForm, id: editingEmp.id } : empForm;

      const res = await fetch('/api/employees', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok) {
        setFeedback({
          type: 'success',
          text: editingEmp
            ? `Datos de ${empForm.fullName} actualizados correctamente.`
            : `Empleado ${empForm.fullName} (${data.employeeCode}) registrado con éxito.`,
        });
        setShowNewEmpModal(false);
        setEditingEmp(null);
        setEmpForm({
          employeeCode: '',
          fullName: '',
          dpi: '',
          jobTitle: '',
          email: '',
          phone: '+502 ',
          departmentId: '',
          immediateSupervisorId: '',
          companyName: 'Persiluz / SivarStock',
        });
        fetchData();
      } else {
        setFeedback({ type: 'error', text: data.error || 'Error al guardar empleado.' });
      }
    } catch {
      setFeedback({ type: 'error', text: 'Error de conexión.' });
    }
  };

  // Filtrar empleados y cruzar con sus activos asignados, celulares y actas
  const enrichedEmployees = employees
    .filter((emp) => {
      if (filterDept && emp.department_id !== filterDept) return false;
      if (search) {
        const s = search.toLowerCase();
        const matchEmp =
          emp.full_name?.toLowerCase().includes(s) ||
          emp.employee_code?.toLowerCase().includes(s) ||
          emp.dpi?.toLowerCase().includes(s) ||
          emp.email?.toLowerCase().includes(s) ||
          emp.department_name?.toLowerCase().includes(s);

        const empItems = inventoryItems.filter(
          (i) => i.current_employee_id === emp.id || i.assigned_user_email === emp.email
        );
        const matchItem = empItems.some(
          (i) =>
            i.permanent_code?.toLowerCase().includes(s) ||
            i.product_name?.toLowerCase().includes(s) ||
            i.serial_number?.toLowerCase().includes(s) ||
            i.mac_address?.toLowerCase().includes(s) ||
            i.imei?.toLowerCase().includes(s)
        );

        const empMobiles = mobileDevices.filter((m) => m.employee_id === emp.id);
        const matchMobile = empMobiles.some(
          (m) =>
            m.phone_number?.toLowerCase().includes(s) ||
            m.imei?.toLowerCase().includes(s) ||
            m.brand?.toLowerCase().includes(s) ||
            m.model?.toLowerCase().includes(s)
        );

        return matchEmp || matchItem || matchMobile;
      }
      return true;
    })
    .map((emp) => {
      const assignedItems = inventoryItems.filter(
        (i) =>
          (i.current_employee_id === emp.id || (emp.email && i.assigned_user_email === emp.email)) &&
          i.operational_status !== 'DADO_DE_BAJA'
      );
      const assignedMobiles = mobileDevices.filter(
        (m) => m.employee_id === emp.id && m.status !== 'DADO_DE_BAJA'
      );
      const empActas = actas.filter((a) => a.employee_id === emp.id);
      return {
        ...emp,
        assignedItems,
        assignedMobiles,
        empActas,
        totalAssets: assignedItems.length + assignedMobiles.length,
      };
    });

  // Lista plana de todos los activos asignados para exportar
  const allAssignedRecords = enrichedEmployees.flatMap((emp) => [
    ...emp.assignedItems.map((item: any) => ({
      employee_code: emp.employee_code,
      employee_name: emp.full_name,
      employee_dpi: emp.dpi || 'S/R',
      department_name: emp.department_name || 'Sin Área',
      supervisor_name: emp.supervisor_name || 'Directo',
      asset_type: 'EQUIPO / ACTIVO',
      code: item.permanent_code,
      description: `${item.product_name} (${item.brand || ''} ${item.model || ''})`,
      serial_or_imei: [
        item.serial_number ? `S/N:${item.serial_number}` : '',
        item.mac_address ? `MAC:${item.mac_address}` : '',
        item.imei ? `IMEI:${item.imei}` : '',
      ].filter(Boolean).join(' | ') || 'N/A',
      status: item.operational_status,
    })),
    ...emp.assignedMobiles.map((mob: any) => ({
      employee_code: emp.employee_code,
      employee_name: emp.full_name,
      employee_dpi: emp.dpi || 'S/R',
      department_name: emp.department_name || 'Sin Área',
      supervisor_name: emp.supervisor_name || 'Directo',
      asset_type: `CELULAR (${mob.carrier || 'Tigo'})`,
      code: mob.device_code,
      description: `${mob.brand} ${mob.model} • ${mob.phone_number}`,
      serial_or_imei: `IMEI: ${mob.imei}${mob.contract_end_date ? ` | Vence: ${mob.contract_end_date}` : ''}`,
      status: mob.status,
    })),
  ]);

  const exportColumns = [
    { key: 'employee_code', header: 'Cód. Empleado' },
    { key: 'employee_name', header: 'Nombre Completo' },
    { key: 'employee_dpi', header: 'DPI' },
    { key: 'department_name', header: 'Departamento' },
    { key: 'supervisor_name', header: 'Jefe Inmediato' },
    { key: 'asset_type', header: 'Tipo de Equipo' },
    { key: 'code', header: 'Código Activo' },
    { key: 'description', header: 'Descripción / Línea' },
    { key: 'serial_or_imei', header: 'Serie / MAC / IMEI' },
    { key: 'status', header: 'Estado' },
  ];

  const handleExportExcel = () => {
    const buf = generateExcelBuffer('Asignaciones por Empleado', exportColumns, allAssignedRecords);
    const blob = new Blob([buf as any], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `expedientes_empleados_${new Date().toISOString().slice(0, 10)}.xlsx`;
    a.click();
  };

  const handleExportPdf = () => {
    const doc = generatePdfDoc(
      'Expediente de Equipos y Celulares por Empleado',
      'Consolidado de Activos Físicos (Serie/MAC/IMEI), DPI, Jefe Inmediato y Líneas Móviles',
      exportColumns,
      allAssignedRecords
    );
    doc.save(`expedientes_empleados_${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  const totalInventoryCount = inventoryItems.filter((i) => i.operational_status !== 'DADO_DE_BAJA').length;
  const totalAssignedToEmployees = inventoryItems.filter((i) => i.operational_status === 'ASIGNADO').length;
  const signedActasCount = actas.filter((a) => a.status === 'FIRMADA').length;
  const pendingActasCount = actas.filter((a) => a.status === 'PENDIENTE_FIRMA').length;

  const filteredActas = actas.filter((a) => {
    if (actaStatusFilter !== 'TODAS' && a.status !== actaStatusFilter) return false;
    if (search) {
      const s = search.toLowerCase();
      return (
        a.acta_code?.toLowerCase().includes(s) ||
        a.employee_name?.toLowerCase().includes(s) ||
        a.employee_dpi?.toLowerCase().includes(s) ||
        a.department_name?.toLowerCase().includes(s)
      );
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Cabecera */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2.5">
            <UserCheck className="h-7 w-7 text-military-700" />
            Empleados, Equipos Asignados y Actas Digitales (WhatsApp)
          </h1>
          <p className="text-sm text-slate-500">
            Base de datos de empleados con DPI, jefe inmediato, teléfonos y generación de <strong>Actas Digitales con Firma Electrónica</strong>.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleExportExcel}
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-sm"
          >
            <Download className="h-4 w-4 text-emerald-600" /> Excel
          </button>
          <button
            onClick={handleExportPdf}
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-sm"
          >
            <FileText className="h-4 w-4 text-rose-600" /> PDF
          </button>
          <button
            onClick={() => {
              setEditingEmp(null);
              setEmpForm({
                employeeCode: '',
                fullName: '',
                dpi: '',
                jobTitle: '',
                email: '',
                phone: '+502 ',
                departmentId: '',
                immediateSupervisorId: '',
                companyName: 'Persiluz / SivarStock',
              });
              setShowNewEmpModal(true);
            }}
            className="flex items-center gap-1.5 rounded-xl bg-military-700 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-military-800 transition"
          >
            <UserPlus className="h-4 w-4" /> Nuevo Empleado
          </button>
        </div>
      </div>

      {/* Resumen de Integración: Empleados + Actas Firmadas + Inventario Total */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-xs font-bold uppercase text-slate-400">Personal Registrado</div>
          <div className="mt-1 text-2xl font-black text-slate-900">{employees.length}</div>
          <div className="mt-1 text-[11px] text-slate-500">
            {enrichedEmployees.filter((e) => e.totalAssets > 0).length} con equipos a cargo
          </div>
        </div>

        <div className="rounded-2xl border border-sky-200 bg-sky-50/40 p-4 shadow-sm">
          <div className="text-xs font-bold uppercase text-sky-700">Equipos en Empleados</div>
          <div className="mt-1 text-2xl font-black text-sky-900">{totalAssignedToEmployees}</div>
          <div className="mt-1 text-[11px] text-sky-700">De {totalInventoryCount} en Inventario Total</div>
        </div>

        <div
          onClick={() => {
            setActiveTab('ACTAS_DIGITALES');
            setActaStatusFilter('FIRMADA');
          }}
          className="cursor-pointer rounded-2xl border border-emerald-200 bg-emerald-50/40 p-4 shadow-sm hover:border-emerald-400 transition"
        >
          <div className="text-xs font-bold uppercase text-emerald-700">Actas Firmadas</div>
          <div className="mt-1 text-2xl font-black text-emerald-900">{signedActasCount}</div>
          <div className="mt-1 text-[11px] text-emerald-700">Firmadas digitalmente ✓</div>
        </div>

        <div
          onClick={() => {
            setActiveTab('ACTAS_DIGITALES');
            setActaStatusFilter('PENDIENTE_FIRMA');
          }}
          className="cursor-pointer rounded-2xl border border-amber-200 bg-amber-50/50 p-4 shadow-sm hover:border-amber-400 transition"
        >
          <div className="text-xs font-bold uppercase text-amber-800">Pendientes de Firma</div>
          <div className="mt-1 text-2xl font-black text-amber-900">{pendingActasCount}</div>
          <div className="mt-1 text-[11px] text-amber-700">Enviadas por WhatsApp</div>
        </div>
      </div>

      {feedback && (
        <div
          className={`flex items-center justify-between rounded-xl border p-4 text-sm font-medium ${
            feedback.type === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border-rose-200 bg-rose-50 text-rose-800'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            ) : (
              <AlertCircle className="h-5 w-5 text-rose-600" />
            )}
            <span>{feedback.text}</span>
          </div>
          <button onClick={() => setFeedback(null)}>
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Pestañas de Vista y Filtros */}
      <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setActiveTab('EMPLEADOS')}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition ${
              activeTab === 'EMPLEADOS'
                ? 'bg-military-700 text-white shadow'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <Users className="h-4 w-4" /> Expedientes por Empleado ({enrichedEmployees.length})
          </button>
          <button
            onClick={() => setActiveTab('ACTAS_DIGITALES')}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition ${
              activeTab === 'ACTAS_DIGITALES'
                ? 'bg-military-700 text-white shadow'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <FileSignature className="h-4 w-4" /> Actas Digitales Firmadas / Pendientes ({actas.length})
          </button>
          <button
            onClick={() => setActiveTab('CODIGOS')}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition ${
              activeTab === 'CODIGOS'
                ? 'bg-military-700 text-white shadow'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <QrCode className="h-4 w-4" /> Etiquetas QR ({allAssignedRecords.length})
          </button>
        </div>

        <div className="flex flex-1 max-w-xl gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por empleado, DPI, código SIV, serie, MAC, IMEI..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl border border-slate-200 pl-10 pr-4 py-2 text-sm focus:border-military-600 focus:outline-none"
            />
          </div>

          <select
            value={filterDept}
            onChange={(e) => setFilterDept(e.target.value)}
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-military-600 focus:outline-none"
          >
            <option value="">Todas las Áreas</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* VISTA 1: Expediente de Equipos por Empleado */}
      {activeTab === 'EMPLEADOS' && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {loading ? (
            <div className="col-span-2 py-12 text-center text-slate-400">
              Cargando expedientes de personal...
            </div>
          ) : enrichedEmployees.length === 0 ? (
            <div className="col-span-2 py-12 text-center text-slate-400">
              No se encontraron empleados con estos criterios.
            </div>
          ) : (
            enrichedEmployees.map((emp) => (
              <div
                key={emp.id}
                className={`rounded-2xl border p-5 shadow-sm transition ${
                  emp.status === 'RETIRADO'
                    ? 'border-rose-200 bg-rose-50/30'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                {/* Cabecera del Empleado */}
                <div className="flex items-start justify-between border-b border-slate-100 pb-3.5 gap-2">
                  <div className="flex items-start gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-military-800 text-sm font-bold text-emerald-400">
                      {emp.initials}
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-mono text-[11px] font-bold text-military-700 bg-military-50 px-2 py-0.5 rounded">
                          {emp.employee_code}
                        </span>
                        {emp.dpi && (
                          <span className="font-mono text-[11px] font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded flex items-center gap-1">
                            <CreditCard className="h-3 w-3 text-slate-500" /> DPI: {emp.dpi}
                          </span>
                        )}
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                            emp.status === 'ACTIVO'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {emp.status}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <h3 className="text-base font-bold text-slate-900">{emp.full_name}</h3>
                        <button
                          onClick={() => {
                            setEditingEmp(emp);
                            setEmpForm({
                              employeeCode: emp.employee_code || '',
                              fullName: emp.full_name || '',
                              dpi: emp.dpi || '',
                              jobTitle: emp.job_title || '',
                              email: emp.email || '',
                              phone: emp.phone || '+502 ',
                              departmentId: emp.department_id || '',
                              immediateSupervisorId: emp.immediate_supervisor_id || '',
                              companyName: emp.company_name || 'Persiluz / SivarStock',
                            });
                            setShowNewEmpModal(true);
                          }}
                          className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                          title="Editar DPI, Jefe Inmediato o teléfono del empleado"
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                        </button>
                      </div>

                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 mt-0.5">
                        <span className="flex items-center gap-1 font-medium text-slate-700">
                          <Building2 className="h-3.5 w-3.5 text-slate-400" />
                          {emp.department_name || 'Sin departamento'}
                        </span>
                        {emp.supervisor_name && (
                          <span className="text-slate-600 font-medium">
                            • Jefe: <strong>{emp.supervisor_name}</strong>
                          </span>
                        )}
                        {emp.email && (
                          <span className="flex items-center gap-1">
                            <Mail className="h-3 w-3 text-slate-400" />
                            {emp.email}
                          </span>
                        )}
                        {emp.phone && (
                          <span className="flex items-center gap-1">
                            <Phone className="h-3 w-3 text-slate-400" />
                            {emp.phone}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-1.5 shrink-0">
                    <div className="text-right">
                      <span className="text-[10px] font-bold text-slate-400 uppercase block">Equipos</span>
                      <span className="text-xl font-black text-military-800">{emp.totalAssets}</span>
                    </div>
                    {emp.status === 'ACTIVO' && (
                      <button
                        onClick={() => openAssignToEmployeeModal(emp)}
                        className="inline-flex items-center gap-1 rounded-lg bg-military-700 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-military-800 transition shadow-sm"
                      >
                        <Plus className="h-3 w-3" /> Agregar Equipo
                      </button>
                    )}
                  </div>
                </div>

                {/* Equipos de Inventario Físico Asignados */}
                <div className="mt-3.5 space-y-2.5">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                    <Laptop className="h-3.5 w-3.5 text-slate-500" />
                    Equipos y Activos Físicos ({emp.assignedItems.length})
                  </div>

                  {emp.assignedItems.length === 0 ? (
                    <p className="text-xs italic text-slate-400 pl-5">Sin equipos de cómputo o mobiliario asignado.</p>
                  ) : (
                    <div className="space-y-1.5">
                      {emp.assignedItems.map((item: any) => (
                        <div
                          key={item.id}
                          className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 text-xs border border-slate-100"
                        >
                          <div>
                            <span className="font-mono font-bold text-military-800">{item.permanent_code}</span>
                            <span className="mx-1.5 text-slate-300">•</span>
                            <span className="font-semibold text-slate-800">{item.product_name}</span>
                            <div className="text-[11px] text-slate-500 font-mono">
                              {item.brand} {item.model}
                              {item.serial_number ? ` | S/N: ${item.serial_number}` : ''}
                              {item.mac_address ? ` | MAC: ${item.mac_address}` : ''}
                              {item.imei ? ` | IMEI: ${item.imei}` : ''}
                            </div>
                          </div>

                          <div className="flex items-center gap-1">
                            <button
                              onClick={() =>
                                setSelectedQrItem({
                                  permanentCode: item.permanent_code,
                                  productName: item.product_name,
                                  brand: item.brand,
                                  model: item.model,
                                  serialNumber: item.serial_number,
                                  departmentName: emp.department_name || 'General',
                                })
                              }
                              className="rounded-lg p-1.5 text-slate-500 hover:bg-white hover:text-military-700 shadow-sm border border-transparent hover:border-slate-200"
                              title="Ver código QR del activo"
                            >
                              <QrCode className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleReturnItemToBodega(item, emp.full_name)}
                              className="rounded-lg p-1.5 text-amber-600 hover:bg-amber-50"
                              title="Retornar equipo a Bodega Central"
                            >
                              <RotateCcw className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Celulares Corporativos Asignados */}
                  <div className="pt-2 text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                    <Smartphone className="h-3.5 w-3.5 text-emerald-600" />
                    Celulares y Líneas Móviles ({emp.assignedMobiles.length})
                  </div>

                  {emp.assignedMobiles.length === 0 ? (
                    <p className="text-xs italic text-slate-400 pl-5">Sin línea móvil corporativa asignada.</p>
                  ) : (
                    <div className="space-y-1.5">
                      {emp.assignedMobiles.map((mob: any) => (
                        <div
                          key={mob.id}
                          className="flex items-center justify-between rounded-xl bg-emerald-50/50 px-3 py-2 text-xs border border-emerald-100"
                        >
                          <div>
                            <span className="font-mono font-bold text-emerald-800">{mob.device_code}</span>
                            <span className="mx-1.5 text-emerald-300">•</span>
                            <span className="font-semibold text-slate-900">
                              {mob.brand} {mob.model} ({mob.carrier || 'Tigo'})
                            </span>
                            <div className="text-[11px] text-emerald-700 font-medium">
                              Línea: {mob.phone_number} • IMEI: <span className="font-mono">{mob.imei}</span>
                              {mob.contract_end_date && ` • Vence: ${mob.contract_end_date}`}
                            </div>
                          </div>
                          <span className="text-[10px] font-bold text-emerald-700 bg-white px-2 py-0.5 rounded border border-emerald-200">
                            {mob.delivery_date}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Barra Inferior de Actas Digitales y Envío por WhatsApp */}
                <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-[11px]">
                    {emp.empActas?.some((a: any) => a.status === 'FIRMADA') ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 font-bold text-emerald-800">
                        <CheckCircle2 className="h-3 w-3" />{' '}
                        {emp.empActas.filter((a: any) => a.status === 'FIRMADA').length} Acta(s) Firmada(s)
                      </span>
                    ) : emp.empActas?.some((a: any) => a.status === 'PENDIENTE_FIRMA') ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 font-bold text-amber-800">
                        <Clock className="h-3 w-3" /> Pendiente de Firma
                      </span>
                    ) : (
                      <span className="text-slate-400">Sin acta digital emitida</span>
                    )}
                  </div>

                  {emp.totalAssets > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => openCreateActaModal(emp, 'ENTREGA_INICIAL')}
                        className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1.5 text-[11px] font-bold text-white hover:bg-emerald-700 shadow-sm transition"
                      >
                        <Share2 className="h-3 w-3" />
                        <span>Acta Digital / WhatsApp</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => openCreateActaModal(emp, 'CAMBIO_EQUIPO')}
                        className="inline-flex items-center gap-1 rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-1.5 text-[11px] font-bold text-amber-900 hover:bg-amber-100 transition"
                        title="Generar acta únicamente por el dispositivo que se cambió"
                      >
                        <RefreshCw className="h-3 w-3" />
                        <span>Acta Cambio Equipo</span>
                      </button>
                    </div>
                  )}
                </div>

                {emp.status === 'RETIRADO' && (
                  <div className="mt-3 rounded-xl bg-rose-100/80 p-2.5 text-xs text-rose-800 flex items-center gap-2">
                    <ShieldAlert className="h-4 w-4 shrink-0 text-rose-600" />
                    <div>
                      <strong>Baja el {emp.exit_date}:</strong> {emp.exit_reason || 'Retiro de la empresa'}
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* VISTA 2: Control de Actas Digitales (Quién ha firmado y quién no, ver e imprimir desde el celular) */}
      {activeTab === 'ACTAS_DIGITALES' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-600">Filtrar por estado de firma:</span>
              {[
                { id: 'TODAS', label: `Todas (${actas.length})` },
                { id: 'FIRMADA', label: `Firmadas (${signedActasCount})` },
                { id: 'PENDIENTE_FIRMA', label: `Pendientes de Firma (${pendingActasCount})` },
              ].map((st) => (
                <button
                  key={st.id}
                  onClick={() => setActaStatusFilter(st.id as any)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                    actaStatusFilter === st.id
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {st.label}
                </button>
              ))}
            </div>

            <div className="text-xs text-slate-500">
              Responsable de entrega actual: <strong className="text-slate-900">{issuerConfig.issuerName}</strong>{' '}
              <Link href="/configuracion" className="text-military-700 font-bold hover:underline ml-1">
                (Cambiar en Ajustes)
              </Link>
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-200 bg-slate-50 font-bold uppercase text-slate-600">
                  <tr>
                    <th className="px-4 py-3.5">Código Acta</th>
                    <th className="px-4 py-3.5">Tipo</th>
                    <th className="px-4 py-3.5">Empleado Receptor / DPI</th>
                    <th className="px-4 py-3.5">Dispositivos Incluidos</th>
                    <th className="px-4 py-3.5">Entregado Por</th>
                    <th className="px-4 py-3.5">Estado de Firma</th>
                    <th className="px-4 py-3.5 text-right">Acciones (WhatsApp / Imprimir)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredActas.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-400">
                        No hay actas digitales registradas con este filtro.
                      </td>
                    </tr>
                  ) : (
                    filteredActas.map((acta) => (
                      <tr key={acta.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 font-mono font-black text-military-800">
                          {acta.acta_code}
                          <div className="text-[10px] font-normal text-slate-400">
                            {new Date(acta.delivery_date).toLocaleDateString('es-GT')}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                              acta.acta_type === 'CAMBIO_EQUIPO'
                                ? 'bg-amber-100 text-amber-900'
                                : 'bg-blue-100 text-blue-900'
                            }`}
                          >
                            {acta.acta_type === 'CAMBIO_EQUIPO' ? 'Cambio de Equipo' : 'Entrega General'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-bold text-slate-900">{acta.employee_name}</div>
                          <div className="font-mono text-[11px] text-slate-500">
                            DPI: {acta.employee_dpi || 'Pendiente'} • {acta.department_name || 'General'}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="space-y-0.5">
                            {(acta.items || []).map((it: any, idx: number) => (
                              <div key={idx} className="text-[11px] text-slate-700">
                                <span className="font-mono font-bold">{it.code}</span>: {it.name} (
                                <span className="font-semibold">
                                  {it.receive_condition === 'NUEVO'
                                    ? 'Nuevo'
                                    : it.receive_condition === 'USADO_MAL_ESTADO'
                                    ? 'Usado mal estado'
                                    : 'Usado buen estado'}
                                </span>
                                )
                              </div>
                            ))}
                          </div>
                        </td>
                        <td className="px-4 py-3 font-semibold text-slate-800">{acta.delivered_by_name}</td>
                        <td className="px-4 py-3">
                          {acta.status === 'FIRMADA' ? (
                            <div>
                              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-black text-emerald-800">
                                <CheckCircle2 className="h-3 w-3" /> FIRMADA
                              </span>
                              {acta.signed_at && (
                                <div className="text-[10px] text-slate-400 mt-0.5">
                                  {new Date(acta.signed_at).toLocaleString('es-GT')}
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-[10px] font-black text-amber-800">
                              <Clock className="h-3 w-3" /> PENDIENTE DE FIRMA
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <Link
                              href={`/acta/${acta.acta_code}?token=${acta.public_token}`}
                              className="inline-flex items-center gap-1 rounded-lg bg-slate-900 px-2.5 py-1.5 text-[11px] font-bold text-white hover:bg-slate-800"
                            >
                              <Printer className="h-3 w-3" />
                              <span>{acta.status === 'FIRMADA' ? 'Ver / Imprimir' : 'Ver / Firmar'}</span>
                            </Link>
                            <button
                              type="button"
                              onClick={() => {
                                const shareUrl = `${window.location.origin}/acta/${acta.acta_code}?token=${acta.public_token}`;
                                const text = `Hola *${acta.employee_name}*, aquí tienes tu Acta Digital de Entrega *${acta.acta_code}* emitida por *${acta.delivered_by_name}* para revisarla y firmarla:\n${shareUrl}`;
                                const cleanPhone = (acta.employee_phone || '').replace(/[^0-9]/g, '');
                                const waUrl = cleanPhone
                                  ? `https://wa.me/${cleanPhone.startsWith('502') ? cleanPhone : `502${cleanPhone}`}?text=${encodeURIComponent(text)}`
                                  : `https://wa.me/?text=${encodeURIComponent(text)}`;
                                window.open(waUrl, '_blank');
                              }}
                              className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1.5 text-[11px] font-bold text-white hover:bg-emerald-700"
                            >
                              <Share2 className="h-3 w-3" />
                              <span>WhatsApp</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* VISTA 3: Tabla Consolidada de Códigos QR */}
      {activeTab === 'CODIGOS' && (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs font-bold uppercase text-slate-600">
                <tr>
                  <th className="px-4 py-3.5">Empleado</th>
                  <th className="px-4 py-3.5">Área</th>
                  <th className="px-4 py-3.5">Tipo</th>
                  <th className="px-4 py-3.5">Código Activo</th>
                  <th className="px-4 py-3.5">Equipo / Descripción</th>
                  <th className="px-4 py-3.5">Serie / MAC / IMEI</th>
                  <th className="px-4 py-3.5 text-right">Etiqueta QR</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {allAssignedRecords.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-10 text-center text-slate-400">
                      No hay registros de activos asignados.
                    </td>
                  </tr>
                ) : (
                  allAssignedRecords.map((rec, idx) => (
                    <tr key={idx} className="hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-900">{rec.employee_name}</div>
                        <div className="font-mono text-xs text-slate-500">
                          {rec.employee_code} • DPI: {rec.employee_dpi}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs font-medium text-slate-600">{rec.department_name}</td>
                      <td className="px-4 py-3">
                        <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-bold text-slate-700">
                          {rec.asset_type}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs font-bold text-military-800">{rec.code}</td>
                      <td className="px-4 py-3 font-medium text-slate-800">{rec.description}</td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-600">{rec.serial_or_imei}</td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() =>
                            setSelectedQrItem({
                              permanentCode: rec.code,
                              productName: rec.description,
                              brand: rec.asset_type,
                              model: '',
                              serialNumber: rec.serial_or_imei,
                              departmentName: rec.department_name,
                            })
                          }
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                        >
                          <QrCode className="h-3.5 w-3.5 text-military-700" /> QR
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL GENERAR ACTA DIGITAL DE ENTREGA O CAMBIO DE DISPOSITIVO (WHATSAPP / FIRMA) */}
      {actaModalEmp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl max-h-[92vh] overflow-y-auto">
            <div className="flex items-start justify-between border-b border-slate-100 pb-4">
              <div>
                <span className="font-mono text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                  ACTA DIGITAL CON FIRMA ELECTRÓNICA
                </span>
                <h2 className="text-lg font-bold text-slate-900 mt-1">
                  {actaType === 'CAMBIO_EQUIPO'
                    ? `Acta por Cambio de Dispositivo — ${actaModalEmp.full_name}`
                    : `Acta de Entrega de Equipos — ${actaModalEmp.full_name}`}
                </h2>
                <p className="text-xs text-slate-500">
                  Entregado por: <strong>{issuerConfig.issuerName}</strong> • Fecha automática:{' '}
                  <strong>{new Date().toLocaleDateString('es-GT')}</strong>
                </p>
              </div>
              <button onClick={() => setActaModalEmp(null)} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-4 space-y-4">
              {/* Selector de Tipo de Acta */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => openCreateActaModal(actaModalEmp, 'ENTREGA_INICIAL')}
                  className={`rounded-xl border p-3 text-left text-xs transition ${
                    actaType === 'ENTREGA_INICIAL'
                      ? 'border-military-700 bg-military-50/70 font-bold text-military-900'
                      : 'border-slate-200 bg-white text-slate-600'
                  }`}
                >
                  <div className="font-black">1. Acta de Entrega General</div>
                  <div className="text-[11px] opacity-80">Incluye todos los dispositivos entregados al empleado</div>
                </button>
                <button
                  type="button"
                  onClick={() => openCreateActaModal(actaModalEmp, 'CAMBIO_EQUIPO')}
                  className={`rounded-xl border p-3 text-left text-xs transition ${
                    actaType === 'CAMBIO_EQUIPO'
                      ? 'border-amber-600 bg-amber-50 font-bold text-amber-900'
                      : 'border-slate-200 bg-white text-slate-600'
                  }`}
                >
                  <div className="font-black">2. Acta por Cambio de Dispositivo</div>
                  <div className="text-[11px] opacity-80">Muestra únicamente el dispositivo que se cambió</div>
                </button>
              </div>

              {/* Datos de Identificación del Empleado (DPI) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 rounded-xl bg-slate-50 p-3.5 border border-slate-200 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Nombre Completo del Empleado</label>
                  <input
                    type="text"
                    disabled
                    value={actaModalEmp.full_name}
                    className="w-full rounded-lg border border-slate-200 bg-slate-100 px-3 py-1.5 font-bold text-slate-800"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Número de DPI del Empleado *</label>
                  <input
                    type="text"
                    placeholder="Ej. 2456 78901 0101"
                    value={actaDpi}
                    onChange={(e) => setActaDpi(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 font-mono font-bold text-slate-900 focus:border-military-700 focus:outline-none"
                  />
                </div>
              </div>

              {/* Si es Acta por Cambio de Equipo, permitir anotar qué equipo anterior fue reemplazado */}
              {actaType === 'CAMBIO_EQUIPO' && (
                <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-3.5 space-y-2 text-xs">
                  <span className="font-bold text-amber-900 block">
                    Datos del Dispositivo Anterior que se Reemplazó / Cambió (Opcional):
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <input
                      type="text"
                      placeholder="Código ant. (ej. SIV-IT-0001)"
                      value={replacedDeviceInfo.code}
                      onChange={(e) => setReplacedDeviceInfo({ ...replacedDeviceInfo, code: e.target.value })}
                      className="rounded-lg border border-amber-300 bg-white px-2.5 py-1.5 font-mono"
                    />
                    <input
                      type="text"
                      placeholder="Equipo ant. (ej. Laptop HP)"
                      value={replacedDeviceInfo.name}
                      onChange={(e) => setReplacedDeviceInfo({ ...replacedDeviceInfo, name: e.target.value })}
                      className="rounded-lg border border-amber-300 bg-white px-2.5 py-1.5"
                    />
                    <input
                      type="text"
                      placeholder="Serie / IMEI anterior"
                      value={replacedDeviceInfo.serial_number}
                      onChange={(e) => setReplacedDeviceInfo({ ...replacedDeviceInfo, serial_number: e.target.value })}
                      className="rounded-lg border border-amber-300 bg-white px-2.5 py-1.5 font-mono"
                    />
                  </div>
                </div>
              )}

              {/* Selección de Dispositivos y Situación en que Reciben el Producto */}
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-2">
                  Selecciona los dispositivos a incluir y en qué situación los recibe el empleado:
                </label>

                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {(actaModalEmp.assignedItems || []).map((item: any) => {
                    const key = `item-${item.id}`;
                    const state = actaItemsSelection[key] || { selected: true, condition: 'USADO_BUEN_ESTADO', notes: '' };
                    return (
                      <div
                        key={key}
                        className={`flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-xl border p-3 text-xs ${
                          state.selected ? 'border-military-600 bg-military-50/30' : 'border-slate-200 bg-slate-50 opacity-60'
                        }`}
                      >
                        <label className="flex items-start gap-2.5 cursor-pointer flex-1">
                          <input
                            type="checkbox"
                            checked={state.selected}
                            onChange={(e) =>
                              setActaItemsSelection({
                                ...actaItemsSelection,
                                [key]: { ...state, selected: e.target.checked },
                              })
                            }
                            className="mt-0.5 h-4 w-4 rounded border-slate-300 text-military-800"
                          />
                          <div>
                            <div className="font-bold text-slate-900">
                              <span className="font-mono text-military-800">{item.permanent_code}</span> — {item.product_name}
                            </div>
                            <div className="font-mono text-[11px] text-slate-500">
                              {item.brand} {item.model} {item.serial_number ? `• S/N: ${item.serial_number}` : ''}
                            </div>
                          </div>
                        </label>

                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-semibold text-slate-600">Recibe:</span>
                          <select
                            value={state.condition}
                            onChange={(e) =>
                              setActaItemsSelection({
                                ...actaItemsSelection,
                                [key]: { ...state, condition: e.target.value as any },
                              })
                            }
                            className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-900"
                          >
                            <option value="NUEVO">Nuevo</option>
                            <option value="USADO_BUEN_ESTADO">Usado en buen estado</option>
                            <option value="USADO_MAL_ESTADO">Usado en mal estado</option>
                          </select>
                        </div>
                      </div>
                    );
                  })}

                  {(actaModalEmp.assignedMobiles || []).map((mob: any) => {
                    const key = `mob-${mob.id}`;
                    const state = actaItemsSelection[key] || { selected: true, condition: 'USADO_BUEN_ESTADO', notes: '' };
                    return (
                      <div
                        key={key}
                        className={`flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-xl border p-3 text-xs ${
                          state.selected ? 'border-emerald-600 bg-emerald-50/30' : 'border-slate-200 bg-slate-50 opacity-60'
                        }`}
                      >
                        <label className="flex items-start gap-2.5 cursor-pointer flex-1">
                          <input
                            type="checkbox"
                            checked={state.selected}
                            onChange={(e) =>
                              setActaItemsSelection({
                                ...actaItemsSelection,
                                [key]: { ...state, selected: e.target.checked },
                              })
                            }
                            className="mt-0.5 h-4 w-4 rounded border-slate-300 text-emerald-700"
                          />
                          <div>
                            <div className="font-bold text-slate-900">
                              <span className="font-mono text-emerald-800">{mob.device_code}</span> — Celular {mob.brand} {mob.model}
                            </div>
                            <div className="font-mono text-[11px] text-slate-500">
                              Línea: {mob.phone_number} • IMEI: {mob.imei}
                            </div>
                          </div>
                        </label>

                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-semibold text-slate-600">Recibe:</span>
                          <select
                            value={state.condition}
                            onChange={(e) =>
                              setActaItemsSelection({
                                ...actaItemsSelection,
                                [key]: { ...state, condition: e.target.value as any },
                              })
                            }
                            className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-900"
                          >
                            <option value="NUEVO">Nuevo</option>
                            <option value="USADO_BUEN_ESTADO">Usado en buen estado</option>
                            <option value="USADO_MAL_ESTADO">Usado en mal estado</option>
                          </select>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Observaciones de Entrega (Cargador original, estuche, detalles estéticos, etc.):
                </label>
                <input
                  type="text"
                  placeholder="Ej. Se entrega con cargador original y maletín..."
                  value={actaNotes}
                  onChange={(e) => setActaNotes(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs"
                />
              </div>

              {/* Previsualización de Nota Legal */}
              <div className="rounded-xl bg-slate-50 p-3 border border-slate-200 text-[11px] text-slate-600 italic">
                &ldquo;Al firmar este documento, acepto los términos de entrega, la nota de confidencialidad y consiento el uso de la firma electrónica. Automáticamente recibirá una copia de este documento firmado en su correo electrónico. Si requiere una copia física, este documento digital puede ser impreso en cualquier momento.&rdquo;
              </div>

              <div className="flex flex-wrap justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setActaModalEmp(null)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={creatingActa}
                  onClick={() => handleGenerateActa(false)}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-slate-800 disabled:opacity-50"
                >
                  <Printer className="h-4 w-4" />
                  <span>Generar y Firmar / Imprimir Aquí</span>
                </button>
                <button
                  type="button"
                  disabled={creatingActa}
                  onClick={() => handleGenerateActa(true)}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-md hover:bg-emerald-700 disabled:opacity-50"
                >
                  <Share2 className="h-4 w-4" />
                  <span>Generar y Enviar por WhatsApp</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Asignar de Bodega o Registrar Nuevo Artículo en Poder del Empleado */}
      {assignModalEmp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <span className="font-mono text-xs font-bold text-military-700">{assignModalEmp.employee_code}</span>
                <h2 className="text-lg font-bold text-slate-900">
                  Agregar / Asignar Equipo a {assignModalEmp.full_name}
                </h2>
                <p className="text-xs text-slate-500">
                  El artículo quedará vinculado al expediente del empleado y sumado al Inventario Total de la empresa.
                </p>
              </div>
              <button onClick={() => setAssignModalEmp(null)} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-4 flex gap-2 border-b border-slate-100 pb-3">
              <button
                type="button"
                onClick={() => setAssignMode('FROM_BODEGA')}
                className={`flex-1 rounded-xl px-3 py-2 text-xs font-bold transition ${
                  assignMode === 'FROM_BODEGA'
                    ? 'bg-military-700 text-white shadow'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                1. Asignar Existente de Bodega ({availableBodegaItems.length})
              </button>
              <button
                type="button"
                onClick={() => setAssignMode('NEW_ASSET')}
                className={`flex-1 rounded-xl px-3 py-2 text-xs font-bold transition ${
                  assignMode === 'NEW_ASSET'
                    ? 'bg-military-700 text-white shadow'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                2. Registrar Nuevo Equipo Directo al Empleado (+ Inventario Total)
              </button>
            </div>

            <form onSubmit={handleAssignOrCreateForEmployee} className="mt-4 space-y-4">
              {assignMode === 'FROM_BODEGA' ? (
                <div className="space-y-3">
                  <div>
                    <label className="mb-1 block text-xs font-bold text-slate-700">
                      Seleccionar Equipo Disponible en Bodega *
                    </label>
                    <select
                      required
                      value={selectedBodegaItemId}
                      onChange={(e) => setSelectedBodegaItemId(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                    >
                      <option value="">— Seleccione un activo disponible —</option>
                      {availableBodegaItems.map((bi) => (
                        <option key={bi.id} value={bi.id}>
                          {bi.permanent_code} • {bi.product_name} ({bi.brand} {bi.model}) {bi.serial_number ? `- S/N: ${bi.serial_number}` : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-bold text-slate-700">
                      Situación en que el empleado recibe el producto *
                    </label>
                    <select
                      value={bodegaReceiveCondition}
                      onChange={(e) => setBodegaReceiveCondition(e.target.value as any)}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold text-slate-800"
                    >
                      <option value="NUEVO">Nuevo</option>
                      <option value="USADO_BUEN_ESTADO">Usado en buen estado</option>
                      <option value="USADO_MAL_ESTADO">Usado en mal estado</option>
                    </select>
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-bold text-slate-700">
                      Notas de Entrega / Observaciones
                    </label>
                    <input
                      type="text"
                      value={newAssetForm.notes}
                      onChange={(e) => setNewAssetForm({ ...newAssetForm, notes: e.target.value })}
                      placeholder="Ej. Entregado con cargador original y maletín..."
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                    />
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div className="sm:col-span-2">
                    <label className="mb-1 block text-xs font-bold text-slate-700">Producto del Catálogo *</label>
                    <select
                      required
                      value={newAssetForm.productId}
                      onChange={(e) => {
                        const prod = products.find((p) => p.id === e.target.value);
                        setNewAssetForm({
                          ...newAssetForm,
                          productId: e.target.value,
                          brand: prod?.brand || newAssetForm.brand,
                          model: prod?.model || newAssetForm.model,
                        });
                      }}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                    >
                      <option value="">Seleccionar producto...</option>
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.code} - {p.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-bold text-slate-700">Situación en que Recibe *</label>
                    <select
                      value={newAssetForm.receiveCondition}
                      onChange={(e) => setNewAssetForm({ ...newAssetForm, receiveCondition: e.target.value })}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold"
                    >
                      <option value="NUEVO">Nuevo</option>
                      <option value="USADO_BUEN_ESTADO">Usado en buen estado</option>
                      <option value="USADO_MAL_ESTADO">Usado en mal estado</option>
                    </select>
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-bold text-slate-700">Marca</label>
                    <input
                      type="text"
                      value={newAssetForm.brand}
                      onChange={(e) => setNewAssetForm({ ...newAssetForm, brand: e.target.value })}
                      placeholder="Dell, HP, Apple..."
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-bold text-slate-700">Modelo</label>
                    <input
                      type="text"
                      value={newAssetForm.model}
                      onChange={(e) => setNewAssetForm({ ...newAssetForm, model: e.target.value })}
                      placeholder="Latitude 5440..."
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-bold text-slate-700">Número de Serie (S/N)</label>
                    <input
                      type="text"
                      value={newAssetForm.serialNumber}
                      onChange={(e) => setNewAssetForm({ ...newAssetForm, serialNumber: e.target.value })}
                      placeholder="SN-987654321"
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 font-mono text-sm"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-bold text-slate-700">Dirección MAC</label>
                    <input
                      type="text"
                      value={newAssetForm.macAddress}
                      onChange={(e) => setNewAssetForm({ ...newAssetForm, macAddress: e.target.value })}
                      placeholder="00:1A:2B:3C:4D:5E"
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 font-mono text-sm"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-bold text-slate-700">IMEI (si aplica)</label>
                    <input
                      type="text"
                      value={newAssetForm.imei}
                      onChange={(e) => setNewAssetForm({ ...newAssetForm, imei: e.target.value })}
                      placeholder="35489110..."
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 font-mono text-sm"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-bold text-slate-700">Valor Compra (Q)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={newAssetForm.purchasePrice}
                      onChange={(e) => setNewAssetForm({ ...newAssetForm, purchasePrice: e.target.value })}
                      placeholder="0.00"
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                    />
                  </div>

                  <div className="sm:col-span-3">
                    <label className="mb-1 block text-xs font-bold text-slate-700">Notas / Especificaciones</label>
                    <input
                      type="text"
                      value={newAssetForm.notes}
                      onChange={(e) => setNewAssetForm({ ...newAssetForm, notes: e.target.value })}
                      placeholder="Core i7, 16GB RAM, cargador incluido..."
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                    />
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
                <button
                  type="button"
                  onClick={() => setAssignModalEmp(null)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submittingAssign}
                  className="rounded-xl bg-military-700 px-5 py-2 text-xs font-bold text-white hover:bg-military-800 disabled:opacity-50"
                >
                  {submittingAssign
                    ? 'Procesando...'
                    : assignMode === 'FROM_BODEGA'
                    ? 'Asignar al Empleado'
                    : 'Registrar en Empleado y Sumar a Inventario Total'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Crear / Editar Empleado (Con DPI y Jefe Inmediato) */}
      {showNewEmpModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-lg font-bold text-slate-900">
                {editingEmp ? `Editar Empleado: ${editingEmp.full_name}` : 'Registrar Nuevo Empleado'}
              </h2>
              <button
                onClick={() => {
                  setShowNewEmpModal(false);
                  setEditingEmp(null);
                }}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleSaveEmployee} className="mt-4 space-y-3">
              <div>
                <label className="mb-1 block text-xs font-bold text-slate-700">Nombre Completo *</label>
                <input
                  type="text"
                  required
                  value={empForm.fullName}
                  onChange={(e) => setEmpForm({ ...empForm, fullName: e.target.value })}
                  placeholder="Ej. Carlos Roberto Gómez"
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-bold text-slate-700">Número de DPI *</label>
                  <input
                    type="text"
                    value={empForm.dpi}
                    onChange={(e) => setEmpForm({ ...empForm, dpi: e.target.value })}
                    placeholder="Ej. 2345 67890 0101"
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 font-mono text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-bold text-slate-700">Puesto / Cargo</label>
                  <input
                    type="text"
                    value={empForm.jobTitle}
                    onChange={(e) => setEmpForm({ ...empForm, jobTitle: e.target.value })}
                    placeholder="Ej. Supervisor de Planta"
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-bold text-slate-700">Departamento / Área *</label>
                  <select
                    required
                    value={empForm.departmentId}
                    onChange={(e) => setEmpForm({ ...empForm, departmentId: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  >
                    <option value="">Seleccionar área...</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-bold text-slate-700">Jefe Inmediato</label>
                  <select
                    value={empForm.immediateSupervisorId}
                    onChange={(e) => setEmpForm({ ...empForm, immediateSupervisorId: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  >
                    <option value="">Sin jefe inmediato asignado</option>
                    {employees
                      .filter((e) => e.status === 'ACTIVO' && (!editingEmp || e.id !== editingEmp.id))
                      .map((e) => (
                        <option key={e.id} value={e.id}>
                          {e.full_name} ({e.department_name || 'General'})
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-bold text-slate-700">Teléfono WhatsApp</label>
                  <input
                    type="text"
                    value={empForm.phone}
                    onChange={(e) => setEmpForm({ ...empForm, phone: e.target.value })}
                    placeholder="+502 5555-0000"
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-mono"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-bold text-slate-700">Correo Electrónico</label>
                  <input
                    type="email"
                    value={empForm.email}
                    onChange={(e) => setEmpForm({ ...empForm, email: e.target.value })}
                    placeholder="empleado@empresa.com"
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowNewEmpModal(false);
                    setEditingEmp(null);
                  }}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-military-700 px-5 py-2 text-xs font-bold text-white hover:bg-military-800"
                >
                  {editingEmp ? 'Guardar Cambios' : 'Guardar Empleado'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal QR */}
      <QrCodeModal
        isOpen={Boolean(selectedQrItem)}
        onClose={() => setSelectedQrItem(null)}
        item={selectedQrItem}
      />
    </div>
  );
}
