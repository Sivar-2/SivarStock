import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { queryOne } from './db';
import { cookies } from 'next/headers';

const SESSION_SECRET = process.env.SESSION_SECRET || 'sivarstock_enterprise_secure_salt_key_2026';

export interface UserAllowedActions {
  can_read: boolean;
  can_write: boolean;
  can_delete: boolean;
  can_export: boolean;
  can_view_financials: boolean;
}

export interface UserSession {
  id: string;
  username: string;
  fullName: string;
  name?: string;
  email: string;
  role: 'SUPERADMIN' | 'SUPER_ADMIN' | 'ADMIN' | 'SUBADMIN' | 'AREA_MANAGER' | 'OPERATOR' | 'VIEWER';
  isSuperAdmin: boolean;
  departmentId: string | null;
  departmentCode: string | null;
  departmentName: string | null;
  initials: string;
  canViewFinancials: boolean;
  canExport: boolean;
  canManageUsers: boolean;
  canEdit: boolean;
  allowedTabs: string[];
  allowedActions: UserAllowedActions;
  allowedDepartments: string[];
  onlyOwnDepartment: boolean;
  quickAccessEnabled: boolean;
  hasPin: boolean;
}

/**
 * Sesión Inmutable Resiliente para el Master Super Admin TurcoSivar
 * Garantiza acceso al 100% de la aplicación incluso ante fallos de conexión a DB
 */
export const TURCOSIVAR_SUPERADMIN_SESSION: UserSession = {
  id: '1',
  username: 'TurcoSivar',
  fullName: 'Alexander Turcios Melendez',
  name: 'Alexander Turcios Melendez',
  email: 'turcosivar@fpc.local',
  role: 'SUPER_ADMIN',
  isSuperAdmin: true,
  departmentId: null,
  departmentCode: 'GLOBAL',
  departmentName: 'Dirección General FPC',
  initials: 'ATM',
  canViewFinancials: true,
  canExport: true,
  canManageUsers: true,
  canEdit: true,
  allowedTabs: [
    'DASHBOARD', 'INVENTARIO', 'CELULARES', 'PRODUCTOS', 'MOVIMIENTOS',
    'ASIGNACIONES', 'MANTENIMIENTO', 'SERVICIOS', 'COSTOS', 'REPORTES',
    'DEPARTAMENTOS', 'PERMISOS', 'USUARIOS', 'AUDITORIA', 'CONFIGURACION'
  ],
  allowedActions: {
    can_read: true,
    can_write: true,
    can_delete: true,
    can_export: true,
    can_view_financials: true,
  },
  allowedDepartments: ['*'],
  onlyOwnDepartment: false,
  quickAccessEnabled: true,
  hasPin: true,
};

/**
 * Firma criptográfica de tokens con HMAC-SHA256
 */
export function signSessionToken(payload: object): string {
  const json = JSON.stringify(payload);
  const b64Payload = Buffer.from(json, 'utf8').toString('base64');
  const hmac = crypto.createHmac('sha256', SESSION_SECRET).update(b64Payload).digest('base64url');
  return `${b64Payload}.${hmac}`;
}

export function decodeSessionToken(token: string): any | null {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length === 2) {
    const [b64Payload, hmac] = parts;
    const expectedHmac = crypto.createHmac('sha256', SESSION_SECRET).update(b64Payload).digest('base64url');
    if (hmac !== expectedHmac) {
      console.warn('Alerta de seguridad: Firma de sesión inválida o token manipulado.');
      return null;
    }
    try {
      return JSON.parse(Buffer.from(b64Payload, 'base64').toString('utf8'));
    } catch {
      return null;
    }
  }
  // Compatibilidad hacia atrás si el token es base64 simple
  try {
    return JSON.parse(Buffer.from(token, 'base64').toString('utf8'));
  } catch {
    return null;
  }
}

/**
 * Tokens de desafío temporal para validación en 2 pasos de PIN
 */
