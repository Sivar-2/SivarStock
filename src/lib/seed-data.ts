import bcrypt from 'bcryptjs';

export interface SeedDepartment {
  id: string;
  code: string;
  name: string;
  cost_center: string;
  manager_name: string;
  is_bodega: number;
  is_active: number;
}

export const SEED_DEPARTMENTS: SeedDepartment[] = [
  { id: 'dept-bod', code: 'BOD', name: 'Cuarto de Servidores (Bodega)', cost_center: 'CC-BOD-01', manager_name: 'Alexander Admin', is_bodega: 1, is_active: 1 },
  { id: 'dept-ger', code: 'GER', name: 'Gerencia', cost_center: 'CC-GER-01', manager_name: 'Carlos Mendoza', is_bodega: 0, is_active: 1 },
  { id: 'dept-mkt', code: 'MKT', name: 'Mercadeo', cost_center: 'CC-MKT-01', manager_name: 'Valeria Pineda', is_bodega: 0, is_active: 1 },
  { id: 'dept-fin', code: 'FIN', name: 'Finanzas', cost_center: 'CC-FIN-01', manager_name: 'Claudia Morales', is_bodega: 0, is_active: 1 },
  { id: 'dept-cst', code: 'CST', name: 'Costos', cost_center: 'CC-CST-01', manager_name: 'Elena Rivas', is_bodega: 0, is_active: 1 },
  { id: 'dept-log', code: 'LOG', name: 'Logística', cost_center: 'CC-LOG-01', manager_name: 'Jorge Alvarado', is_bodega: 0, is_active: 1 },
  { id: 'dept-imp', code: 'IMP', name: 'Impresiones', cost_center: 'CC-IMP-01', manager_name: 'Roberto Quintanilla', is_bodega: 0, is_active: 1 },
  { id: 'dept-it',  code: 'IT',  name: 'IT', cost_center: 'CC-IT-01', manager_name: 'Alexander Admin', is_bodega: 0, is_active: 1 },
  { id: 'dept-ec2', code: 'EC2', name: 'Ecomerce Segundo Nivel', cost_center: 'CC-EC2-01', manager_name: 'Patricia Vega', is_bodega: 0, is_active: 1 },
  { id: 'dept-per', code: 'PER', name: 'Persiluz', cost_center: 'CC-PER-01', manager_name: 'Mauricio López', is_bodega: 0, is_active: 1 },
  { id: 'dept-ec1', code: 'EC1', name: 'Ecomerce Primer Nivel', cost_center: 'CC-EC1-01', manager_name: 'Fernando Gómez', is_bodega: 0, is_active: 1 },
];

export const SEED_CATEGORIES = [
  ['cat-comp', 'COMP', 'Computadoras y Laptops', 'INDIVIDUAL', 'Equipos portátiles, torres y todo-en-uno', 'Laptop'],
  ['cat-imp',  'IMP',  'Impresoras y Escáneres', 'INDIVIDUAL', 'Impresoras térmicas, láser y multifuncionales', 'Printer'],
  ['cat-cel',  'CEL',  'Celulares y Líneas Móviles', 'INDIVIDUAL', 'Smartphones corporativos y teléfonos de ruta', 'Smartphone'],
  ['cat-mon',  'MON',  'Monitores y Pantallas', 'INDIVIDUAL', 'Pantallas LED/QHD y monitores de diseño', 'Monitor'],
  ['cat-red',  'RED',  'Equipos de Red y Servidores', 'INDIVIDUAL', 'Switches, routers PoE, servidores en rack', 'Network'],
  ['cat-sum',  'SUM',  'Suministros y Consumibles de Bodega', 'QUANTITY', 'Cintas de embalaje, etiquetas, rollos y tintas', 'Boxes'],
  ['cat-acc',  'ACC',  'Periféricos y Accesorios', 'QUANTITY', 'Mouses, teclados, cables HDMI y adaptadores', 'Mouse'],
  ['cat-mob',  'MOB',  'Mobiliario y Ergonomía', 'INDIVIDUAL', 'Sillas ergonómicas, mesas de trabajo y estantes', 'Armchair'],
];

export const ALL_TABS_JSON = JSON.stringify([
  'DASHBOARD', 'INVENTARIO', 'CELULARES', 'PRODUCTOS', 'MOVIMIENTOS',
  'ASIGNACIONES', 'MANTENIMIENTO', 'SERVICIOS', 'COSTOS', 'REPORTES',
  'DEPARTAMENTOS', 'USUARIOS', 'AUDITORIA', 'CONFIGURACION'
]);

