'use client';

import React, { useState, useEffect } from 'react';
import {
  Users,
  Shield,
  ShieldCheck,
  Search,
  Lock,
  Mail,
  Building,
  KeyRound,
  CheckCircle,
  XCircle,
  Eye,
  SlidersHorizontal,
  UserPlus,
  Edit2,
  Trash2,
  Check,
  AlertCircle,
  Smartphone,
  FileSpreadsheet,
  DollarSign,
  Layers,
} from 'lucide-react';

const ALL_SYSTEM_TABS = [
  { key: 'DASHBOARD', label: 'Inicio / Dashboard', desc: 'Métricas, KPIs y alertas de inventario' },
  { key: 'INVENTARIO', label: 'Inventario Físico', desc: 'Equipos, computadoras, maquinaria e impresoras' },
  { key: 'CELULARES', label: 'Celulares y Líneas', desc: 'Smartphones corporativos, IMEIs y chips' },
  { key: 'PRODUCTOS', label: 'Categorías y Productos', desc: 'Catálogo de consumibles y suministros' },
  { key: 'MOVIMIENTOS', label: 'Entradas y Movimientos', desc: 'Kardex e ingresos/salidas de bodega' },
  { key: 'ASIGNACIONES', label: 'Asignaciones a Personal', desc: 'Custodios de activos y actas de entrega' },
  { key: 'MANTENIMIENTO', label: 'Averías y Mantenimiento', desc: 'Registro de fallas, reparaciones y sustituciones' },
  { key: 'SERVICIOS', label: 'Licencias y Servicios', desc: 'Software, dominios y suscripciones digitales' },
  { key: 'COSTOS', label: 'Costos y Facturas', desc: 'Facturación en GTQ/USD, garantías y compras' },
  { key: 'REPORTES', label: 'Reportes y Métricas', desc: 'Exportación a Excel, PDF y Looker Studio' },
  { key: 'DEPARTAMENTOS', label: 'Áreas y Departamentos', desc: 'Estructura organizativa de la planta' },
  { key: 'AUDITORIA', label: 'Historial de Auditoría', desc: 'Bitácora inmutable de cambios y accesos' },
  { key: 'CONFIGURACION', label: 'Configuración y Backups', desc: 'Copias de seguridad híbridas y QR' },
];

