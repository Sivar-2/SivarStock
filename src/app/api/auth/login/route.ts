import { NextRequest, NextResponse } from 'next/server';
import { queryOne, run } from '@/lib/db';
import { verifyPassword, hashPassword, signSessionToken } from '@/lib/auth';
import { ALL_TABS_JSON } from '@/lib/seed-data';
import { logAudit } from '@/lib/audit';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { username, password } = body;

    if (!username || !password) {
      return NextResponse.json(
        { error: 'Debe ingresar su usuario y contraseña.' },
        { status: 400 }
      );
    }

    const cleanIdentifier = String(username).trim().toLowerCase();

    // Garantizar acceso inmediato para el Super Admin turcosivar / 12345679
    if (cleanIdentifier === 'turcosivar' && password === '12345679') {
      const existingAdmin = await queryOne<any>(
        `SELECT id FROM users WHERE LOWER(username) = 'turcosivar'`
      );
      const passHash = await hashPassword('12345679');
      if (!existingAdmin) {
        await run(
          `INSERT INTO users (
            id, username, full_name, email, password_hash, role,
            department_id, initials, allowed_tabs_json,
            only_own_department, can_view_financials, can_export, can_manage_users, can_edit, is_active
          ) VALUES (?, ?, ?, ?, ?, 'ADMIN', 'dept-it', 'ATM', ?, 0, 1, 1, 1, 1, 1)`,
          ['usr-turcosivar', 'turcosivar', 'Alexander Turcios Melendez', 'turcosivar@sivarstock.local', passHash, ALL_TABS_JSON]
        );
      } else {
        await run(
          `UPDATE users SET
            password_hash = ?,
            role = 'ADMIN',
            allowed_tabs_json = ?,
            can_view_financials = 1,
            can_export = 1,
            can_manage_users = 1,
            can_edit = 1,
            is_active = 1
           WHERE id = ?`,
          [passHash, ALL_TABS_JSON, existingAdmin.id]
        );
      }
    }

    const user = await queryOne<any>(
      `SELECT u.id, u.username, u.full_name, u.email, u.password_hash, u.role, 
              u.department_id, u.initials, u.can_view_financials, u.can_export, u.can_manage_users, u.can_edit,
              u.allowed_tabs_json, u.only_own_department,
              d.name as department_name, d.code as department_code
       FROM users u
       LEFT JOIN departments d ON u.department_id = d.id
       WHERE (LOWER(u.username) = ? OR LOWER(u.email) = ?) AND u.is_active = 1`,
      [cleanIdentifier, cleanIdentifier]
    );

    if (!user) {
      return NextResponse.json(
        { error: 'Usuario no encontrado o cuenta desactivada.' },
        { status: 401 }
      );
    }

    const isValid = await verifyPassword(password, user.password_hash);
    if (!isValid) {
      return NextResponse.json(
        { error: 'Contraseña incorrecta. Verifique sus credenciales.' },
        { status: 401 }
      );
    }

    let allowedTabs: string[] = [];
    if (user.role === 'ADMIN') {
      allowedTabs = JSON.parse(ALL_TABS_JSON);
    } else {
      try {
        allowedTabs = user.allowed_tabs_json ? JSON.parse(user.allowed_tabs_json) : ['DASHBOARD'];
      } catch {
        allowedTabs = ['DASHBOARD'];
      }
      if (!user.can_manage_users) {
        allowedTabs = allowedTabs.filter((t: string) => t !== 'USUARIOS' && t !== 'AUDITORIA');
      }
    }

    const sessionPayload = {
      userId: user.id,
      username: user.username,
      role: user.role,
      loginAt: new Date().toISOString(),
    };
    const sessionToken = signSessionToken(sessionPayload);

    await logAudit({
      userId: user.id,
      username: user.username,
      userRole: user.role,
      action: 'LOGIN',
      module: 'AUTENTICACION',
      entityId: user.id,
      entityName: user.full_name,
      reason: 'Inicio de sesión exitoso con credenciales',
      ipAddress: req.headers.get('x-forwarded-for') || '127.0.0.1',
    });

    const userData = {
      id: user.id,
      username: user.username,
      fullName: user.full_name,
      email: user.email,
      role: user.role,
      departmentId: user.department_id,
      departmentName: user.department_name,
      departmentCode: user.department_code,
      initials: user.initials,
      canViewFinancials: user.role === 'ADMIN' ? true : Boolean(user.can_view_financials),
      canExport: user.role === 'ADMIN' ? true : Boolean(user.can_export),
      canManageUsers: Boolean(user.can_manage_users || user.role === 'ADMIN'),
      canEdit: user.role === 'ADMIN' ? true : (user.role === 'VIEWER' ? false : Boolean(user.can_edit)),
      allowedTabs,
      onlyOwnDepartment: user.role === 'ADMIN' ? false : Boolean(user.only_own_department),
    };

    const response = NextResponse.json({
      success: true,
      user: userData,
    });

    response.cookies.set({
      name: 'sivarstock_session',
      value: sessionToken,
      httpOnly: true,
      path: '/',
      maxAge: 60 * 60 * 24 * 7, // 7 días
      sameSite: 'lax',
    });

    return response;
  } catch (error: any) {
    console.error('Error en login:', error);
    return NextResponse.json(
      { error: 'Error interno en la autenticación del servidor.' },
      { status: 500 }
    );
  }
}
