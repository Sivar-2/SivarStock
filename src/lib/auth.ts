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
  // Compatibilidad hacia atrás si el token es base64 simple
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

    const row = await queryOne<any>(
      `SELECT u.id, u.username, u.full_name, u.email, u.role, u.department_id, 
              u.initials, u.can_view_financials, u.can_export, u.can_manage_users, u.can_edit,
              u.allowed_tabs_json, u.only_own_department,
              d.code as department_code, d.name as department_name
       FROM users u
       LEFT JOIN departments d ON u.department_id = d.id
       WHERE u.id = ? AND u.is_active = 1`,
      [userId]
    );

    if (!row) return null;

    let allowedTabs: string[] = [];
    try {
      allowedTabs = row.allowed_tabs_json ? JSON.parse(row.allowed_tabs_json) : [];
    } catch {
      allowedTabs = ['DASHBOARD', 'INVENTARIO', 'CELULARES', 'PRODUCTOS'];
    }

    // Regla estricta 1: MOVIMIENTOS y AUDITORIA son EXCLUSIVOS del rol ADMIN.
    // Para cualquier otro rol, se ocultan de sus allowedTabs.
    if (row.role !== 'ADMIN') {
      allowedTabs = allowedTabs.filter(
        (tab: string) => tab !== 'MOVIMIENTOS' && tab !== 'AUDITORIA' && tab !== 'USUARIOS'
      );
    }

    // Regla estricta 2: El rol VIEWER tiene canEdit = false forzado en el servidor
    const isViewer = row.role === 'VIEWER';
    const canEdit = isViewer ? false : Boolean(row.can_edit);

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
      canViewFinancials: Boolean(row.can_view_financials),
      canExport: Boolean(row.can_export),
      canManageUsers: Boolean(row.can_manage_users || row.role === 'ADMIN'),
      canEdit,
      allowedTabs,
      onlyOwnDepartment: Boolean(row.only_own_department),
    };
  } catch (error) {
    console.error('Error al obtener usuario de sesión:', error);
    return null;
  }
}

/**
 * Función central de autorización RBAC por Módulo y Modo (READ, WRITE, DELETE).
 * - ADMIN: acceso total irrestricto.
 * - MOVIMIENTOS y AUDITORIA: Exclusivos de ADMIN (retorna false para cualquier otro rol).
 * - VIEWER: forzado canEdit = false, sólo puede READ en sus pestañas permitidas.
 * - SUBADMIN (CEO): con canEdit = true puede crear y editar productos en /api/products
 *   e ítems en /api/inventory/items según sus allowedTabs.
 */
export function canAccessModule(
  user: UserSession | null,
  moduleName: string,
  mode: 'READ' | 'WRITE' | 'DELETE' = 'READ'
): boolean {
  if (!user) return false;
  if (user.role === 'ADMIN') return true;

  const mod = moduleName.toUpperCase().trim();

  // Regla estricta 1: MOVIMIENTOS y AUDITORIA exclusivos de ADMIN
  if (mod === 'MOVIMIENTOS' || mod === 'AUDITORIA') {
    return false;
  }

  // Regla estricta 2: VIEWER nunca puede escribir ni eliminar
  if (user.role === 'VIEWER') {
    if (mode === 'WRITE' || mode === 'DELETE') return false;
    return user.allowedTabs.includes(mod);
  }

  // Si el módulo no está en las pestañas permitidas del usuario
  if (!user.allowedTabs.includes(mod)) {
    return false;
  }

  // Para lectura basta con tener la pestaña habilitada
  if (mode === 'READ') {
    return true;
  }

  // Si requiere escritura o borrado, validar canEdit
  if (!user.canEdit) {
    return false;
  }

  // Para borrado (DELETE):
  if (mode === 'DELETE') {
    // Solo ADMIN puede borrar empleados o usuarios
    if (mod === 'EMPLEADOS' || mod === 'DEPARTAMENTOS' || mod === 'USUARIOS') {
      return false;
    }
    // SUBADMIN con canEdit puede borrar en PRODUCTOS o INVENTARIO
    if (user.role === 'SUBADMIN') {
      return mod === 'PRODUCTOS' || mod === 'INVENTARIO' || mod === 'CELULARES';
    }
    return false;
  }

  return true;
}

/**
 * Helper rápido para rutas API: valida que el usuario no sea VIEWER ni tenga canEdit deshabilitado.
 * Retorna mensaje de error si está denegado, o null si está autorizado.
 */
export function validateApiWritePermission(
  user: UserSession | null,
  moduleName?: string
): { error: string; status: number } | null {
  if (!user) {
    return { error: 'No autorizado: Sesión requerida', status: 401 };
  }

  if (user.role === 'VIEWER' || !user.canEdit) {
    return {
      error: 'Acceso denegado: El rol Lector (VIEWER) tiene permisos de edición desactivados en el servidor.',
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
 * Validadores de Autorización para Server Actions y API Routes
 */
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
  if (user.role === 'ADMIN' || user.role === 'SUBADMIN') return true;
  if (!departmentId) return true;
  return user.departmentId === departmentId;
}
