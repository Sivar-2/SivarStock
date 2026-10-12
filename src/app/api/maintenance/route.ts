import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne, run } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { logAudit } from '@/lib/audit';

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const status = url.searchParams.get('status');

    let sql = `
      SELECT 
        m.id, m.item_id, m.reported_date, m.scheduled_date, m.fault_description,
        m.severity, m.technician_supplier, m.repair_cost, m.currency,
        m.status, m.solution_type, m.replacement_item_id, m.replacement_reason,
        m.updates_json, m.resolved_date, m.resolution_notes, m.created_at,
        i.permanent_code, i.serial_number, i.brand, i.model, i.is_broken,
        p.name as product_name, p.code as product_code,
        c.name as category_name,
        d.name as department_name, d.code as department_code,
        u.full_name as reported_by_name,
        rep_i.permanent_code as replacement_item_code,
        rep_p.name as replacement_product_name
      FROM maintenance_records m
      JOIN inventory_items i ON m.item_id = i.id
      JOIN products p ON i.product_id = p.id
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN departments d ON i.current_department_id = d.id
      LEFT JOIN users u ON m.reported_by_user_id = u.id
      LEFT JOIN inventory_items rep_i ON m.replacement_item_id = rep_i.id
      LEFT JOIN products rep_p ON rep_i.product_id = rep_p.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (status) {
      sql += ` AND m.status = ?`;
      params.push(status);
    }

    sql += ` ORDER BY m.reported_date DESC`;

    const rawRecords = await query(sql, params);

    const records = rawRecords.map((r: any) => {
      let updates = [];
      try {
        updates = r.updates_json ? JSON.parse(r.updates_json) : [];
      } catch {
        updates = [];
      }
      return {
        ...r,
        updates,
      };
    });

    // Activos marcados como averiados que necesitan ser agendados
    const brokenItems = await query(`
      SELECT i.id, i.permanent_code, i.brand, i.model, i.broken_notes, p.name as product_name, d.name as department_name
      FROM inventory_items i
      JOIN products p ON i.product_id = p.id
      LEFT JOIN departments d ON i.current_department_id = d.id
      WHERE (i.is_broken = 1 OR i.operational_status IN ('AVERIADO', 'EN_REVISION'))
      AND i.id NOT IN (SELECT item_id FROM maintenance_records WHERE status IN ('REPORTADA', 'AGENDADA', 'EN_DIAGNOSTICO', 'EN_REPARACION'))
    `);

    return NextResponse.json({ records, brokenItems });
  } catch (error: any) {
    console.error('Error al consultar mantenimientos:', error);
    return NextResponse.json({ error: 'Error al consultar órdenes de mantenimiento.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const body = await req.json();
    const {
      itemId,
      scheduledDate,
      faultDescription,
      severity,
      technicianSupplier,
      repairCost,
      currency,
    } = body;

    if (!itemId || !faultDescription || !faultDescription.trim()) {
      return NextResponse.json(
        { error: 'Debe seleccionar un equipo y especificar la descripción de la avería.' },
        { status: 400 }
      );
    }

    const item = await queryOne<any>(`SELECT * FROM inventory_items WHERE id = ?`, [itemId]);
    if (!item) return NextResponse.json({ error: 'Equipo no encontrado' }, { status: 404 });

    const recordId = `mnt-${Date.now()}`;
    const initialUpdates = [
      {
        date: new Date().toISOString().split('T')[0],
        note: `Reporte inicial: ${faultDescription.trim()}`,
        author: user.fullName,
        status: scheduledDate ? 'AGENDADA' : 'REPORTADA',
      },
    ];

    await run(
      `INSERT INTO maintenance_records (
        id, item_id, scheduled_date, reported_by_user_id, fault_description,
        severity, technician_supplier, repair_cost, currency, charged_department_id,
        status, updates_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        recordId,
        itemId,
        scheduledDate || null,
        user.id,
        faultDescription.trim(),
        severity || 'MODERADA',
        technicianSupplier || null,
        Number(repairCost) || 0,
        currency || 'GTQ',
        item.current_department_id,
        scheduledDate ? 'AGENDADA' : 'REPORTADA',
        JSON.stringify(initialUpdates),
      ]
    );

    // Actualizar estado del activo a AVERIADO
    await run(
      `UPDATE inventory_items SET is_broken = 1, operational_status = 'AVERIADO' WHERE id = ?`,
      [itemId]
    );

    await logAudit({
      userId: user.id,
      username: user.username,
      userRole: user.role,
      action: 'REPORTAR_AVERIA',
      module: 'MANTENIMIENTO',
      entityId: recordId,
      entityName: item.permanent_code,
      reason: `Ingreso a mantenimiento: ${faultDescription.trim()}`,
    });

    return NextResponse.json({ success: true, recordId });
  } catch (error: any) {
    console.error('Error al registrar mantenimiento:', error);
    return NextResponse.json({ error: error.message || 'Error al guardar.' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const body = await req.json();
    const {
      id,
      action, // 'ADD_UPDATE', 'RESOLVE'
      note,
      status,
      solutionType, // 'REPARACION_INTERNA', 'REPARACION_PROVEEDOR', 'COMPRA_REEMPLAZO', 'BAJA_SIN_REEMPLAZO'
      replacementItemId,
      replacementReason,
      resolutionNotes,
    } = body;

    if (!id) return NextResponse.json({ error: 'ID requerido' }, { status: 400 });

    const currentRecord = await queryOne<any>(`SELECT * FROM maintenance_records WHERE id = ?`, [id]);
    if (!currentRecord) return NextResponse.json({ error: 'Registro no encontrado' }, { status: 404 });

    let updates = [];
    try {
      updates = currentRecord.updates_json ? JSON.parse(currentRecord.updates_json) : [];
    } catch {
      updates = [];
    }

    if (action === 'ADD_UPDATE') {
      if (!note || !note.trim()) {
        return NextResponse.json({ error: 'Nota requerida' }, { status: 400 });
      }

      updates.push({
        date: new Date().toISOString().split('T')[0],
        note: note.trim(),
        author: user.fullName,
        status: status || currentRecord.status,
      });

      await run(
        `UPDATE maintenance_records SET updates_json = ?, status = ? WHERE id = ?`,
        [JSON.stringify(updates), status || currentRecord.status, id]
      );

      return NextResponse.json({ success: true });
    }

    if (action === 'RESOLVE') {
      if (!solutionType) {
        return NextResponse.json({ error: 'Tipo de solución requerido' }, { status: 400 });
      }

      const today = new Date().toISOString().split('T')[0];
      const isReplacement = solutionType === 'COMPRA_REEMPLAZO' || solutionType === 'BAJA_SIN_REEMPLAZO';

      updates.push({
        date: today,
        note: `Resolución final: ${solutionType}. ${resolutionNotes || ''}`,
        author: user.fullName,
        status: isReplacement ? 'IRREPARABLE_REEMPLAZO' : 'REPARADO',
      });

      await run(
        `UPDATE maintenance_records SET
          status = ?,
          solution_type = ?,
          replacement_item_id = ?,
          replacement_reason = ?,
          resolved_date = CURRENT_TIMESTAMP,
          resolution_notes = ?,
          updates_json = ?
         WHERE id = ?`,
        [
          isReplacement ? 'IRREPARABLE_REEMPLAZO' : 'REPARADO',
          solutionType,
          replacementItemId || null,
          replacementReason || null,
          resolutionNotes || null,
          JSON.stringify(updates),
          id,
        ]
      );

      // Si fue reparado, volver a DISPONIBLE y quitar bandera is_broken = 0
      if (!isReplacement) {
        await run(
          `UPDATE inventory_items SET is_broken = 0, operational_status = 'DISPONIBLE' WHERE id = ?`,
          [currentRecord.item_id]
        );
      } else {
        // Si no tuvo reparación y se compró reemplazo, marcar como DADO_DE_BAJA
        await run(
          `UPDATE inventory_items SET
            is_broken = 1,
            operational_status = 'DADO_DE_BAJA',
            replacement_item_id = ?
           WHERE id = ?`,
          [replacementItemId || null, currentRecord.item_id]
        );
      }

      await logAudit({
        userId: user.id,
        username: user.username,
        userRole: user.role,
        action: 'RESOLVER_MANTENIMIENTO',
        module: 'MANTENIMIENTO',
        entityId: id,
        entityName: currentRecord.item_id,
        reason: `Resolución de avería: ${solutionType}. Reemplazo: ${replacementItemId || 'Ninguno'}`,
      });

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Acción inválida' }, { status: 400 });
  } catch (error: any) {
    console.error('Error al actualizar mantenimiento:', error);
    return NextResponse.json({ error: error.message || 'Error al actualizar.' }, { status: 500 });
  }
}
