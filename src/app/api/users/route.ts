import { NextResponse, NextRequest } from 'next/server';
import { query, queryOne, execute } from '@/lib/db';
import { getCurrentUser, hashPassword } from '@/lib/auth';

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Solo el administrador puede gestionar usuarios y permisos.' }, { status: 403 });
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
        u.only_own_department,
        u.can_view_financials,
        u.can_export,
        u.can_edit,
        u.is_active,
        u.created_at,
        d.name as department_name,
        d.code as department_code,
        e.employee_code
      FROM users u
      LEFT JOIN departments d ON u.department_id = d.id
      LEFT JOIN employees e ON u.employee_id = e.id
      ORDER BY 
        CASE WHEN u.role = 'ADMIN' THEN 1 WHEN u.role = 'SUBADMIN' THEN 2 ELSE 3 END,
        u.full_name ASC
    `);

    const formattedUsers = users.map((u) => {
      let allowedTabs: string[] = [];
      try {
        allowedTabs = u.allowed_tabs_json ? JSON.parse(u.allowed_tabs_json) : [];
      } catch {
        allowedTabs = [];
      }
      return {
        ...u,
        allowedTabs,
        only_own_department: Boolean(u.only_own_department),
        can_view_financials: Boolean(u.can_view_financials),
        can_export: Boolean(u.can_export),
        can_edit: Boolean(u.can_edit),
        is_active: Boolean(u.is_active),
      };
    });

    return NextResponse.json({ success: true, users: formattedUsers });
  } catch (error: any) {
    console.error('Error fetching users:', error);
    return NextResponse.json({ error: 'Error al consultar usuarios.' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser || currentUser.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Solo el administrador puede crear usuarios.' }, { status: 403 });
    }

    const body = await request.json();
    const {
      username,
      full_name,
      email,
      password,
      role = 'AREA_MANAGER',
      department_id,
      employee_id,
      allowedTabs = ['DASHBOARD', 'INVENTARIO', 'PRODUCTOS'],
      only_own_department = false,
      can_view_financials = false,
      can_export = false,
      can_edit = true,
    } = body;

    if (!username || !full_name || !email || !password) {
      return NextResponse.json({ error: 'Usuario, nombre, correo y contraseña son obligatorios.' }, { status: 400 });
    }

    // Comprobar unicidad
    const existing = await queryOne<any>('SELECT id FROM users WHERE username = ? OR email = ?', [username, email]);
    if (existing) {
      return NextResponse.json({ error: 'El nombre de usuario o correo electrónico ya está registrado.' }, { status: 400 });
    }

    const initials = full_name
      .split(' ')
      .map((w: string) => w[0])
      .join('')
      .substring(0, 3)
      .toUpperCase();

    const passwordHash = await hashPassword(password);
    const id = `USR-${Date.now()}`;
    const allowedTabsJson = JSON.stringify(allowedTabs);

    await execute(
      `INSERT INTO users (
        id, username, full_name, email, password_hash, role,
        department_id, employee_id, initials, allowed_tabs_json,
        only_own_department, can_view_financials, can_export, can_edit, is_active
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
      [
        id,
        username.trim().toLowerCase(),
        full_name.trim(),
        email.trim().toLowerCase(),
        passwordHash,
        role,
        department_id || null,
        employee_id || null,
        initials,
        allowedTabsJson,
        only_own_department ? 1 : 0,
        can_view_financials ? 1 : 0,
        can_export ? 1 : 0,
        can_edit ? 1 : 0,
      ]
    );

    // Auditoría
    await execute(
      `INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, details_json)
       VALUES (?, ?, 'USER_CREATED', 'users', ?, ?)`,
      [
        `AUD-${Date.now()}`,
        currentUser.id,
        id,
        JSON.stringify({ username, role, department_id, allowedTabs, only_own_department }),
      ]
    );

    return NextResponse.json({ success: true, id, message: 'Usuario creado exitosamente con permisos personalizados.' });
  } catch (error: any) {
    console.error('Error creating user:', error);
    return NextResponse.json({ error: error.message || 'Error al crear usuario.' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser || currentUser.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Solo el administrador puede modificar permisos de usuarios.' }, { status: 403 });
    }

    const body = await request.json();
    const {
      id,
      full_name,
      email,
      password,
      role,
      department_id,
      allowedTabs,
      only_own_department,
      can_view_financials,
      can_export,
      can_edit,
      is_active,
    } = body;

    if (!id) {
      return NextResponse.json({ error: 'ID de usuario requerido.' }, { status: 400 });
    }

    const user = await queryOne<any>('SELECT * FROM users WHERE id = ?', [id]);
    if (!user) {
      return NextResponse.json({ error: 'Usuario no encontrado.' }, { status: 404 });
    }

    // Protección para el administrador principal
    if (user.email === 'alexander7tm@gmail.com' && (is_active === false || role !== 'ADMIN')) {
      return NextResponse.json({ error: 'El administrador principal alexander7tm@gmail.com no puede ser desactivado ni degradado.' }, { status: 400 });
    }

    let passwordClause = '';
    const params: any[] = [
      full_name || user.full_name,
      email || user.email,
      role || user.role,
      department_id !== undefined ? department_id : user.department_id,
      allowedTabs ? JSON.stringify(allowedTabs) : user.allowed_tabs_json,
      only_own_department !== undefined ? (only_own_department ? 1 : 0) : user.only_own_department,
      can_view_financials !== undefined ? (can_view_financials ? 1 : 0) : user.can_view_financials,
      can_export !== undefined ? (can_export ? 1 : 0) : user.can_export,
      can_edit !== undefined ? (can_edit ? 1 : 0) : user.can_edit,
      is_active !== undefined ? (is_active ? 1 : 0) : user.is_active,
    ];

    if (password && password.trim().length >= 6) {
      const passwordHash = await hashPassword(password);
      passwordClause = ', password_hash = ?';
      params.push(passwordHash);
    }

    params.push(id);

    await execute(
      `UPDATE users SET 
        full_name = ?, 
        email = ?, 
        role = ?, 
        department_id = ?, 
        allowed_tabs_json = ?, 
        only_own_department = ?, 
        can_view_financials = ?, 
        can_export = ?, 
        can_edit = ?, 
        is_active = ?
        ${passwordClause}
       WHERE id = ?`,
      params
    );

    // Auditoría
    await execute(
      `INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, details_json)
       VALUES (?, ?, 'USER_UPDATED', 'users', ?, ?)`,
      [
        `AUD-${Date.now()}`,
        currentUser.id,
        id,
        JSON.stringify({ updatedBy: currentUser.email, role, department_id, allowedTabs, only_own_department }),
      ]
    );

    return NextResponse.json({ success: true, message: 'Permisos actualizados con éxito.' });
  } catch (error: any) {
    console.error('Error updating user:', error);
    return NextResponse.json({ error: error.message || 'Error al actualizar usuario.' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser || currentUser.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Solo el administrador puede eliminar usuarios.' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID requerido.' }, { status: 400 });
    }

    const targetUser = await queryOne<any>('SELECT email FROM users WHERE id = ?', [id]);
    if (!targetUser) {
      return NextResponse.json({ error: 'Usuario no encontrado.' }, { status: 404 });
    }

    if (targetUser.email === 'alexander7tm@gmail.com') {
      return NextResponse.json({ error: 'El administrador principal alexander7tm@gmail.com no puede ser eliminado.' }, { status: 400 });
    }

    // Soft delete para preservar integridad de bitácoras y movimientos
    await execute('UPDATE users SET is_active = 0 WHERE id = ?', [id]);

    await execute(
      `INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, details_json)
       VALUES (?, ?, 'USER_DEACTIVATED', 'users', ?, ?)`,
      [
        `AUD-${Date.now()}`,
        currentUser.id,
        id,
        JSON.stringify({ deactivatedUser: targetUser.email }),
      ]
    );

    return NextResponse.json({ success: true, message: 'Usuario desactivado exitosamente.' });
  } catch (error: any) {
    console.error('Error deleting user:', error);
    return NextResponse.json({ error: 'Error al desactivar usuario.' }, { status: 500 });
  }
}
