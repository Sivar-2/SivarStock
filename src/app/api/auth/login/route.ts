import { NextRequest, NextResponse } from 'next/server';
import { queryOne, run } from '@/lib/db';
import {
  verifyPassword,
  verifyPin,
  signSessionToken,
  signPinChallenge,
  decodePinChallenge,
} from '@/lib/auth';
import { logAudit } from '@/lib/audit';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      username,
      password,
      pin,
      tempToken,
      quickLogin,
      rememberDevice,
    } = body;

    const ipAddress = req.headers.get('x-forwarded-for') || '127.0.0.1';

    // ------------------------------------------------------------------------
    // CASO 1: Acceso Rápido con PIN Directo (Dispositivo Recordado / APK)
    // ------------------------------------------------------------------------
    if (quickLogin) {
      if (!username || !pin) {
        return NextResponse.json(
          { error: 'Debe ingresar el usuario y el PIN de 4 dígitos.' },
          { status: 400 }
        );
      }

      const user = await queryOne<any>(
        `SELECT u.id, u.username, u.full_name, u.email, u.pin_hash, u.role, 
                u.department_id, u.initials, u.can_view_financials, u.can_export, 
                u.can_manage_users, u.can_edit, u.quick_access_enabled,
                d.name as department_name, d.code as department_code
         FROM users u
         LEFT JOIN departments d ON u.department_id = d.id
         WHERE (LOWER(u.username) = ? OR LOWER(u.email) = ?) AND u.is_active = 1`,
        [username.trim().toLowerCase(), username.trim().toLowerCase()]
      );

      if (!user || !user.pin_hash) {
        return NextResponse.json(
          { error: 'Usuario no encontrado o no tiene PIN de acceso configurado.' },
          { status: 401 }
        );
      }

      const isPinValid = await verifyPin(pin, user.pin_hash);
      if (!isPinValid) {
        return NextResponse.json(
          { error: 'PIN de 4 dígitos incorrecto. Intente de nuevo.' },
          { status: 401 }
        );
      }

      // Crear token de sesión
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
        action: 'LOGIN_QUICK_PIN',
        module: 'AUTENTICACION',
        entityId: user.id,
        entityName: user.full_name,
        reason: 'Inicio de sesión rápido con PIN en dispositivo recordado',
        ipAddress,
      });

      const response = NextResponse.json({
        success: true,
        user: {
          id: user.id,
          username: user.username,
          fullName: user.full_name,
          email: user.email,
          role: user.role,
          isSuperAdmin: user.role === 'SUPERADMIN' || user.username === 'TurcoSivar',
          departmentId: user.department_id,
          departmentName: user.department_name,
          departmentCode: user.department_code,
          initials: user.initials,
          canViewFinancials: Boolean(user.can_view_financials),
          canExport: Boolean(user.can_export),
          canManageUsers: Boolean(user.can_manage_users || user.role === 'ADMIN' || user.role === 'SUPERADMIN'),
          canEdit: Boolean(user.can_edit),
          quickAccessEnabled: Boolean(user.quick_access_enabled),
          hasPin: true,
        },
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
    }

    // ------------------------------------------------------------------------
    // CASO 2: Paso 2 de Verificación en Dos Pasos (Validación de Desafío PIN)
    // ------------------------------------------------------------------------
    if (tempToken && pin) {
      const challenge = decodePinChallenge(tempToken);
      if (!challenge) {
        return NextResponse.json(
          { error: 'El tiempo de autorización del PIN ha expirado. Ingrese sus credenciales nuevamente.' },
          { status: 401 }
        );
      }

      const user = await queryOne<any>(
        `SELECT u.id, u.username, u.full_name, u.email, u.pin_hash, u.role, 
                u.department_id, u.initials, u.can_view_financials, u.can_export, 
                u.can_manage_users, u.can_edit, u.quick_access_enabled,
                d.name as department_name, d.code as department_code
         FROM users u
         LEFT JOIN departments d ON u.department_id = d.id
         WHERE u.id = ? AND u.is_active = 1`,
        [challenge.userId]
      );

      if (!user || !user.pin_hash) {
        return NextResponse.json(
          { error: 'Usuario no encontrado o no tiene PIN configurado.' },
          { status: 401 }
        );
      }

      const isPinValid = await verifyPin(pin, user.pin_hash);
      if (!isPinValid) {
        return NextResponse.json(
          { error: 'PIN incorrecto. Ingrese su PIN de 4 dígitos.' },
          { status: 401 }
        );
      }

      // Si el usuario marcó recordar dispositivo, actualizar en base de datos
      if (rememberDevice) {
        await run('UPDATE users SET quick_access_enabled = 1 WHERE id = ?', [user.id]).catch(() => {});
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
        action: 'LOGIN_PIN_VERIFIED',
        module: 'AUTENTICACION',
        entityId: user.id,
        entityName: user.full_name,
        reason: 'Verificación de segundo factor (PIN de 4 dígitos) exitosa',
        ipAddress,
      });

      const response = NextResponse.json({
        success: true,
        user: {
          id: user.id,
          username: user.username,
          fullName: user.full_name,
          email: user.email,
          role: user.role,
          isSuperAdmin: user.role === 'SUPERADMIN' || user.username === 'TurcoSivar',
          departmentId: user.department_id,
          departmentName: user.department_name,
          departmentCode: user.department_code,
          initials: user.initials,
          canViewFinancials: Boolean(user.can_view_financials),
          canExport: Boolean(user.can_export),
          canManageUsers: Boolean(user.can_manage_users || user.role === 'ADMIN' || user.role === 'SUPERADMIN'),
          canEdit: Boolean(user.can_edit),
          quickAccessEnabled: Boolean(rememberDevice || user.quick_access_enabled),
          hasPin: true,
        },
        quickAccess: rememberDevice ? {
          username: user.username,
          fullName: user.full_name,
          initials: user.initials,
          role: user.role,
        } : null,
      });

      response.cookies.set({
        name: 'sivarstock_session',
        value: sessionToken,
        httpOnly: true,
        path: '/',
        maxAge: 60 * 60 * 24 * 7,
        sameSite: 'lax',
      });

      return response;
    }

    // ------------------------------------------------------------------------
    // CASO 3: Paso 1 (Usuario y Contraseña)
    // ------------------------------------------------------------------------
    if (!username || !password) {
      return NextResponse.json(
        { error: 'Debe ingresar su usuario o correo y contraseña.' },
        { status: 400 }
      );
    }

    const user = await queryOne<any>(
      `SELECT u.id, u.username, u.full_name, u.email, u.password_hash, u.pin_hash, u.role, 
              u.department_id, u.initials, u.can_view_financials, u.can_export, 
              u.can_manage_users, u.can_edit, u.quick_access_enabled,
              d.name as department_name, d.code as department_code
       FROM users u
       LEFT JOIN departments d ON u.department_id = d.id
       WHERE (LOWER(u.username) = ? OR LOWER(u.email) = ?) AND u.is_active = 1`,
      [username.trim().toLowerCase(), username.trim().toLowerCase()]
    );

    if (!user) {
      return NextResponse.json(
        { error: 'Credenciales inválidas o usuario inactivo en el sistema.' },
        { status: 401 }
      );
    }

    const isPasswordValid = await verifyPassword(password, user.password_hash);
    if (!isPasswordValid) {
      return NextResponse.json(
        { error: 'Contraseña incorrecta. Verifique sus credenciales.' },
        { status: 401 }
      );
    }

    // Si el usuario tiene un PIN de 4 dígitos configurado -> Desafío 2FA
    if (user.pin_hash) {
      const tempToken = signPinChallenge({
        userId: user.id,
        username: user.username,
        exp: Date.now() + 5 * 60 * 1000, // 5 minutos de vigencia
      });

      return NextResponse.json({
        requiresPin: true,
        tempToken,
        username: user.username,
        fullName: user.full_name,
        initials: user.initials,
        role: user.role,
        message: 'Credenciales correctas. Ingrese su PIN de 4 dígitos para continuar.',
      });
    }

    // Si el usuario NO tiene PIN -> Inicio de sesión directo
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
      action: 'LOGIN_CREDENTIALS',
      module: 'AUTENTICACION',
      entityId: user.id,
      entityName: user.full_name,
      reason: 'Inicio de sesión exitoso con usuario y contraseña',
      ipAddress,
    });

    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        fullName: user.full_name,
        email: user.email,
        role: user.role,
        isSuperAdmin: user.role === 'SUPERADMIN' || user.username === 'TurcoSivar',
        departmentId: user.department_id,
        departmentName: user.department_name,
        departmentCode: user.department_code,
        initials: user.initials,
        canViewFinancials: Boolean(user.can_view_financials),
        canExport: Boolean(user.can_export),
        canManageUsers: Boolean(user.can_manage_users || user.role === 'ADMIN' || user.role === 'SUPERADMIN'),
        canEdit: Boolean(user.can_edit),
        quickAccessEnabled: Boolean(user.quick_access_enabled),
        hasPin: false,
      },
    });

    response.cookies.set({
      name: 'sivarstock_session',
      value: sessionToken,
      httpOnly: true,
      path: '/',
      maxAge: 60 * 60 * 24 * 7,
      sameSite: 'lax',
    });

    return response;
  } catch (error: any) {
    console.error('Error en ruta login:', error);
    return NextResponse.json(
      { error: 'Error interno en el servidor de autenticación local.' },
      { status: 500 }
    );
  }
}
