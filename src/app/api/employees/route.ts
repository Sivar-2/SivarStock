import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne, run, transaction } from '@/lib/db';
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
        e.id, e.employee_code, e.full_name, e.dpi, e.job_title, e.initials, e.email, e.phone,
        e.department_id, e.immediate_supervisor_id, e.company_name, e.status,
        e.exit_date, e.exit_reason, e.notes, e.created_at,
        d.name as department_name, d.code as department_code,
        s.full_name as supervisor_name,
        u.id as user_account_id, u.username, u.role as system_role,
        (SELECT COUNT(*) FROM inventory_items ii WHERE ii.current_employee_id = e.id AND ii.operational_status != 'DADO_DE_BAJA') as assigned_items_count,
        (SELECT COUNT(*) FROM mobile_devices md WHERE md.employee_id = e.id AND md.status != 'DADO_DE_BAJA') as assigned_mobiles_count,
        (SELECT COUNT(*) FROM delivery_actas da WHERE da.employee_id = e.id AND da.status = 'FIRMADA') as signed_actas_count,
        (SELECT COUNT(*) FROM delivery_actas da WHERE da.employee_id = e.id AND da.status = 'PENDIENTE_FIRMA') as pending_actas_count
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
      employeeCode: inputCode,
      employee_code,
      fullName,
      dpi,
      jobTitle,
      initials,
      email,
      phone,
      departmentId,
      immediateSupervisorId,
      companyName,
      createSystemUser,
      systemRole,
      notes,
    } = body;

    if (!fullName || !fullName.trim()) {
      return NextResponse.json({ error: 'El nombre completo del empleado es obligatorio.' }, { status: 400 });
    }

    const cleanName = fullName.trim();
    const cleanDpi = dpi ? String(dpi).trim() : null;
    const cleanEmail = email ? String(email).trim().toLowerCase() : null;

    // Prevención de duplicados Poka-Yoke: DPI o Correo ya existente
    if (cleanDpi) {
      const existingDpi = await queryOne<any>(`SELECT id, full_name, employee_code FROM employees WHERE dpi = ?`, [cleanDpi]);
      if (existingDpi) {
        return NextResponse.json(
          { error: `El número de DPI ${cleanDpi} ya está registrado para ${existingDpi.full_name} (${existingDpi.employee_code}).` },
          { status: 409 }
        );
      }
    }

    if (cleanEmail) {
      const existingEmail = await queryOne<any>(`SELECT id, full_name, employee_code FROM employees WHERE LOWER(email) = ?`, [cleanEmail]);
      if (existingEmail) {
        return NextResponse.json(
          { error: `El correo ${cleanEmail} ya pertenece al empleado ${existingEmail.full_name} (${existingEmail.employee_code}).` },
          { status: 409 }
        );
      }
    }

    // Código correlativo secuencial único EMP-001, EMP-002... si no se especifica
    let finalEmployeeCode = (inputCode || employee_code || '').trim().toUpperCase();
    if (finalEmployeeCode) {
      const existingCode = await queryOne<any>(`SELECT id, full_name FROM employees WHERE employee_code = ?`, [finalEmployeeCode]);
      if (existingCode) {
        return NextResponse.json(
          { error: `El código de empleado ${finalEmployeeCode} ya está en uso por ${existingCode.full_name}.` },
          { status: 409 }
        );
      }
    } else {
      const allEmps = await query<any>(`SELECT employee_code FROM employees`);
      let maxNum = 0;
      for (const e of allEmps) {
        if (e.employee_code) {
          const match = e.employee_code.match(/EMP-(\d+)/i) || e.employee_code.match(/EMP-[A-Z0-9]+-(\d+)/i);
          if (match && match[1]) {
            const n = parseInt(match[1], 10);
            if (!isNaN(n) && n > maxNum) maxNum = n;
          }
        }
      }
      const nextSeq = (maxNum + 1).toString().padStart(3, '0');
      finalEmployeeCode = `EMP-${nextSeq}`;
    }

    // Calcular iniciales automáticamente: "Carlos Gómez" -> "CG"
    const calculatedInitials = initials && initials.trim()
      ? initials.trim().toUpperCase()
      : cleanName
          .split(/\s+/)
          .filter(Boolean)
          .map((n: string) => n[0])
          .slice(0, 3)
          .join('')
          .toUpperCase() || 'EM';

    const employeeId = `emp-${Date.now()}`;

    await run(
      `INSERT INTO employees (
        id, employee_code, full_name, dpi, job_title, initials, email, phone,
        department_id, immediate_supervisor_id, company_name, status, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVO', ?)`,
      [
        employeeId,
        finalEmployeeCode,
        cleanName,
        cleanDpi,
        jobTitle ? String(jobTitle).trim() : null,
        calculatedInitials,
        cleanEmail,
        phone ? String(phone).trim() : null,
        departmentId || null,
        immediateSupervisorId || null,
        companyName || 'Persiluz / SivarStock',
        notes ? String(notes).trim() : null,
      ]
    );

    // Si se solicitó crear usuario con acceso al sistema
    if (createSystemUser && cleanEmail) {
      const existingUsr = await queryOne<any>(`SELECT id FROM users WHERE LOWER(email) = ?`, [cleanEmail]);
      if (!existingUsr) {
        const userId = `usr-${Date.now()}`;
        const baseUsername = cleanEmail.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '') + Math.floor(Math.random() * 90 + 10);
        const defaultPasswordHash = await hashPassword('user123');

        await run(
          `INSERT INTO users (
            id, username, full_name, email, password_hash, role,
            department_id, employee_id, initials, can_view_financials, can_export, can_edit
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 1, 1)`,
          [
            userId,
            baseUsername,
            cleanName,
            cleanEmail,
            defaultPasswordHash,
            systemRole || 'VIEWER',
            departmentId || null,
            employeeId,
            calculatedInitials,
          ]
        );
      }
    }

    await logAudit({
      userId: user.id,
      username: user.username,
      userRole: user.role,
      action: 'CREAR_EMPLEADO',
      module: 'DEPARTAMENTOS',
      entityId: employeeId,
      entityName: `${finalEmployeeCode} - ${cleanName}`,
      reason: `Registro de nuevo empleado (DPI: ${cleanDpi || 'N/A'})`,
    });

    return NextResponse.json({ success: true, employeeId, employeeCode: finalEmployeeCode });
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
      dpi,
      jobTitle,
      initials,
      email,
      phone,
      departmentId,
      immediateSupervisorId,
      companyName,
      notes,
      action, // 'TRANSFER', 'EXIT', 'UPDATE'
      exitReason,
      exitDate,
      giveAccess,
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

      const pendingNote = ` | [BAJA EMPLEADO ${effectiveExitDate}: Pendiente inspección y recepción física en Bodega. Motivo: ${exitReason.trim()}]`;

      await run(
        `UPDATE inventory_items SET
          operational_status = 'DEVOLUCION_PENDIENTE',
          notes = COALESCE(notes, '') || ?
         WHERE current_employee_id = ?`,
        [pendingNote, id]
      );

      await run(
        `UPDATE mobile_devices SET
          status = 'DEVOLUCION_PENDIENTE'
         WHERE employee_id = ?`,
        [id]
      );

      await run(
        `UPDATE assignments SET
          status = 'DEVOLUCION_PENDIENTE',
          return_notes = ?
         WHERE employee_id = ? AND status = 'ACTIVA'`,
        [`Pendiente confirmación de recepción física en Bodega por baja de empleado (${effectiveExitDate}): ${exitReason.trim()}`, id]
      );

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

      const existingUser = await queryOne<any>(`SELECT id FROM users WHERE LOWER(email) = ?`, [emailToUse]);
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

    // Validación de duplicados en edición de DPI
    if (dpi !== undefined && dpi && String(dpi).trim() !== currentEmp.dpi) {
      const dupDpi = await queryOne<any>(`SELECT id, full_name FROM employees WHERE dpi = ? AND id != ?`, [String(dpi).trim(), id]);
      if (dupDpi) {
        return NextResponse.json({ error: `El DPI ${dpi} ya pertenece a ${dupDpi.full_name}.` }, { status: 409 });
      }
    }

    // ACCIÓN 3: Actualización general o Traslado de área
    await run(
      `UPDATE employees SET
        full_name = ?,
        dpi = ?,
        job_title = ?,
        initials = ?,
        email = ?,
        phone = ?,
        department_id = ?,
        immediate_supervisor_id = ?,
        company_name = ?,
        notes = ?
       WHERE id = ?`,
      [
        fullName !== undefined ? fullName.trim() : currentEmp.full_name,
        dpi !== undefined ? (dpi ? String(dpi).trim() : null) : currentEmp.dpi,
        jobTitle !== undefined ? (jobTitle ? String(jobTitle).trim() : null) : currentEmp.job_title,
        initials !== undefined ? initials.trim() : currentEmp.initials,
        email !== undefined ? (email ? email.trim() : null) : currentEmp.email,
        phone !== undefined ? (phone ? phone.trim() : null) : currentEmp.phone,
        departmentId !== undefined ? departmentId : currentEmp.department_id,
        immediateSupervisorId !== undefined ? (immediateSupervisorId || null) : currentEmp.immediate_supervisor_id,
        companyName !== undefined ? companyName : currentEmp.company_name,
        notes !== undefined ? notes : currentEmp.notes,
        id,
      ]
    );

    // Si se trasladó de departamento, actualizar también sus activos individuales y líneas móviles
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
      reason: departmentId !== currentEmp.department_id ? 'Traslado de departamento' : 'Actualización de expediente de empleado',
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error al actualizar empleado:', error);
    return NextResponse.json({ error: error.message || 'Error al actualizar.' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Acceso denegado: Solo administradores (ADMIN) pueden eliminar empleados.' },
        { status: 403 }
      );
    }

    const url = new URL(req.url);
    const id = url.searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID de empleado requerido.' }, { status: 400 });
    }

    const emp = await queryOne<any>(`SELECT * FROM employees WHERE id = ?`, [id]);
    if (!emp) {
      return NextResponse.json({ error: 'Empleado no encontrado.' }, { status: 404 });
    }

    await transaction(async () => {
      // 1. Cerrar asignaciones activas
      await run(
        `UPDATE assignments 
         SET status = 'DEVUELTO', 
             returned_at = datetime('now'), 
             return_notes = 'Liberado por eliminación del custodio'
         WHERE employee_id = ? AND status = 'ACTIVA'`,
        [id]
      );

      // 2. Liberar equipos en inventory_items pasándolos a DISPONIBLE y sincronizando stock en products
      const empItems = await query<any>(`SELECT id, product_id FROM inventory_items WHERE current_employee_id = ?`, [id]);
      await run(
        `UPDATE inventory_items 
         SET operational_status = 'DISPONIBLE',
             current_employee_id = NULL,
             current_assigned_user_id = NULL,
             current_department_id = COALESCE(current_department_id, 'dept-bod'),
             notes = COALESCE(notes, '') || ' | Liberado a Bodega por eliminación del empleado ${emp.full_name}',
             updated_at = datetime('now')
         WHERE current_employee_id = ?`,
        [id]
      );

      // Sincronizar current_stock de cada producto afectado
      const affectedProductIds = Array.from(new Set(empItems.map((i) => i.product_id).filter(Boolean)));
      for (const prodId of affectedProductIds) {
        const cnt = await queryOne<{ total: number }>(
          `SELECT COUNT(*) as total FROM inventory_items WHERE product_id = ? AND operational_status = 'DISPONIBLE'`,
          [prodId]
        );
        if (cnt) {
          await run(`UPDATE products SET current_stock = ? WHERE id = ?`, [Number(cnt.total || 0), prodId]);
        }
      }

      // 3. Liberar dispositivos móviles en mobile_devices
      await run(
        `UPDATE mobile_devices
         SET status = 'DISPONIBLE',
             employee_id = NULL,
             updated_at = datetime('now')
         WHERE employee_id = ?`,
        [id]
      );

      // 4. Desvincular usuario del sistema si tenía asociado
      await run(`UPDATE users SET employee_id = NULL WHERE employee_id = ?`, [id]);

      // 5. Eliminar el empleado
      await run(`DELETE FROM employees WHERE id = ?`, [id]);
    });

    await logAudit({
      userId: user.id,
      username: user.username,
      userRole: user.role,
      action: 'ELIMINAR_EMPLEADO',
      module: 'DEPARTAMENTOS',
      entityId: id,
      entityName: `${emp.employee_code} - ${emp.full_name}`,
      reason: `Empleado eliminado por administrador ${user.fullName}. Sus activos y celulares fueron liberados a estado DISPONIBLE en Bodega.`,
    });

    return NextResponse.json({
      success: true,
      message: `Empleado ${emp.full_name} eliminado y sus equipos liberados a estado DISPONIBLE en Bodega.`,
    });
  } catch (error: any) {
    console.error('Error al eliminar empleado:', error);
    return NextResponse.json({ error: error.message || 'Error al eliminar empleado.' }, { status: 500 });
  }
}
