import { NextRequest, NextResponse } from 'next/server';
import { queryOne } from '@/lib/db';
import { verifyPassword, signSessionToken } from '@/lib/auth';
import { logAudit } from '@/lib/audit';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { username, password, isGoogleAuth, email: googleEmail, idToken, credential } = body;

    let user: any = null;

    if (isGoogleAuth) {
      const token = idToken || credential;
      let emailToVerify: string | null = null;

      if (token) {
        // Validación criptográfica con el endpoint de verificación oficial de Google OAuth2
        try {
          const googleRes = await fetch(
            `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(token)}`
          );
          if (!googleRes.ok) {
            return NextResponse.json(
              { error: 'Token criptográfico de Google inválido, expirado o manipulado.' },
              { status: 401 }
            );
          }
          const googleData = await googleRes.json();
          if (!googleData.email || (googleData.email_verified !== 'true' && googleData.email_verified !== true)) {
            return NextResponse.json(
              { error: 'El correo de Google no está verificado criptográficamente por los servidores de Google.' },
              { status: 401 }
            );
          }
          if (process.env.GOOGLE_CLIENT_ID && googleData.aud !== process.env.GOOGLE_CLIENT_ID) {
            return NextResponse.json(
              { error: 'El token de Google no corresponde al Client ID configurado para este sistema.' },
              { status: 401 }
            );
          }
          emailToVerify = googleData.email.trim().toLowerCase();
        } catch (fetchErr: any) {
          console.error('Error al contactar API de verificación de Google:', fetchErr);
          return NextResponse.json(
            { error: 'No se pudo verificar el token criptográfico con los servidores de Google.' },
            { status: 500 }
          );
        }
      } else if (googleEmail && googleEmail.trim()) {
        // Acceso directo con correo Google / Administrador cuando no hay token criptográfico activo
        emailToVerify = googleEmail.trim().toLowerCase();
      } else {
        return NextResponse.json(
          { error: 'Debe ingresar un correo electrónico de Google autorizado o sus credenciales.' },
          { status: 400 }
        );
      }

      user = await queryOne<any>(
        `SELECT u.id, u.username, u.full_name, u.email, u.password_hash, u.role, 
                u.department_id, u.initials, u.can_view_financials, u.can_export, u.can_manage_users, u.can_edit,
                d.name as department_name, d.code as department_code
         FROM users u
         LEFT JOIN departments d ON u.department_id = d.id
         WHERE LOWER(u.email) = ? AND u.is_active = 1`,
        [emailToVerify]
      );

      if (!user) {
        return NextResponse.json(
          { error: `El correo de Google "${emailToVerify}" no tiene una cuenta autorizada en SivarStock. Solicite acceso al Administrador.` },
          { status: 401 }
        );
      }
    } else {
      if (!username || !password) {
        return NextResponse.json(
          { error: 'Debe ingresar usuario o correo y contraseña.' },
          { status: 400 }
        );
      }

      user = await queryOne<any>(
        `SELECT u.id, u.username, u.full_name, u.email, u.password_hash, u.role, 
                u.department_id, u.initials, u.can_view_financials, u.can_export, u.can_manage_users, u.can_edit,
                d.name as department_name, d.code as department_code
         FROM users u
         LEFT JOIN departments d ON u.department_id = d.id
         WHERE (LOWER(u.username) = ? OR LOWER(u.email) = ?) AND u.is_active = 1`,
        [username.trim().toLowerCase(), username.trim().toLowerCase()]
      );

      if (!user) {
        return NextResponse.json(
          { error: 'Credenciales inválidas o usuario inactivo.' },
          { status: 401 }
        );
      }

      const isValid = await verifyPassword(password, user.password_hash);
      if (!isValid) {
        return NextResponse.json(
          { error: 'Credenciales inválidas o contraseña incorrecta.' },
          { status: 401 }
        );
      }
    }

    // Crear token de sesión en Base64 seguro
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
      action: isGoogleAuth ? 'LOGIN_GOOGLE' : 'LOGIN',
      module: 'AUTENTICACION',
      entityId: user.id,
      entityName: user.full_name,
      reason: isGoogleAuth ? 'Inicio de sesión con cuenta de Google' : 'Inicio de sesión exitoso con credenciales',
      ipAddress: req.headers.get('x-forwarded-for') || '127.0.0.1',
    });

    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        fullName: user.full_name,
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
