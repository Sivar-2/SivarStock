'use client';

import React, { useState, useEffect } from 'react';
import {
  Users,
  Shield,
  Search,
  Lock,
  CheckCircle,
  XCircle,
  SlidersHorizontal,
  UserPlus,
  Edit2,
  Trash2,
} from 'lucide-react';

const ALL_SYSTEM_TABS = [
  { key: 'DASHBOARD', label: 'Inicio / Dashboard', desc: 'Métricas, KPIs y alertas generales' },
  { key: 'INVENTARIO', label: 'Bodega', desc: 'Equipos en cuarto de bodega, traslados, consumo y mantenimiento' },
  { key: 'CELULARES', label: 'Celulares y Líneas', desc: 'Móviles corporativos, IMEIs y vencimiento de contratos' },
  { key: 'PRODUCTOS', label: 'Categorías y Productos', desc: 'Catálogo de productos, consumibles y suministros' },
  { key: 'MOVIMIENTOS', label: 'Entradas y Movimientos', desc: 'Kardex y registro de ingresos/salidas' },
  { key: 'ASIGNACIONES', label: 'Asignaciones y Actas Digitales', desc: 'Custodios de activos y actas por WhatsApp' },
  { key: 'MANTENIMIENTO', label: 'Averías y Mantenimiento', desc: 'Gestión de fallas y sustituciones' },
  { key: 'SERVICIOS', label: 'Licencias y Contratos', desc: 'Software, proveedores, SLAs y suscripciones' },
  { key: 'COSTOS', label: 'Costos y Facturas', desc: 'Facturas, órdenes de compra y garantías' },
  { key: 'REPORTES', label: 'Reportes y Métricas', desc: 'Exportación Excel/CSV y consultas dinámicas' },
  { key: 'DEPARTAMENTOS', label: 'Áreas y Empleados', desc: 'Estructura organizativa, DPI, jefes y traslados' },
  { key: 'CONFIGURACION', label: 'Configuración / Ajustes', desc: 'Firma digital, servidor LAN, respaldos y QR' },
];