export function signPinChallenge(payload: { userId: string; username: string; exp: number }): string {
  return signSessionToken({ ...payload, isPinChallenge: true });
}

export function decodePinChallenge(token: string): { userId: string; username: string; exp: number } | null {
  const decoded = decodeSessionToken(token);
  if (!decoded || !decoded.isPinChallenge || !decoded.userId || !decoded.exp) {
    return null;
  }
  if (Date.now() > decoded.exp) {
    return null; // Expirado
  }
  return decoded;
}

/**
 * Funciones de Hash y Verificación de Contraseñas
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  if (!password || !hash) return false;
  return bcrypt.compare(password, hash);
}

/**
 * Funciones de Hash y Verificación de PIN de 4 dígitos
 */
export async function hashPin(pin: string): Promise<string> {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(pin.trim(), salt);
}

export async function verifyPin(pin: string, hash: string | null | undefined): Promise<boolean> {
  if (!pin || !hash) return false;
  return bcrypt.compare(pin.trim(), hash);
}

/**
 * Obtiene el usuario de la sesión actual basado en la cookie segura sivarstock_session
 * Incluye blindaje maestro para TurcoSivar (retorna sesión válida sin depender de SQL)
 */
export async function getCurrentUser(): Promise<UserSession | null> {
  try {
    const cookieStore = cookies();
    const sessionCookie = cookieStore.get('sivarstock_session');
    
    if (!sessionCookie || !sessionCookie.value) {
      return null;
    }

    const decoded = decodeSessionToken(sessionCookie.value);
    if (!decoded) return null;

    // BLINDAJE RESILIENTE MASTER SUPER ADMIN:
    const isSuperAdminUser = Boolean(
      decoded.username?.toLowerCase() === 'turcosivar' ||
      decoded.role === 'SUPER_ADMIN' ||
      decoded.role === 'SUPERADMIN' ||
      decoded.userId === '1' ||
      decoded.id === '1' ||
      decoded.id === 1
    );

    if (isSuperAdminUser) {
      return TURCOSIVAR_SUPERADMIN_SESSION;
    }

    const userId = decoded.userId || decoded.id;
    if (!userId) return null;

    let row: any = null;
    try {
      row = await queryOne<any>(
        `SELECT u.id, u.username, u.full_name, u.email, u.role, u.department_id, 
                u.initials, u.can_view_financials, u.can_export, u.can_manage_users, u.can_edit,
                u.allowed_tabs_json, u.allowed_actions_json, u.allowed_departments_json,
                u.only_own_department, u.pin_hash, u.quick_access_enabled,
                d.code as department_code, d.name as department_name
         FROM users u
         LEFT JOIN departments d ON u.department_id = d.id
         WHERE (u.id = ? OR LOWER(u.username) = ?) AND u.is_active = 1`,
        [userId, (decoded.username || '').toLowerCase()]
      );
    } catch (dbErr) {
      console.warn('DB check warning en getCurrentUser:', dbErr);
      return null;
    }

    if (!row) return null;

    const isRowSuperAdmin = row.role === 'SUPERADMIN' || row.role === 'SUPER_ADMIN' || row.username === 'TurcoSivar';
    if (isRowSuperAdmin) {
      return TURCOSIVAR_SUPERADMIN_SESSION;
    }

    // Parsear pestañas permitidas
    let allowedTabs: string[] = [];
    try {
      allowedTabs = row.allowed_tabs_json ? JSON.parse(row.allowed_tabs_json) : [];
    } catch {
      allowedTabs = ['DASHBOARD', 'INVENTARIO', 'CELULARES', 'PRODUCTOS'];
    }

    // Parsear acciones granulares
    let allowedActions: UserAllowedActions = {
      can_read: true,
      can_write: Boolean(row.can_edit),
      can_delete: false,
      can_export: Boolean(row.can_export),
      can_view_financials: Boolean(row.can_view_financials),
    };
    if (row.allowed_actions_json) {
      try {
        const parsed = JSON.parse(row.allowed_actions_json);
        allowedActions = {
          can_read: parsed.can_read !== undefined ? Boolean(parsed.can_read) : true,
          can_write: parsed.can_write !== undefined ? Boolean(parsed.can_write) : Boolean(row.can_edit),
          can_delete: parsed.can_delete !== undefined ? Boolean(parsed.can_delete) : false,
          can_export: parsed.can_export !== undefined ? Boolean(parsed.can_export) : Boolean(row.can_export),
          can_view_financials: parsed.can_view_financials !== undefined ? Boolean(parsed.can_view_financials) : Boolean(row.can_view_financials),
        };
      } catch {}
    }

    // Parsear departamentos permitidos
    let allowedDepartments: string[] = [];
    try {
      allowedDepartments = row.allowed_departments_json ? JSON.parse(row.allowed_departments_json) : [];
    } catch {
      allowedDepartments = row.department_id ? [row.department_id] : [];
    }

    // Para cualquier otro rol, "PERMISOS" y "USUARIOS" son exclusivos de Super Admin
    allowedTabs = allowedTabs.filter(
      (tab: string) => tab !== 'PERMISOS' && tab !== 'USUARIOS'
    );

    // MOVIMIENTOS y AUDITORIA son exclusivos de ADMIN y SUPERADMIN
    if (row.role !== 'ADMIN') {
      allowedTabs = allowedTabs.filter(
        (tab: string) => tab !== 'MOVIMIENTOS' && tab !== 'AUDITORIA'
      );
    }

    // Rol VIEWER: edición deshabilitada siempre
    const isViewer = row.role === 'VIEWER';
    const canEdit = isViewer ? false : Boolean(row.can_edit && allowedActions.can_write);
    if (isViewer) {
      allowedActions.can_write = false;
      allowedActions.can_delete = false;
    }

    return {
      id: row.id,
      username: row.username,
      fullName: row.full_name,
      name: row.full_name,
      email: row.email,
      role: row.role,
      isSuperAdmin: false,
      departmentId: row.department_id,
      departmentCode: row.department_code,
      departmentName: row.department_name,
      initials: row.initials || 'US',
      canViewFinancials: Boolean(row.can_view_financials && allowedActions.can_view_financials),
      canExport: Boolean(row.can_export && allowedActions.can_export),
      canManageUsers: Boolean(row.can_manage_users || row.role === 'ADMIN'),
      canEdit,
      allowedTabs,
      allowedActions,
      allowedDepartments,
      onlyOwnDepartment: Boolean(row.only_own_department),
      quickAccessEnabled: Boolean(row.quick_access_enabled),
      hasPin: Boolean(row.pin_hash),
    };
  } catch (error) {
    console.error('Error al obtener usuario de sesión:', error);
    return null;
  }
}

