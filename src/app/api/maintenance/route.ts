import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne, run } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { logAudit } from '@/lib/audit';

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const status = url.searchParams.get('status');

    // Auto-transición: Si algún equipo en observación (prueba de 7 días) ya cumplió su fecha sin fallas, pasarlo a FUNCIONAL / REPARADO
    const todayIso = new Date().toISOString().split('T')[0];
    const expiredObservations = await query<any>(
      `SELECT id, item_id, updates_json, observation_end_date
       FROM maintenance_records
       WHERE (status = 'EN_OBSERVACION' OR resolution_status = 'EN_OBSERVACION')
         AND observation_end_date IS NOT NULL
         AND observation_end_date <= ?`,
      [todayIso]
    );

    for (const obs of expiredObservations) {
      let updates = [];
      try {
        updates = obs.updates_json ? JSON.parse(obs.updates_json) : [];
      } catch {
        updates = [];
      }
      updates.push({
        date: todayIso,
        note: `Prueba de 7 días en observación superada con éxito (vencía ${obs.observation_end_date}). Equipo marcado automáticamente como FUNCIONAL.`,
        author: 'Sistema Automático (7 días)',
        status: 'REPARADO',
      });

      await run(
        `UPDATE maintenance_records
         SET status = 'REPARADO',
             resolution_status = 'FUNCIONAL',
             resolved_date = CURRENT_TIMESTAMP,
             updates_json = ?
         WHERE id = ?`,
        [JSON.stringify(updates), obs.id]
      );

      await run(
        `UPDATE inventory_items
         SET is_broken = 0,
             operational_status = CASE WHEN current_employee_id IS NOT NULL THEN 'ASIGNADO' ELSE 'DISPONIBLE' END
         WHERE id = ?`,
        [obs.item_id]
      );
    }

    let sql = `
      SELECT 
        m.id, m.item_id, m.reported_date, m.scheduled_date, m.fault_description,
        m.severity, m.technician_supplier, m.repair_cost, m.currency,
        m.status, m.solution_type, m.replacement_item_id, m.replacement_reason,
        m.repair_scope, m.resolution_status, m.observation_start_date, m.observation_end_date,
        m.employee_id, m.updates_json, m.resolved_date, m.resolution_notes, m.created_at,
        i.permanent_code, i.serial_number, i.brand, i.model, i.is_broken, i.current_employee_id,
        p.name as product_name, p.code as product_code,
        c.name as category_name,
        d.name as department_name, d.code as department_code,
        COALESCE(emp.full_name, emp_item.full_name) as employee_name,
        COALESCE(emp.employee_code, emp_item.employee_code) as employee_code,
        COALESCE(emp.phone, emp_item.phone) as employee_phone,
        u.full_name as reported_by_name,
        rep_i.permanent_code as replacement_item_code,
        rep_p.name as replacement_product_name
      FROM maintenance_records m
      JOIN inventory_items i ON m.item_id = i.id
      JOIN products p ON i.product_id = p.id
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN departments d ON i.current_department_id = d.id
      LEFT JOIN employees emp ON m.employee_id = emp.id
      LEFT JOIN employees emp_item ON i.current_employee_id = emp_item.id
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

      let observationDaysRemaining: number | null = null;
      if (r.observation_end_date && (r.status === 'EN_OBSERVACION' || r.resolution_status === 'EN_OBSERVACION')) {
        const endMs = new Date(`${r.observation_end_date}T23:59:59`).getTime();
        const diffDays = Math.ceil((endMs - Date.now()) / (1000 * 60 * 60 * 24));
        observationDaysRemaining = Math.max(0, diffDays);
      }

      return {
        ...r,
        updates,
        observationDaysRemaining,
      };
    });

    // Activos marcados como averiados que necesitan ser agendados
    const brokenItems = await query(`
      SELECT i.id, i.permanent_code, i.brand, i.model, i.broken_notes,
             p.name as product_name, d.name as department_name,
             e.full_name as employee_name, e.id as employee_id
      FROM inventory_items i
      JOIN products p ON i.product_id = p.id
      LEFT JOIN departments d ON i.current_department_id = d.id
      LEFT JOIN employees e ON i.current_employee_id = e.id
      WHERE (i.is_broken = 1 OR i.operational_status IN ('AVERIADO', 'EN_REVISION', 'EN_REPARACION'))
      AND i.id NOT IN (
        SELECT item_id FROM maintenance_records
        WHERE status IN ('REPORTADA', 'AGENDADA', 'EN_DIAGNOSTICO', 'EN_REPARACION', 'EN_OBSERVACION')
      )
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
      createNewBrokenItem = false,
      newProductName,
      newBrand,
      newModel,
      newSerialNumber,
      itemId: existingItemId,
      employeeId,
      scheduledDate,
      faultDescription,
      severity = 'MODERADA',
      repairScope = 'TERCERO', // 'TERCERO' | 'INTERNA_NOSOTROS'
      technicianSupplier,
      repairCost,
      currency = 'GTQ',
      startInObservation = false,
    } = body;

    if (!faultDescription || !faultDescription.trim()) {
      return NextResponse.json(
        { error: 'Debe especificar la descripción de la avería o motivo de mantenimiento.' },
        { status: 400 }
      );
    }

    let finalItemId = existingItemId;
    let item: any = null;

    if (createNewBrokenItem) {
      if (!newProductName || !String(newProductName).trim()) {
        return NextResponse.json(
          { error: 'Indique el nombre del producto averiado a registrar.' },
          { status: 400 }
        );
      }
      const prodId = `prod-${Date.now()}`;
      const prodCode = `AVR-${Math.floor(1000 + Math.random() * 9000)}`;
      await run(
        `INSERT INTO products (id, category_id, code, name, brand, model, unit_of_measure, current_stock, min_stock, unit_price)
         VALUES (?, 'cat-2', ?, ?, ?, ?, 'unidad', 1, 1, 0)`,
        [prodId, prodCode, String(newProductName).trim(), newBrand || '', newModel || '']
      );

      finalItemId = `item-${Date.now()}`;
      const permCode = `SIV-MNT-${Math.floor(1000 + Math.random() * 9000)}`;
      await run(
        `INSERT INTO inventory_items (
          id, product_id, permanent_code, serial_number, brand, model,
          current_department_id, current_employee_id, current_location_id,
          operational_status, physical_condition, is_broken, broken_notes
        ) VALUES (?, ?, ?, ?, ?, ?, 'dept-bod', ?, 'loc-bod-1', 'EN_REPARACION', 'DANADO', 1, ?)`,
        [
          finalItemId,
          prodId,
          permCode,
          newSerialNumber || null,
          newBrand || '',
          newModel || '',
          employeeId || null,
          faultDescription.trim(),
        ]
      );
      item = await queryOne<any>(`SELECT * FROM inventory_items WHERE id = ?`, [finalItemId]);
    } else {
      if (!finalItemId) {
        return NextResponse.json({ error: 'Debe seleccionar un equipo.' }, { status: 400 });
      }
      item = await queryOne<any>(`SELECT * FROM inventory_items WHERE id = ?`, [finalItemId]);
      if (!item) return NextResponse.json({ error: 'Equipo no encontrado' }, { status: 404 });
    }

    const recordId = `mnt-${Date.now()}`;
    const todayStr = new Date().toISOString().split('T')[0];
    const obsEndStr = startInObservation
      ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      : null;

    const initialStatus = startInObservation
      ? 'EN_OBSERVACION'
      : scheduledDate
      ? 'AGENDADA'
      : 'EN_REPARACION';

    const scopeLabel =
      repairScope === 'INTERNA_NOSOTROS'
        ? 'Reparación Interna (IT Nosotros)'
        : `Taller / Proveedor Tercero (${technicianSupplier || 'Externo'})`;

    const initialUpdates = [
      {
        date: todayStr,
        note: `Ingreso a mantenimiento [${scopeLabel}]: ${faultDescription.trim()}${
          startInObservation ? ` • Inicia prueba de 7 días en observación hasta ${obsEndStr}` : ''
        }`,
        author: user.fullName,
        status: initialStatus,
      },
    ];

    const resolvedEmployeeId = employeeId || item.current_employee_id || null;

    await run(
      `INSERT INTO maintenance_records (
        id, item_id, scheduled_date, reported_by_user_id, fault_description,
        severity, technician_supplier, repair_cost, currency, charged_department_id,
        status, repair_scope, resolution_status, observation_start_date, observation_end_date,
        employee_id, updates_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        recordId,
        finalItemId,
        scheduledDate || todayStr,
        user.id,
        faultDescription.trim(),
        severity || 'MODERADA',
        repairScope === 'INTERNA_NOSOTROS' ? 'IT Interno (Nosotros)' : technicianSupplier || 'Proveedor Externo',
        Number(repairCost) || 0,
        currency || 'GTQ',
        item.current_department_id || 'dept-bod',
        initialStatus,
        repairScope,
        startInObservation ? 'EN_OBSERVACION' : 'PENDIENTE',
        startInObservation ? todayStr : null,
        obsEndStr,
        resolvedEmployeeId,
        JSON.stringify(initialUpdates),
      ]
    );

    await run(
      `UPDATE inventory_items
       SET is_broken = ?,
           operational_status = ?,
           current_employee_id = COALESCE(?, current_employee_id)
       WHERE id = ?`,
      [
        startInObservation ? 0 : 1,
        startInObservation ? 'ASIGNADO' : 'EN_REPARACION',
        resolvedEmployeeId,
        finalItemId,
      ]
    );

    await logAudit({
      userId: user.id,
      username: user.username,
      userRole: user.role,
      action: 'REPORTAR_AVERIA',
      module: 'MANTENIMIENTO',
      entityId: recordId,
      entityName: item.permanent_code,
      reason: `Ingreso a mantenimiento (${scopeLabel}): ${faultDescription.trim()}`,
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
      action, // 'ADD_UPDATE' | 'START_OBSERVATION' | 'RESOLVE'
      note,
      status,
      repairScope,
      technicianSupplier,
      repairCost,
      employeeId,
      solutionType, // 'REPARACION_INTERNA' | 'REPARACION_PROVEEDOR' | 'EN_OBSERVACION_7_DIAS' | 'COMPRA_REEMPLAZO' | 'BAJA_SIN_REEMPLAZO'
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

    const today = new Date().toISOString().split('T')[0];

    if (action === 'ADD_UPDATE') {
      if (!note || !note.trim()) {
        return NextResponse.json({ error: 'Nota de avance requerida' }, { status: 400 });
      }

      const nextStatus = status || currentRecord.status;
      updates.push({
        date: today,
        note: note.trim(),
        author: user.fullName,
        status: nextStatus,
      });

      await run(
        `UPDATE maintenance_records
         SET updates_json = ?,
             status = ?,
             repair_scope = COALESCE(?, repair_scope),
             technician_supplier = COALESCE(?, technician_supplier),
             repair_cost = COALESCE(?, repair_cost)
         WHERE id = ?`,
        [
          JSON.stringify(updates),
          nextStatus,
          repairScope || null,
          technicianSupplier || null,
          repairCost !== undefined ? Number(repairCost) : null,
          id,
        ]
      );

      return NextResponse.json({ success: true, updates });
    }

    if (action === 'START_OBSERVATION' || solutionType === 'EN_OBSERVACION_7_DIAS') {
      const obsEnd = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const obsNote =
        note ||
        resolutionNotes ||
        `Equipo entregado en período de observación por 7 días (hasta ${obsEnd}). Si no presenta fallas en 1 semana, quedará marcado como FUNCIONAL automáticamente.`;

      updates.push({
        date: today,
        note: obsNote,
        author: user.fullName,
        status: 'EN_OBSERVACION',
      });

      await run(
        `UPDATE maintenance_records
         SET status = 'EN_OBSERVACION',
             resolution_status = 'EN_OBSERVACION',
             observation_start_date = ?,
             observation_end_date = ?,
             employee_id = COALESCE(?, employee_id),
             updates_json = ?
         WHERE id = ?`,
        [today, obsEnd, employeeId || null, JSON.stringify(updates), id]
      );

      await run(
        `UPDATE inventory_items
         SET is_broken = 0,
             operational_status = 'ASIGNADO',
             current_employee_id = COALESCE(?, current_employee_id)
         WHERE id = ?`,
        [employeeId || currentRecord.employee_id || null, currentRecord.item_id]
      );

      return NextResponse.json({
        success: true,
        observationEndDate: obsEnd,
        message: `Equipo puesto en observación por 7 días (hasta ${obsEnd}).`,
      });
    }

    if (action === 'RESOLVE') {
      if (!solutionType) {
        return NextResponse.json({ error: 'Tipo de solución requerido' }, { status: 400 });
      }

      const isReplacementOrBaja =
        solutionType === 'COMPRA_REEMPLAZO' || solutionType === 'BAJA_SIN_REEMPLAZO';
      const finalStatus = isReplacementOrBaja ? 'DADO_DE_BAJA' : 'REPARADO';
      const finalResolutionStatus = isReplacementOrBaja ? 'DAR_DE_BAJA' : 'FUNCIONAL';

      updates.push({
        date: today,
        note: `Resolución final (${solutionType}): ${resolutionNotes || 'Completado'}`,
        author: user.fullName,
        status: finalStatus,
      });

      await run(
        `UPDATE maintenance_records SET
          status = ?,
          resolution_status = ?,
          solution_type = ?,
          replacement_item_id = ?,
          replacement_reason = ?,
          resolved_date = CURRENT_TIMESTAMP,
          resolution_notes = ?,
          updates_json = ?
         WHERE id = ?`,
        [
          finalStatus,
          finalResolutionStatus,
          solutionType,
          replacementItemId || null,
          replacementReason || null,
          resolutionNotes || null,
          JSON.stringify(updates),
          id,
        ]
      );

      if (!isReplacementOrBaja) {
        await run(
          `UPDATE inventory_items
           SET is_broken = 0,
               operational_status = CASE WHEN current_employee_id IS NOT NULL THEN 'ASIGNADO' ELSE 'DISPONIBLE' END
           WHERE id = ?`,
          [currentRecord.item_id]
        );
      } else {
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
        reason: `Resolución de avería: ${solutionType}. Estado: ${finalResolutionStatus}`,
      });

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Acción inválida' }, { status: 400 });
  } catch (error: any) {
    console.error('Error al actualizar mantenimiento:', error);
    return NextResponse.json({ error: error.message || 'Error al actualizar.' }, { status: 500 });
  }
}
