import { NextResponse, NextRequest } from 'next/server';
import { query, queryOne, run } from '@/lib/db';
import { getCurrentUser, hashPassword } from '@/lib/auth';
import { logAudit } from '@/lib/audit';

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user || (user.role !== 'ADMIN' && !user.canManageUsers)) {
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
        CASE WHEN LOWER(u.username) = 'turcosivar' THEN 0 WHEN u.role = 'ADMIN' THEN 1 WHEN u.role = 'SUBADMIN' THEN 2 ELSE 3 END,
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
    if (!currentUser || (currentUser.role !== 'ADMIN' && !currentUser.canManageUsers)) {
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
      allowedTabs = ['DASHBOARD', 'INVENTARIO'],
      only_own_department = false,
      can_view_financials = false,
      can_export = false,
      can_edit = true,
    } = body;

    const cleanUsername = String(username || '').trim().toLowerCase();
    const cleanFullName = String(full_name || '').trim();
    const cleanEmail = email && String(email).trim()
      ? String(email).trim().toLowerCase()
      : `${cleanUsername}@sivarstock.local`;

    if (!cleanUsername || !cleanFullName || !password) {
      return NextResponse.json({ error: 'Usuario, nombre completo y contraseña son obligatorios.' }, { status: 400 });
    }

    // Comprobar unicidad de username y correo
    const existing = await queryOne<any>(
      'SELECT id, username, email FROM users WHERE LOWER(username) = ? OR LOWER(email) = ?',
      [cleanUsername, cleanEmail]
    );
    if (existing) {
      return NextResponse.json(
        { error: `El usuario "${cleanUsername}" o el correo "${cleanEmail}" ya está registrado.` },
        { status: 400 }
      );
    }

    const initials = cleanFullName
      .split(' ')
      .filter(Boolean)
      .map((w: string) => w[0])
      .join('')
      .substring(0, 3)
      .toUpperCase() || 'USR';

    const passwordHash = await hashPassword(password);
    const id = `USR-${Date.now()}`;
    const validTabs = Array.isArray(allowedTabs) && allowedTabs.length > 0 ? allowedTabs : ['INVENTARIO'];
    const allowedTabsJson = JSON.stringify(validTabs);
    const effectiveCanEdit = role === 'VIEWER' ? 0 : (can_edit ? 1 : 0);

    await run(
      `INSERT INTO users (
        id, username, full_name, email, password_hash, role,
        department_id, employee_id, initials, allowed_tabs_json,
        only_own_department, can_view_financials, can_export, can_manage_users, can_edit, is_active
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
      [
        id,
        cleanUsername,
        cleanFullName,
        cleanEmail,
        passwordHash,
        role,
        department_id || null,
        employee_id || null,
        initials,
        allowedTabsJson,
        only_own_department ? 1 : 0,
        can_view_financials ? 1 : 0,
        can_export ? 1 : 0,
        role === 'ADMIN' ? 1 : 0,
        effectiveCanEdit,
      ]
    );

    await logAudit({
      userId: currentUser.id,
      username: currentUser.username,
      userRole: currentUser.role,
      action: 'CREAR_USUARIO',
      module: 'USUARIOS',
      entityId: id,
      entityName: `${cleanUsername} (${cleanFullName})`,
      afterState: { username: cleanUsername, role, department_id, allowedTabs: validTabs, only_own_department },
      reason: `Creación de cuenta de usuario @${cleanUsername} con rol ${role} y ${validTabs.length} pestañas autorizadas`,
    });

    return NextResponse.json({
      success: true,
      id,
      message: `Usuario @${cleanUsername} creado exitosamente. Solo podrá ver las ${validTabs.length} pestaña(s) asignadas.`,
    });
  } catch (error: any) {
    console.error('Error creating user:', error);
    return NextResponse.json({ error: error.message || 'Error al crear usuario.' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser || (currentUser.role !== 'ADMIN' && !currentUser.canManageUsers)) {
      return NextResponse.json({ error: 'Solo el administrador puede modificar permisos de usuarios.' }, { status: 403 });
    }

    const body = await request.json();
    const {
      id,
      username,
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

    const isMainSuperAdmin = String(user.username).toLowerCase() === 'turcosivar';
    if (isMainSuperAdmin && (is_active === false || (role && role !== 'ADMIN'))) {
      return NextResponse.json({ error: 'El usuario administrador principal @turcosivar no puede ser desactivado ni degradado.' }, { status: 400 });
    }

    const nextUsername = username ? String(username).trim().toLowerCase() : user.username;
    const nextEmail = email && String(email).trim() ? String(email).trim().toLowerCase() : user.email;
    const nextRole = role || user.role;
    const nextCanEdit = nextRole === 'VIEWER' ? 0 : (can_edit !== undefined ? (can_edit ? 1 : 0) : user.can_edit);

    let passwordClause = '';
    const params: any[] = [
      nextUsername,
      full_name ? String(full_name).trim() : user.full_name,
      nextEmail,
      nextRole,
      department_id !== undefined ? (department_id || null) : user.department_id,
      allowedTabs ? JSON.stringify(allowedTabs) : user.allowed_tabs_json,
      only_own_department !== undefined ? (only_own_department ? 1 : 0) : user.only_own_department,
      can_view_financials !== undefined ? (can_view_financials ? 1 : 0) : user.can_view_financials,
      can_export !== undefined ? (can_export ? 1 : 0) : user.can_export,
      nextCanEdit,
      is_active !== undefined ? (is_active ? 1 : 0) : user.is_active,
    ];

    if (password && String(password).trim().length >= 4) {
      const passwordHash = await hashPassword(String(password).trim());
      passwordClause = ', password_hash = ?';
      params.push(passwordHash);
    }

    params.push(id);

    await run(
      `UPDATE users SET 
        username = ?,
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

    await logAudit({
      userId: currentUser.id,
      username: currentUser.username,
      userRole: currentUser.role,
      action: 'MODIFICAR_USUARIO',
      module: 'USUARIOS',
      entityId: id,
      entityName: user.full_name,
      afterState: { username: nextUsername, role: nextRole, department_id, allowedTabs, only_own_department, is_active },
      reason: `Actualización de permisos para @${nextUsername}`,
    });

    return NextResponse.json({ success: true, message: 'Permisos y credenciales actualizados con éxito.' });
  } catch (error: any) {
    console.error('Error updating user:', error);
    return NextResponse.json({ error: error.message || 'Error al actualizar usuario.' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser || (currentUser.role !== 'ADMIN' && !currentUser.canManageUsers)) {
      return NextResponse.json({ error: 'Solo el administrador puede eliminar o revocar usuarios.' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const mode = searchParams.get('mode') || 'DELETE'; // 'DELETE' | 'DEACTIVATE'

    if (!id) {
      return NextResponse.json({ error: 'ID requerido.' }, { status: 400 });
    }

    const targetUser = await queryOne<any>('SELECT id, username, email, full_name, employee_id FROM users WHERE id = ?', [id]);
    if (!targetUser) {
      return NextResponse.json({ error: 'Usuario no encontrado.' }, { status: 404 });
    }

    if (String(targetUser.username).toLowerCase() === 'turcosivar') {
      return NextResponse.json({ error: 'El usuario principal @turcosivar no puede ser eliminado.' }, { status: 400 });
    }

    if (mode === 'DEACTIVATE') {
      await run('UPDATE users SET is_active = 0, password_hash = ? WHERE id = ?', [`REVOKED_${Date.now()}`, id]);
      await logAudit({
        userId: currentUser.id,
        username: currentUser.username,
        userRole: currentUser.role,
        action: 'REVOCAR_CREDENCIALES_USUARIO',
        module: 'USUARIOS',
        entityId: id,
        entityName: `${targetUser.full_name} (@${targetUser.username})`,
        reason: 'Revocación de usuario y contraseña (sin acceso hasta crear nuevas credenciales)',
      });
      return NextResponse.json({
        success: true,
        message: `Credenciales de @${targetUser.username} revocadas. No podrá ingresar a menos que se creen nuevas credenciales.`,
      });
    }

    // Eliminación total de usuario y contraseña
    await run('UPDATE employees SET user_account_id = NULL WHERE user_account_id = ? OR id = ?', [id, targetUser.employee_id || '']);
    await run('DELETE FROM users WHERE id = ?', [id]);

    await logAudit({
      userId: currentUser.id,
      username: currentUser.username,
      userRole: currentUser.role,
      action: 'ELIMINAR_USUARIO',
      module: 'USUARIOS',
      entityId: id,
      entityName: `${targetUser.full_name} (@${targetUser.username})`,
      reason: 'Eliminación definitiva de usuario y contraseña de acceso',
    });

    return NextResponse.json({
      success: true,
      message: `Usuario @${targetUser.username} y su contraseña han sido eliminados por completo del sistema.`,
    });
  } catch (error: any) {
    console.error('Error deleting user:', error);
    return NextResponse.json({ error: 'Error al eliminar usuario.' }, { status: 500 });
  }
}
