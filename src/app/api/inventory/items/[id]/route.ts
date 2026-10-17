import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne, run, transaction } from '@/lib/db';
import { getCurrentUser, checkPermission, canAccessModule } from '@/lib/auth';
import { logAudit } from '@/lib/audit';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { id } = params;

    const item = await queryOne<any>(`
      SELECT 
        i.*,
        p.name as product_name,
        p.code as product_code,
        p.description as product_description,
        c.name as category_name,
        d.name as department_name,
        d.code as department_code,
        loc.name as location_name,
        u.full_name as assigned_user_name,
        u.email as assigned_user_email,
        u.initials as assigned_user_initials
      FROM inventory_items i
      JOIN products p ON i.product_id = p.id
      JOIN categories c ON p.category_id = c.id
      LEFT JOIN departments d ON i.current_department_id = d.id
      LEFT JOIN locations loc ON i.current_location_id = loc.id
      LEFT JOIN users u ON i.current_assigned_user_id = u.id
      WHERE i.id = ? OR i.permanent_code = ?
    `, [id, id]);

    if (!item) {
      return NextResponse.json({ error: 'Activo no encontrado.' }, { status: 404 });
    }

    // Historial de asignaciones de este activo
    const assignments = await query<any>(`
      SELECT a.*, u.full_name as user_name, u.initials as user_initials,
             d_orig.name as origin_dept_name, d_dest.name as target_dept_name,
             ass_by.full_name as assigned_by_name
      FROM assignments a
      JOIN users u ON a.user_id = u.id
      LEFT JOIN users ass_by ON a.assigned_by_user_id = ass_by.id
      LEFT JOIN departments d_orig ON a.origin_department_id = d_orig.id
      LEFT JOIN departments d_dest ON a.target_department_id = d_dest.id
      WHERE a.item_id = ?
      ORDER BY a.assigned_at DESC
    `, [item.id]);

    // Historial de mantenimientos
    const maintenance = await query<any>(`
      SELECT m.*, u.full_name as reported_by_name
      FROM maintenance_records m
      LEFT JOIN users u ON m.reported_by_user_id = u.id
      WHERE m.item_id = ?
      ORDER BY m.reported_date DESC
    `, [item.id]);

    // Historial de movimientos kardex
    const movements = await query<any>(`
      SELECT m.*, u.full_name as user_name,
             d_from.name as from_dept_name, d_to.name as to_dept_name
      FROM inventory_movements m
      LEFT JOIN users u ON m.user_id = u.id
      LEFT JOIN departments d_from ON m.from_department_id = d_from.id
      LEFT JOIN departments d_to ON m.to_department_id = d_to.id
      WHERE m.item_id = ?
      ORDER BY m.created_at DESC
    `, [item.id]);

    return NextResponse.json({
      success: true,
      item,
      assignments,
      maintenance,
      movements,
    });
  } catch (error: any) {
    console.error('Error al obtener detalle del activo:', error);
    return NextResponse.json({ error: 'Error al consultar activo.' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await getCurrentUser();
    if (!user || !canAccessModule(user, 'INVENTARIO', 'WRITE')) {
      return NextResponse.json({ error: 'No autorizado para modificar activos.' }, { status: 403 });
    }

    const { id } = params;
    const body = await req.json();

    const currentItem = await queryOne<any>(`SELECT * FROM inventory_items WHERE id = ?`, [id]);
    if (!currentItem) {
      return NextResponse.json({ error: 'Activo no encontrado.' }, { status: 404 });
    }

    const {
      serialNumber,
      brand,
      model,
      currentDepartmentId,
      currentLocationId,
      operationalStatus,
      physicalCondition,
      purchasePrice,
      replacementValue,
      supplier,
      notes,
    } = body;

    await run(`
      UPDATE inventory_items
      SET serial_number = COALESCE(?, serial_number),
          brand = COALESCE(?, brand),
          model = COALESCE(?, model),
          current_department_id = COALESCE(?, current_department_id),
          current_location_id = COALESCE(?, current_location_id),
          operational_status = COALESCE(?, operational_status),
          physical_condition = COALESCE(?, physical_condition),
          purchase_price = COALESCE(?, purchase_price),
          replacement_value = COALESCE(?, replacement_value),
          supplier = COALESCE(?, supplier),
          notes = COALESCE(?, notes),
          updated_at = datetime('now')
      WHERE id = ?
    `, [
      serialNumber, brand, model, currentDepartmentId, currentLocationId,
      operationalStatus, physicalCondition,
      purchasePrice !== undefined ? parseFloat(purchasePrice) : null,
      replacementValue !== undefined ? parseFloat(replacementValue) : null,
      supplier, notes, id
    ]);

    await logAudit({
      userId: user.id,
      username: user.username,
      userRole: user.role,
      action: 'EDITAR_ACTIVO',
      module: 'INVENTARIO',
      entityId: id,
      entityName: currentItem.permanent_code,
      beforeState: currentItem,
      afterState: body,
      reason: 'Actualización de ficha de activo',
    });

    return NextResponse.json({ success: true, message: 'Activo actualizado con éxito.' });
  } catch (error: any) {
    console.error('Error al actualizar activo:', error);
    return NextResponse.json({ error: 'Error al actualizar activo.' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await getCurrentUser();
    if (!user || !canAccessModule(user, 'INVENTARIO', 'DELETE')) {
      return NextResponse.json({ error: 'Solo administradores o usuarios autorizados pueden dar de baja activos.' }, { status: 403 });
    }

    const { id } = params;
    const { searchParams } = new URL(req.url);
    const reason = searchParams.get('reason') || 'Baja autorizada por administración';

    const item = await queryOne<any>(`SELECT * FROM inventory_items WHERE id = ?`, [id]);
    if (!item) {
      return NextResponse.json({ error: 'Activo no encontrado.' }, { status: 404 });
    }

    await transaction(async () => {
      // 1. Cerrar asignación activa si existía
      await run(`
        UPDATE assignments
        SET status = 'DEVUELTO',
            returned_at = datetime('now'),
            return_notes = ?
        WHERE item_id = ? AND status = 'ACTIVA'
      `, [reason, id]);

      // 2. Marcar DADO_DE_BAJA, desasignar empleado y registrar notas de baja
      await run(`
        UPDATE inventory_items
        SET operational_status = 'DADO_DE_BAJA',
            physical_condition = 'AVERIADO',
            current_employee_id = NULL,
            current_assigned_user_id = NULL,
            is_broken = 1,
            broken_notes = ?,
            notes = COALESCE(notes, '') || ' | BAJA: ' || ?,
            updated_at = datetime('now')
        WHERE id = ?
      `, [reason, reason, id]);

      // 3. Registrar movimiento de baja
      const movId = `mov-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`;
      await run(`
        INSERT INTO inventory_movements (
          id, movement_type, item_id, product_id, quantity,
          from_department_id, reason, user_id
        ) VALUES (?, 'BAJA', ?, ?, 1, ?, ?, ?)
      `, [movId, id, item.product_id, item.current_department_id, reason, user.id]);
    });

    await logAudit({
      userId: user.id,
      username: user.username,
      userRole: user.role,
      action: 'BAJA_ACTIVO',
      module: 'INVENTARIO',
      entityId: id,
      entityName: item.permanent_code,
      reason,
    });

    return NextResponse.json({ success: true, message: `Activo ${item.permanent_code} dado de baja formalmente.` });
  } catch (error: any) {
    console.error('Error al dar de baja activo:', error);
    return NextResponse.json({ error: 'Error al procesar la baja del activo.' }, { status: 500 });
  }
}
