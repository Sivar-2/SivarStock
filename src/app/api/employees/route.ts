import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne, run } from '@/lib/db';
import { getCurrentUser, hashPassword } from '@/lib/auth';
import { logAudit } from '@/lib/audit';

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    const url = new URL(req.url);
    const departmentId = url.searchParams.get('departmentId');
    const status = url.searchParams.get('status') || 'ACTIVO';
    const all = url.searchParams.get('all') === 'true';

    let sql = `
      SELECT 
        e.id, e.employee_code, e.full_name, e.initials, e.email, e.phone,
        e.department_id, e.immediate_supervisor_id, e.company_name, e.status,
        e.exit_date, e.exit_reason, e.notes, e.created_at,
        d.name as department_name, d.code as department_code,
        s.full_name as supervisor_name,
        u.id as user_account_id, u.username, u.role as system_role,
        (SELECT COUNT(*) FROM inventory_items ii WHERE ii.current_employee_id = e.id) as assigned_items_count,
        (SELECT COUNT(*) FROM mobile_devices md WHERE md.employee_id = e.id) as assigned_mobiles_count
      FROM employees e
      LEFT JOIN departments d ON e.department_id = d.id
      LEFT JOIN employees s ON e.immediate_supervisor_id = s.id
      LEFT JOIN users u ON u.employee_id = e.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (!all && status) {
      sql += ` AND e.status = ?`;
      params.push(status);
    }

    if (user && user.onlyOwnDepartment && user.departmentId) {
      sql += ` AND e.department_id = ?`;
      params.push(user.departmentId);
    } else if (departmentId) {
      sql += ` AND e.department_id = ?`;
      params.push(departmentId);
    }

    sql += ` ORDER BY e.full_name ASC`;

    const employees = await query(sql, params);
    return NextResponse.json({ employees });
  } catch (error: any) {
    console.error('Error al listar empleados:', error);
    return NextResponse.json({ error: 'Error al consultar empleados.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const body = await req.json();
    const {
      fullName,
      initials,
      email,
      phone,
      departmentId,
      immediateSupervisorId,
      companyName,
      createSystemUser,
      systemRole,
    } = body;

    if (!fullName || !fullName.trim()) {
      return NextResponse.json({ error: 'El nombre completo es obligatorio.' }, { status: 400 });
    }

    // Obtener código de departamento para generar código único de empleado
    let deptCode = 'GEN';
    if (departmentId) {
      const dept = await queryOne<any>(`SELECT code FROM departments WHERE id = ?`, [departmentId]);
      if (dept) deptCode = dept.code;
    }

    // Generar correlativo secuencial único EMP-{DEPT}-{SEQ:3}
    const countRow = await queryOne<any>(
      `SELECT COUNT(*) as total FROM employees WHERE department_id = ?`,
      [departmentId || '']
    );
    const seq = ((countRow ? countRow.total : 0) + 1).toString().padStart(3, '0');
    const employeeCode = `EMP-${deptCode}-${seq}`;

    // Calcular iniciales si no se proporcionan
    const calculatedInitials = initials && initials.trim()
      ? initials.trim().toUpperCase()
      : fullName
          .trim()
          .split(' ')
          .map((n: string) => n[0])
          .slice(0, 3)
          .join('')
          .toUpperCase();

    const employeeId = `emp-${Date.now()}`;

    await run(
      `INSERT INTO employees (
        id, employee_code, full_name, initials, email, phone,
        department_id, immediate_supervisor_id, company_name, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVO')`,
      [
        employeeId,
        employeeCode,
        fullName.trim(),
        calculatedInitials,
        email ? email.trim() : null,
        phone ? phone.trim() : null,
        departmentId || null,
        immediateSupervisorId || null,
        companyName || 'Persiluz / SivarStock',
      ]
    );

    // Si se solicitó crear usuario con acceso al sistema
    if (createSystemUser && email) {
      const userId = `usr-${Date.now()}`;
      const baseUsername = email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '');
      const defaultPasswordHash = await hashPassword('user123');

      await run(
        `INSERT INTO users (
          id, username, full_name, email, password_hash, role,
          department_id, employee_id, initials, can_view_financials, can_export, can_edit
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 1, 1)`,
        [
          userId,
          baseUsername,
          fullName.trim(),
          email.trim(),
          defaultPasswordHash,
          systemRole || 'VIEWER',
          departmentId || null,
          employeeId,
          calculatedInitials,
        ]
      );
    }

    await logAudit({
      userId: user.id,
      username: user.username,
      userRole: user.role,
      action: 'CREAR_EMPLEADO',
      module: 'DEPARTAMENTOS',
      entityId: employeeId,
      entityName: `${employeeCode} - ${fullName}`,
      reason: 'Registro de nuevo empleado en la empresa',
    });

    return NextResponse.json({ success: true, employeeId, employeeCode });
  } catch (error: any) {
    console.error('Error al registrar empleado:', error);
    return NextResponse.json({ error: error.message || 'Error al guardar empleado.' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const body = await req.json();
    const {
      id,
      fullName,
      initials,
      email,
      phone,
      departmentId,
      immediateSupervisorId,
      companyName,
      action, // 'TRANSFER', 'EXIT', 'UPDATE'
      exitReason,
      exitDate,
      giveAccess, // boolean: crear acceso al sistema
      systemRole,
    } = body;

    if (!id) {
      return NextResponse.json({ error: 'ID de empleado requerido' }, { status: 400 });
    }

    const currentEmp = await queryOne<any>(`SELECT * FROM employees WHERE id = ?`, [id]);
    if (!currentEmp) {
      return NextResponse.json({ error: 'Empleado no encontrado' }, { status: 404 });
    }

    // ACCIÓN 1: Salida de la empresa (Baja Poka-Yoke con desconexión y retorno de activos)
    if (action === 'EXIT') {
      if (!exitReason || !exitReason.trim()) {
        return NextResponse.json({ error: 'Debe especificar el motivo obligatorio de la baja.' }, { status: 400 });
      }

      const effectiveExitDate = exitDate || new Date().toISOString().split('T')[0];

      // 1. Marcar empleado como RETIRADO
      await run(
        `UPDATE employees SET 
          status = 'RETIRADO',
          exit_date = ?,
          exit_reason = ?,
          notes = COALESCE(notes, '') || ?
         WHERE id = ?`,
        [
          effectiveExitDate,
          exitReason.trim(),
          ` | Retirado el ${effectiveExitDate}: ${exitReason.trim()}`,
          id,
        ]
      );

      // 2. Colocar activos físicos en proceso de DEVOLUCION_PENDIENTE (no disponibles hasta confirmación física en Bodega)
      const pendingNote = ` | [BAJA EMPLEADO ${effectiveExitDate}: Pendiente inspección y recepción física en Bodega. Motivo: ${exitReason.trim()}]`;

      await run(
        `UPDATE inventory_items SET
          operational_status = 'DEVOLUCION_PENDIENTE',
          notes = COALESCE(notes, '') || ?
         WHERE current_employee_id = ?`,
        [pendingNote, id]
      );

      // 3. Colocar celulares en DEVOLUCION_PENDIENTE
      await run(
        `UPDATE mobile_devices SET
          status = 'DEVOLUCION_PENDIENTE'
         WHERE employee_id = ?`,
        [id]
      );

      // 4. Marcar asignaciones activas como DEVOLUCION_PENDIENTE
      await run(
        `UPDATE assignments SET
          status = 'DEVOLUCION_PENDIENTE',
          return_notes = ?
         WHERE employee_id = ? AND status = 'ACTIVA'`,
        [`Pendiente confirmación de recepción física en Bodega por baja de empleado (${effectiveExitDate}): ${exitReason.trim()}`, id]
      );

      // 5. Inactivar cuenta de usuario si tenía
      await run(`UPDATE users SET is_active = 0 WHERE employee_id = ?`, [id]);

      await logAudit({
        userId: user.id,
        username: user.username,
        userRole: user.role,
        action: 'BAJA_EMPLEADO',
        module: 'DEPARTAMENTOS',
        entityId: id,
        entityName: currentEmp.full_name,
        reason: `Baja de empleado: ${exitReason.trim()}. Activos asignados puestos en proceso de DEVOLUCIÓN PENDIENTE para verificación física en Bodega.`,
      });

      return NextResponse.json({
        success: true,
        message: 'Empleado dado de baja exitosamente. Sus activos y dispositivos han sido puestos en estado de DEVOLUCIÓN PENDIENTE hasta confirmar su entrega física en Bodega.',
      });
    }

    // ACCIÓN 2: Dar acceso al sistema (Crear usuario)
    if (giveAccess) {
      const emailToUse = (email || currentEmp.email || '').trim().toLowerCase();
      if (!emailToUse) {
        return NextResponse.json({ error: 'El empleado debe tener un correo electrónico para acceder.' }, { status: 400 });
      }

      const existingUser = await queryOne<any>(`SELECT id FROM users WHERE email = ?`, [emailToUse]);
      if (existingUser) {
        return NextResponse.json({ error: 'Ya existe un usuario con este correo electrónico.' }, { status: 400 });
      }

      const userId = `usr-${Date.now()}`;
      const baseUsername = emailToUse.split('@')[0].replace(/[^a-z0-9]/g, '');
      const defaultPasswordHash = await hashPassword('user123');

      await run(
        `INSERT INTO users (
          id, username, full_name, email, password_hash, role,
          department_id, employee_id, initials, can_view_financials, can_export, can_edit
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 1, 1)`,
        [
          userId,
          baseUsername,
          currentEmp.full_name,
          emailToUse,
          defaultPasswordHash,
          systemRole || 'VIEWER',
          currentEmp.department_id,
          id,
          currentEmp.initials,
        ]
      );

      await logAudit({
        userId: user.id,
        username: user.username,
        userRole: user.role,
        action: 'CREAR_USUARIO_ACCESO',
        module: 'USUARIOS',
        entityId: userId,
        entityName: currentEmp.full_name,
        reason: `Creación de acceso al sistema con rol ${systemRole || 'VIEWER'}`,
      });

      return NextResponse.json({ success: true, message: 'Acceso al sistema concedido con éxito.' });
    }

    // ACCIÓN 3: Actualización general o Traslado de área
    await run(
      `UPDATE employees SET
        full_name = ?,
        initials = ?,
        email = ?,
        phone = ?,
        department_id = ?,
        immediate_supervisor_id = ?,
        company_name = ?
       WHERE id = ?`,
      [
        fullName !== undefined ? fullName.trim() : currentEmp.full_name,
        initials !== undefined ? initials.trim() : currentEmp.initials,
        email !== undefined ? email.trim() : currentEmp.email,
        phone !== undefined ? phone.trim() : currentEmp.phone,
        departmentId !== undefined ? departmentId : currentEmp.department_id,
        immediateSupervisorId !== undefined ? immediateSupervisorId : currentEmp.immediate_supervisor_id,
        companyName !== undefined ? companyName : currentEmp.company_name,
        id,
      ]
    );

    // Si se trasladó de departamento, actualizar también sus activos individuales
    if (departmentId && departmentId !== currentEmp.department_id) {
      await run(
        `UPDATE inventory_items SET current_department_id = ? WHERE current_employee_id = ?`,
        [departmentId, id]
      );
      await run(
        `UPDATE mobile_devices SET department_id = ? WHERE employee_id = ?`,
        [departmentId, id]
      );
    }

    await logAudit({
      userId: user.id,
      username: user.username,
      userRole: user.role,
      action: 'MODIFICAR_EMPLEADO',
      module: 'DEPARTAMENTOS',
      entityId: id,
      entityName: currentEmp.full_name,
      reason: departmentId !== currentEmp.department_id ? 'Traslado de departamento' : 'Actualización de datos',
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error al actualizar empleado:', error);
    return NextResponse.json({ error: error.message || 'Error al actualizar.' }, { status: 500 });
  }
}