/**
 * Alias getSession() requerido por las reglas de SivarStock
 */
export const getSession = getCurrentUser;

/**
 * Función central de autorización RBAC por Módulo y Modo (READ, WRITE, DELETE).
 */
export function canAccessModule(
  user: UserSession | null,
  moduleName: string,
  mode: 'READ' | 'WRITE' | 'DELETE' = 'READ'
): boolean {
  if (!user) return false;
  if (
    user.isSuperAdmin ||
    user.role === 'SUPERADMIN' ||
    user.role === 'SUPER_ADMIN' ||
    user.username?.toLowerCase() === 'turcosivar'
  ) {
    return true;
  }

  const mod = moduleName.toUpperCase().trim();

  // Gestión de Permisos / Usuarios exclusiva de SUPERADMIN
  if (mod === 'PERMISOS' || mod === 'USUARIOS') {
    return false;
  }

  // MOVIMIENTOS y AUDITORIA exclusivos de ADMIN o SUPERADMIN
  if (mod === 'MOVIMIENTOS' || mod === 'AUDITORIA') {
    if (user.role !== 'ADMIN') return false;
  }

  // VIEWER nunca puede escribir ni eliminar
  if (user.role === 'VIEWER') {
    if (mode === 'WRITE' || mode === 'DELETE') return false;
    return user.allowedTabs.includes(mod);
  }

  // Si el módulo no está en las pestañas permitidas del usuario
  if (!user.allowedTabs.includes(mod)) {
    return false;
  }

  // Lectura
  if (mode === 'READ') {
    return user.allowedActions.can_read;
  }

  // Escritura
  if (mode === 'WRITE') {
    return user.canEdit && user.allowedActions.can_write;
  }

  // Eliminación
  if (mode === 'DELETE') {
    if (!user.allowedActions.can_delete) return false;
    if (mod === 'EMPLEADOS' || mod === 'DEPARTAMENTOS' || mod === 'CONFIGURACION') {
      return user.role === 'ADMIN';
    }
    return true;
  }

  return true;
}