export default function UsuariosPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState<any | null>(null);

  const [formData, setFormData] = useState({
    username: '',
    full_name: '',
    email: '',
    password: '',
    role: 'AREA_MANAGER',
    department_id: '',
    allowedTabs: ['DASHBOARD', 'INVENTARIO', 'ASIGNACIONES'],
    only_own_department: false,
    can_view_financials: false,
    can_export: false,
    can_edit: true,
    is_active: true,
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
      .catch(console.error)
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
      role: 'AREA_MANAGER',
      department_id: departments[0]?.id || '',
      allowedTabs: ['DASHBOARD', 'INVENTARIO', 'ASIGNACIONES'],
      only_own_department: true,
      can_view_financials: false,
      can_export: false,
      can_edit: true,
      is_active: true,
    });
    setShowModal(true);
  };

  const openEditModal = (user: any) => {
    setEditingUser(user);
    setFormData({
      username: user.username,
      full_name: user.full_name,
      email: user.email || '',
      password: '',
      role: user.role,
      department_id: user.department_id || '',
      allowedTabs: Array.isArray(user.allowedTabs) ? user.allowedTabs : [],
      only_own_department: Boolean(user.only_own_department),
      can_view_financials: Boolean(user.can_view_financials),
      can_export: Boolean(user.can_export),
      can_edit: Boolean(user.can_edit),
      is_active: user.is_active !== false,
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.role !== 'ADMIN' && formData.allowedTabs.length === 0) {
      alert('Selecciona al menos una pestaña/módulo para que este usuario pueda ver al ingresar.');
      return;
    }

    try {
      const url = '/api/users';
      const method = editingUser ? 'PUT' : 'POST';
      const payload = editingUser ? { ...formData, id: editingUser.id } : formData;

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
      if (data.message) {
        alert(data.message);
      }
    } catch (err: any) {
      alert(err.message || 'Error de conexión');
    }
  };

  const handleDeactivate = async (user: any, mode: 'DEACTIVATE' | 'DELETE' = 'DELETE') => {
    if (String(user.username).toLowerCase() === 'turcosivar') {
      alert('El administrador principal @turcosivar no puede ser eliminado ni desactivado.');
      return;
    }
    const msg =
      mode === 'DELETE'
        ? `¿Eliminar definitivamente el usuario y contraseña de ${user.full_name} (@${user.username})? Ya NO tendrá acceso a la plataforma a menos que se creen nuevas credenciales.`
        : `¿Revocar contraseña y desactivar el acceso de ${user.full_name} (@${user.username})?`;
    if (!confirm(msg)) return;

    try {
      const res = await fetch(`/api/users?id=${encodeURIComponent(user.id)}&mode=${mode}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Error al procesar solicitud');
        return;
      }
      if (data.message) alert(data.message);
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
            <h1 className="text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">
              Usuarios y Gestión de Permisos (RBAC)
            </h1>
            <span className="rounded-full bg-military-800 px-2.5 py-0.5 text-[11px] font-bold text-white">
              Control de Accesos
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Crea usuarios adicionales y elige exactamente qué pestañas y permisos puede ver cada uno al iniciar sesión.
          </p>
        </div>

        <button
          onClick={openCreateModal}
          className="flex items-center justify-center gap-2 rounded-xl bg-military-800 px-4 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-military-900"
        >
          <UserPlus className="h-4 w-4" />
          <span>+ Crear Nuevo Usuario</span>
        </button>
      </div>

      {/* Resumen de Seguridad */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 text-military-800 font-bold text-xs uppercase mb-1">
            <Shield className="h-4 w-4" />
            <span>Administrador Principal</span>
          </div>
          <p className="text-xs text-slate-500">
            <strong>@turcosivar</strong> (Alexander Turcios Melendez) — Acceso total a todos los módulos y base de datos.
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 text-blue-700 font-bold text-xs uppercase mb-1">
            <Users className="h-4 w-4" />
            <span>Filtro por Departamento</span>
          </div>
          <p className="text-xs text-slate-500">
            Puedes restringir a un usuario para que solo vea los activos y empleados de su propio departamento.
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 text-emerald-700 font-bold text-xs uppercase mb-1">
            <SlidersHorizontal className="h-4 w-4" />
            <span>Pestañas Exclusivas</span>
          </div>
          <p className="text-xs text-slate-500">
            Cuando el usuario inicia sesión, el menú lateral y las rutas bloquean todo lo que no le hayas marcado.
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 text-amber-700 font-bold text-xs uppercase mb-1">
            <Lock className="h-4 w-4" />
            <span>Modo Solo Lectura o Edición</span>
          </div>
          <p className="text-xs text-slate-500">
            Decide si el usuario puede agregar/editar registros o si únicamente tiene permiso de consulta.
          </p>
        </div>
      </div>

      {/* Búsqueda */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por nombre, usuario, departamento o rol..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-xs text-slate-800 focus:border-military-600 focus:bg-white focus:outline-none"
          />
        </div>
        <span className="text-xs text-slate-500 font-medium">
          {filteredUsers.length} usuario(s) registrados
        </span>
      </div>

      {/* Tabla de Usuarios */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="border-b border-slate-200 bg-slate-50 text-[11px] uppercase font-bold text-slate-500">
              <tr>
                <th className="px-4 py-3">Usuario y Nombre</th>
                <th className="px-4 py-3">Rol del Sistema</th>
                <th className="px-4 py-3">Área Asignada</th>
                <th className="px-4 py-3">Pestañas Habilitadas</th>
                <th className="px-4 py-3">Permisos Especiales</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    Cargando usuarios...
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    No se encontraron usuarios que coincidan con la búsqueda.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => {
                  const isSuperAdmin = String(u.username).toLowerCase() === 'turcosivar';
                  return (
                    <tr key={u.id} className="hover:bg-slate-50 transition">
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <div className="h-8 w-8 rounded-full bg-military-800 text-white flex items-center justify-center font-bold text-xs shadow-xs">
                            {u.initials || 'U'}
                          </div>
                          <div>
                            <span className="font-bold text-slate-900 block">{u.full_name}</span>
                            <span className="font-mono text-[11px] font-bold text-emerald-700">Usuario: {u.username}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <span
                          className={`inline-block rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                            isSuperAdmin
                              ? 'bg-purple-100 text-purple-800 border border-purple-200'
                              : u.role === 'ADMIN'
                              ? 'bg-military-100 text-military-800'
                              : u.role === 'SUBADMIN'
                              ? 'bg-blue-100 text-blue-800'
                              : u.role === 'AREA_MANAGER'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {isSuperAdmin ? 'ADMIN PRINCIPAL' : u.role}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 font-medium text-slate-700">
                        {u.department_name ? (
                          <span>{u.department_name}</span>
                        ) : (
                          <span className="text-slate-400 italic">Acceso Global</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5">
                        {u.role === 'ADMIN' ? (
                          <span className="text-[11px] font-bold text-purple-700">Todas las pestañas</span>
                        ) : (
                          <div className="flex flex-wrap gap-1 max-w-xs">
                            {(u.allowedTabs || []).map((t: string) => (
                              <span
                                key={t}
                                className="rounded bg-slate-100 border border-slate-200 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-slate-700"
                              >
                                {t}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex flex-col gap-1 text-[11px]">
                          {u.only_own_department && (
                            <span className="rounded bg-amber-50 px-1.5 py-0.5 font-semibold text-amber-800 border border-amber-200 w-fit">
                              Solo su departamento
                            </span>
                          )}
                          {u.can_edit || u.role === 'ADMIN' ? (
                            <span className="rounded bg-emerald-50 px-1.5 py-0.5 font-semibold text-emerald-700 border border-emerald-200 w-fit">
                              Puede editar
                            </span>
                          ) : (
                            <span className="rounded bg-blue-50 px-1.5 py-0.5 font-semibold text-blue-700 border border-blue-200 w-fit">
                              Solo lectura
                            </span>
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
                            title="Editar permisos, usuario y contraseña"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>
                          {!isSuperAdmin && u.is_active && (
                            <button
                              onClick={() => handleDeactivate(u, 'DEACTIVATE')}
                              className="rounded-lg p-1.5 text-amber-600 hover:bg-amber-50 transition"
                              title="Revocar contraseña / Desactivar acceso"
                            >
                              <Lock className="h-3.5 w-3.5" />
                            </button>
                          )}
                          {!isSuperAdmin && (
                            <button
                              onClick={() => handleDeactivate(u, 'DELETE')}
                              className="rounded-lg p-1.5 text-rose-500 hover:bg-rose-50 hover:text-rose-700 transition"
                              title="Eliminar usuario y contraseña definitivamente"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="my-8 w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  {editingUser ? `Editar Usuario y Permisos: ${editingUser.full_name}` : 'Crear Nuevo Usuario con Permisos Personalizados'}
                </h3>
                <p className="text-xs text-slate-500">
                  El usuario ingresará en la pantalla de acceso con el Usuario y Contraseña que definas aquí, y verá únicamente las pestañas seleccionadas.
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
                  <label className="block text-xs font-bold text-slate-700">Usuario para Iniciar Sesión *</label>
                  <input
                    type="text"
                    required
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value.replace(/\s+/g, '').toLowerCase() })}
                    placeholder="Ej. cmendez"
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs font-mono font-bold text-slate-900 focus:border-military-600 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700">
                    {editingUser ? 'Nueva Contraseña (dejar en blanco para conservar)' : 'Contraseña de Acceso *'}
                  </label>
                  <input
                    type="text"
                    required={!editingUser}
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    placeholder={editingUser ? 'Escribir solo si deseas cambiarla' : 'Ej. 123456'}
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs font-mono text-slate-800 focus:border-military-600 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700">Correo Electrónico (Opcional)</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="usuario@empresa.com"
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-800 focus:border-military-600 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700">Nivel de Rol</label>
                  <select
                    value={formData.role}
                    onChange={(e) => {
                      const nextRole = e.target.value;
                      setFormData({
                        ...formData,
                        role: nextRole,
                        can_edit: nextRole === 'VIEWER' ? false : formData.can_edit,
                      });
                    }}
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 focus:border-military-600 focus:outline-none"
                  >
                    <option value="AREA_MANAGER">Personalizado / Jefe de Área (Ve solo pestañas marcadas)</option>
                    <option value="SUBADMIN">Subadministrador / Gerencia (Ve solo pestañas marcadas)</option>
                    <option value="VIEWER">Solo Consulta / Auditor (Sin permiso de editar)</option>
                    <option value="ADMIN">Administrador Total (Ve todas las pestañas)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700">Departamento Asignado</label>
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

              {/* Toggles de Restricción */}
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                <span className="block text-xs font-bold text-slate-800">
                  Permisos de Acción dentro de sus Pestañas Autorizadas
                </span>

                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                  <label className="flex items-center gap-2 p-2 rounded-lg bg-white border border-slate-200 text-xs font-medium text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.only_own_department}
                      onChange={(e) => setFormData({ ...formData, only_own_department: e.target.checked })}
                      className="h-4 w-4 rounded border-slate-300 text-military-800 focus:ring-military-700"
                    />
                    <span>Ver solo su depto.</span>
                  </label>

                  <label className="flex items-center gap-2 p-2 rounded-lg bg-white border border-slate-200 text-xs font-medium text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.can_view_financials}
                      onChange={(e) => setFormData({ ...formData, can_view_financials: e.target.checked })}
                      className="h-4 w-4 rounded border-slate-300 text-military-800 focus:ring-military-700"
                    />
                    <span>Ver precios y costos</span>
                  </label>

                  <label className="flex items-center gap-2 p-2 rounded-lg bg-white border border-slate-200 text-xs font-medium text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      disabled={formData.role === 'VIEWER'}
                      checked={formData.role === 'VIEWER' ? false : formData.can_edit}
                      onChange={(e) => setFormData({ ...formData, can_edit: e.target.checked })}
                      className="h-4 w-4 rounded border-slate-300 text-military-800 focus:ring-military-700"
                    />
                    <span>Permitir agregar/editar</span>
                  </label>
                </div>
              </div>

              {/* Matriz de Pestañas Permitidas */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="block text-xs font-bold text-slate-800">
                    Pestañas que este Usuario Podrá Ver ({formData.allowedTabs.length} seleccionadas)
                  </span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, allowedTabs: ALL_SYSTEM_TABS.map((t) => t.key) })}
                      className="text-[11px] text-military-700 font-bold hover:underline"
                    >
                      Marcar Todas
                    </button>
                    <span>•</span>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, allowedTabs: ['INVENTARIO'] })}
                      className="text-[11px] text-slate-500 font-medium hover:underline"
                    >
                      Solo Inventario
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 max-h-60 overflow-y-auto pr-1">
                  {ALL_SYSTEM_TABS.map((tab) => {
                    const isChecked = formData.allowedTabs.includes(tab.key);
                    return (
                      <div
                        key={tab.key}
                        onClick={() => handleToggleTab(tab.key)}
                        className={`flex items-start gap-2.5 p-2.5 rounded-lg border cursor-pointer transition ${
                          isChecked
                            ? 'border-military-600 bg-military-50/50'
                            : 'border-slate-200 bg-white hover:bg-slate-50'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {}}
                          className="mt-0.5 h-4 w-4 rounded border-slate-300 text-military-800 focus:ring-military-700 pointer-events-none"
                        />
                        <div>
                          <span className="block text-xs font-bold text-slate-900">{tab.label}</span>
                          <span className="block text-[10px] text-slate-500">{tab.desc}</span>
                        </div>
                      </div>
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
                  className="rounded-lg bg-military-800 px-5 py-2 text-xs font-bold text-white shadow-sm hover:bg-military-900"
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
