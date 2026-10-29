import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }
    if (String(user.username || '').toLowerCase() !== 'turcosivar') {
      return NextResponse.json(
        { error: 'Acceso denegado: El módulo de Bitácora es de acceso exclusivo para @turcosivar.' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const module = searchParams.get('module');
    const action = searchParams.get('action');
    const search = searchParams.get('search') || '';

    let sql = `SELECT * FROM audit_logs WHERE 1=1`;
    const params: any[] = [];

    if (search.trim()) {
      sql += ` AND (username LIKE ? OR entity_name LIKE ? OR reason LIKE ? OR action LIKE ?)`;
      const term = `%${search.trim()}%`;
      params.push(term, term, term, term);
    }

    if (module) {
      sql += ` AND module = ?`;
      params.push(module);
    }

    if (action) {
      sql += ` AND action = ?`;
      params.push(action);
    }

    sql += ` ORDER BY created_at DESC LIMIT 150`;

    const logs = await query(sql, params);
    return NextResponse.json({ success: true, count: logs.length, logs });
  } catch (error: any) {
    console.error('Error al consultar bitácora:', error);
    return NextResponse.json({ error: 'Error al consultar bitácora.' }, { status: 500 });
  }
}
