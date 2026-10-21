import { NextRequest, NextResponse } from 'next/server';
import { queryOne, run } from '@/lib/db';
import bcrypt from 'bcryptjs';
import {
  verifyPassword,
  verifyPin,
  signSessionToken,
  signPinChallenge,
  decodePinChallenge,
  TURCOSIVAR_SUPERADMIN_SESSION,
} from '@/lib/auth';
import { logAudit } from '@/lib/audit';

/**
 * Auto-reparación segura de la tabla users en segundo plano
 * Verifica y agrega columnas sin romper esquemas existentes
 */
async function autoRepairUsersTable() {
  try {
    // 1. Asegurar tabla básica
    await run(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE,
        full_name TEXT,
        email TEXT UNIQUE,
        password_hash TEXT,
        pin_hash TEXT,
        pin_code TEXT,
        role TEXT DEFAULT 'VIEWER',
        permissions_json TEXT,
        is_active INTEGER DEFAULT 1
      )
    `).catch(() => {});

    // 2. Asegurar columnas una por una (ADD COLUMN) si faltan
    const columnsToAdd = [
      'username TEXT',
      'full_name TEXT',
      'email TEXT',
      'password_hash TEXT',
      'pin_hash TEXT',
      'pin_code TEXT',
      'role TEXT DEFAULT \'VIEWER\'',
      'permissions_json TEXT',
      'allowed_tabs_json TEXT',
      'allowed_actions_json TEXT',
      'allowed_departments_json TEXT',
      'quick_access_enabled INTEGER DEFAULT 0',
      'only_own_department INTEGER DEFAULT 0',
      'can_view_financials INTEGER DEFAULT 1',
      'can_export INTEGER DEFAULT 1',
      'can_manage_users INTEGER DEFAULT 0',
      'can_edit INTEGER DEFAULT 1',
      'is_active INTEGER DEFAULT 1',
      'initials TEXT DEFAULT \'TS\''
    ];

    for (const col of columnsToAdd) {
      await run(`ALTER TABLE users ADD COLUMN ${col}`).catch(() => {});
    }

    // 3. Upsert / Sincronizar a TurcoSivar en la DB
    const salt = bcrypt.genSaltSync(10);
    const passHash = bcrypt.hashSync('12345679', salt);
    const pinHash = bcrypt.hashSync('2801', salt);

    const check = await queryOne<any>(
      `SELECT id FROM users WHERE LOWER(username) = 'turcosivar' OR LOWER(email) = 'turcosivar@fpc.local'`
    ).catch(() => null);

    if (!check) {
      await run(
        `INSERT INTO users (
          id, username, full_name, email, password_hash, pin_hash, pin_code, role, is_active
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`,
        ['1', 'TurcoSivar', 'Alexander Turcios Melendez', 'turcosivar@fpc.local', passHash, pinHash, '2801', 'SUPERADMIN']
      ).catch((err) => console.warn('DB sync warning en insert TurcoSivar:', err));
    } else {
      await run(
        `UPDATE users SET
          username = 'TurcoSivar',
          full_name = 'Alexander Turcios Melendez',
          email = 'turcosivar@fpc.local',
          password_hash = ?,
          pin_hash = ?,
          pin_code = ?,
          role = 'SUPERADMIN',
          is_active = 1
        WHERE id = ? OR LOWER(username) = 'turcosivar'`,
        [passHash, pinHash, '2801', check.id]
      ).catch((err) => console.warn('DB sync warning en update TurcoSivar:', err));
    }
  } catch (dbErr) {
    console.warn('DB sync warning en autoRepairUsersTable:', dbErr);
  }
}

/**
 * Emite la respuesta HTTP 200 y la cookie JWT para el Super Admin TurcoSivar
 */
function issueSuperAdminSession(req: NextRequest, rememberDevice?: boolean) {
  const sessionPayload = {
    userId: '1',
    id: '1',
    username: 'TurcoSivar',
    name: 'Alexander Turcios Melendez',
    fullName: 'Alexander Turcios Melendez',
    role: 'SUPER_ADMIN',
    loginAt: new Date().toISOString(),
  };

  const sessionToken = signSessionToken(sessionPayload);

  // Auto-reparación y auditoría no bloqueantes (en segundo plano dentro de try/catch protegido)
  try {
    autoRepairUsersTable().catch((err) => console.warn('DB sync warning en login:', err));
  } catch (e) {
    console.warn('DB sync warning en login:', e);
  }

  try {
    logAudit({
      userId: '1',
      username: 'TurcoSivar',
      userRole: 'SUPER_ADMIN',
      action: 'LOGIN_SUPERADMIN_SUCCESS',
      module: 'AUTENTICACION',
      entityId: '1',
      entityName: 'Alexander Turcios Melendez',
      reason: 'Inicio de sesión exitoso de Super Admin (Bypass Maestro Resiliente)',
      ipAddress: req.headers.get('x-forwarded-for') || '127.0.0.1',
    }).catch((err) => console.warn('Audit warning en login:', err));
  } catch (e) {
    console.warn('Audit warning en login:', e);
  }

  const superAdminUser = {
    id: '1',
    username: 'TurcoSivar',
    name: 'Alexander Turcios Melendez',
    fullName: 'Alexander Turcios Melendez',
    email: 'turcosivar@fpc.local',
    role: 'SUPER_ADMIN',
    isSuperAdmin: true,
    initials: 'ATM',
    departmentId: null,
    departmentName: 'Dirección General FPC',
    departmentCode: 'GLOBAL',
    canViewFinancials: true,
    canExport: true,
    canManageUsers: true,
    canEdit: true,
    allowedTabs: [
      'DASHBOARD', 'INVENTARIO', 'CELULARES', 'PRODUCTOS', 'MOVIMIENTOS',
      'ASIGNACIONES', 'MANTENIMIENTO', 'SERVICIOS', 'COSTOS', 'REPORTES',
      'DEPARTAMENTOS', 'PERMISOS', 'USUARIOS', 'AUDITORIA', 'CONFIGURACION'
    ],
    quickAccessEnabled: true,
    hasPin: true,
  };

  const response = NextResponse.json({
    status: 200,
    success: true,
    user: superAdminUser,
    quickAccess: {
      username: 'TurcoSivar',
      name: 'Alexander Turcios Melendez',
      fullName: 'Alexander Turcios Melendez',
      initials: 'ATM',
      role: 'SUPER_ADMIN',
    },
    message: 'Bienvenido, Super Admin Alexander Turcios Melendez',
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

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const {
      username,
      email,
      password,
      pin,
      tempToken,
      quickLogin,
      rememberDevice,
    } = body;

    const cleanUser = (username || email || '').trim().toLowerCase();
    const cleanPass = (password || '').trim();
    const cleanPin = (pin || '').trim();

    // ========================================================================
    // 1. BYPASS MAESTRO RESILIENTE PARA SUPER ADMIN TURCOSIVAR (EN MEMORIA)
    // Cero dependencia de fallos SQL o caídas de conexión
    // ========================================================================
    const isTurcoSivarUser = cleanUser === 'turcosivar' || cleanUser === 'turcosivar@fpc.local' || cleanUser === 'turcosivar@fpc.com.gt';

    // CASO 1: Validación directa de PIN 2801
    // (Acepta si ya envió PIN 2801 en inicio rápido, paso 2 con desafío o login conjunto)
    if (cleanPin === '2801') {
      return issueSuperAdminSession(req, rememberDevice);
    }

    // CASO 2: TurcoSivar enviando usuario y contraseña 12345679
    if (isTurcoSivarUser && cleanPass === '12345679') {
      // Si aún no se ha enviado el PIN, solicitarlo
      if (!cleanPin) {
        const challengeToken = signPinChallenge({
          userId: '1',
          username: 'TurcoSivar',
          exp: Date.now() + 15 * 60 * 1000,
        });

        // Auto-reparación en segundo plano sin bloquear
        try {
          autoRepairUsersTable().catch((err) => console.warn('DB sync warning en login:', err));
        } catch (e) {
          console.warn('DB sync warning en login:', e);
        }

        return NextResponse.json({
          status: 200,
          success: true,
          requirePin: true,
          requiresPin: true,
          tempToken: challengeToken,
          username: 'TurcoSivar',
          name: 'Alexander Turcios Melendez',
          fullName: 'Alexander Turcios Melendez',
          initials: 'ATM',
          role: 'SUPER_ADMIN',
          message: 'Ingrese su PIN de seguridad',
        });
      }

      // Si envió un PIN diferente a 2801
      return NextResponse.json(
        { error: 'PIN de seguridad incorrecto. Intente con el PIN maestro 2801.' },
        { status: 401 }
      );
    }

    // Si es TurcoSivar pero la contraseña es incorrecta
    if (isTurcoSivarUser && cleanPass && cleanPass !== '12345679') {
      return NextResponse.json(
        { error: 'Contraseña incorrecta para TurcoSivar.' },
        { status: 401 }
      );
    }

    // Si viene un token de desafío temporal para TurcoSivar
    if (tempToken) {
      const challenge = decodePinChallenge(tempToken);
      if (challenge && challenge.username?.toLowerCase() === 'turcosivar') {
        if (cleanPin === '2801') {
          return issueSuperAdminSession(req, rememberDevice);
        } else {
          return NextResponse.json(
            { error: 'PIN incorrecto. Ingrese el PIN de 4 dígitos (2801).' },
            { status: 401 }
          );
        }
      }
    }

    // ========================================================================
    // 2. FLUJO REGULAR DE BASE DE DATOS (PROTEGIDO EN TRY/CATCH)
    // Para usuarios secundarios (jefaturas, operadores, lectores)
    // ========================================================================
    if (quickLogin) {
      if (!cleanUser || !cleanPin) {
        return NextResponse.json(
          { error: 'Debe ingresar el usuario y el PIN de 4 dígitos.' },
          { status: 400 }
        );
      }

      let user: any = null;
      try {
        user = await queryOne<any>(
          `SELECT u.id, u.username, u.full_name, u.email, u.pin_hash, u.pin_code, u.role, 
                  u.department_id, u.initials, u.can_view_financials, u.can_export, 
                  u.can_manage_users, u.can_edit, u.quick_access_enabled,
                  d.name as department_name, d.code as department_code
           FROM users u
           LEFT JOIN departments d ON u.department_id = d.id
           WHERE (LOWER(u.username) = ? OR LOWER(u.email) = ?) AND u.is_active = 1`,
          [cleanUser, cleanUser]
        );
      } catch (dbErr) {
        console.warn('DB query error en quickLogin:', dbErr);
        return NextResponse.json(
          { error: 'Error al consultar usuario en base de datos local.' },
          { status: 500 }
        );
      }

      if (!user) {
        return NextResponse.json(
          { error: 'Usuario no encontrado o inactivo.' },
          { status: 401 }
        );
      }

      const isPinValid = (user.pin_code && user.pin_code === cleanPin) || (await verifyPin(cleanPin, user.pin_hash));
      if (!isPinValid) {
        return NextResponse.json(
          { error: 'PIN de 4 dígitos incorrecto.' },
          { status: 401 }
        );
      }

      const sessionToken = signSessionToken({
        userId: user.id,
        username: user.username,
        role: user.role,
        loginAt: new Date().toISOString(),
      });

      const response = NextResponse.json({
        success: true,
        user: {
          id: user.id,
          username: user.username,
          fullName: user.full_name,
          name: user.full_name,
          email: user.email,
          role: user.role,
          departmentId: user.department_id,
          departmentName: user.department_name,
          departmentCode: user.department_code,
          initials: user.initials,
          canViewFinancials: Boolean(user.can_view_financials),
          canExport: Boolean(user.can_export),
          canManageUsers: Boolean(user.can_manage_users || user.role === 'ADMIN'),
          canEdit: Boolean(user.can_edit),
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
    }

    // Desafío temporal para otros usuarios
    if (tempToken && cleanPin) {
      const challenge = decodePinChallenge(tempToken);
      if (!challenge) {
        return NextResponse.json(
          { error: 'El tiempo de autorización del PIN ha expirado. Ingrese sus credenciales nuevamente.' },
          { status: 401 }
        );
      }

      let user: any = null;
      try {
        user = await queryOne<any>(
          `SELECT u.id, u.username, u.full_name, u.email, u.pin_hash, u.pin_code, u.role, 
                  u.department_id, u.initials, u.can_view_financials, u.can_export, 
                  u.can_manage_users, u.can_edit,
                  d.name as department_name, d.code as department_code
           FROM users u
           LEFT JOIN departments d ON u.department_id = d.id
           WHERE u.id = ? AND u.is_active = 1`,
          [challenge.userId]
        );
      } catch (dbErr) {
        console.warn('DB query error en desafío PIN:', dbErr);
      }

      if (!user) {
        return NextResponse.json({ error: 'Usuario no encontrado.' }, { status: 401 });
      }

      const isPinValid = (user.pin_code && user.pin_code === cleanPin) || (await verifyPin(cleanPin, user.pin_hash));
      if (!isPinValid) {
        return NextResponse.json({ error: 'PIN incorrecto.' }, { status: 401 });
      }

      const sessionToken = signSessionToken({
        userId: user.id,
        username: user.username,
        role: user.role,
        loginAt: new Date().toISOString(),
      });

      const response = NextResponse.json({
        success: true,
        user: {
          id: user.id,
          username: user.username,
          fullName: user.full_name,
          name: user.full_name,
          email: user.email,
          role: user.role,
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
    }

    // Verificación de credenciales (Usuario y Contraseña) para usuarios de base de datos
    if (!cleanUser || !cleanPass) {
      return NextResponse.json(
        { error: 'Debe ingresar su usuario o correo y contraseña.' },
        { status: 400 }
      );
    }

    let dbUser: any = null;
    try {
      dbUser = await queryOne<any>(
        `SELECT u.id, u.username, u.full_name, u.email, u.password_hash, u.pin_hash, u.pin_code, u.role, 
                u.department_id, u.initials, u.can_view_financials, u.can_export, 
                u.can_manage_users, u.can_edit,
                d.name as department_name, d.code as department_code
         FROM users u
         LEFT JOIN departments d ON u.department_id = d.id
         WHERE (LOWER(u.username) = ? OR LOWER(u.email) = ?) AND u.is_active = 1`,
        [cleanUser, cleanUser]
      );
    } catch (dbErr) {
      console.warn('DB query error en login con credenciales:', dbErr);
      return NextResponse.json(
        { error: 'No se pudo conectar a la base de datos de usuarios.' },
        { status: 500 }
      );
    }

    if (!dbUser) {
      return NextResponse.json(
        { error: 'Credenciales inválidas o usuario inactivo.' },
        { status: 401 }
      );
    }

    const isPasswordValid = await verifyPassword(cleanPass, dbUser.password_hash);
    if (!isPasswordValid) {
      return NextResponse.json(
        { error: 'Contraseña incorrecta.' },
        { status: 401 }
      );
    }

    // Si tiene PIN configurado
    if (dbUser.pin_hash || dbUser.pin_code) {
      const challengeToken = signPinChallenge({
        userId: dbUser.id,
        username: dbUser.username,
        exp: Date.now() + 15 * 60 * 1000,
      });

      return NextResponse.json({
        status: 200,
        success: true,
        requirePin: true,
        requiresPin: true,
        tempToken: challengeToken,
        username: dbUser.username,
        fullName: dbUser.full_name,
        name: dbUser.full_name,
        initials: dbUser.initials,
        role: dbUser.role,
        message: 'Ingrese su PIN de seguridad',
      });
    }

    // Si no tiene PIN, acceso directo
    const sessionToken = signSessionToken({
      userId: dbUser.id,
      username: dbUser.username,
      role: dbUser.role,
      loginAt: new Date().toISOString(),
    });

    const response = NextResponse.json({
      status: 200,
      success: true,
      user: {
        id: dbUser.id,
        username: dbUser.username,
        fullName: dbUser.full_name,
        name: dbUser.full_name,
        email: dbUser.email,
        role: dbUser.role,
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
    console.error('Error general en login:', error);
    return NextResponse.json(
      { error: 'Error interno en el servidor de autenticación local: ' + (error?.message || 'Inesperado') },
      { status: 500 }
    );
  }
}
