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
      returnCondition = 'BUENO',
      newDepartmentId,
      newLocationId,
      sendToMaintenance = false,
      returnNotes,
    } = body;

    if (!assignmentId) {
      return NextResponse.json({ error: 'Debe especificar el código o ID de la asignación.' }, { status: 400 });
    }

    const assignment = await queryOne<any>(`
      SELECT a.*, i.permanent_code, u.full_name as user_name
      FROM assignments a
      JOIN inventory_items i ON a.item_id = i.id
      JOIN users u ON a.user_id = u.id
      WHERE a.id = ? OR a.assignment_code = ?
    `, [assignmentId, assignmentId]);

    if (!assignment) {
      return NextResponse.json({ error: 'Asignación no encontrada.' }, { status: 404 });
    }

    if (assignment.status === 'DEVUELTO') {
      return NextResponse.json({ error: 'Esta asignación ya fue finalizada anteriormente.' }, { status: 400 });
    }

    const targetDept = newDepartmentId || assignment.origin_department_id || 'dept-it';
    const isDamaged = returnCondition === 'AVERIADO' || returnCondition === 'DANADO' || sendToMaintenance;
    const newOperationalStatus = isDamaged ? 'EN_REVISION' : 'DISPONIBLE';

    await transaction(async () => {
      // 1. Cerrar la asignación
      await run(`
        UPDATE assignments
        SET status = 'DEVUELTO',
            returned_at = datetime('now'),
            return_condition = ?,
            return_notes = ?
        WHERE id = ?
      `, [returnCondition, returnNotes || null, assignment.id]);

      // 2. Liberar el activo individual
      await run(`
        UPDATE inventory_items
        SET operational_status = ?,
            physical_condition = ?,
            current_assigned_user_id = NULL,
            current_department_id = ?,
            current_location_id = ?,
            updated_at = datetime('now')
        WHERE id = ?
      `, [newOperationalStatus, returnCondition, targetDept, newLocationId || null, assignment.item_id]);

      // 3. Registrar movimiento kardex
      const movId = `mov-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`;
      await run(`
        INSERT INTO inventory_movements (
          id, movement_type, item_id, product_id, quantity,
          from_department_id, to_department_id, from_user_id,
          reason, reference_code, user_id
        ) VALUES (?, 'DEVOLUCION', ?, ?, 1, ?, ?, ?, ?, ?, ?)
      `, [
        movId, assignment.item_id, assignment.product_id,
        assignment.target_department_id, targetDept, assignment.user_id,
        `Devolución de equipo. Condición: ${returnCondition}. ${returnNotes || ''}`,
        assignment.assignment_code, user.id
      ]);

      // 4. Si amerita mantenimiento, registrar ficha técnica
      if (isDamaged) {
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
      entityId: assignment.id,
      entityName: assignment.assignment_code,
      reason: `Devolución de ${assignment.permanent_code} por ${assignment.user_name}`,
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
