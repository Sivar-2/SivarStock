import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Debe iniciar sesión para ejecutar reportes.' }, { status: 401 });
    }
    const body = await req.json();
    const {
      module, // 'INVENTARIO', 'MOVIMIENTOS', 'COSTOS', 'ASIGNACIONES', 'SERVICIOS', 'MANTENIMIENTO', 'CELULARES', 'BODEGA'
      columns = [],
      filters = {},
      groupBy,
      sortBy,
      sortDir = 'ASC',
      startDate,
      endDate,
    } = body;

    let baseSql = '';
    const params: any[] = [];

    if (module === 'INVENTARIO') {
      baseSql = `
        SELECT 
          i.id,
          i.permanent_code,
          p.code as product_code,
          p.name as product_name,
          p.category as category_name,
          i.brand,
          i.model,
          i.serial_number,
          d.name as department_name,
          d.code as department_code,
          e.full_name as assigned_user_name,
          i.operational_status,
          i.physical_condition,
          i.purchase_price,
          i.replacement_value,
          i.supplier,
          i.purchase_date,
          i.warranty_expiration,
          i.invoice_number,
          p.is_consumable,
          p.unit_of_measure
        FROM inventory_items i
        JOIN products p ON i.product_id = p.id
        LEFT JOIN departments d ON i.current_department_id = d.id
        LEFT JOIN employees e ON i.assigned_employee_id = e.id
        WHERE 1=1
      `;

      if (filters.departmentId) {
        baseSql += ` AND i.current_department_id = ?`;
        params.push(filters.departmentId);
      }
      if (filters.status) {
        baseSql += ` AND i.operational_status = ?`;
        params.push(filters.status);
      }
      if (filters.employeeId) {
        baseSql += ` AND i.assigned_employee_id = ?`;
        params.push(filters.employeeId);
      }
    } else if (module === 'BODEGA') {
      baseSql = `
        SELECT 
          i.id,
          i.permanent_code,
          p.code as product_code,
          p.name as product_name,
          p.category as category_name,
          i.brand,
          i.model,
          i.serial_number,
          d.name as department_name,
          i.operational_status,
          i.purchase_price,
          i.supplier,
          i.purchase_date
        FROM inventory_items i
        JOIN products p ON i.product_id = p.id
        JOIN departments d ON i.current_department_id = d.id
        WHERE d.is_bodega = 1
      `;
    } else if (module === 'CELULARES') {
      baseSql = `
        SELECT 
          m.id,
          m.device_code,
          m.brand,
          m.model,
          m.phone_number,
          m.imei,
          m.status,
          m.delivery_date,
          m.notes_history as notes,
          e.full_name as employee_name,
          d.name as department_name
        FROM mobile_devices m
        LEFT JOIN employees e ON m.employee_id = e.id
        LEFT JOIN departments d ON m.department_id = d.id
        WHERE 1=1
      `;
      if (filters.departmentId) {
        baseSql += ` AND m.department_id = ?`;
        params.push(filters.departmentId);
      }
    } else if (module === 'MANTENIMIENTO') {
      baseSql = `
        SELECT 
          mr.id,
          mr.reported_date,
          mr.fault_description,
          mr.severity,
          mr.status,
          mr.solution_type,
          mr.solution_notes,
          mr.cost,
          mr.repair_date,
          i.permanent_code,
          p.name as product_name,
          d.name as department_name,
          rep_i.permanent_code as replacement_code
        FROM maintenance_records mr
        JOIN inventory_items i ON mr.item_id = i.id
        JOIN products p ON i.product_id = p.id
        LEFT JOIN departments d ON i.current_department_id = d.id
        LEFT JOIN inventory_items rep_i ON mr.replacement_item_id = rep_i.id
        WHERE 1=1
      `;
      if (startDate) {
        baseSql += ` AND mr.reported_date >= ?`;
        params.push(startDate);
      }
      if (endDate) {
        baseSql += ` AND mr.reported_date <= ?`;
        params.push(endDate);
      }
    } else if (module === 'COSTOS') {
      baseSql = `
        SELECT 
          c.id,
          c.expense_date,
          c.concept,
          c.cost_nature,
          c.amount,
          c.tax_amount,
          c.total_amount,
          c.currency,
          c.supplier,
          c.invoice_number,
          c.purchase_order,
          c.warranty_doc_url,
          c.invoice_doc_url,
          d_chg.name as charged_dept_name,
          i.permanent_code,
          p.name as product_name
        FROM cost_records c
        LEFT JOIN departments d_chg ON c.charged_department_id = d_chg.id
        LEFT JOIN inventory_items i ON c.item_id = i.id
        LEFT JOIN products p ON c.product_id = p.id
        WHERE 1=1
      `;
      if (filters.chargedDeptId) {
        baseSql += ` AND c.charged_department_id = ?`;
        params.push(filters.chargedDeptId);
      }
      if (startDate) {
        baseSql += ` AND c.expense_date >= ?`;
        params.push(startDate);
      }
      if (endDate) {
        baseSql += ` AND c.expense_date <= ?`;
        params.push(endDate);
      }
    } else if (module === 'MOVIMIENTOS') {
      baseSql = `
        SELECT 
          m.id,
          m.created_at,
          m.movement_type,
          m.quantity,
          m.unit_cost,
          m.total_cost,
          m.reason,
          m.reference_code,
          p.code as product_code,
          p.name as product_name,
          d_from.name as from_dept_name,
          d_to.name as to_dept_name,
          u.full_name as executed_by_name
        FROM inventory_movements m
        JOIN products p ON m.product_id = p.id
        LEFT JOIN departments d_from ON m.from_department_id = d_from.id
        LEFT JOIN departments d_to ON m.to_department_id = d_to.id
        LEFT JOIN users u ON m.user_id = u.id
        WHERE 1=1
      `;
      if (startDate) {
        baseSql += ` AND m.created_at >= ?`;
        params.push(startDate);
      }
      if (endDate) {
        baseSql += ` AND m.created_at <= ?`;
        params.push(endDate);
      }
    } else if (module === 'SERVICIOS') {
      baseSql = `
        SELECT 
          s.id,
          s.name,
          s.category,
          s.provider,
          s.cost_period,
          s.amount,
          s.currency,
          s.monthly_equivalent_cost,
          s.expiration_date,
          s.seats_used,
          s.status,
          d.name as department_name,
          CAST((julianday(s.expiration_date) - julianday('now')) AS INTEGER) as days_remaining
        FROM digital_services s
        LEFT JOIN departments d ON s.responsible_department_id = d.id
        WHERE 1=1
      `;
    } else if (module === 'ASIGNACIONES') {
      baseSql = `
        SELECT 
          a.id,
          a.assignment_code,
          a.assigned_at,
          a.status,
          a.employee_id,
          i.permanent_code,
          p.name as product_name,
          e.full_name as user_name,
          d.name as target_dept_name
        FROM assignments a
        JOIN products p ON a.product_id = p.id
        LEFT JOIN employees e ON COALESCE(a.employee_id, a.user_id) = e.id
        LEFT JOIN inventory_items i ON a.item_id = i.id
        LEFT JOIN departments d ON a.target_department_id = d.id
        WHERE 1=1
      `;
    } else {
      return NextResponse.json({ error: 'Módulo de reporte no reconocido.' }, { status: 400 });
    }

    const ALLOWED_SORT_COLUMNS = new Set([
      'id', 'permanent_code', 'product_code', 'product_name', 'category_name',
      'brand', 'model', 'serial_number', 'department_name', 'department_code',
      'assigned_user_name', 'operational_status', 'physical_condition',
      'purchase_price', 'replacement_value', 'supplier', 'purchase_date',
      'warranty_expiration', 'invoice_number', 'created_at', 'device_code',
      'phone_number', 'imei', 'status', 'delivery_date', 'reported_date',
      'severity', 'cost', 'repair_date', 'expense_date', 'concept', 'amount',
      'total_amount', 'movement_type', 'quantity', 'unit_cost', 'total_cost',
      'assigned_at'
    ]);

    const safeDir = String(sortDir).toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
    if (sortBy && ALLOWED_SORT_COLUMNS.has(String(sortBy).toLowerCase())) {
      baseSql += ` ORDER BY ${String(sortBy).toLowerCase()} ${safeDir}`;
    } else {
      baseSql += ` ORDER BY 1 ${safeDir}`;
    }

    const rawRows = await query(baseSql, params);

    // Ocultar datos financieros confidenciales si el usuario no tiene permisos
    const rows = rawRows.map((r: any) => {
      if (!user.canViewFinancials) {
        const sanitized = { ...r };
        delete sanitized.purchase_price;
        delete sanitized.replacement_value;
        delete sanitized.cost;
        delete sanitized.amount;
        delete sanitized.total_amount;
        delete sanitized.unit_cost;
        delete sanitized.total_cost;
        return sanitized;
      }
      return r;
    });

    // Agrupación opcional
    let groupedSummary: Record<string, { count: number; totalAmount?: number }> = {};
    if (groupBy && rows.length > 0) {
      rows.forEach((r: any) => {
        const key = r[groupBy] || 'Sin especificar';
        if (!groupedSummary[key]) {
          groupedSummary[key] = { count: 0, totalAmount: 0 };
        }
        groupedSummary[key].count += 1;
        if (user.canViewFinancials) {
          if (r.total_amount) {
            groupedSummary[key].totalAmount = (groupedSummary[key].totalAmount || 0) + Number(r.total_amount);
          } else if (r.purchase_price) {
            groupedSummary[key].totalAmount = (groupedSummary[key].totalAmount || 0) + Number(r.purchase_price);
          }
        }
      });
    }

    return NextResponse.json({
      success: true,
      count: rows.length,
      data: rows,
      groupedSummary: groupBy ? groupedSummary : null,
    });
  } catch (error: any) {
    console.error('Error al ejecutar reporte:', error);
    return NextResponse.json({ error: 'Error al procesar consulta de reporte.' }, { status: 500 });
  }
}
