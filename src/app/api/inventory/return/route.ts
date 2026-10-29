import { NextRequest, NextResponse } from 'next/server';
import { queryOne, run, transaction } from '@/lib/db';
import { getCurrentUser, checkPermission } from '@/lib/auth';
import { logAudit } from '@/lib/audit';

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || !checkPermission(user, 'AREA_MANAGER')) {
      return NextResponse.json({ error: 'No autorizado para procesar devoluciones.' }, { status: 403 });
    }

    const body = await req.json();
    const {
      assignmentId,
      itemId,
      returnCondition = 'BUENO',
      newDepartmentId,
      newLocationId,
      sendToMaintenance = false,
      returnNotes,
    } = body;

    if (!assignmentId && !itemId) {
      return NextResponse.json({ error: 'Debe especificar el código/ID de la asignación o del activo.' }, { status: 400 });
    }

    let assignment = await queryOne<any>(`
      SELECT a.*, i.permanent_code,
             COALESCE(e.full_name, u.full_name, 'Colaborador') as user_name
      FROM assignments a
      LEFT JOIN inventory_items i ON a.item_id = i.id
      LEFT JOIN employees e ON a.employee_id = e.id
      LEFT JOIN users u ON a.user_id = u.id
      WHERE a.id = ? OR a.assignment_code = ? OR (a.item_id = ? AND a.status IN ('ACTIVA', 'DEVOLUCION_PENDIENTE'))
      ORDER BY a.assigned_at DESC LIMIT 1
    `, [assignmentId || '', assignmentId || '', itemId || assignmentId || '']);

    // Si no tenía fila en assignments pero el activo está ASIGNADO o DEVOLUCION_PENDIENTE en inventory_items
    if (!assignment && (itemId || assignmentId)) {
      const directItem = await queryOne<any>(`
        SELECT i.*, COALESCE(e.full_name, u.full_name, 'Colaborador') as user_name
        FROM inventory_items i
        LEFT JOIN employees e ON i.current_employee_id = e.id
        LEFT JOIN users u ON i.current_assigned_user_id = u.id
        WHERE i.id = ? OR i.permanent_code = ?
      `, [itemId || assignmentId, itemId || assignmentId]);

      if (directItem) {
        assignment = {
          id: null,
          assignment_code: directItem.permanent_code,
          item_id: directItem.id,
          product_id: directItem.product_id,
          employee_id: directItem.current_employee_id,
          user_id: directItem.current_assigned_user_id,
          origin_department_id: 'dept-bod',
          target_department_id: directItem.current_department_id,
          permanent_code: directItem.permanent_code,
          user_name: directItem.user_name,
          status: 'ACTIVA',
        };
      }
    }

    if (!assignment) {
      return NextResponse.json({ error: 'Asignación o activo no encontrado.' }, { status: 404 });
    }

    if (assignment.status === 'DEVUELTO') {
      return NextResponse.json({ error: 'Esta asignación ya fue finalizada anteriormente.' }, { status: 400 });
    }

    const targetDept = newDepartmentId || assignment.origin_department_id || 'dept-bod';
    const isDamaged = returnCondition === 'AVERIADO' || returnCondition === 'DANADO' || sendToMaintenance;
    const newOperationalStatus = isDamaged ? 'EN_REVISION' : 'DISPONIBLE';

    await transaction(async () => {
      // 1. Cerrar la asignación si existe registro
      if (assignment.id) {
        await run(`
          UPDATE assignments
          SET status = 'DEVUELTO',
              returned_at = datetime('now'),
              return_condition = ?,
              return_notes = ?
          WHERE id = ?
        `, [returnCondition, returnNotes || null, assignment.id]);
      }

      // 2. Si es un activo individual, liberarlo y actualizar stock en bodega si queda DISPONIBLE
      if (assignment.item_id) {
        await run(`
          UPDATE inventory_items
          SET operational_status = ?,
              physical_condition = ?,
              current_employee_id = NULL,
              current_assigned_user_id = NULL,
              current_department_id = ?,
              current_location_id = ?,
              updated_at = datetime('now')
          WHERE id = ?
        `, [newOperationalStatus, returnCondition, targetDept, newLocationId || null, assignment.item_id]);

        if (newOperationalStatus === 'DISPONIBLE' && assignment.product_id) {
          await run(`UPDATE products SET current_stock = COALESCE(current_stock, 0) + 1 WHERE id = ?`, [assignment.product_id]);
        }
      } else if (assignment.product_id && !isDamaged) {
        // Si fue asignación por cantidad desde catálogo de productos, reintegrar cantidad al stock
        const qty = Number(assignment.quantity) || 1;
        await run(`UPDATE products SET current_stock = COALESCE(current_stock, 0) + ? WHERE id = ?`, [qty, assignment.product_id]);
      }

      // 3. Registrar movimiento kardex
      const movId = `mov-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`;
      await run(`
        INSERT INTO inventory_movements (
          id, movement_type, item_id, product_id, quantity,
          from_department_id, to_department_id, from_employee_id, from_user_id,
          reason, reference_code, user_id
        ) VALUES (?, 'DEVOLUCION', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        movId, assignment.item_id || null, assignment.product_id, Number(assignment.quantity) || 1,
        assignment.target_department_id, targetDept, assignment.employee_id || null, assignment.user_id || null,
        `Devolución de equipo. Condición: ${returnCondition}. ${returnNotes || ''}`.trim(),
        assignment.assignment_code, user.id
      ]);

      // 4. Si amerita mantenimiento, registrar ficha técnica
      if (isDamaged && assignment.item_id) {
        const mntId = `mnt-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`;
        await run(`
          INSERT INTO maintenance_records (
            id, item_id, fault_description, severity, status, charged_department_id, reported_by_user_id
          ) VALUES (?, ?, ?, 'MODERADA', 'REPORTADA', ?, ?)
        `, [
          mntId, assignment.item_id,
          `Ingreso por devolución en condición ${returnCondition}: ${returnNotes || 'Revisión técnica requerida'}`,
          targetDept, user.id
        ]);
      }
    });

    await logAudit({
      userId: user.id,
      username: user.username,
      userRole: user.role,
      action: 'DEVOLVER_ACTIVO',
      module: 'ASIGNACIONES',
      entityId: assignment.id || assignment.item_id,
      entityName: assignment.assignment_code,
      reason: `Devolución de ${assignment.permanent_code || assignment.assignment_code} por ${assignment.user_name}`,
    });

    return NextResponse.json({
      success: true,
      message: `Activo devuelto exitosamente. Estado actual: ${newOperationalStatus}.`,
    });
  } catch (error: any) {
    console.error('Error al devolver activo:', error);
    return NextResponse.json({ error: error.message || 'Error al procesar devolución.' }, { status: 500 });
  }
}
