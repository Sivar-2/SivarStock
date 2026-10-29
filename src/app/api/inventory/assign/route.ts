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
      employeeId,
      userId,
      targetDepartmentId,
      chargedDepartmentId,
      expectedReturnDate,
      notes,
    } = body;

    const targetPersonId = employeeId || userId;
    if (!itemId || !targetPersonId) {
      return NextResponse.json({ error: 'Debe seleccionar el activo y el empleado/responsable.' }, { status: 400 });
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
      return NextResponse.json({ error: 'El activo ya se encuentra asignado a otro colaborador.' }, { status: 400 });
    }

    if (item.operational_status === 'DADO_DE_BAJA' || item.operational_status === 'PERDIDO') {
      return NextResponse.json({ error: 'No se puede asignar un activo dado de baja o extraviado.' }, { status: 400 });
    }

    // Buscar primero en employees, y como respaldo en users
    let recipientEmp = await queryOne<any>(`
      SELECT id, full_name, initials, department_id, employee_code
      FROM employees
      WHERE id = ?
    `, [targetPersonId]);

    let recipientUser: any = null;
    if (!recipientEmp) {
      recipientUser = await queryOne<any>(`
        SELECT id, full_name, initials, department_id, employee_id
        FROM users
        WHERE id = ? AND is_active = 1
      `, [targetPersonId]);
      if (recipientUser && recipientUser.employee_id) {
        recipientEmp = await queryOne<any>(`SELECT id, full_name, initials, department_id, employee_code FROM employees WHERE id = ?`, [recipientUser.employee_id]);
      }
    } else {
      recipientUser = await queryOne<any>(`SELECT id FROM users WHERE employee_id = ? AND is_active = 1`, [recipientEmp.id]);
    }

    if (!recipientEmp && !recipientUser) {
      return NextResponse.json({ error: 'Empleado o usuario responsable no encontrado.' }, { status: 404 });
    }

    const recipientName = recipientEmp ? recipientEmp.full_name : recipientUser.full_name;
    const recipientInitials = recipientEmp ? recipientEmp.initials : recipientUser.initials;
    const recipientDeptId = recipientEmp ? recipientEmp.department_id : recipientUser.department_id;
    const resolvedEmployeeId = recipientEmp ? recipientEmp.id : null;
    const resolvedUserId = recipientUser ? recipientUser.id : null;

    // Generar código de asignación estructurado
    const assignmentCode = await generateAssignmentCode(
      recipientInitials,
      item.product_code,
      new Date().getFullYear()
    );

    const assignmentId = `asg-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`;
    const effectiveTargetDept = targetDepartmentId || recipientDeptId || item.current_department_id;
    const effectiveChargedDept = chargedDepartmentId || effectiveTargetDept;

    await transaction(async () => {
      // 1. Crear el registro de asignación vinculando employee_id y user_id
      await run(`
        INSERT INTO assignments (
          id, assignment_code, item_id, product_id, quantity, employee_id, user_id, assigned_by_user_id,
          origin_department_id, target_department_id, charged_department_id, assigned_at,
          expected_return_date, status, notes
        ) VALUES (?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, datetime('now'), ?, 'ACTIVA', ?)
      `, [
        assignmentId, assignmentCode, itemId, item.product_id, resolvedEmployeeId, resolvedUserId, user.id,
        item.current_department_id, effectiveTargetDept, effectiveChargedDept,
        expectedReturnDate || null, notes || null
      ]);

      // 2. Si estaba DISPONIBLE en Bodega, reducir en 1 el current_stock disponible en bodega
      if (item.operational_status === 'DISPONIBLE') {
        await run(
          `UPDATE products SET current_stock = CASE WHEN current_stock > 0 THEN current_stock - 1 ELSE 0 END WHERE id = ?`,
          [item.product_id]
        );
      }

      // 3. Actualizar estado y responsable en el activo (tanto current_employee_id como current_assigned_user_id)
      await run(`
        UPDATE inventory_items
        SET operational_status = 'ASIGNADO',
            current_employee_id = ?,
            current_assigned_user_id = ?,
            current_department_id = ?,
            updated_at = datetime('now')
        WHERE id = ?
      `, [resolvedEmployeeId, resolvedUserId, effectiveTargetDept, itemId]);

      // 4. Registrar movimiento kardex
      const movId = `mov-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`;
      await run(`
        INSERT INTO inventory_movements (
          id, movement_type, item_id, product_id, quantity,
          from_department_id, to_department_id, from_employee_id, to_employee_id, from_user_id, to_user_id,
          reason, reference_code, user_id
        ) VALUES (?, 'ASIGNACION', ?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        movId, itemId, item.product_id,
        item.current_department_id, effectiveTargetDept,
        item.current_employee_id, resolvedEmployeeId,
        item.current_assigned_user_id, resolvedUserId,
        `Asignación formal a ${recipientName}`, assignmentCode, user.id
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
      afterState: { assignmentCode, itemId, employeeId: resolvedEmployeeId, userId: resolvedUserId, permanentCode: item.permanent_code },
      reason: `Asignación de ${item.permanent_code} a ${recipientName}`,
    });

    return NextResponse.json({
      success: true,
      message: `Activo asignado exitosamente a ${recipientName} con código ${assignmentCode}`,
      assignment: {
        id: assignmentId,
        code: assignmentCode,
        recipient: recipientName,
      }
    });
  } catch (error: any) {
    console.error('Error al asignar activo:', error);
    return NextResponse.json({ error: error.message || 'Error al procesar asignación.' }, { status: 500 });
  }
}
