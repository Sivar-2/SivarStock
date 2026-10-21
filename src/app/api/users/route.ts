import { NextResponse, NextRequest } from 'next/server';
import { query, queryOne, run } from '@/lib/db';
import { getSession, hashPassword, hashPin } from '@/lib/auth';
import { logAudit } from '@/lib/audit';

function checkSuperAdminAccess(user: any): boolean {
  if (!user) return false;
  return Boolean(
    user.isSuperAdmin ||
    user.role === 'SUPERADMIN' ||
    user.username === 'TurcoSivar'
  );
}

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!checkSuperAdminAccess(session)) {
      return NextResponse.json(
        { error: 'Acceso restringido: Solo el Super Administrador (TurcoSivar) tiene autorización para gestionar permisos.' },
        { status: 403 }
      );
    }

    const users = await query<any>(`
      SELECT 
        u.id,
        u.username,
        u.full_name,
        u.email,
        u.role,
        u.department_id,
        u.employee_id,
        u.initials,
        u.allowed_tabs_json,
        u.allowed_actions_json,
        u.allowed_departments_json,
        u.only_own_department,
        u.can_view_financials,
        u.can_export,
        u.can_edit,
        u.quick_access_enabled,
        CASE WHEN u.pin_hash IS NOT NULL AND u.pin_hash != '' THEN 1 ELSE 0 END as has_pin,
        u.is_active,
        u.created_at,
        d.name as department_name,
        d.code as department_code,
        e.employee_code
      FROM users u
      LEFT JOIN departments d ON u.department_id = d.id
      LEFT JOIN employees e ON u.employee_id = e.id
      ORDER BY 
        CASE 
          WHEN u.username = 'TurcoSivar' OR u.role = 'SUPERADMIN' THEN 1 
          WHEN u.role = 'ADMIN' THEN 2 
          WHEN u.role = 'SUBADMIN' THEN 3 
          ELSE 4 
        END,
        u.full_name ASC
    `);

    const formattedUsers = users.map((u) => {
      let allowedTabs: string[] = [];
      try {
        allowedTabs = u.allowed_tabs_json ? JSON.parse(u.allowed_tabs_json) : [];
      } catch {
        allowedTabs = [];
      }

      let allowedActions = {
        can_read: true,
        can_write: Boolean(u.can_edit),
        can_delete: false,
        can_export: Boolean(u.can_export),
        can_view_financials: Boolean(u.can_view_financials),
      };
      try {
        if (u.allowed_actions_json) {
          const parsed = JSON.parse(u.allowed_actions_json);
          allowedActions = {
            can_read: parsed.can_read !== undefined ? Boolean(parsed.can_read) : true,
            can_write: parsed.can_write !== undefined ? Boolean(parsed.can_write) : Boolean(u.can_edit),
            can_delete: parsed.can_delete !== undefined ? Boolean(parsed.can_delete) : false,
            can_export: parsed.can_export !== undefined ? Boolean(parsed.can_export) : Boolean(u.can_export),
            can_view_financials: parsed.can_view_financials !== undefined ? Boolean(parsed.can_view_financials) : Boolean(u.can_view_financials),
          };
        }
      } catch {}

      let allowedDepartments: string[] = [];
      try {
        allowedDepartments = u.allowed_departments_json ? JSON.parse(u.allowed_departments_json) : [];
      } catch {}

      return {
        id: u.id,
        username: u.username,
        full_name: u.full_name,
        email: u.email,
        role: u.role,
        department_id: u.department_id,
        department_name: u.department_name,
        department_code: u.department_code,
        employee_id: u.employee_id,
        employee_code: u.employee_code,
        initials: u.initials,
        allowedTabs,
        allowedActions,
        allowedDepartments,
        only_own_department: Boolean(u.only_own_department),
        can_view_financials: Boolean(u.can_view_financials),
        can_export: Boolean(u.can_export),
        can_edit: Boolean(u.can_edit),
        quick_access_enabled: Boolean(u.quick_access_enabled),
        has_pin: Boolean(u.has_pin),
        is_active: Boolean(u.is_active),
        created_at: u.created_at,
        is_super_admin: u.username === 'TurcoSivar' || u.role === 'SUPERADMIN',
      };
    });

    return NextResponse.json({ success: true, users: formattedUsers });
  } catch (error: any) {
    console.error('Error al listar usuarios:', error);
    return NextResponse.json({ error: 'Error interno al consultar usuarios.' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!checkSuperAdminAccess(session)) {
      return NextResponse.json(
        { error: 'Acceso restringido: Solo el Super Administrador (TurcoSivar) puede crear nuevos usuarios.' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const {
      username,
      full_name,
      email,
      password,
      pin,
      role = 'OPERATOR',
      department_id,
      employee_id,
      allowedTabs = ['DASHBOARD', 'INVENTARIO', 'PRODUCTOS'],
      allowedActions = { can_read: 1, can_write: 1, can_delete: 0, can_export: 1, can_view_financials: 0 },
      allowedDepartments = [],
      only_own_department = false,
      can_view_financials = false,
      can_export = true,
      can_edit = true,
    } = body;

    if (!username || !full_name || !email || !password) {
      return NextResponse.json(
        { error: 'Usuario, nombre completo, correo y contraseña son campos obligatorios.' },
        { status: 400 }
      );
    }

    // Verificar unicidad de username y email
    const existing = await queryOne<any>(
      'SELECT id FROM users WHERE LOWER(username) = ? OR LOWER(email) = ?',
      [username.trim().toLowerCase(), email.trim().toLowerCase()]
    );
    if (existing) {
      return NextResponse.json(
        { error: 'El nombre de usuario o correo electrónico ya está registrado.' },
        { status: 400 }
      );
    }

    const initials = full_name
      .trim()
      .split(/\s+/)
      .map((w: string) => w[0])
      .join('')
      .substring(0, 3)
      .toUpperCase();

    const passwordHash = await hashPassword(password);
    let pinHash: string | null = null;
    if (pin && typeof pin === 'string' && pin.trim().length === 4) {
      pinHash = await hashPin(pin.trim());
    }

    const id = `usr-${Date.now()}`;
    const allowedTabsJson = JSON.stringify(allowedTabs);
    const allowedActionsJson = JSON.stringify(allowedActions);
    const allowedDepartmentsJson = JSON.stringify(allowedDepartments);

    await run(
      `INSERT INTO users (
        id, username, full_name, email, password_hash, pin_hash, quick_access_enabled,
        role, department_id, employee_id, initials, allowed_tabs_json, allowed_actions_json,
        allowed_departments_json, only_own_department, can_view_financials, can_export,
        can_manage_users, can_edit, is_active
      ) VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
      [
        id,
        username.trim().toLowerCase(),
        full_name.trim(),
        email.trim().toLowerCase(),
        passwordHash,
        pinHash,
        role,
        department_id || null,
        employee_id || null,
        initials,
        allowedTabsJson,
        allowedActionsJson,
        allowedDepartmentsJson,
        only_own_department ? 1 : 0,
        can_view_financials ? 1 : 0,
        can_export ? 1 : 0,
        role === 'SUPERADMIN' || role === 'ADMIN' ? 1 : 0,
        can_edit ? 1 : 0,
      ]
    );

    // Auditoría centralizada
    await logAudit({
      userId: session?.id,
      username: session?.username || 'TurcoSivar',
      userRole: session?.role || 'SUPERADMIN',
      action: 'USER_CREATED',
      module: 'PERMISOS',
      entityId: id,
      entityName: full_name.trim(),
      afterState: { username, role, department_id, allowedTabs, allowedActions },
      reason: 'Creación de usuario con permisos personalizados RBAC',
      ipAddress: request.headers.get('x-forwarded-for') || '127.0.0.1',
    });

    return NextResponse.json({
      success: true,
      id,
      message: 'Usuario y permisos creados exitosamente en el sistema.',
    });
  } catch (error: any) {
    console.error('Error al crear usuario:', error);
    return NextResponse.json(
      { error: error.message || 'Error interno al registrar usuario.' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getSession();
    if (!checkSuperAdminAccess(session)) {
      return NextResponse.json(
        { error: 'Acceso restringido: Solo el Super Administrador (TurcoSivar) puede modificar permisos de usuarios.' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const {
      id,
      full_name,
      email,
      password,
      pin,
      role,
      department_id,
      allowedTabs,
      allowedActions,
      allowedDepartments,
      only_own_department,
      can_view_financials,
      can_export,
      can_edit,
      is_active,
    } = body;

    if (!id) {
      return NextResponse.json({ error: 'ID de usuario requerido.' }, { status: 400 });
    }

    const existingUser = await queryOne<any>('SELECT * FROM users WHERE id = ?', [id]);
    if (!existingUser) {
      return NextResponse.json({ error: 'Usuario no encontrado.' }, { status: 404 });
    }

    // Regla de Protección Inmutable para Master Super Admin TurcoSivar
    const isMasterTurcoSivar = existingUser.username === 'TurcoSivar' || existingUser.id === 'usr-turcosivar';
    if (isMasterTurcoSivar) {
      if (is_active === false || is_active === 0) {
        return NextResponse.json(
          { error: 'El Master Super Admin "TurcoSivar" no puede ser desactivado.' },
          { status: 400 }
        );
      }
      if (role && role !== 'SUPERADMIN') {
        return NextResponse.json(
          { error: 'El Master Super Admin "TurcoSivar" no puede ser degradado de rol.' },
          { status: 400 }
        );
      }
    }

    let passwordHash = existingUser.password_hash;
    if (password && typeof password === 'string' && password.trim().length >= 6) {
      passwordHash = await hashPassword(password.trim());
    }

    let pinHash = existingUser.pin_hash;
    if (pin !== undefined) {
      if (pin && typeof pin === 'string' && pin.trim().length === 4) {
        pinHash = await hashPin(pin.trim());
      } else if (pin === '' || pin === null) {
        pinHash = null;
      }
    }

    const updatedAllowedTabs = allowedTabs ? JSON.stringify(allowedTabs) : existingUser.allowed_tabs_json;
    const updatedAllowedActions = allowedActions ? JSON.stringify(allowedActions) : existingUser.allowed_actions_json;
    const updatedAllowedDepartments = allowedDepartments ? JSON.stringify(allowedDepartments) : existingUser.allowed_departments_json;

    await run(
      `UPDATE users SET
        full_name = ?,
        email = ?,
        password_hash = ?,
        pin_hash = ?,
        role = ?,
        department_id = ?,
        allowed_tabs_json = ?,
        allowed_actions_json = ?,
        allowed_departments_json = ?,
        only_own_department = ?,
        can_view_financials = ?,
        can_export = ?,
        can_edit = ?,
        is_active = ?
       WHERE id = ?`,
      [
        full_name || existingUser.full_name,
        email || existingUser.email,
        passwordHash,
        pinHash,
        role || existingUser.role,
        department_id !== undefined ? department_id : existingUser.department_id,
        updatedAllowedTabs,
        updatedAllowedActions,
        updatedAllowedDepartments,
        only_own_department !== undefined ? (only_own_department ? 1 : 0) : existingUser.only_own_department,
        can_view_financials !== undefined ? (can_view_financials ? 1 : 0) : existingUser.can_view_financials,
        can_export !== undefined ? (can_export ? 1 : 0) : existingUser.can_export,
        can_edit !== undefined ? (can_edit ? 1 : 0) : existingUser.can_edit,
        is_active !== undefined ? (is_active ? 1 : 0) : existingUser.is_active,
        id,
      ]
    );

    // Auditoría centralizada
    await logAudit({
      userId: session?.id,
      username: session?.username || 'TurcoSivar',
      userRole: session?.role || 'SUPERADMIN',
      action: 'USER_UPDATED',
      module: 'PERMISOS',
      entityId: id,
      entityName: full_name || existingUser.full_name,
      beforeState: { role: existingUser.role, is_active: existingUser.is_active },
      afterState: { role, is_active, allowedTabs, allowedActions },
      reason: 'Actualización de credenciales y permisos granulares por Super Admin',
      ipAddress: request.headers.get('x-forwarded-for') || '127.0.0.1',
    });

    return NextResponse.json({
      success: true,
      message: 'Permisos de usuario actualizados con éxito.',
    });
  } catch (error: any) {
    console.error('Error al actualizar usuario:', error);
    return NextResponse.json(
      { error: error.message || 'Error interno al actualizar permisos.' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getSession();
    if (!checkSuperAdminAccess(session)) {
      return NextResponse.json(
        { error: 'Acceso restringido: Solo el Super Administrador (TurcoSivar) puede desactivar usuarios.' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID de usuario requerido.' }, { status: 400 });
    }

    const existingUser = await queryOne<any>('SELECT * FROM users WHERE id = ?', [id]);
    if (!existingUser) {
      return NextResponse.json({ error: 'Usuario no encontrado.' }, { status: 404 });
    }

    if (existingUser.username === 'TurcoSivar' || existingUser.id === 'usr-turcosivar') {
      return NextResponse.json(
        { error: 'El Master Super Admin "TurcoSivar" es inmutable y no puede ser desactivado.' },
        { status: 400 }
      );
    }

    // Soft delete: Desactivar acceso conservando trazabilidad histórica
    await run('UPDATE users SET is_active = 0 WHERE id = ?', [id]);

    await logAudit({
      userId: session?.id,
      username: session?.username || 'TurcoSivar',
      userRole: session?.role || 'SUPERADMIN',
      action: 'USER_DEACTIVATED',
      module: 'PERMISOS',
      entityId: id,
      entityName: existingUser.full_name,
      reason: `Desactivación de cuenta de usuario @${existingUser.username}`,
      ipAddress: request.headers.get('x-forwarded-for') || '127.0.0.1',
    });

    return NextResponse.json({
      success: true,
      message: `El usuario @${existingUser.username} ha sido desactivado exitosamente.`,
    });
  } catch (error: any) {
    console.error('Error al desactivar usuario:', error);
    return NextResponse.json(
      { error: 'Error interno al desactivar usuario.' },
      { status: 500 }
    );
  }
}
