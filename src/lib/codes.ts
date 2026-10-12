import { queryOne } from './db';

/**
 * Genera un código permanente inmutable para un activo individual.
 * Formato estándar: SIV-{DEPT_CODE}-{CORRELATIVO:6}
 * Ejemplo: SIV-IT-000001, SIV-PROD-000042
 */
export async function generatePermanentCode(deptCode: string = 'GEN'): Promise<string> {
  const cleanDept = (deptCode || 'GEN').toUpperCase().trim().replace(/[^A-Z0-9]/g, '');
  const prefix = `SIV-${cleanDept}-`;
  
  // Buscar el correlativo más alto existente para este prefijo
  const row = await queryOne<{ max_code: string }>(
    `SELECT permanent_code as max_code 
     FROM inventory_items 
     WHERE permanent_code LIKE ? 
     ORDER BY permanent_code DESC LIMIT 1`,
    [`${prefix}%`]
  );

  let nextSeq = 1;
  if (row && row.max_code) {
    const parts = row.max_code.split('-');
    const lastNum = parseInt(parts[parts.length - 1], 10);
    if (!isNaN(lastNum)) {
      nextSeq = lastNum + 1;
    }
  }

  const paddedSeq = String(nextSeq).padStart(6, '0');
  return `${prefix}${paddedSeq}`;
}

/**
 * Genera el código de entrega de asignación con el formato reglamentario:
 * INICIALES-AÑO-CÓDIGOPRODUCTO-CORRELATIVO
 * Ejemplo: AM-2026-CBLE-001
 */
export async function generateAssignmentCode(
  userInitials: string,
  productCode: string,
  year: number = new Date().getFullYear()
): Promise<string> {
  const cleanInitials = (userInitials || 'US').toUpperCase().trim().replace(/[^A-Z]/g, '').slice(0, 4) || 'US';
  const cleanProduct = (productCode || 'ITEM').toUpperCase().trim().replace(/[^A-Z0-9]/g, '').slice(0, 8) || 'ITEM';
  const prefix = `${cleanInitials}-${year}-${cleanProduct}-`;

  const row = await queryOne<{ max_code: string }>(
    `SELECT assignment_code as max_code 
     FROM assignments 
     WHERE assignment_code LIKE ? 
     ORDER BY assignment_code DESC LIMIT 1`,
    [`${prefix}%`]
  );

  let nextSeq = 1;
  if (row && row.max_code) {
    const parts = row.max_code.split('-');
    const lastNum = parseInt(parts[parts.length - 1], 10);
    if (!isNaN(lastNum)) {
      nextSeq = lastNum + 1;
    }
  }

  const paddedSeq = String(nextSeq).padStart(3, '0');
  return `${prefix}${paddedSeq}`;
}
