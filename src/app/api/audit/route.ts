import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getCurrentUser, checkPermission } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || !checkPermission(user, 'SUBADMIN')) {
      return NextResponse.json({ error: 'No autorizado para consultar bitácora de auditoría.' }, { status: 403 });
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

    sql += ` ORDER BY created_at DESC LIMIT 100`;

    const logs = await query(sql, params);
    return NextResponse.json({ success: true, count: logs.length, logs });
  } catch (error: any) {
    console.error('Error al consultar auditoría:', error);
    return NextResponse.json({ error: 'Error al consultar auditoría.' }, { status: 500 });
  }
}
