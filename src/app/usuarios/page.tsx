'use client';

import React, { useState, useEffect } from 'react';
import {
  Users,
  Shield,
  Search,
  Lock,
  Mail,
  Building,
  Key,
  CheckCircle,
  XCircle,
  Eye,
  SlidersHorizontal,
  UserPlus,
  Edit2,
  Trash2,
  Check,
  AlertCircle
} from 'lucide-react';

const ALL_SYSTEM_TABS = [
  { key: 'DASHBOARD', label: 'Inicio / Dashboard', desc: 'Métricas, KPIs y alertas generales' },
  { key: 'INVENTARIO', label: 'Inventario Físico', desc: 'Equipos, computadoras e impresoras' },
  { key: 'CELULARES', label: 'Celulares y Líneas', desc: 'Móviles corporativos, IMEIs y notas' },
  { key: 'PRODUCTOS', label: 'Categorías y Productos', desc: 'Catálogo de consumibles y suministros' },
  { key: 'MOVIMIENTOS', label: 'Entradas y Movimientos', desc: 'Kardex y registro de ingresos/salidas' },
  { key: 'ASIGNACIONES', label: 'Asignaciones a Personal', desc: 'Custodios de activos y bajas laborales' },
  { key: 'MANTENIMIENTO', label: 'Averías y Mantenimiento', desc: 'Gestión de fallas y sustituciones' },
  { key: 'SERVICIOS', label: 'Licencias y Servicios', desc: 'Software, dominios y suscripciones' },
  { key: 'COSTOS', label: 'Costos y Facturas', desc: 'Facturas, órdenes de compra y garantías' },
  { key: 'REPORTES', label: 'Reportes y Métricas', desc: 'Exportación Excel/PDF y Looker Studio' },
  { key: 'DEPARTAMENTOS', label: 'Áreas y Departamentos', desc: 'Estructura organizativa y traslados' },
  { key: 'CONFIGURACION', label: 'Configuración', desc: 'Copias de seguridad, modo nocturno, QR' },
];

