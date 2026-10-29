'use client';

import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  Search,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

export default function AuditoriaPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [moduleFilter, setModuleFilter] = useState('');
  const [search, setSearch] = useState('');
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const [accessDenied, setAccessDenied] = useState(false);

  const fetchLogs = () => {
    setLoading(true);
    setAccessDenied(false);
    const p = new URLSearchParams();
    if (moduleFilter) p.set('module', moduleFilter);
    if (search) p.set('search', search);

    fetch(`/api/audit?${p.toString()}`)
      .then(async (r) => {
        if (r.status === 403) {
          setAccessDenied(true);
          return null;
        }
        return r.json();
      })
      .then((d) => {
        if (d && d.logs) setLogs(d.logs);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchLogs();
  }, [moduleFilter, search]);

  if (accessDenied) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 p-8 text-center max-w-xl mx-auto my-12">
        <ShieldAlert className="h-12 w-12 text-rose-600 mx-auto mb-3" />
        <h2 className="text-lg font-black text-rose-900">Acceso Restringido — Exclusivo @turcosivar</h2>
        <p className="text-xs text-rose-700 mt-1">
          El módulo de Bitácora es de acceso estrictamente personal y exclusivo para @turcosivar (Alexander Turcios Melendez).
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">
            Bitácora
          </h1>
          <p className="text-xs sm:text-sm text-slate-500">
            Registro confidencial de operaciones, movimientos, altas, bajas, actas y cambios del sistema (Exclusivo @turcosivar).
          </p>
        </div>
      </div>

      {/* Filtros */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
          <div className="sm:col-span-2">
            <label className="block text-[11px] font-bold text-slate-600 mb-1">Buscar</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Usuario, entidad afectada, motivo..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 py-1.5 pl-8 pr-3 text-xs text-slate-800 focus:border-military-600 focus:bg-white focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1">Módulo</label>
            <select
              value={moduleFilter}
              onChange={(e) => setModuleFilter(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-slate-50 py-1.5 px-2 text-xs text-slate-800 focus:border-military-600 focus:bg-white focus:outline-none"
            >
              <option value="">Todos los módulos</option>
              <option value="INVENTARIO">Bodega / Inventario</option>
              <option value="MOVIMIENTOS">Entradas y Movimientos</option>
              <option value="ASIGNACIONES">Asignaciones y Actas</option>
              <option value="COSTOS">Costos y Facturas</option>
              <option value="SERVICIOS_DIGITALES">Licencias y Contratos</option>
              <option value="MANTENIMIENTO">Averías y Mantenimiento</option>
              <option value="USUARIOS">Usuarios y Permisos</option>
              <option value="CATALOGOS">Categorías y Áreas</option>
              <option value="AUTENTICACION">Autenticación</option>
              <option value="CONFIGURACION">Configuración</option>
            </select>
          </div>
        </div>
      </div>

      {/* Lista de Registros */}
      <div className="space-y-3">
        {loading ? (
          <div className="rounded-xl border border-slate-200 bg-white py-12 text-center text-xs text-slate-400">
            Cargando bitácora...
          </div>
        ) : logs.length > 0 ? (
          logs.map((log: any) => {
            const isExpanded = expandedLogId === log.id;
            return (
              <div
                key={log.id}
                className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-slate-300"
              >
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-700">
                      {log.module}
                    </span>
                    <span className="font-mono text-xs font-bold text-military-800">
                      {log.action}
                    </span>
                    {log.entity_name && (
                      <span className="text-xs font-semibold text-slate-800">
                        • {log.entity_name}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-slate-500 font-mono">
                    <span>{new Date(log.created_at).toLocaleString('es-GT')}</span>
                    <span className="font-bold text-slate-700">
                      @{log.username} ({log.user_role})
                    </span>
                  </div>
                </div>

                {log.reason && (
                  <p className="mt-2 text-xs text-slate-600 bg-slate-50 p-2 rounded-lg border border-slate-100">
                    <strong>Motivo:</strong> {log.reason}
                  </p>
                )}

                {(log.before_state_json || log.after_state_json) && (
                  <div className="mt-2">
                    <button
                      onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                      className="flex items-center gap-1 text-[11px] font-bold text-military-700 hover:underline"
                    >
                      {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                      <span>{isExpanded ? 'Ocultar detalle de datos' : 'Ver datos antes / después'}</span>
                    </button>

                    {isExpanded && (
                      <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-mono">
                        {log.before_state_json && (
                          <div className="rounded-lg bg-red-50/50 p-3 border border-red-100 overflow-x-auto">
                            <span className="text-[10px] uppercase font-bold text-red-700 block mb-1">
                              Estado Anterior
                            </span>
                            <pre className="text-[11px] text-red-900 whitespace-pre-wrap">
                              {log.before_state_json}
                            </pre>
                          </div>
                        )}
                        {log.after_state_json && (
                          <div className="rounded-lg bg-emerald-50/50 p-3 border border-emerald-100 overflow-x-auto">
                            <span className="text-[10px] uppercase font-bold text-emerald-700 block mb-1">
                              Estado Posterior
                            </span>
                            <pre className="text-[11px] text-emerald-900 whitespace-pre-wrap">
                              {log.after_state_json}
                            </pre>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        ) : (
          <div className="rounded-xl border border-slate-200 bg-white py-12 text-center text-xs text-slate-400">
            No se encontraron registros en la bitácora.
          </div>
        )}
      </div>
    </div>
  );
}