export default function PermisosPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState<any | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    username: '',
    full_name: '',
    email: '',
    password: '',
    pin: '',
    role: 'OPERATOR',
    department_id: '',
    allowedTabs: ['DASHBOARD', 'INVENTARIO', 'PRODUCTOS', 'ASIGNACIONES'],
    allowedActions: {
      can_read: true,
      can_write: true,
      can_delete: false,
      can_export: true,
      can_view_financials: false,
    },
    allowedDepartments: [] as string[],
    only_own_department: false,
  });

  const fetchUsers = () => {
    setLoading(true);
    Promise.all([
      fetch('/api/users').then((r) => r.json()),
      fetch('/api/catalogs').then((r) => r.json()),
    ])
      .then(([usersRes, catRes]) => {
        if (usersRes.users) setUsers(usersRes.users);
        if (catRes.departments) setDepartments(catRes.departments);
      })
      .catch((err) => console.error('Error al cargar datos:', err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const openCreateModal = () => {
    setEditingUser(null);
    setFormData({
      username: '',
      full_name: '',
      email: '',
      password: '',
      pin: '',
      role: 'OPERATOR',
      department_id: departments[0]?.id || '',
      allowedTabs: ['DASHBOARD', 'INVENTARIO', 'PRODUCTOS', 'ASIGNACIONES'],
      allowedActions: {
        can_read: true,
        can_write: true,
        can_delete: false,
        can_export: true,
        can_view_financials: false,
      },
      allowedDepartments: departments[0]?.id ? [departments[0]?.id] : [],
      only_own_department: true,
    });
    setShowModal(true);
  };

  const openEditModal = (user: any) => {
    setEditingUser(user);
    setFormData({
      username: user.username,
      full_name: user.full_name,
      email: user.email,
      password: '',
      pin: '', // Dejar en blanco si no se modifica
      role: user.role,
      department_id: user.department_id || '',
      allowedTabs: user.allowedTabs || [],
      allowedActions: {
        can_read: Boolean(user.allowedActions?.can_read ?? true),
        can_write: Boolean(user.allowedActions?.can_write ?? user.can_edit),
        can_delete: Boolean(user.allowedActions?.can_delete ?? false),
        can_export: Boolean(user.allowedActions?.can_export ?? user.can_export),
        can_view_financials: Boolean(user.allowedActions?.can_view_financials ?? user.can_view_financials),
      },
      allowedDepartments: user.allowedDepartments || [],
      only_own_department: Boolean(user.only_own_department),
    });
    setShowModal(true);
  };

  const handleToggleTab = (tabKey: string) => {
    setFormData((prev) => {
      const exists = prev.allowedTabs.includes(tabKey);
      return {
        ...prev,
        allowedTabs: exists
          ? prev.allowedTabs.filter((t) => t !== tabKey)
          : [...prev.allowedTabs, tabKey],
      };
    });
  };

  const handleToggleDepartment = (deptId: string) => {
    setFormData((prev) => {
      const exists = prev.allowedDepartments.includes(deptId);
      return {
        ...prev,
        allowedDepartments: exists
          ? prev.allowedDepartments.filter((d) => d !== deptId)
          : [...prev.allowedDepartments, deptId],
      };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (formData.pin && formData.pin.length !== 4) {
      alert('El PIN debe tener exactamente 4 dígitos numéricos.');
      return;
    }

    try {
      const url = '/api/users';
      const method = editingUser ? 'PUT' : 'POST';
      const payload = {
        ...formData,
        id: editingUser ? editingUser.id : undefined,
        can_edit: formData.allowedActions.can_write,
        can_export: formData.allowedActions.can_export,
        can_view_financials: formData.allowedActions.can_view_financials,
      };

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Error al guardar usuario');
        return;
      }

      setShowModal(false);
      fetchUsers();
    } catch (err: any) {
      alert(err.message || 'Error de conexión');
    }
  };

  const handleDeactivate = async (user: any) => {
    if (user.username === 'TurcoSivar' || user.id === 'usr-turcosivar') {
      alert('El Master Super Admin "TurcoSivar" es inmutable y no puede ser desactivado.');
      return;
    }
    if (!confirm(`¿Estás seguro de desactivar la cuenta de ${user.full_name}?`)) return;

    try {
      const res = await fetch(`/api/users?id=${user.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Error al desactivar usuario');
        return;
      }
      fetchUsers();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const filteredUsers = users.filter(
    (u) =>
      u.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      u.username?.toLowerCase().includes(search.toLowerCase()) ||
      u.email?.toLowerCase().includes(search.toLowerCase()) ||
      u.role?.toLowerCase().includes(search.toLowerCase()) ||
      u.department_name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Encabezado */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black tracking-tight text-slate-900 sm:text-3xl flex items-center gap-2.5">
              <ShieldCheck className="h-7 w-7 text-emerald-600" />
              Gestión de Permisos & Control de Accesos (RBAC)
            </h1>
            <span className="rounded-full bg-military-800 px-2.5 py-0.5 text-[11px] font-bold text-white shadow-xs">
              Super Admin FPC
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Módulo exclusivo de <strong>TurcoSivar</strong>. Configura roles, PINs de 4 dígitos para tabletas y APK, pestañas visibles y matriz de permisos por departamento.
          </p>
        </div>

        <button
          onClick={openCreateModal}
          className="flex items-center justify-center gap-2 rounded-xl bg-military-800 px-4 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-military-900 active:scale-95"
        >
          <UserPlus className="h-4 w-4" />
          <span>+ Agregar Usuario / Operador</span>
        </button>
      </div>

      {/* Banner Master Super Admin */}
      <div className="rounded-2xl border border-emerald-500/30 bg-gradient-to-r from-emerald-950/20 via-slate-900/10 to-military-950/20 p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-military-800 text-emerald-400 font-black text-lg shadow-md ring-2 ring-emerald-500/30">
              TS
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-slate-900 text-base">TurcoSivar</span>
                <span className="rounded-md bg-emerald-100 text-emerald-800 border border-emerald-200 px-2 py-0.2 text-[10px] font-bold">
                  MASTER SUPER ADMIN
                </span>
                <span className="rounded-md bg-purple-100 text-purple-800 border border-purple-200 px-2 py-0.2 text-[10px] font-bold font-mono">
                  PIN: 2801
                </span>
              </div>
              <p className="text-xs text-slate-600 mt-0.5">
                Acceso total irrestricto a los 14 módulos, base de datos local PostgreSQL/SQLite, auditoría inmutable y costos financieros en GTQ.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs font-semibold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200/80 shrink-0">
            <CheckCircle className="h-4 w-4 text-emerald-600" />
            <span>Perfil Protegido e Inmutable</span>
          </div>
        </div>
      </div>

      {/* Tarjetas Informativas de Seguridad */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 text-military-800 font-bold text-xs uppercase mb-1">
            <KeyRound className="h-4 w-4 text-emerald-600" />
            <span>PIN de 4 Dígitos</span>
          </div>
          <p className="text-xs text-slate-500">
            Permite acceso instantáneo en terminales de taller, tabletas y APK Honor 400 sin teclear contraseñas largas.
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 text-blue-700 font-bold text-xs uppercase mb-1">
            <Building className="h-4 w-4" />
            <span>Áreas y Departamentos</span>
          </div>
          <p className="text-xs text-slate-500">
            Aislamiento estricto: Cada jefe de área u operador solo puede interactuar con el inventario de su departamento.
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 text-emerald-700 font-bold text-xs uppercase mb-1">
            <SlidersHorizontal className="h-4 w-4" />
            <span>Pestañas Selectivas</span>
          </div>
          <p className="text-xs text-slate-500">
            Tú defines exactamente cuáles de las 14 secciones del sistema están visibles para cada usuario.
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 text-amber-700 font-bold text-xs uppercase mb-1">
            <DollarSign className="h-4 w-4" />
            <span>Costos y Finanzas (GTQ)</span>
          </div>
          <p className="text-xs text-slate-500">
            Toggle dedicado para ocultar costos y precios de compra en Quetzales a operadores y auditores.
          </p>
        </div>
      </div>

      {/* Búsqueda */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por nombre, usuario, correo, departamento o rol..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-xs text-slate-800 focus:border-military-600 focus:bg-white focus:outline-none"
          />
        </div>
        <span className="text-xs text-slate-500 font-medium">
          {filteredUsers.length} usuario(s) registrados
        </span>
      </div>

      {/* Tabla de Usuarios y Permisos */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="border-b border-slate-200 bg-slate-50 text-[11px] uppercase font-bold text-slate-500">
              <tr>
                <th className="px-4 py-3">Usuario y Nombre</th>
                <th className="px-4 py-3">Rol del Sistema</th>
                <th className="px-4 py-3">Departamento</th>
                <th className="px-4 py-3">PIN 4 Dígitos</th>
                <th className="px-4 py-3">Pestañas</th>
                <th className="px-4 py-3">Acciones Granulares</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400">
                    Cargando usuarios y matriz de permisos...
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400">
                    No se encontraron usuarios que coincidan con la búsqueda.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => {
                  const isTurco = u.username === 'TurcoSivar' || u.role === 'SUPERADMIN';
                  return (
                    <tr key={u.id} className="hover:bg-slate-50 transition">
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2">
                          <div
                            className={`h-8 w-8 rounded-full flex items-center justify-center font-bold text-xs shadow-xs ${
                              isTurco
                                ? 'bg-military-800 text-emerald-400 ring-2 ring-emerald-400/40'
                                : 'bg-slate-800 text-white'
                            }`}
                          >
                            {u.initials || 'U'}
                          </div>
                          <div>
                            <span className="font-bold text-slate-900 block flex items-center gap-1.5">
                              {u.full_name}
                              {isTurco && (
                                <ShieldCheck className="h-3.5 w-3.5 text-emerald-600 inline" />
                              )}
                            </span>
                            <span className="font-mono text-[11px] text-slate-500">@{u.username}</span>
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-3.5">
                        <span
                          className={`inline-block rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                            isTurco
                              ? 'bg-purple-100 text-purple-800 border border-purple-200'
                              : u.role === 'ADMIN'
                              ? 'bg-military-100 text-military-800 border border-military-200'
                              : u.role === 'SUBADMIN'
                              ? 'bg-blue-100 text-blue-800'
                              : u.role === 'AREA_MANAGER'
                              ? 'bg-emerald-100 text-emerald-800'
                              : u.role === 'OPERATOR'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {isTurco ? 'SUPERADMIN' : u.role}
                        </span>
                      </td>

                      <td className="px-4 py-3.5 font-medium text-slate-700">
                        {u.department_name ? (
                          <div className="flex items-center gap-1">
                            <span>{u.department_name}</span>
                            <span className="text-[10px] text-slate-400 font-mono">({u.department_code})</span>
                          </div>
                        ) : (
                          <span className="text-emerald-700 font-semibold text-[11px]">Acceso Global (Todas)</span>
                        )}
                      </td>

                      <td className="px-4 py-3.5">
                        {u.has_pin ? (
                          <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700 border border-emerald-200">
                            <KeyRound className="h-3 w-3" />
                            <span>Configurado</span>
                          </span>
                        ) : (
                          <span className="text-slate-400 text-[11px] italic">Sin PIN</span>
                        )}
                      </td>

                      <td className="px-4 py-3.5">
                        {isTurco ? (
                          <span className="text-[11px] font-bold text-purple-700">Todas (14/14)</span>
                        ) : (
                          <span className="rounded bg-slate-100 px-2 py-0.5 font-bold text-[11px] text-slate-700">
                            {u.allowedTabs?.length || 0} de 14
                          </span>
                        )}
                      </td>

                      <td className="px-4 py-3.5">
                        <div className="flex flex-wrap gap-1 text-[10px]">
                          {u.allowedActions?.can_read && (
                            <span className="rounded bg-slate-100 px-1.5 py-0.2 font-medium text-slate-700">Lectura</span>
                          )}
                          {u.allowedActions?.can_write && (
                            <span className="rounded bg-blue-50 px-1.5 py-0.2 font-semibold text-blue-700 border border-blue-200">Edición</span>
                          )}
                          {u.allowedActions?.can_delete && (
                            <span className="rounded bg-rose-50 px-1.5 py-0.2 font-semibold text-rose-700 border border-rose-200">Eliminación</span>
                          )}
                          {u.allowedActions?.can_view_financials && (
                            <span className="rounded bg-emerald-50 px-1.5 py-0.2 font-semibold text-emerald-700 border border-emerald-200">Costos GTQ</span>
                          )}
                          {u.allowedActions?.can_export && (
                            <span className="rounded bg-amber-50 px-1.5 py-0.2 font-semibold text-amber-700 border border-amber-200">Exportar</span>
                          )}
                        </div>
                      </td>

                      <td className="px-4 py-3.5">
                        {u.is_active ? (
                          <span className="flex items-center gap-1 text-emerald-600 font-semibold">
                            <CheckCircle className="h-3.5 w-3.5" /> Activo
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-red-500 font-semibold">
                            <XCircle className="h-3.5 w-3.5" /> Inactivo
                          </span>
                        )}
                      </td>

                      <td className="px-4 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => openEditModal(u)}
                            className="rounded-lg p-1.5 text-slate-600 hover:bg-slate-100 hover:text-military-800 transition"
                            title="Editar permisos, PIN y accesos"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>
                          {!isTurco && u.is_active && (
                            <button
                              onClick={() => handleDeactivate(u)}
                              className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 transition"
                              title="Desactivar acceso"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
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

      {/* Modal de Creación / Edición de Usuario y Permisos */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="my-8 w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-emerald-600" />
                  {editingUser ? `Editar Permisos: ${editingUser.full_name}` : 'Crear Nuevo Usuario / Operador'}
                </h3>
                <p className="text-xs text-slate-500">
                  Asigna credenciales, PIN de 4 dígitos, rol, permisos granulares y pestañas autorizadas.
                </p>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="mt-4 space-y-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700">Nombre Completo *</label>
                  <input
                    type="text"
                    required
                    value={formData.full_name}
                    onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                    placeholder="Ej. Ing. Carlos Méndez"
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-800 focus:border-military-600 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700">Usuario (Login) *</label>
                  <input
                    type="text"
                    required
                    disabled={Boolean(editingUser)}
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    placeholder="Ej. cmendez"
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-800 focus:border-military-600 focus:outline-none disabled:bg-slate-50"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700">Correo Electrónico *</label>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="cmendez@persiluz.com"
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-800 focus:border-military-600 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700">
                    {editingUser ? 'Nueva Contraseña (opcional)' : 'Contraseña de Acceso *'}
                  </label>
                  <input
                    type="password"
                    required={!editingUser}
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    placeholder="Mínimo 6 caracteres"
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-800 focus:border-military-600 focus:outline-none"
                  />
                </div>

                {/* PIN de 4 Dígitos */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 flex items-center justify-between">
                    <span className="flex items-center gap-1 text-emerald-800">
                      <KeyRound className="h-3.5 w-3.5" />
                      PIN Numérico de 4 Dígitos
                    </span>
                    <span className="text-[10px] text-slate-400">Para tableta / APK</span>
                  </label>
                  <input
                    type="text"
                    maxLength={4}
                    pattern="\d*"
                    value={formData.pin}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, '');
                      setFormData({ ...formData, pin: val });
                    }}
                    placeholder={editingUser?.has_pin ? '•••• (Conservar PIN)' : 'Ej. 2801'}
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-800 font-mono tracking-widest focus:border-military-600 focus:outline-none"
                  />
                </div>

                {/* Rol Institucional */}
                <div>
                  <label className="block text-xs font-bold text-slate-700">Rol Institucional</label>
                  <select
                    value={formData.role}
                    disabled={editingUser?.username === 'TurcoSivar'}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 focus:border-military-600 focus:outline-none disabled:bg-slate-50"
                  >
                    <option value="OPERATOR">Operador de Bodega / Taller</option>
                    <option value="AREA_MANAGER">Jefe de Área / Responsable de Departamento</option>
                    <option value="SUBADMIN">Subadministrador / Gerencia General</option>
                    <option value="ADMIN">Administrador General</option>
                    <option value="VIEWER">Usuario Consulta / Auditor</option>
                    {editingUser?.username === 'TurcoSivar' && (
                      <option value="SUPERADMIN">Master Super Admin (Inmutable)</option>
                    )}
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700">Departamento Principal</label>
                  <select
                    value={formData.department_id}
                    onChange={(e) => setFormData({ ...formData, department_id: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 focus:border-military-600 focus:outline-none"
                  >
                    <option value="">Acceso Global / Todos los Departamentos</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name} ({d.code})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Matriz de Acciones Granulares */}
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                <span className="block text-xs font-bold text-slate-800">
                  Acciones Granulares Permitidas
                </span>

                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  <label className="flex items-center gap-2 p-2 rounded-lg bg-white border border-slate-200 text-xs font-medium text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.allowedActions.can_read}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          allowedActions: { ...formData.allowedActions, can_read: e.target.checked },
                        })
                      }
                      className="h-4 w-4 rounded border-slate-300 text-military-800 focus:ring-military-700"
                    />
                    <span>Lectura de datos</span>
                  </label>

                  <label className="flex items-center gap-2 p-2 rounded-lg bg-white border border-slate-200 text-xs font-medium text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.allowedActions.can_write}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          allowedActions: { ...formData.allowedActions, can_write: e.target.checked },
                        })
                      }
                      className="h-4 w-4 rounded border-slate-300 text-military-800 focus:ring-military-700"
                    />
                    <span>Crear / Editar</span>
                  </label>

                  <label className="flex items-center gap-2 p-2 rounded-lg bg-white border border-slate-200 text-xs font-medium text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.allowedActions.can_delete}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          allowedActions: { ...formData.allowedActions, can_delete: e.target.checked },
                        })
                      }
                      className="h-4 w-4 rounded border-slate-300 text-military-800 focus:ring-military-700"
                    />
                    <span>Eliminar registros</span>
                  </label>

                  <label className="flex items-center gap-2 p-2 rounded-lg bg-white border border-slate-200 text-xs font-medium text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.allowedActions.can_view_financials}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          allowedActions: { ...formData.allowedActions, can_view_financials: e.target.checked },
                        })
                      }
                      className="h-4 w-4 rounded border-slate-300 text-military-800 focus:ring-military-700"
                    />
                    <span>Ver costos en GTQ</span>
                  </label>

                  <label className="flex items-center gap-2 p-2 rounded-lg bg-white border border-slate-200 text-xs font-medium text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.allowedActions.can_export}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          allowedActions: { ...formData.allowedActions, can_export: e.target.checked },
                        })
                      }
                      className="h-4 w-4 rounded border-slate-300 text-military-800 focus:ring-military-700"
                    />
                    <span>Exportar reportes</span>
                  </label>

                  <label className="flex items-center gap-2 p-2 rounded-lg bg-white border border-slate-200 text-xs font-medium text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.only_own_department}
                      onChange={(e) => setFormData({ ...formData, only_own_department: e.target.checked })}
                      className="h-4 w-4 rounded border-slate-300 text-military-800 focus:ring-military-700"
                    />
                    <span>Solo su departamento</span>
                  </label>
                </div>
              </div>

              {/* Matriz de Pestañas Permitidas */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="block text-xs font-bold text-slate-800">
                    Pestañas Permitidas ({formData.allowedTabs.length} de {ALL_SYSTEM_TABS.length})
                  </span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, allowedTabs: ALL_SYSTEM_TABS.map((t) => t.key) })}
                      className="text-[11px] text-military-700 font-bold hover:underline"
                    >
                      Todas
                    </button>
                    <span>•</span>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, allowedTabs: ['DASHBOARD', 'INVENTARIO', 'PRODUCTOS'] })}
                      className="text-[11px] text-slate-500 font-medium hover:underline"
                    >
                      Operativo Básico
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 max-h-52 overflow-y-auto pr-1">
                  {ALL_SYSTEM_TABS.map((tab) => {
                    const isChecked = formData.allowedTabs.includes(tab.key);
                    return (
                      <label
                        key={tab.key}
                        onClick={() => handleToggleTab(tab.key)}
                        className={`flex items-start gap-2.5 p-2 rounded-lg border cursor-pointer transition ${
                          isChecked
                            ? 'border-military-600 bg-military-50/50'
                            : 'border-slate-200 bg-white hover:bg-slate-50'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {}}
                          className="mt-0.5 h-4 w-4 rounded border-slate-300 text-military-800 focus:ring-military-700"
                        />
                        <div>
                          <span className="block text-xs font-bold text-slate-900">{tab.label}</span>
                          <span className="block text-[10px] text-slate-500">{tab.desc}</span>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="mt-5 flex justify-end gap-2 border-t border-slate-100 pt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="rounded-lg px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-military-800 px-5 py-2 text-xs font-bold text-white shadow-sm hover:bg-military-900 active:scale-95"
                >
                  {editingUser ? 'Guardar Cambios de Permiso' : 'Crear Usuario'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
