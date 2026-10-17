import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne, run, transaction } from '@/lib/db';
import { getCurrentUser, canAccessModule } from '@/lib/auth';
import { generateAssignmentCode } from '@/lib/codes';
import { logAudit } from '@/lib/audit';

export const dynamic = 'force-dynamic';

/**
 * GET /api/inventory/lifecycle?code=SIV-...
 * Busca un activo en inventory_items por permanent_code, serial_number o id (o en products por code).
 * Retorna activo, producto, categoría, departamento, custodio actual, última asignación activa,
 * últimos 5 movimientos y equipos DISPONIBLES de la misma categoría para SWAP.
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const code = (searchParams.get('code') || '').trim();

    if (!code) {
      return NextResponse.json({ error: 'Código de activo o producto requerido' }, { status: 400 });
    }

    // 1. Buscar en inventory_items por permanent_code, serial_number o id
    const item = await queryOne<any>(`
      SELECT 
        i.*,
        p.id as product_id,
        p.name as product_name,
        p.code as product_code,
        p.description as product_description,
        p.brand as product_brand,
        p.model as product_model,
        p.image_url as product_image_url,
        p.unit_price as product_unit_price,
        c.id as category_id,
        c.name as category_name,
        c.code as category_code,
        d.id as department_id,
        d.name as department_name,
        d.code as department_code,
        e.id as employee_id,
        e.full_name as employee_name,
        e.employee_code,
        e.initials as employee_initials,
        e.email as employee_email,
        e.phone as employee_phone
      FROM inventory_items i
      JOIN products p ON i.product_id = p.id
      JOIN categories c ON p.category_id = c.id
      LEFT JOIN departments d ON i.current_department_id = d.id
      LEFT JOIN employees e ON i.current_employee_id = e.id
      WHERE UPPER(i.permanent_code) = UPPER(?) 
         OR UPPER(i.serial_number) = UPPER(?) 
         OR i.id = ?
    `, [code, code, code]);

    if (!item) {
      // 2. Si no existe en inventory_items, buscar en products por code o id
      const productData = await queryOne<any>(`
        SELECT p.*, c.name as category_name, c.code as category_code
        FROM products p
        JOIN categories c ON p.category_id = c.id
        WHERE UPPER(p.code) = UPPER(?) OR p.id = ?
      `, [code, code]);

      if (!productData) {
        return NextResponse.json(
          { error: `No se encontró ningún activo ni producto con el código "${code}".` },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        isProductOnly: true,
        product: productData,
        message: 'Código corresponde a un producto general del catálogo.',
      });
    }

    // 3. Última asignación activa en assignments
    const activeAssignment = await queryOne<any>(`
      SELECT a.*, 
             e.full_name as employee_name, e.employee_code, e.initials as employee_initials,
             e.email as employee_email, e.phone as employee_phone,
             td.name as target_dept_name, td.code as target_dept_code,
             u.full_name as assigned_by_name
      FROM assignments a
      LEFT JOIN employees e ON a.employee_id = e.id
      LEFT JOIN departments td ON a.target_department_id = td.id
      LEFT JOIN users u ON a.assigned_by_user_id = u.id
      WHERE a.item_id = ? AND a.status = 'ACTIVA'
      ORDER BY a.assigned_at DESC LIMIT 1
    `, [item.id]);

    // 4. Últimos 5 movimientos del activo
    const recentMovements = await query<any>(`
      SELECT m.*, 
             u.full_name as executed_by_name, u.username as executed_by_username,
             fd.name as from_dept_name, td.name as to_dept_name,
             fe.full_name as from_employee_name, te.full_name as to_employee_name
      FROM inventory_movements m
      LEFT JOIN users u ON m.user_id = u.id
      LEFT JOIN departments fd ON m.from_department_id = fd.id
      LEFT JOIN departments td ON m.to_department_id = td.id
      LEFT JOIN employees fe ON m.from_employee_id = fe.id
      LEFT JOIN employees te ON m.to_employee_id = te.id
      WHERE m.item_id = ?
      ORDER BY m.created_at DESC LIMIT 5
    `, [item.id]);

    // 5. Lista de equipos DISPONIBLE de la misma categoría para SWAP
    const availableSwaps = await query<any>(`
      SELECT i.id, i.permanent_code, i.serial_number, i.brand, i.model, i.physical_condition,
             p.name as product_name, p.code as product_code, d.name as department_name
      FROM inventory_items i
      JOIN products p ON i.product_id = p.id
      LEFT JOIN departments d ON i.current_department_id = d.id
      WHERE p.category_id = ? 
        AND i.operational_status = 'DISPONIBLE' 
        AND i.id != ?
      ORDER BY i.permanent_code ASC
      LIMIT 25
    `, [item.category_id, item.id]);

    return NextResponse.json({
      success: true,
      isProductOnly: false,
      item,
      activeAssignment,
      recentMovements,
      availableSwaps,
    });
  } catch (error: any) {
    console.error('Error en lifecycle GET:', error);
    return NextResponse.json({ error: error.message || 'Error al consultar ciclo de vida' }, { status: 500 });
  }
}

/**
 * POST /api/inventory/lifecycle
 * Ejecuta en transacción las acciones de ciclo de vida del activo:
 * - ASSIGN: Asigna activo a empleado y genera AM-XXXX
 * - SWAP: Sustituye activo por otro de bodega, cierra asignación anterior y crea nueva
 * - RETURN_TO_WAREHOUSE: Retorna activo a bodega y desvincula custodio
 * - DECOMMISSION: Da de baja equipo con justificación y libera custodio
 * - REACTIVATE: Reactiva equipo dado de baja o averiado dejándolo disponible o reasignándolo
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || !canAccessModule(user, 'INVENTARIO', 'WRITE')) {
      return NextResponse.json(
        { error: 'Acceso denegado: Se requieren permisos de edición (ADMIN o SUBADMIN) para operar ciclo de vida.' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { action } = body;

    if (!action) {
      return NextResponse.json({ error: 'Acción de ciclo de vida no especificada' }, { status: 400 });
    }

    // ------------------------------------------------------------------------
    // 1. ASSIGN: Asignación a Empleado
    // ------------------------------------------------------------------------
    if (action === 'ASSIGN') {
      const { itemId, employeeId, departmentId, expectedReturnDate, notes } = body;

      if (!itemId || !employeeId) {
        return NextResponse.json({ error: 'Debe seleccionar el activo y el empleado custodio.' }, { status: 400 });
      }

      const item = await queryOne<any>(`
        SELECT i.*, p.code as product_code, p.name as product_name
        FROM inventory_items i
        JOIN products p ON i.product_id = p.id
        WHERE i.id = ?
      `, [itemId]);

      if (!item) return NextResponse.json({ error: 'Activo no encontrado.' }, { status: 404 });
      if (item.operational_status === 'ASIGNADO') {
        return NextResponse.json({ error: 'El activo ya se encuentra asignado a un custodio.' }, { status: 400 });
      }
      if (item.operational_status === 'DADO_DE_BAJA') {
        return NextResponse.json({ error: 'No se puede asignar un activo que está dado de baja.' }, { status: 400 });
      }

      const emp = await queryOne<any>(`SELECT * FROM employees WHERE id = ?`, [employeeId]);
      if (!emp) return NextResponse.json({ error: 'Empleado no encontrado.' }, { status: 404 });

      const targetDept = departmentId || emp.department_id || item.current_department_id || 'dept-bod';
      const assignmentCode = await generateAssignmentCode(emp.initials, item.product_code, new Date().getFullYear());
      const assignmentId = `asg-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      const movId = `mov-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

      await transaction(async () => {
        // Insertar asignación
        await run(`
          INSERT INTO assignments (
            id, assignment_code, item_id, product_id, employee_id, assigned_by_user_id,
            origin_department_id, target_department_id, charged_department_id,
            assigned_at, expected_return_date, status, notes
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), ?, 'ACTIVA', ?)
        `, [
          assignmentId, assignmentCode, itemId, item.product_id, employeeId, user.id,
          item.current_department_id || 'dept-bod', targetDept, targetDept,
          expectedReturnDate || null, notes || null
        ]);

        // Actualizar activo
        await run(`
          UPDATE inventory_items
          SET operational_status = 'ASIGNADO',
              current_employee_id = ?,
              current_department_id = ?,
              updated_at = datetime('now')
          WHERE id = ?
        `, [employeeId, targetDept, itemId]);

        // Registrar movimiento
        await run(`
          INSERT INTO inventory_movements (
            id, movement_type, item_id, product_id, quantity,
            from_department_id, to_department_id, to_employee_id,
            reason, reference_code, user_id, created_at
          ) VALUES (?, 'ASIGNACION', ?, ?, 1, ?, ?, ?, ?, ?, ?, datetime('now'))
        `, [
          movId, itemId, item.product_id,
          item.current_department_id || 'dept-bod', targetDept, employeeId,
          `Asignación mediante escaneo QR a ${emp.full_name}. ${notes ? `Notas: ${notes}` : ''}`.trim(),
          assignmentCode, user.id
        ]);
      });

      await logAudit({
        userId: user.id,
        username: user.username,
        userRole: user.role,
        action: 'ASIGNAR_ACTIVO',
        module: 'INVENTARIO',
        entityId: itemId,
        entityName: `${item.permanent_code} (${assignmentCode})`,
        reason: `Activo ${item.permanent_code} asignado a ${emp.full_name} (${emp.employee_code})`,
      });

      return NextResponse.json({
        success: true,
        message: `Activo asignado exitosamente con código ${assignmentCode}`,
        assignmentCode,
      });
    }

    // ------------------------------------------------------------------------
    // 2. SWAP: Cambiar / Sustituir por otro equipo de bodega
    // ------------------------------------------------------------------------
    if (action === 'SWAP') {
      const {
        oldItemId,
        newItemId,
        employeeId,
        oldItemDestinationStatus = 'EN_REVISION',
        oldItemCondition = 'AVERIADO',
        reason,
      } = body;

      if (!oldItemId || !newItemId || !employeeId || !reason?.trim()) {
        return NextResponse.json(
          { error: 'Equipo saliente, nuevo equipo de reemplazo, empleado y motivo son obligatorios.' },
          { status: 400 }
        );
      }

      const oldItem = await queryOne<any>(`
        SELECT i.*, p.code as product_code, p.name as product_name
        FROM inventory_items i
        JOIN products p ON i.product_id = p.id
        WHERE i.id = ?
      `, [oldItemId]);

      const newItem = await queryOne<any>(`
        SELECT i.*, p.code as product_code, p.name as product_name
        FROM inventory_items i
        JOIN products p ON i.product_id = p.id
        WHERE i.id = ?
      `, [newItemId]);

      if (!oldItem || !newItem) {
        return NextResponse.json({ error: 'Uno de los activos no fue encontrado en la base de datos.' }, { status: 404 });
      }

      if (newItem.operational_status !== 'DISPONIBLE') {
        return NextResponse.json({ error: 'El equipo de reemplazo debe estar en estado DISPONIBLE en bodega.' }, { status: 400 });
      }

      const emp = await queryOne<any>(`SELECT * FROM employees WHERE id = ?`, [employeeId]);
      if (!emp) return NextResponse.json({ error: 'Empleado no encontrado.' }, { status: 404 });

      const newAssignmentCode = await generateAssignmentCode(emp.initials, newItem.product_code, new Date().getFullYear());
      const newAssignmentId = `asg-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      const targetDept = emp.department_id || newItem.current_department_id || 'dept-bod';

      const movOldId = `mov-${Date.now()}-1`;
      const movNewId = `mov-${Date.now()}-2`;

      await transaction(async () => {
        // 1. Cerrar asignación del equipo saliente
        await run(`
          UPDATE assignments
          SET status = 'DEVUELTO',
              returned_at = datetime('now'),
              return_condition = ?,
              return_notes = ?
          WHERE item_id = ? AND status = 'ACTIVA'
        `, [oldItemCondition, `Reemplazado por ${newItem.permanent_code}: ${reason.trim()}`, oldItemId]);

        // 2. Actualizar estado del equipo saliente y enlazar replacement_item_id
        const isBroken = oldItemDestinationStatus === 'AVERIADO' || oldItemDestinationStatus === 'DADO_DE_BAJA' ? 1 : 0;
        await run(`
          UPDATE inventory_items
          SET operational_status = ?,
              physical_condition = ?,
              current_employee_id = NULL,
              current_department_id = 'dept-bod',
              is_broken = ?,
              broken_notes = ?,
              replacement_item_id = ?,
              notes = COALESCE(notes, '') || ?,
              updated_at = datetime('now')
          WHERE id = ?
        `, [
          oldItemDestinationStatus,
          oldItemCondition,
          isBroken,
          reason.trim(),
          newItemId,
          ` | [SWAP: Reemplazado por ${newItem.permanent_code}. Motivo: ${reason.trim()}]`,
          oldItemId
        ]);

        // 3. Crear asignación del nuevo equipo
        await run(`
          INSERT INTO assignments (
            id, assignment_code, item_id, product_id, employee_id, assigned_by_user_id,
            origin_department_id, target_department_id, charged_department_id,
            assigned_at, status, notes
          ) VALUES (?, ?, ?, ?, ?, ?, 'dept-bod', ?, ?, datetime('now'), 'ACTIVA', ?)
        `, [
          newAssignmentId, newAssignmentCode, newItemId, newItem.product_id, employeeId, user.id,
          targetDept, targetDept,
          `Sustitución de equipo. Anterior: ${oldItem.permanent_code}. Motivo: ${reason.trim()}`
        ]);

        // 4. Actualizar estado del nuevo equipo
        await run(`
          UPDATE inventory_items
          SET operational_status = 'ASIGNADO',
              current_employee_id = ?,
              current_department_id = ?,
              notes = COALESCE(notes, '') || ?,
              updated_at = datetime('now')
          WHERE id = ?
        `, [
          employeeId,
          targetDept,
          ` | [SWAP: Entregado como reemplazo de ${oldItem.permanent_code}]`,
          newItemId
        ]);

        // 5. Movimientos kardex
        await run(`
          INSERT INTO inventory_movements (
            id, movement_type, item_id, product_id, quantity,
            from_department_id, to_department_id, from_employee_id,
            reason, reference_code, user_id, created_at
          ) VALUES (?, ?, ?, ?, 1, ?, 'dept-bod', ?, ?, ?, ?, datetime('now'))
        `, [
          movOldId,
          isBroken ? 'REPARACION' : 'DEVOLUCION',
          oldItemId, oldItem.product_id,
          oldItem.current_department_id || targetDept,
          employeeId,
          `Equipo reemplazado por ${newItem.permanent_code}: ${reason.trim()}`,
          oldItem.permanent_code,
          user.id
        ]);

        await run(`
          INSERT INTO inventory_movements (
            id, movement_type, item_id, product_id, quantity,
            from_department_id, to_department_id, to_employee_id,
            reason, reference_code, user_id, created_at
          ) VALUES (?, 'ASIGNACION', ?, ?, 1, 'dept-bod', ?, ?, ?, ?, ?, datetime('now'))
        `, [
          movNewId,
          newItemId, newItem.product_id,
          targetDept,
          employeeId,
          `Entrega de reemplazo por ${oldItem.permanent_code}: ${reason.trim()}`,
          newAssignmentCode,
          user.id
        ]);
      });

      await logAudit({
        userId: user.id,
        username: user.username,
        userRole: user.role,
        action: 'SWAP_ACTIVO',
        module: 'INVENTARIO',
        entityId: newItemId,
        entityName: `${oldItem.permanent_code} -> ${newItem.permanent_code}`,
        reason: `Sustitución de equipo para ${emp.full_name}. Motivo: ${reason.trim()}`,
      });

      return NextResponse.json({
        success: true,
        message: `Sustitución completada. ${newItem.permanent_code} ha sido asignado a ${emp.full_name} con código ${newAssignmentCode}.`,
        newAssignmentCode,
      });
    }

    // ------------------------------------------------------------------------
    // 3. RETURN_TO_WAREHOUSE: Devolver a Bodega
    // ------------------------------------------------------------------------
    if (action === 'RETURN_TO_WAREHOUSE') {
      const { itemId, condition = 'BUENO', notes } = body;

      if (!itemId) return NextResponse.json({ error: 'ID de activo requerido.' }, { status: 400 });

      const item = await queryOne<any>(`SELECT * FROM inventory_items WHERE id = ?`, [itemId]);
      if (!item) return NextResponse.json({ error: 'Activo no encontrado.' }, { status: 404 });

      const movId = `mov-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

      await transaction(async () => {
        // Cerrar asignación activa
        await run(`
          UPDATE assignments
          SET status = 'DEVUELTO',
              returned_at = datetime('now'),
              return_condition = ?,
              return_notes = ?
          WHERE item_id = ? AND status = 'ACTIVA'
        `, [condition, notes || 'Devolución confirmada a Bodega Central', itemId]);

        // Actualizar activo
        await run(`
          UPDATE inventory_items
          SET operational_status = 'DISPONIBLE',
              physical_condition = ?,
              current_employee_id = NULL,
              current_assigned_user_id = NULL,
              current_department_id = 'dept-bod',
              notes = COALESCE(notes, '') || ?,
              updated_at = datetime('now')
          WHERE id = ?
        `, [
          condition,
          notes ? ` | Retornado a Bodega: ${notes}` : ' | Retornado a Bodega Central',
          itemId
        ]);

        // Registrar movimiento
        await run(`
          INSERT INTO inventory_movements (
            id, movement_type, item_id, product_id, quantity,
            from_department_id, to_department_id, from_employee_id,
            reason, user_id, created_at
          ) VALUES (?, 'DEVOLUCION', ?, ?, 1, ?, 'dept-bod', ?, ?, ?, datetime('now'))
        `, [
          movId, itemId, item.product_id,
          item.current_department_id || 'dept-bod',
          item.current_employee_id,
          `Devolución de equipo a Bodega Central. ${notes || ''}`.trim(),
          user.id
        ]);
      });

      await logAudit({
        userId: user.id,
        username: user.username,
        userRole: user.role,
        action: 'DEVOLUCION_BODEGA',
        module: 'INVENTARIO',
        entityId: itemId,
        entityName: item.permanent_code,
        reason: `Equipo retornado a Bodega Central en condición ${condition}`,
      });

      return NextResponse.json({
        success: true,
        message: `Activo ${item.permanent_code} devuelto exitosamente a Bodega Central.`,
      });
    }

    // ------------------------------------------------------------------------
    // 4. DECOMMISSION: Dar de Baja
    // ------------------------------------------------------------------------
    if (action === 'DECOMMISSION') {
      const { itemId, reason, condition = 'AVERIADO' } = body;

      if (!itemId || !reason?.trim()) {
        return NextResponse.json({ error: 'ID de activo y motivo de baja son obligatorios.' }, { status: 400 });
      }

      const item = await queryOne<any>(`SELECT * FROM inventory_items WHERE id = ?`, [itemId]);
      if (!item) return NextResponse.json({ error: 'Activo no encontrado.' }, { status: 404 });

      const movId = `mov-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

      await transaction(async () => {
        // Si estaba asignado, cerrar asignación activa liberando al custodio
        await run(`
          UPDATE assignments
          SET status = 'DEVUELTO',
              returned_at = datetime('now'),
              return_condition = ?,
              return_notes = ?
          WHERE item_id = ? AND status = 'ACTIVA'
        `, [condition, `Baja de activo: ${reason.trim()}`, itemId]);

        // Marcar activo como DADO_DE_BAJA
        await run(`
          UPDATE inventory_items
          SET operational_status = 'DADO_DE_BAJA',
              physical_condition = ?,
              current_employee_id = NULL,
              current_assigned_user_id = NULL,
              is_broken = 1,
              broken_notes = ?,
              notes = COALESCE(notes, '') || ?,
              updated_at = datetime('now')
          WHERE id = ?
        `, [
          condition,
          reason.trim(),
          ` | [DADO DE BAJA: ${reason.trim()}]`,
          itemId
        ]);

        // Registrar movimiento
        await run(`
          INSERT INTO inventory_movements (
            id, movement_type, item_id, product_id, quantity,
            from_department_id, reason, user_id, created_at
          ) VALUES (?, 'BAJA', ?, ?, 1, ?, ?, ?, datetime('now'))
        `, [
          movId, itemId, item.product_id,
          item.current_department_id || 'dept-bod',
          `Baja formal de activo: ${reason.trim()}`,
          user.id
        ]);
      });

      await logAudit({
        userId: user.id,
        username: user.username,
        userRole: user.role,
        action: 'BAJA_ACTIVO',
        module: 'INVENTARIO',
        entityId: itemId,
        entityName: item.permanent_code,
        reason: `Baja formal: ${reason.trim()}`,
      });

      return NextResponse.json({
        success: true,
        message: `Activo ${item.permanent_code} dado de baja exitosamente.`,
      });
    }

    // ------------------------------------------------------------------------
    // 5. REACTIVATE: Reactivar equipo dado de baja o averiado
    // ------------------------------------------------------------------------
    if (action === 'REACTIVATE') {
      const { itemId, condition = 'BUENO', assignToEmployeeId, notes } = body;

      if (!itemId) return NextResponse.json({ error: 'ID de activo requerido.' }, { status: 400 });

      const item = await queryOne<any>(`
        SELECT i.*, p.code as product_code, p.name as product_name
        FROM inventory_items i
        JOIN products p ON i.product_id = p.id
        WHERE i.id = ?
      `, [itemId]);

      if (!item) return NextResponse.json({ error: 'Activo no encontrado.' }, { status: 404 });

      const movId = `mov-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

      await transaction(async () => {
        if (assignToEmployeeId) {
          const emp = await queryOne<any>(`SELECT * FROM employees WHERE id = ?`, [assignToEmployeeId]);
          if (!emp) throw new Error('Empleado para reasignación no encontrado.');

          const targetDept = emp.department_id || 'dept-bod';
          const asgCode = await generateAssignmentCode(emp.initials, item.product_code, new Date().getFullYear());
          const asgId = `asg-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

          // Insertar nueva asignación
          await run(`
            INSERT INTO assignments (
              id, assignment_code, item_id, product_id, employee_id, assigned_by_user_id,
              origin_department_id, target_department_id, charged_department_id,
              assigned_at, status, notes
            ) VALUES (?, ?, ?, ?, ?, ?, 'dept-bod', ?, ?, datetime('now'), 'ACTIVA', ?)
          `, [
            asgId, asgCode, itemId, item.product_id, assignToEmployeeId, user.id,
            targetDept, targetDept,
            `Reactivación y reasignación de activo. ${notes || ''}`.trim()
          ]);

          // Actualizar activo
          await run(`
            UPDATE inventory_items
            SET operational_status = 'ASIGNADO',
                physical_condition = ?,
                current_employee_id = ?,
                current_department_id = ?,
                is_broken = 0,
                broken_notes = NULL,
                notes = COALESCE(notes, '') || ?,
                updated_at = datetime('now')
            WHERE id = ?
          `, [
            condition,
            assignToEmployeeId,
            targetDept,
            ` | [REACTIVADO Y ASIGNADO A ${emp.full_name}: ${notes || 'Reincorporado al servicio'}]`,
            itemId
          ]);

          // Movimiento kardex
          await run(`
            INSERT INTO inventory_movements (
              id, movement_type, item_id, product_id, quantity,
              from_department_id, to_department_id, to_employee_id,
              reason, reference_code, user_id, created_at
            ) VALUES (?, 'AJUSTE_AUTORIZADO', ?, ?, 1, 'dept-bod', ?, ?, ?, ?, ?, datetime('now'))
          `, [
            movId, itemId, item.product_id,
            targetDept, assignToEmployeeId,
            `Reactivación autorizada y asignación a ${emp.full_name}. ${notes || ''}`.trim(),
            asgCode, user.id
          ]);
        } else {
          // Reactivar a Bodega Central como DISPONIBLE
          await run(`
            UPDATE inventory_items
            SET operational_status = 'DISPONIBLE',
                physical_condition = ?,
                current_employee_id = NULL,
                current_assigned_user_id = NULL,
                current_department_id = 'dept-bod',
                is_broken = 0,
                broken_notes = NULL,
                notes = COALESCE(notes, '') || ?,
                updated_at = datetime('now')
            WHERE id = ?
          `, [
            condition,
            ` | [REACTIVADO EN BODEGA CENTRAL: ${notes || 'Reincorporado como disponible'}]`,
            itemId
          ]);

          await run(`
            INSERT INTO inventory_movements (
              id, movement_type, item_id, product_id, quantity,
              from_department_id, to_department_id,
              reason, user_id, created_at
            ) VALUES (?, 'AJUSTE_AUTORIZADO', ?, ?, 1, 'dept-bod', 'dept-bod', ?, ?, datetime('now'))
          `, [
            movId, itemId, item.product_id,
            `Reactivación autorizada en Bodega Central como DISPONIBLE. ${notes || ''}`.trim(),
            user.id
          ]);
        }
      });

      await logAudit({
        userId: user.id,
        username: user.username,
        userRole: user.role,
        action: 'REACTIVAR_ACTIVO',
        module: 'INVENTARIO',
        entityId: itemId,
        entityName: item.permanent_code,
        reason: `Reactivación de equipo en condición ${condition}. ${notes || ''}`.trim(),
      });

      return NextResponse.json({
        success: true,
        message: `Activo ${item.permanent_code} reactivado con éxito.`,
      });
    }

    return NextResponse.json({ error: `Acción '${action}' no reconocida.` }, { status: 400 });
  } catch (error: any) {
    console.error('Error en lifecycle POST:', error);
    return NextResponse.json({ error: error.message || 'Error al procesar ciclo de vida' }, { status: 500 });
  }
}