/**
 * Inserta los datos base necesarios (Departamentos, Usuarios Administradores, Categorías)
 * en la base de datos si aún no existen.
 */
export async function seedInitialData(runQuery: (sql: string, params?: any[]) => Promise<any>): Promise<void> {
  try {
    // 1. Departamentos
    for (const d of SEED_DEPARTMENTS) {
      await runQuery(
        `INSERT INTO departments (id, code, name, cost_center, manager_name, is_bodega, is_active)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT (id) DO NOTHING`,
        [d.id, d.code, d.name, d.cost_center, d.manager_name, d.is_bodega, d.is_active]
      ).catch(() => {});
    }

    // 2. Empleado Administrador principal
    await runQuery(
      `INSERT INTO employees (id, employee_code, full_name, initials, email, phone, department_id, company_name, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (id) DO NOTHING`,
      ['emp-alex', 'EMP-IT-001', 'Alexander Administrador', 'AA', 'alexander7tm@gmail.com', '+502 5555-0101', 'dept-it', 'Persiluz / SivarStock', 'ACTIVO']
    ).catch(() => {});

    // 3. Usuarios Principales (Superadmin: alexander7tm@gmail.com con clave admin123)
    const salt = bcrypt.genSaltSync(10);
    const adminPass = bcrypt.hashSync('admin123', salt);
    const userPass = bcrypt.hashSync('user123', salt);

    const users = [
      ['usr-alex', 'alexander7tm', 'Alexander Admin', 'alexander7tm@gmail.com', adminPass, 'ADMIN', 'dept-it', 'emp-alex', 'AA', ALL_TABS_JSON, 0, 1, 1, 1, 1, 1],
      ['usr-carlos', 'cmendoza', 'Carlos Mendoza (CEO)', 'cmendoza@persiluz.com', userPass, 'SUBADMIN', 'dept-ger', null, 'CM', JSON.stringify(['DASHBOARD','INVENTARIO','CELULARES','PRODUCTOS','COSTOS','REPORTES','DEPARTAMENTOS']), 0, 1, 1, 0, 1, 1],
      ['usr-jorge', 'jalvarado', 'Jorge Alvarado (Jefe Logística)', 'jalvarado@persiluz.com', userPass, 'AREA_MANAGER', 'dept-log', null, 'JA', JSON.stringify(['DASHBOARD','INVENTARIO','CELULARES','PRODUCTOS','MOVIMIENTOS','ASIGNACIONES']), 1, 0, 1, 0, 1, 1],
      ['usr-elena', 'erivas', 'Elena Rivas (Costos)', 'erivas@persiluz.com', userPass, 'VIEWER', 'dept-cst', null, 'ER', JSON.stringify(['DASHBOARD','INVENTARIO','PRODUCTOS','COSTOS','REPORTES']), 0, 1, 1, 0, 0, 1],
    ];

    for (const u of users) {
      await runQuery(
        `INSERT INTO users (id, username, full_name, email, password_hash, role, department_id, employee_id, initials, allowed_tabs_json, only_own_department, can_view_financials, can_export, can_manage_users, can_edit, is_active)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT (id) DO NOTHING`,
        u
      ).catch(() => {});
    }

    // 4. Categorías
    for (const c of SEED_CATEGORIES) {
      await runQuery(
        `INSERT INTO categories (id, code, name, tracking_type, description, icon)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT (id) DO NOTHING`,
        c
      ).catch(() => {});
    }

    // 5. Ajustes del Sistema
    const settings = [
      ['company_name', 'Persiluz / SivarStock Guatemala', 'Nombre de la empresa'],
      ['admin_email', 'alexander7tm@gmail.com', 'Correo del super-administrador'],
      ['primary_currency', 'GTQ', 'Moneda principal (Quetzales)'],
      ['currency_symbol', 'Q', 'Símbolo monetario'],
      ['secondary_currency', 'USD', 'Moneda secundaria para servicios y licencias'],
    ];

    for (const s of settings) {
      await runQuery(
        `INSERT INTO system_settings (key, value, description)
         VALUES (?, ?, ?)
         ON CONFLICT (key) DO NOTHING`,
        s
      ).catch(() => {});
    }

    console.log('✅ Sembrado inicial de SivarStock completado (Admin: alexander7tm@gmail.com / admin123).');
  } catch (err) {
    console.warn('Advertencia durante sembrado inicial:', err);
  }
}
