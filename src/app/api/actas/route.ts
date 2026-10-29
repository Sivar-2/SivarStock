import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne, run } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { logAudit } from '@/lib/audit';

export const DEFAULT_LEGAL_NOTICE =
  'Al firmar este documento, acepto los términos de entrega, la nota de confidencialidad y consiento el uso de la firma electrónica. Automáticamente recibirá una copia de este documento firmado en su correo electrónico. Si requiere una copia física, este documento digital puede ser impreso en cualquier momento.';

export const DEFAULT_ISSUER_NAME = 'Alexander Turcios Melendez';
export const DEFAULT_ISSUER_ROLE = 'Jefe de IT / Administración de Inventario';

async function getIssuerConfig() {
  const rows = await query<{ key: string; value: string }>(
    `SELECT key, value FROM system_settings WHERE key IN ('acta_issuer_name', 'acta_issuer_role', 'acta_issuer_signature')`
  );
  const map: Record<string, string> = {};
  for (const r of rows) {
    map[r.key] = r.value;
  }
  return {
    issuerName: map['acta_issuer_name'] || DEFAULT_ISSUER_NAME,
    issuerRole: map['acta_issuer_role'] || DEFAULT_ISSUER_ROLE,
    issuerSignature: map['acta_issuer_signature'] || '',
  };
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const id = url.searchParams.get('id');
    const code = url.searchParams.get('code');
    const employeeId = url.searchParams.get('employeeId');
    const status = url.searchParams.get('status');

    const issuerConfig = await getIssuerConfig();

    // Consulta individual para vista pública / WhatsApp / Impresión
    if (id || code) {
      const acta = await queryOne<any>(
        id
          ? `SELECT * FROM delivery_actas WHERE id = ? OR acta_code = ?`
          : `SELECT * FROM delivery_actas WHERE acta_code = ?`,
        id ? [id, id] : [code]
      );

      if (!acta) {
        return NextResponse.json({ error: 'Acta de entrega no encontrada.' }, { status: 404 });
      }

      let parsedItems = [];
      let parsedReplaced = null;
      try {
        parsedItems = JSON.parse(acta.items_json || '[]');
      } catch {
        parsedItems = [];
      }
      try {
        parsedReplaced = acta.replaced_item_json ? JSON.parse(acta.replaced_item_json) : null;
      } catch {
        parsedReplaced = null;
      }

      return NextResponse.json({
        acta: {
          ...acta,
          items: parsedItems,
          replacedItem: parsedReplaced,
        },
        issuerConfig,
      });
    }

    // Listado general de actas (firmadas y pendientes)
    let sql = `SELECT * FROM delivery_actas WHERE 1=1`;
    const params: any[] = [];

    if (employeeId) {
      sql += ` AND employee_id = ?`;
      params.push(employeeId);
    }

    if (status) {
      sql += ` AND status = ?`;
      params.push(status);
    }

    sql += ` ORDER BY created_at DESC`;

    const rows = await query<any>(sql, params);
    const actas = rows.map((r) => {
      let items = [];
      let replacedItem = null;
      try {
        items = JSON.parse(r.items_json || '[]');
      } catch {
        items = [];
      }
      try {
        replacedItem = r.replaced_item_json ? JSON.parse(r.replaced_item_json) : null;
      } catch {
        replacedItem = null;
      }
      return {
        ...r,
        items,
        replacedItem,
      };
    });

    return NextResponse.json({
      actas,
      issuerConfig,
    });
  } catch (error: any) {
    console.error('Error en GET /api/actas:', error);
    return NextResponse.json({ error: 'Error al obtener actas digitales.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const body = await req.json();
    const { action } = body;

    // 1. Guardar configuración de firma del encargado en Ajustes (Por defecto Alexander Turcios Melendez)
    if (action === 'SAVE_ISSUER_SETTINGS') {
      const { issuerName, issuerRole, issuerSignature } = body;
      const finalName = (issuerName || DEFAULT_ISSUER_NAME).trim();
      const finalRole = (issuerRole || DEFAULT_ISSUER_ROLE).trim();
      const finalSig = issuerSignature || '';

      const settings = [
        { key: 'acta_issuer_name', value: finalName, desc: 'Nombre de quien entrega equipos en Actas Digitales' },
        { key: 'acta_issuer_role', value: finalRole, desc: 'Cargo de quien entrega equipos en Actas Digitales' },
        { key: 'acta_issuer_signature', value: finalSig, desc: 'Firma digital base64 de quien entrega equipos' },
      ];

      for (const s of settings) {
        const exists = await queryOne(`SELECT key FROM system_settings WHERE key = ?`, [s.key]);
        if (exists) {
          await run(`UPDATE system_settings SET value = ?, updated_at = datetime('now') WHERE key = ?`, [s.value, s.key]);
        } else {
          await run(
            `INSERT INTO system_settings (key, value, description, updated_at) VALUES (?, ?, ?, datetime('now'))`,
            [s.key, s.value, s.desc]
          );
        }
      }

      await logAudit({
        userId: user.id,
        username: user.username,
        userRole: user.role,
        action: 'ACTUALIZAR_FIRMA_EMISOR',
        module: 'CONFIGURACION',
        entityId: 'acta_issuer',
        entityName: finalName,
        reason: `Actualización de responsable de entrega y firma digital (${finalName})`,
      });

      return NextResponse.json({
        success: true,
        message: `Configuración de firma actualizada para ${finalName}.`,
        issuerConfig: { issuerName: finalName, issuerRole: finalRole, issuerSignature: finalSig },
      });
    }

    // 2. Crear nueva Acta Digital de Entrega o Acta de Cambio de Dispositivo
    const {
      actaType = 'ENTREGA_INICIAL', // 'ENTREGA_INICIAL' | 'CAMBIO_EQUIPO' | 'DEVOLUCION'
      employeeId,
      employeeName,
      employeeDpi,
      employeeCode,
      employeeEmail,
      employeePhone,
      departmentName,
      supervisorName,
      items = [],
      replacedItem = null,
      notes,
      employeeSignatureData, // Opcional si firma en el mismo momento en el celular del administrador
    } = body;

    if (!employeeName || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: 'Debe indicar el empleado y al menos un dispositivo a entregar.' },
        { status: 400 }
      );
    }

    const issuerConfig = await getIssuerConfig();

    // Si se proporcionó DPI y el empleado existe, actualizar su DPI en la tabla employees
    if (employeeId && employeeDpi && String(employeeDpi).trim()) {
      await run(`UPDATE employees SET dpi = ? WHERE id = ?`, [String(employeeDpi).trim(), employeeId]);
    }

    // Generar código correlativo único ACTA-2026-XXXX
    const year = new Date().getFullYear();
    const countRow = await queryOne<{ cnt: number }>(`SELECT COUNT(*) as cnt FROM delivery_actas`);
    const nextNum = ((countRow?.cnt || 0) + 1).toString().padStart(4, '0');
    const actaCode = `ACTA-${year}-${nextNum}`;
    const actaId = `acta-${Date.now()}`;
    const publicToken = `tok-${Math.random().toString(36).substring(2, 10)}${Date.now().toString(36)}`;
    const nowIso = new Date().toISOString();

    const isSignedImmediately = Boolean(employeeSignatureData && employeeSignatureData.startsWith('data:image'));

    await run(
      `INSERT INTO delivery_actas (
        id, acta_code, acta_type, employee_id, employee_code, employee_name,
        employee_dpi, employee_email, employee_phone, department_name, supervisor_name,
        delivered_by_name, delivered_by_role, delivered_by_signature,
        items_json, replaced_item_json, delivery_date, status,
        employee_signature_data, signed_at, public_token, legal_notice, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        actaId,
        actaCode,
        actaType,
        employeeId || null,
        employeeCode || null,
        employeeName.trim(),
        employeeDpi ? String(employeeDpi).trim() : null,
        employeeEmail || null,
        employeePhone || null,
        departmentName || null,
        supervisorName || null,
        issuerConfig.issuerName,
        issuerConfig.issuerRole,
        issuerConfig.issuerSignature || null,
        JSON.stringify(items),
        replacedItem ? JSON.stringify(replacedItem) : null,
        nowIso,
        isSignedImmediately ? 'FIRMADA' : 'PENDIENTE_FIRMA',
        isSignedImmediately ? employeeSignatureData : null,
        isSignedImmediately ? nowIso : null,
        publicToken,
        DEFAULT_LEGAL_NOTICE,
        notes || null,
      ]
    );

    await logAudit({
      userId: user.id,
      username: user.username,
      userRole: user.role,
      action: actaType === 'CAMBIO_EQUIPO' ? 'CREAR_ACTA_CAMBIO' : 'CREAR_ACTA_ENTREGA',
      module: 'ASIGNACIONES',
      entityId: actaId,
      entityName: `${actaCode} - ${employeeName}`,
      reason: `Generación de acta digital (${actaType}) con ${items.length} dispositivo(s). Entregado por ${issuerConfig.issuerName}`,
    });

    return NextResponse.json({
      success: true,
      actaId,
      actaCode,
      publicToken,
      message: `Acta digital ${actaCode} generada exitosamente.`,
    });
  } catch (error: any) {
    console.error('Error en POST /api/actas:', error);
    return NextResponse.json({ error: error.message || 'Error al generar el acta digital.' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, actaCode, employeeSignatureData, employeeDpi, token } = body;

    if (!id && !actaCode) {
      return NextResponse.json({ error: 'ID o código de acta requerido.' }, { status: 400 });
    }

    if (!employeeSignatureData || !employeeSignatureData.startsWith('data:image')) {
      return NextResponse.json({ error: 'Debe dibujar su firma electrónica en el recuadro para confirmar.' }, { status: 400 });
    }

    const acta = await queryOne<any>(
      `SELECT * FROM delivery_actas WHERE id = ? OR acta_code = ?`,
      [id || actaCode, actaCode || id]
    );

    if (!acta) {
      return NextResponse.json({ error: 'Acta no encontrada.' }, { status: 404 });
    }

    // Validar token si no hay sesión administrativa
    const user = await getCurrentUser();
    if (!user && token !== acta.public_token) {
      return NextResponse.json({ error: 'Token de seguridad inválido para firmar esta acta.' }, { status: 403 });
    }

    const signedAt = new Date().toISOString();
    const finalDpi = employeeDpi ? String(employeeDpi).trim() : acta.employee_dpi;
    const ip = req.headers.get('x-forwarded-for') || 'Red Local LAN';

    await run(
      `UPDATE delivery_actas
       SET status = 'FIRMADA',
           employee_signature_data = ?,
           employee_dpi = ?,
           signed_at = ?,
           signed_ip = ?
       WHERE id = ?`,
      [employeeSignatureData, finalDpi, signedAt, ip, acta.id]
    );

    // Sincronizar DPI en el registro del empleado si se actualizó al firmar
    if (acta.employee_id && finalDpi) {
      await run(`UPDATE employees SET dpi = ? WHERE id = ?`, [finalDpi, acta.employee_id]);
    }

    return NextResponse.json({
      success: true,
      signedAt,
      message: '¡Acta firmada electrónicamente con éxito! Ha quedado registrada en la base de datos.',
    });
  } catch (error: any) {
    console.error('Error en PUT /api/actas:', error);
    return NextResponse.json({ error: error.message || 'Error al registrar la firma.' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || (user.role !== 'ADMIN' && user.role !== 'SUBADMIN')) {
      return NextResponse.json({ error: 'No autorizado para eliminar actas.' }, { status: 403 });
    }

    const url = new URL(req.url);
    const id = url.searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'ID requerido.' }, { status: 400 });
    }

    await run(`DELETE FROM delivery_actas WHERE id = ?`, [id]);
    return NextResponse.json({ success: true, message: 'Acta eliminada correctamente.' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Error al eliminar acta.' }, { status: 500 });
  }
}
