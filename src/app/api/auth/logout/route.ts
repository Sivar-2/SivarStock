import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { logAudit } from '@/lib/audit';

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (user) {
    await logAudit({
      userId: user.id,
      username: user.username,
      userRole: user.role,
      action: 'LOGOUT',
      module: 'AUTENTICACION',
      reason: 'Cierre de sesión de usuario',
    });
  }

  const response = NextResponse.json({ success: true, message: 'Sesión cerrada correctamente.' });
  response.cookies.delete('sivarstock_session');
  return response;
}