/**
 * Helper para validar permisos de escritura en rutas API
 */
export function validateApiWritePermission(
  user: UserSession | null,
  moduleName?: string
): { error: string; status: number } | null {
  if (!user) {
    return { error: 'No autorizado: Sesión requerida', status: 401 };
  }

  if (
    user.isSuperAdmin ||
    user.role === 'SUPERADMIN' ||
    user.role === 'SUPER_ADMIN' ||
    user.username?.toLowerCase() === 'turcosivar'
  ) {
    return null;
  }

  if (user.role === 'VIEWER' || !user.canEdit || !user.allowedActions.can_write) {
    return {
      error: 'Acceso denegado: El usuario no posee permisos de edición/escritura asignados.',
      status: 403,
    };
  }

  if (moduleName && !canAccessModule(user, moduleName, 'WRITE')) {
    return {
      error: `Acceso denegado: No tiene permisos de modificación en el módulo ${moduleName}.`,
      status: 403,
    };
  }

  return null;
}

/**
 * Validadores de Rol y Departamento
 */
export function checkPermission(
  user: UserSession | null, 
  requiredRole?: 'SUPERADMIN' | 'SUPER_ADMIN' | 'ADMIN' | 'SUBADMIN' | 'AREA_MANAGER' | 'OPERATOR' | 'VIEWER'
): boolean {
  if (!user) return false;
  if (
    user.isSuperAdmin ||
    user.role === 'SUPERADMIN' ||
    user.role === 'SUPER_ADMIN' ||
    user.username?.toLowerCase() === 'turcosivar'
  ) {
    return true;
  }

  if (requiredRole === 'SUPERADMIN' || requiredRole === 'SUPER_ADMIN') {
    return false;
  }

  if (requiredRole === 'ADMIN') {
    return user.role === 'ADMIN';
  }

  if (requiredRole === 'SUBADMIN') {
    return user.role === 'ADMIN' || user.role === 'SUBADMIN';
  }

  if (requiredRole === 'AREA_MANAGER') {
    return user.role === 'ADMIN' || user.role === 'SUBADMIN' || user.role === 'AREA_MANAGER';
  }

  return true;
}

export function canAccessDepartment(user: UserSession | null, departmentId?: string | null): boolean {
  if (!user) return false;
  if (
    user.isSuperAdmin ||
    user.role === 'SUPERADMIN' ||
    user.role === 'SUPER_ADMIN' ||
    user.username?.toLowerCase() === 'turcosivar' ||
    user.role === 'ADMIN'
  ) {
    return true;
  }
  if (!departmentId) return true;

  if (user.allowedDepartments && user.allowedDepartments.includes('*')) {
    return true;
  }

  if (user.allowedDepartments && user.allowedDepartments.includes(departmentId)) {
    return true;
  }

  if (!user.onlyOwnDepartment && (!user.allowedDepartments || user.allowedDepartments.length === 0)) {
    return true;
  }

  return user.departmentId === departmentId;
}
