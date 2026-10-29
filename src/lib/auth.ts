import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { queryOne } from './db';
import { cookies } from 'next/headers';

const SESSION_SECRET = process.env.SESSION_SECRET || 'sivarstock_enterprise_secure_salt_key_2026';

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
  try {
    return JSON.parse(Buffer.from(token, 'base64').toString('utf8'));
  } catch {
    return null;
  }
}

export interface UserSession {
  id: string;
  username: string;
  fullName: string;
  email: string;
  role: 'ADMIN' | 'SUBADMIN' | 'AREA_MANAGER' | 'VIEWER';
  departmentId: string | null;
  departmentCode: string | null;
  departmentName: string | null;
  initials: string;
  canViewFinancials: boolean;
  canExport: boolean;
  canManageUsers: boolean;
  canEdit: boolean;
  allowedTabs: string[];
  onlyOwnDepartment: boolean;
}

export async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

const ALL_ADMIN_TABS = [
  'DASHBOARD', 'INVENTARIO', 'CELULARES', 'PRODUCTOS', 'MOVIMIENTOS',
  'ASIGNACIONES', 'MANTENIMIENTO', 'SERVICIOS', 'COSTOS', 'REPORTES',
  'DEPARTAMENTOS', 'USUARIOS', 'AUDITORIA', 'CONFIGURACION'
];

/**
 * Obtiene el usuario de la sesión actual basado en la cookie segura
 */
export async function getCurrentUser(): Promise<UserSession | null> {
  try {
    const cookieStore = cookies();
    const sessionCookie = cookieStore.get('sivarstock_session');
    
    if (!sessionCookie || !sessionCookie.value) {
      return null;
    }

    const decoded = decodeSessionToken(sessionCookie.value);
    if (!decoded || !decoded.userId) return null;
    const userId = decoded.userId;

    let row = await queryOne<any>(
      `SELECT u.id, u.username, u.full_name, u.email, u.role, u.department_id, 
              u.initials, u.can_view_financials, u.can_export, u.can_manage_users, u.can_edit,
              u.allowed_tabs_json, u.only_own_department,
              d.code as department_code, d.name as department_name
       FROM users u
       LEFT JOIN departments d ON u.department_id = d.id
       WHERE u.id = ? AND u.is_active = 1`,
      [userId]
    );

    if (!row && decoded.username) {
      row = await queryOne<any>(
        `SELECT u.id, u.username, u.full_name, u.email, u.role, u.department_id, 
                u.initials, u.can_view_financials, u.can_export, u.can_manage_users, u.can_edit,
                u.allowed_tabs_json, u.only_own_department,
                d.code as department_code, d.name as department_name
         FROM users u
         LEFT JOIN departments d ON u.department_id = d.id
         WHERE LOWER(u.username) = ? AND u.is_active = 1`,
        [String(decoded.username).toLowerCase()]
      );
    }

    if (!row) return null;

    let allowedTabs: string[] = [];
    if (row.role === 'ADMIN') {
      allowedTabs = ALL_ADMIN_TABS;
    } else {
      try {
        allowedTabs = row.allowed_tabs_json ? JSON.parse(row.allowed_tabs_json) : [];
      } catch {
        allowedTabs = ['DASHBOARD'];
      }
      // Si el usuario no es ADMIN, solo ve EXACTAMENTE las pestañas que el administrador le asignó
      if (!row.can_manage_users) {
        allowedTabs = allowedTabs.filter((tab: string) => tab !== 'USUARIOS' && tab !== 'AUDITORIA');
      }
    }

    const isViewer = row.role === 'VIEWER';
    const canEdit = row.role === 'ADMIN' ? true : (isViewer ? false : Boolean(row.can_edit));

    return {
      id: row.id,
      username: row.username,
      fullName: row.full_name,
      email: row.email,
      role: row.role,
      departmentId: row.department_id,
      departmentCode: row.department_code,
      departmentName: row.department_name,
      initials: row.initials,
      canViewFinancials: row.role === 'ADMIN' ? true : Boolean(row.can_view_financials),
      canExport: row.role === 'ADMIN' ? true : Boolean(row.can_export),
      canManageUsers: Boolean(row.can_manage_users || row.role === 'ADMIN'),
      canEdit,
      allowedTabs,
      onlyOwnDepartment: row.role === 'ADMIN' ? false : Boolean(row.only_own_department),
    };
  } catch (error) {
    console.error('Error al obtener usuario de sesión:', error);
    return null;
  }
}

/**
 * Función central de autorización RBAC por Módulo y Modo (READ, WRITE, DELETE).
 * - ADMIN: acceso total irrestricto.
 * - Otros usuarios: acceso estrictamente limitado a sus `allowedTabs` y permisos (`canEdit`).
 */
export function canAccessModule(
  user: UserSession | null,
  moduleName: string,
  mode: 'READ' | 'WRITE' | 'DELETE' | 'view' | 'create' | 'edit' | 'delete' | string = 'READ'
): boolean {
  if (!user) return false;
  if (user.role === 'ADMIN') return true;

  const rawMode = String(mode || 'READ').toLowerCase();
  const normalizedMode =
    rawMode === 'view' || rawMode === 'read' ? 'READ' :
    rawMode === 'delete' ? 'DELETE' :
    'WRITE';

  const mod = moduleName.toUpperCase().trim();

  // Mapear alias de módulos a las llaves de pestañas
  const tabKey =
    mod === 'EMPLEADOS' ? 'DEPARTAMENTOS' :
    mod === 'SERVICIOS_DIGITALES' ? 'SERVICIOS' :
    mod;

  if (!user.allowedTabs.includes(tabKey) && !user.allowedTabs.includes(mod)) {
    return false;
  }

  if (normalizedMode === 'READ') {
    return true;
  }

  if (user.role === 'VIEWER' || !user.canEdit) {
    return false;
  }

  if (normalizedMode === 'DELETE') {
    if (mod === 'USUARIOS' || mod === 'AUDITORIA') {
      return false;
    }
    return user.canEdit;
  }

  return true;
}

export function validateApiWritePermission(
  user: UserSession | null,
  moduleName?: string
): { error: string; status: number } | null {
  if (!user) {
    return { error: 'No autorizado: Sesión requerida', status: 401 };
  }

  if (user.role === 'VIEWER' || !user.canEdit) {
    return {
      error: 'Acceso denegado: Su cuenta tiene permisos de solo lectura (sin edición).',
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

export function checkPermission(
  user: UserSession | null, 
  requiredRole?: 'ADMIN' | 'SUBADMIN' | 'AREA_MANAGER' | 'VIEWER'
): boolean {
  if (!user) return false;
  if (user.role === 'ADMIN') return true;

  if (requiredRole === 'SUBADMIN') {
    return user.role === 'SUBADMIN';
  }

  if (requiredRole === 'AREA_MANAGER') {
    return user.role === 'SUBADMIN' || user.role === 'AREA_MANAGER';
  }

  return true;
}

export function canAccessDepartment(user: UserSession | null, departmentId?: string | null): boolean {
  if (!user) return false;
  if (user.role === 'ADMIN' || !user.onlyOwnDepartment) return true;
  if (!departmentId) return true;
  return user.departmentId === departmentId;
}