export default function UsuariosPage() {
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
    role: 'AREA_MANAGER',
    department_id: '',
    allowedTabs: ['DASHBOARD', 'INVENTARIO', 'PRODUCTOS', 'ASIGNACIONES'],
    only_own_department: false,
    can_view_financials: false,
    can_export: false,
    can_edit: true,
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
      allowedTabs: ['DASHBOARD', 'INVENTARIO', 'PRODUCTOS', 'ASIGNACIONES'],
      only_own_department: true,
      can_view_financials: false,
      can_export: false,
      can_edit: true,
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
      role: user.role,
      department_id: user.department_id || '',
      allowedTabs: user.allowedTabs || [],
      only_own_department: user.only_own_department,
      can_view_financials: user.can_view_financials,
      can_export: user.can_export,
      can_edit: user.can_edit,
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
    } catch (err: any) {
      alert(err.message || 'Error de conexión');
    }
  };

  const handleDeactivate = async (user: any) => {
    if (user.email === 'alexander7tm@gmail.com') {
      alert('El administrador principal no puede ser desactivado.');
      return;
    }
    if (!confirm(`¿Estás seguro de desactivar la cuenta de ${user.full_name}?`)) return;

    try {
      const res = await fetch(`/api/users?id=${user.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Error al desactivar');
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
            <h1 className="text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">
              Usuarios y Gestión de Permisos (RBAC)
            </h1>
            <span className="rounded-full bg-military-800 px-2.5 py-0.5 text-[11px] font-bold text-white">
              Control de Accesos
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Asigna qué pestañas específicas puede ver o modificar cada jefe, CEO o gerente, con restricción por departamento.
          </p>
        </div>

        <button
          onClick={openCreateModal}
          className="flex items-center justify-center gap-2 rounded-xl bg-military-800 px-4 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-military-900"
        >
          <UserPlus className="h-4 w-4" />
          <span>+ Agregar Usuario / Jefe</span>
        </button>
      </div>

      {/* Resumen de Seguridad */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 text-military-800 font-bold text-xs uppercase mb-1">
            <Shield className="h-4 w-4" />
            <span>Super Administrador</span>
          </div>
          <p className="text-xs text-slate-500">
            alexander7tm@gmail.com — Acceso irrestricto a auditoría, usuarios, costos y base de datos.
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 text-blue-700 font-bold text-xs uppercase mb-1">
            <Users className="h-4 w-4" />
            <span>Jefaturas / Gerencia</span>
          </div>
          <p className="text-xs text-slate-500">
            Restricción por departamento habilitable para que solo auditen a su propio personal.
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 text-emerald-700 font-bold text-xs uppercase mb-1">
            <SlidersHorizontal className="h-4 w-4" />
            <span>Pestañas Selectivas</span>
          </div>
          <p className="text-xs text-slate-500">
            Tú decides exactamente cuáles de las 12 secciones del sistema están visibles para cada cuenta.
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 text-amber-700 font-bold text-xs uppercase mb-1">
            <Lock className="h-4 w-4" />
            <span>Finanzas y Edición</span>
          </div>
          <p className="text-xs text-slate-500">
            Toggles dedicados para ocultar costos en Quetzales/Dólares o bloquear edición (Solo Lectura).
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

      {/* Tabla de Usuarios */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="border-b border-slate-200 bg-slate-50 text-[11px] uppercase font-bold text-slate-500">
              <tr>
                <th className="px-4 py-3">Usuario y Nombre</th>
                <th className="px-4 py-3">Correo Electrónico</th>
                <th className="px-4 py-3">Rol del Sistema</th>
                <th className="px-4 py-3">Área Asignada</th>
                <th className="px-4 py-3">Pestañas Habilitadas</th>
                <th className="px-4 py-3">Restricciones</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400">
                    Cargando usuarios...
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
                  const isSuperAdmin = u.email === 'alexander7tm@gmail.com';
                  return (
                    <tr key={u.id} className="hover:bg-slate-50 transition">
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2">
                          <div className="h-8 w-8 rounded-full bg-military-800 text-white flex items-center justify-center font-bold text-xs shadow-xs">
                            {u.initials || 'U'}
                          </div>
                          <div>
                            <span className="font-bold text-slate-900 block">{u.full_name}</span>
                            <span className="font-mono text-[11px] text-slate-500">@{u.username}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 font-medium text-slate-600">
                        {u.email}
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
                          {isSuperAdmin ? 'ADMINISTRADOR PRINCIPAL' : u.role}
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
                        {isSuperAdmin ? (
                          <span className="text-[11px] font-bold text-purple-700">Todas las pestañas (12/12)</span>
                        ) : (
                          <div className="flex items-center gap-1">
                            <span className="rounded bg-slate-100 px-2 py-0.5 font-bold text-[11px] text-slate-700">
                              {u.allowedTabs?.length || 0} de 12 pestañas
                            </span>
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
                          {!u.can_view_financials && !isSuperAdmin && (
                            <span className="rounded bg-slate-100 px-1.5 py-0.5 font-semibold text-slate-600 w-fit">
                              Sin acceso a costos
                            </span>
                          )}
                          {!u.can_edit && !isSuperAdmin && (
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
                            title="Editar permisos y pestañas"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>
                          {!isSuperAdmin && u.is_active && (
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="my-8 w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  {editingUser ? `Editar Permisos: ${editingUser.full_name}` : 'Crear Nuevo Usuario o Jefatura'}
                </h3>
                <p className="text-xs text-slate-500">
                  Configura credenciales, rol y matriz de pestañas permitidas.
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
                    {editingUser ? 'Nueva Contraseña (dejar en blanco para conservar)' : 'Contraseña de Acceso *'}
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

                <div>
                  <label className="block text-xs font-bold text-slate-700">Rol Institucional</label>
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 focus:border-military-600 focus:outline-none"
                  >
                    <option value="SUBADMIN">Subadministrador / Gerencia General</option>
                    <option value="AREA_MANAGER">Jefe de Área / Responsable de Departamento</option>
                    <option value="VIEWER">Usuario Consulta / Auditor</option>
                    <option value="ADMIN">Administrador Completo</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700">Departamento de Pertenencia</label>
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

              {/* Toggles de Restricción Poka-Yoke */}
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                <span className="block text-xs font-bold text-slate-800">
                  Reglas de Seguridad y Restricciones
                </span>

                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                  <label className="flex items-center gap-2 p-2 rounded-lg bg-white border border-slate-200 text-xs font-medium text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.only_own_department}
                      onChange={(e) => setFormData({ ...formData, only_own_department: e.target.checked })}
                      className="h-4 w-4 rounded border-slate-300 text-military-800 focus:ring-military-700"
                    />
                    <span>Solo su departamento</span>
                  </label>

                  <label className="flex items-center gap-2 p-2 rounded-lg bg-white border border-slate-200 text-xs font-medium text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.can_view_financials}
                      onChange={(e) => setFormData({ ...formData, can_view_financials: e.target.checked })}
                      className="h-4 w-4 rounded border-slate-300 text-military-800 focus:ring-military-700"
                    />
                    <span>Ver costos y facturas</span>
                  </label>

                  <label className="flex items-center gap-2 p-2 rounded-lg bg-white border border-slate-200 text-xs font-medium text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.can_edit}
                      onChange={(e) => setFormData({ ...formData, can_edit: e.target.checked })}
                      className="h-4 w-4 rounded border-slate-300 text-military-800 focus:ring-military-700"
                    />
                    <span>Permitir edición / mutación</span>
                  </label>
                </div>
              </div>

              {/* Matriz de Pestañas Permitidas */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="block text-xs font-bold text-slate-800">
                    Pestañas del Sistema que Puede Ver ({formData.allowedTabs.length} seleccionadas)
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
                      onClick={() => setFormData({ ...formData, allowedTabs: ['DASHBOARD'] })}
                      className="text-[11px] text-slate-500 font-medium hover:underline"
                    >
                      Mínimo
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 max-h-56 overflow-y-auto pr-1">
                  {ALL_SYSTEM_TABS.map((tab) => {
                    const isChecked = formData.allowedTabs.includes(tab.key);
                    return (
                      <label
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
                          onChange={() => {}} // handled by container
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
