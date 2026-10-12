import { NextRequest, NextResponse } from 'next/server';
import { queryOne, run, transaction } from '@/lib/db';
import { getCurrentUser, checkPermission } from '@/lib/auth';
import { generateAssignmentCode } from '@/lib/codes';
import { logAudit } from '@/lib/audit';

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || !checkPermission(user, 'AREA_MANAGER')) {
      return NextResponse.json({ error: 'No autorizado para asignar activos.' }, { status: 403 });
    }

    const body = await req.json();
    const {
      itemId,
      userId,
      targetDepartmentId,
      chargedDepartmentId,
      expectedReturnDate,
      notes,
    } = body;

    if (!itemId || !userId) {
      return NextResponse.json({ error: 'Debe seleccionar el activo y el usuario responsable.' }, { status: 400 });
    }

    // Verificar el activo
    const item = await queryOne<any>(`
      SELECT i.*, p.code as product_code, p.name as product_name
      FROM inventory_items i
      JOIN products p ON i.product_id = p.id
      WHERE i.id = ?
    `, [itemId]);

    if (!item) {
      return NextResponse.json({ error: 'Activo no encontrado.' }, { status: 404 });
    }

    if (item.operational_status === 'ASIGNADO') {
      return NextResponse.json({ error: 'El activo ya se encuentra asignado a otro usuario.' }, { status: 400 });
    }

    if (item.operational_status === 'DADO_DE_BAJA' || item.operational_status === 'PERDIDO') {
      return NextResponse.json({ error: 'No se puede asignar un activo dado de baja o extraviado.' }, { status: 400 });
    }

    // Obtener iniciales y departamento del usuario receptor
    const recipient = await queryOne<any>(`
      SELECT id, full_name, initials, department_id 
      FROM users 
      WHERE id = ? AND is_active = 1
    `, [userId]);

    if (!recipient) {
      return NextResponse.json({ error: 'Usuario responsable no válido o inactivo.' }, { status: 404 });
    }

    // Generar código de asignación estructurado
    const assignmentCode = await generateAssignmentCode(
      recipient.initials,
      item.product_code,
      new Date().getFullYear()
    );

    const assignmentId = `asg-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`;
    const effectiveTargetDept = targetDepartmentId || recipient.department_id || item.current_department_id;
    const effectiveChargedDept = chargedDepartmentId || effectiveTargetDept;

    await transaction(async () => {
      // 1. Crear el registro de asignación
      await run(`
        INSERT INTO assignments (
          id, assignment_code, item_id, product_id, quantity, user_id, assigned_by_user_id,
          origin_department_id, target_department_id, charged_department_id, assigned_at,
          expected_return_date, status, notes
        ) VALUES (?, ?, ?, ?, 1, ?, ?, ?, ?, ?, datetime('now'), ?, 'ACTIVA', ?)
      `, [
        assignmentId, assignmentCode, itemId, item.product_id, userId, user.id,
        item.current_department_id, effectiveTargetDept, effectiveChargedDept,
        expectedReturnDate || null, notes || null
      ]);

      // 2. Actualizar estado y responsable en el activo
      await run(`
        UPDATE inventory_items
        SET operational_status = 'ASIGNADO',
            current_assigned_user_id = ?,
            current_department_id = ?,
            updated_at = datetime('now')
        WHERE id = ?
      `, [userId, effectiveTargetDept, itemId]);

      // 3. Registrar movimiento kardex
      const movId = `mov-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`;
      await run(`
        INSERT INTO inventory_movements (
          id, movement_type, item_id, product_id, quantity,
          from_department_id, to_department_id, from_user_id, to_user_id,
          reason, reference_code, user_id
        ) VALUES (?, 'ASIGNACION', ?, ?, 1, ?, ?, ?, ?, ?, ?, ?)
      `, [
        movId, itemId, item.product_id,
        item.current_department_id, effectiveTargetDept,
        item.current_assigned_user_id, userId,
        `Asignación formal a ${recipient.full_name}`, assignmentCode, user.id
      ]);
    });

    await logAudit({
      userId: user.id,
      username: user.username,
      userRole: user.role,
      action: 'ASIGNAR_ACTIVO',
      module: 'ASIGNACIONES',
      entityId: assignmentId,
      entityName: assignmentCode,
      afterState: { assignmentCode, itemId, userId, permanentCode: item.permanent_code },
      reason: `Asignación de ${item.permanent_code} a ${recipient.full_name}`,
    });

    return NextResponse.json({
      success: true,
      message: `Activo asignado exitosamente con código ${assignmentCode}`,
      assignment: {
        id: assignmentId,
        code: assignmentCode,
        recipient: recipient.full_name,
      }
    });
  } catch (error: any) {
    console.error('Error al asignar activo:', error);
    return NextResponse.json({ error: error.message || 'Error al procesar asignación.' }, { status: 500 });
  }
}
