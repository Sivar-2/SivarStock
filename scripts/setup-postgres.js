const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

// Configuración de conexión por defecto con los datos provistos por el usuario
const DEFAULT_HOST = process.env.PGHOST || 'localhost';
const DEFAULT_PORT = process.env.PGPORT || 5432;
const DEFAULT_USER = process.env.PGUSER || 'postgres';
const DEFAULT_PASS = process.env.PGPASSWORD || 'Chelona2020$';
const DEFAULT_DB = 'sivarstock';

const rootConnString = process.env.DATABASE_URL_ADMIN || 
  `postgresql://${DEFAULT_USER}:${encodeURIComponent(DEFAULT_PASS)}@${DEFAULT_HOST}:${DEFAULT_PORT}/postgres`;

const appConnString = process.env.DATABASE_URL || 
  `postgresql://${DEFAULT_USER}:${encodeURIComponent(DEFAULT_PASS)}@${DEFAULT_HOST}:${DEFAULT_PORT}/${DEFAULT_DB}`;

async function setupPostgres() {
  console.log('===============================================================');
  console.log('       INICIALIZACIÓN Y CONFIGURACIÓN DE POSTGRESQL            ');
  console.log('===============================================================');
  console.log(`Host: ${DEFAULT_HOST}:${DEFAULT_PORT}`);
  console.log(`Usuario: ${DEFAULT_USER}`);
  console.log(`Base de datos destino: ${DEFAULT_DB}`);

  // 1. Conectar al servidor PostgreSQL (base de datos default 'postgres')
  const rootClient = new Client({
    connectionString: rootConnString,
    ssl: false
  });

  try {
    await rootClient.connect();
    console.log('[OK] Conexión establecida con el servidor PostgreSQL');
  } catch (err) {
    console.error('[ERROR] No se pudo conectar a PostgreSQL en el puerto 5432:');
    console.error('Mensaje:', err.message);
    process.exit(1);
  }

  // 2. Verificar y crear la base de datos sivarstock
  try {
    const res = await rootClient.query("SELECT 1 FROM pg_database WHERE datname = $1", [DEFAULT_DB]);
    if (res.rows.length === 0) {
      console.log(`Creando base de datos "${DEFAULT_DB}"...`);
      await rootClient.query(`CREATE DATABASE "${DEFAULT_DB}"`);
      console.log(`[OK] Base de datos "${DEFAULT_DB}" creada exitosamente.`);
    } else {
      console.log(`[OK] La base de datos "${DEFAULT_DB}" ya existe.`);
    }
  } catch (err) {
    console.error('Error al verificar/crear base de datos:', err.message);
  } finally {
    await rootClient.end();
  }

  // 3. Conectar a la base de datos sivarstock
  const appClient = new Client({
    connectionString: appConnString,
    ssl: false
  });

  await appClient.connect();
  console.log(`[OK] Conectado a la base de datos "${DEFAULT_DB}".`);

  // 4. Aplicar esquema DDL completo
  const schemaPath = path.resolve(__dirname, '..', 'src', 'lib', 'postgres-schema.sql');
  const schemaSql = fs.readFileSync(schemaPath, 'utf8');

  console.log('Aplicando esquema relacional en PostgreSQL...');
  await appClient.query(schemaSql);
  console.log('[OK] Esquema relacional, triggers y vistas analíticas aplicadas.');

  // 5. Poblar datos semilla (Idempotente)
  console.log('Verificando datos iniciales...');
  const userCheck = await appClient.query("SELECT COUNT(*) as count FROM users WHERE email = 'alexander7tm@gmail.com'");
  if (parseInt(userCheck.rows[0].count, 10) === 0) {
    console.log('Insertando datos semilla empresariales...');

    // 11 Departamentos oficiales
    const departments = [
      ['dept-bod', 'BOD', 'Cuarto de Servidores (Bodega)', 'CC-BOD-01', 'Alexander Admin', 1, 1],
      ['dept-ger', 'GER', 'Gerencia', 'CC-GER-01', 'Carlos Mendoza', 0, 1],
      ['dept-mkt', 'MKT', 'Mercadeo', 'CC-MKT-01', 'Valeria Pineda', 0, 1],
      ['dept-fin', 'FIN', 'Finanzas', 'CC-FIN-01', 'Claudia Morales', 0, 1],
      ['dept-cst', 'CST', 'Costos', 'CC-CST-01', 'Elena Rivas', 0, 1],
      ['dept-log', 'LOG', 'Logística', 'CC-LOG-01', 'Jorge Alvarado', 0, 1],
      ['dept-imp', 'IMP', 'Impresiones', 'CC-IMP-01', 'Roberto Quintanilla', 0, 1],
      ['dept-it',  'IT',  'IT', 'CC-IT-01', 'Alexander Admin', 0, 1],
      ['dept-ec2', 'EC2', 'Ecomerce Segundo Nivel', 'CC-EC2-01', 'Patricia Vega', 0, 1],
      ['dept-per', 'PER', 'Persiluz', 'CC-PER-01', 'Mauricio López', 0, 1],
      ['dept-ec1', 'EC1', 'Ecomerce Primer Nivel', 'CC-EC1-01', 'Fernando Gómez', 0, 1],
    ];
    for (const d of departments) {
      await appClient.query(
        `INSERT INTO departments (id, code, name, cost_center, manager_name, is_bodega, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (id) DO NOTHING`,
        d
      );
    }

    // Ubicaciones
    const locations = [
      ['loc-bod-01', 'dept-bod', 'BOD-RACK-01', 'Rack Principal Servidores', 'Área de servidores y switches de red'],
      ['loc-bod-02', 'dept-bod', 'BOD-EST-01', 'Estantería A - Equipos Nuevos', 'Laptops y monitores en caja'],
      ['loc-it-01', 'dept-it', 'IT-MESA-01', 'Mesa de Diagnóstico IT', 'Taller y soporte técnico'],
      ['loc-log-01', 'dept-log', 'LOG-DESP-01', 'Área de Despacho y Empaque', 'Muelle de carga y rotulación'],
    ];
    for (const loc of locations) {
      await appClient.query(
        `INSERT INTO locations (id, department_id, code, name, description)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (id) DO NOTHING`,
        loc
      );
    }

    // Empleados
    const employees = [
      ['emp-alex', 'EMP-IT-001', 'Alexander Administrador', 'AA', 'alexander7tm@gmail.com', '+502 5555-0101', 'dept-it', null, 'Persiluz / SivarStock', 'ACTIVO', null, null, 'Administrador y Líder de IT'],
      ['emp-carlos', 'EMP-GER-001', 'Carlos Mendoza', 'CM', 'cmendoza@persiluz.com', '+502 5555-0102', 'dept-ger', null, 'Persiluz / SivarStock', 'ACTIVO', null, null, 'Director General / CEO'],
      ['emp-valeria', 'EMP-MKT-001', 'Valeria Pineda', 'VP', 'vpineda@persiluz.com', '+502 5555-0103', 'dept-mkt', 'emp-carlos', 'Persiluz / SivarStock', 'ACTIVO', null, null, 'Jefa de Mercadeo Digital'],
      ['emp-claudia', 'EMP-FIN-001', 'Claudia Morales', 'CMO', 'cmorales@persiluz.com', '+502 5555-0104', 'dept-fin', 'emp-carlos', 'Persiluz / SivarStock', 'ACTIVO', null, null, 'Gerente Financiera'],
      ['emp-elena', 'EMP-CST-001', 'Elena Rivas', 'ER', 'erivas@persiluz.com', '+502 5555-0105', 'dept-cst', 'emp-claudia', 'Persiluz / SivarStock', 'ACTIVO', null, null, 'Encargada de Costos'],
      ['emp-jorge', 'EMP-LOG-001', 'Jorge Alvarado', 'JA', 'jalvarado@persiluz.com', '+502 5555-0106', 'dept-log', 'emp-carlos', 'Persiluz / SivarStock', 'ACTIVO', null, null, 'Jefe de Logística y Rutas'],
      ['emp-roberto', 'EMP-IMP-001', 'Roberto Quintanilla', 'RQ', 'rquintanilla@persiluz.com', '+502 5555-0107', 'dept-imp', 'emp-jorge', 'Persiluz / SivarStock', 'ACTIVO', null, null, 'Supervisor de Impresiones'],
      ['emp-patricia', 'EMP-EC2-001', 'Patricia Vega', 'PV', 'pvega@persiluz.com', '+502 5555-0108', 'dept-ec2', 'emp-carlos', 'Persiluz / SivarStock', 'ACTIVO', null, null, 'Líder Ecommerce Nivel 2'],
      ['emp-mauricio', 'EMP-PER-001', 'Mauricio López', 'ML', 'mlopez@persiluz.com', '+502 5555-0109', 'dept-per', 'emp-carlos', 'Persiluz / SivarStock', 'ACTIVO', null, null, 'Coordinador de Marca Persiluz'],
      ['emp-fernando', 'EMP-EC1-001', 'Fernando Gómez', 'FG', 'fgomez@persiluz.com', '+502 5555-0110', 'dept-ec1', 'emp-patricia', 'Persiluz / SivarStock', 'ACTIVO', null, null, 'Líder Ecommerce Nivel 1'],
      ['emp-david', 'EMP-IT-002', 'David Castillo', 'DC', 'dcastillo@persiluz.com', '+502 5555-0111', 'dept-it', 'emp-alex', 'Persiluz / SivarStock', 'ACTIVO', null, null, 'Técnico de Soporte e Infraestructura'],
      ['emp-luis', 'EMP-LOG-099', 'Luis Serrano', 'LS', 'lserrano@persiluz.com', '+502 5555-0199', 'dept-log', 'emp-jorge', 'Persiluz / SivarStock', 'RETIRADO', '2026-01-30', 'Renuncia voluntaria acordada con RRHH', 'Todos los artículos devueltos a Bodega'],
    ];
    for (const e of employees) {
      await appClient.query(
        `INSERT INTO employees (id, employee_code, full_name, initials, email, phone, department_id, immediate_supervisor_id, company_name, status, exit_date, exit_reason, notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
         ON CONFLICT (id) DO NOTHING`,
        e
      );
    }

    // Usuarios y Roles
    const salt = bcrypt.genSaltSync(10);
    const adminPass = bcrypt.hashSync('admin123', salt);
    const userPass = bcrypt.hashSync('user123', salt);
    const allTabs = JSON.stringify([
      'DASHBOARD', 'INVENTARIO', 'CELULARES', 'PRODUCTOS', 'MOVIMIENTOS',
      'ASIGNACIONES', 'MANTENIMIENTO', 'SERVICIOS', 'COSTOS', 'REPORTES',
      'DEPARTAMENTOS', 'USUARIOS', 'AUDITORIA', 'CONFIGURACION'
    ]);

    const users = [
      ['usr-alex', 'alexander7tm', 'Alexander Admin', 'alexander7tm@gmail.com', adminPass, 'ADMIN', 'dept-it', 'emp-alex', 'AA', allTabs, 0, 1, 1, 1, 1, 1],
      ['usr-carlos', 'cmendoza', 'Carlos Mendoza (CEO)', 'cmendoza@persiluz.com', userPass, 'SUBADMIN', 'dept-ger', 'emp-carlos', 'CM', JSON.stringify(['DASHBOARD','INVENTARIO','CELULARES','PRODUCTOS','COSTOS','REPORTES','DEPARTAMENTOS']), 0, 1, 1, 0, 1, 1],
      ['usr-jorge', 'jalvarado', 'Jorge Alvarado (Jefe Logística)', 'jalvarado@persiluz.com', userPass, 'AREA_MANAGER', 'dept-log', 'emp-jorge', 'JA', JSON.stringify(['DASHBOARD','INVENTARIO','CELULARES','PRODUCTOS','MOVIMIENTOS','ASIGNACIONES']), 1, 0, 1, 0, 1, 1],
      ['usr-elena', 'erivas', 'Elena Rivas (Costos)', 'erivas@persiluz.com', userPass, 'VIEWER', 'dept-cst', 'emp-elena', 'ER', JSON.stringify(['DASHBOARD','INVENTARIO','PRODUCTOS','COSTOS','REPORTES']), 0, 1, 1, 0, 0, 1],
    ];
    for (const u of users) {
      await appClient.query(
        `INSERT INTO users (id, username, full_name, email, password_hash, role, department_id, employee_id, initials, allowed_tabs_json, only_own_department, can_view_financials, can_export, can_manage_users, can_edit, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
         ON CONFLICT (id) DO NOTHING`,
        u
      );
    }

    // Categorías
    const categories = [
      ['cat-comp', 'COMP', 'Computadoras y Laptops', 'INDIVIDUAL', 'Equipos portátiles, torres y todo-en-uno', 'Laptop'],
      ['cat-imp',  'IMP',  'Impresoras y Escáneres', 'INDIVIDUAL', 'Impresoras térmicas, láser y multifuncionales', 'Printer'],
      ['cat-cel',  'CEL',  'Celulares y Líneas Móviles', 'INDIVIDUAL', 'Smartphones corporativos y teléfonos de ruta', 'Smartphone'],
      ['cat-mon',  'MON',  'Monitores y Pantallas', 'INDIVIDUAL', 'Pantallas LED/QHD y monitores de diseño', 'Monitor'],
      ['cat-red',  'RED',  'Equipos de Red y Servidores', 'INDIVIDUAL', 'Switches, routers PoE, servidores en rack', 'Network'],
      ['cat-sum',  'SUM',  'Suministros y Consumibles de Bodega', 'QUANTITY', 'Cintas de embalaje, etiquetas, rollos y tintas', 'Boxes'],
      ['cat-acc',  'ACC',  'Periféricos y Accesorios', 'QUANTITY', 'Mouses, teclados, cables HDMI y adaptadores', 'Mouse'],
      ['cat-mob',  'MOB',  'Mobiliario y Ergonomía', 'INDIVIDUAL', 'Sillas ergonómicas, mesas de trabajo y estantes', 'Armchair'],
    ];
    for (const c of categories) {
      await appClient.query(
        `INSERT INTO categories (id, code, name, tracking_type, description, icon)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (id) DO NOTHING`,
        c
      );
    }

    // Productos
    const products = [
      ['prod-dell-5440', 'cat-comp', 'LAP-DELL-5440', 'Laptop Dell Latitude 5440 Core i7 16GB', 'Equipo corporativo para gerencias y soporte', 'Dell', 'Latitude 5440', 'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=500', 'unidad', 5, 2, 8, 8950.00, 8950.00, 1, 'Dell Guatemala / Intcomex', 0, 1],
      ['prod-hp-m404',   'cat-imp',  'IMP-HP-M404',   'Impresora HP LaserJet Pro M404dn', 'Impresora láser monocromática de alto volumen', 'HP', 'LaserJet M404dn', 'https://images.unsplash.com/photo-1612815154858-60aa4c59eaa6?w=500', 'unidad', 3, 1, 4, 3450.00, 3450.00, 1, 'HP Direct Guatemala', 0, 1],
      ['prod-eps-l3250', 'cat-imp',  'IMP-EPS-L3250', 'Impresora Multifuncional Epson EcoTank L3250', 'Multifuncional a color con sistema de tanques', 'Epson', 'EcoTank L3250', 'https://images.unsplash.com/photo-1612815154858-60aa4c59eaa6?w=500', 'unidad', 2, 1, 3, 1950.00, 1950.00, 1, 'Suministros Digitales S.A.', 0, 1],
      ['prod-sam-a54',   'cat-cel',  'CEL-SAM-A54',   'Smartphone Samsung Galaxy A54 5G 128GB', 'Línea de telefonía móvil empresarial', 'Samsung', 'Galaxy A54', 'https://images.unsplash.com/photo-1598327105666-5b89351aff97?w=500', 'unidad', 4, 1, 6, 2850.00, 2850.00, 1, 'Claro Empresas Guatemala', 0, 1],
      ['prod-redm-13',   'cat-cel',  'CEL-REDM-13',   'Smartphone Xiaomi Redmi Note 13 256GB', 'Celular para jefes de ruta y logística', 'Xiaomi', 'Redmi Note 13', 'https://images.unsplash.com/photo-1598327105666-5b89351aff97?w=500', 'unidad', 3, 1, 5, 1750.00, 1750.00, 1, 'Tigo Business Guatemala', 0, 1],
      ['prod-mon-27',    'cat-mon',  'MON-DELL-27',   'Monitor Dell 27" QHD P2723D Hub USB-C', 'Monitor profesional con hub de conexión', 'Dell', 'P2723D', 'https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?w=500', 'unidad', 6, 2, 8, 2250.00, 2250.00, 1, 'Dell Guatemala / Intcomex', 0, 1],
      ['prod-sw-cisco',  'cat-red',  'SW-CISCO-2960', 'Switch Cisco Catalyst 2960X 48 Puertos PoE', 'Switch administrable de acceso en rack', 'Cisco', 'Catalyst 2960X', 'https://images.unsplash.com/photo-1544197150-b99a580bb7a8?w=500', 'unidad', 2, 1, 3, 14400.00, 14400.00, 1, 'Cisco Systems Guatemala', 0, 1],
      ['prod-cin-emb',   'cat-sum',  'CIN-EMB-IND',   'Cinta de Embalaje Industrial 2" x 100m', 'Cinta reforzada de polipropileno para empaque', '3M', 'Tartán 305', 'https://images.unsplash.com/photo-1589939705384-5185137a7f0f?w=500', 'rollo', 4, 10, 50, 25.00, 250.00, 12, 'Empaques de Guatemala S.A.', 1, 1],
      ['prod-mou-log',   'cat-acc',  'MOU-LOG-M185',  'Mouse Inalámbrico Logitech M185 USB', 'Mouse óptico ergonómico', 'Logitech', 'M185', 'https://images.unsplash.com/photo-1615663245857-ac93bb7c39e7?w=500', 'unidad', 3, 5, 20, 95.00, 95.00, 1, 'Office Supplies S.A.', 1, 1],
      ['prod-tec-log',   'cat-acc',  'TEC-LOG-K120',  'Teclado USB Logitech K120 Resistente', 'Teclado para estaciones de trabajo', 'Logitech', 'K120', 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=500', 'unidad', 12, 5, 25, 115.00, 115.00, 1, 'Office Supplies S.A.', 1, 1],
      ['prod-cbl-patch', 'cat-acc',  'CBL-PATCH-2M',  'Patch Cord UTP Cat6 2 Metros Azul', 'Cable de red verificado', 'Panduit', 'Cat6-2M', 'https://images.unsplash.com/photo-1544197150-b99a580bb7a8?w=500', 'unidad', 18, 10, 50, 35.00, 35.00, 1, 'ElectroRedes Guatemala', 1, 1],
    ];
    for (const p of products) {
      await appClient.query(
        `INSERT INTO products (id, category_id, code, name, description, brand, model, image_url, unit_of_measure, current_stock, min_stock, target_stock, unit_price, box_price, units_per_box, default_supplier, is_consumable, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
         ON CONFLICT (id) DO NOTHING`,
        p
      );
    }

    // Proveedores por producto
    const productSuppliers = [
      ['ps-1', 'prod-dell-5440', 'Dell Guatemala / Intcomex', 'ventas@intcomex.gt | Tel: 2420-9900', 1],
      ['ps-2', 'prod-dell-5440', 'Canella S.A. Mayorista', 'corporativo@canella.com.gt | Tel: 2338-5000', 0],
      ['ps-3', 'prod-hp-m404', 'HP Direct Guatemala', 'soporte@hp.com.gt | Tel: 2200-1100', 1],
      ['ps-4', 'prod-hp-m404', 'Suministros Digitales S.A.', 'pedidos@suministros.gt', 0],
      ['ps-5', 'prod-sam-a54', 'Claro Empresas Guatemala', 'ejecutivo@claro.com.gt | Tel: 2420-1000', 1],
      ['ps-6', 'prod-sam-a54', 'Tigo Business Guatemala', 'cuentas@tigo.com.gt | Tel: 2428-0000', 0],
      ['ps-7', 'prod-cin-emb', 'Empaques de Guatemala S.A.', 'ventas@empaques.com.gt | Tel: 2360-4400', 1],
      ['ps-8', 'prod-mou-log', 'Office Supplies S.A.', 'contacto@officesupplies.gt', 1],
    ];
    for (const ps of productSuppliers) {
      await appClient.query(
        `INSERT INTO product_suppliers (id, product_id, supplier_name, contact_info, is_preferred)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (id) DO NOTHING`,
        ps
      );
    }

    // Historial de precios
    const priceHistory = [
      ['ph-1', 'prod-dell-5440', '2025-02-15', 8950.00, 8950.00, 'GTQ', 'Dell Guatemala / Intcomex', 'FAC-2025-9981', 'Lote de 3 laptops para gerencia'],
      ['ph-2', 'prod-dell-5440', '2024-08-12', 9150.00, 9150.00, 'GTQ', 'Canella S.A.', 'FAC-2024-7411', 'Compra unitaria de reemplazo'],
      ['ph-3', 'prod-hp-m404', '2025-03-10', 3450.00, 3450.00, 'GTQ', 'HP Direct Guatemala', 'FAC-2025-4100', 'Impresora para área de Impresiones'],
      ['ph-4', 'prod-cin-emb', '2026-02-10', 25.00, 250.00, 'GTQ', 'Empaques de Guatemala S.A.', 'FAC-2026-014', 'Compra de 2 cajas (24 rollos)'],
    ];
    for (const ph of priceHistory) {
      await appClient.query(
        `INSERT INTO product_price_history (id, product_id, purchase_date, unit_price, box_price, currency, supplier_name, invoice_number, notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (id) DO NOTHING`,
        ph
      );
    }

    // Activos físicos individuales
    const items = [
      ['item-001', 'prod-dell-5440', 'SIV-IT-000001', 'DL-5440-8831', 'Dell', 'Latitude 5440', 'dept-it', 'emp-alex', 'usr-alex', 'ASIGNADO', 'BUENO', '2025-02-15', '2025-02-18', 'Dell Guatemala / Intcomex', 8950.00, 9800.00, 1500.00, 'GTQ', '2028-02-15', 'FAC-2025-9981', 'OC-IT-101', 'https://example.com/warranties/dell-5440-8831.pdf', 'https://example.com/invoices/fac-9981.pdf', 'Equipo asignado al Administrador de IT', 'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=500', 0, null, null, 'usr-alex'],
      ['item-002', 'prod-dell-5440', 'SIV-BOD-000002', 'DL-5440-8832', 'Dell', 'Latitude 5440', 'dept-bod', null, null, 'DISPONIBLE', 'NUEVO', '2025-02-15', '2025-02-18', 'Dell Guatemala / Intcomex', 8950.00, 9800.00, 1500.00, 'GTQ', '2028-02-15', 'FAC-2025-9981', 'OC-IT-101', null, 'https://example.com/invoices/fac-9981.pdf', 'Equipo en stock en Cuarto de Servidores (Bodega)', 'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=500', 0, null, null, 'usr-alex'],
      ['item-003', 'prod-hp-m404', 'SIV-IMP-000003', 'HP-M404-5512', 'HP', 'LaserJet M404dn', 'dept-imp', 'emp-roberto', null, 'ASIGNADO', 'BUENO', '2025-03-10', '2025-03-12', 'HP Direct Guatemala', 3450.00, 3800.00, 500.00, 'GTQ', '2027-03-10', 'FAC-2025-4100', 'OC-IMP-022', null, 'https://example.com/invoices/fac-4100.pdf', 'Impresora principal de sala de empaque', 'https://images.unsplash.com/photo-1612815154858-60aa4c59eaa6?w=500', 0, null, null, 'usr-alex'],
      ['item-004', 'prod-eps-l3250', 'SIV-IMP-000004', 'EP-L3250-9901', 'Epson', 'EcoTank L3250', 'dept-imp', null, null, 'AVERIADO', 'AVERIADO', '2024-09-01', '2024-09-05', 'Suministros Digitales S.A.', 1950.00, 2200.00, 200.00, 'GTQ', '2025-09-01', 'FAC-2024-1180', 'OC-IMP-010', null, null, 'Atascamiento recurrente en rodillo de alimentación', 'https://images.unsplash.com/photo-1612815154858-60aa4c59eaa6?w=500', 1, 'Rodillo de tracción roto', null, 'usr-alex'],
      ['item-005', 'prod-mon-27', 'SIV-GER-000005', 'MD-27-1011', 'Dell', 'P2723D', 'dept-ger', 'emp-carlos', 'usr-carlos', 'ASIGNADO', 'BUENO', '2025-02-15', '2025-02-18', 'Dell Guatemala / Intcomex', 2250.00, 2480.00, 300.00, 'GTQ', '2028-02-15', 'FAC-2025-9982', 'OC-GER-005', null, null, 'Monitor gerencial con estación docking', 'https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?w=500', 0, null, null, 'usr-alex'],
      ['item-006', 'prod-sw-cisco', 'SIV-BOD-000006', 'CS-2960-4411', 'Cisco', 'Catalyst 2960X', 'dept-bod', null, null, 'ASIGNADO', 'BUENO', '2024-11-05', '2024-11-10', 'Cisco Systems Guatemala', 14400.00, 16200.00, 2400.00, 'GTQ', '2027-11-05', 'FAC-2024-8742', 'OC-IT-089', null, null, 'Switch principal en Rack de Servidores', 'https://images.unsplash.com/photo-1544197150-b99a580bb7a8?w=500', 0, null, null, 'usr-alex'],
    ];
    for (const it of items) {
      await appClient.query(
        `INSERT INTO inventory_items (id, product_id, permanent_code, serial_number, brand, model, current_department_id, current_employee_id, current_assigned_user_id, operational_status, physical_condition, purchase_date, reception_date, supplier, purchase_price, replacement_value, residual_value, currency, warranty_expiration, invoice_number, purchase_order, warranty_document_url, invoice_document_url, notes, photo_url, is_broken, broken_notes, replacement_item_id, registered_by_user_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29)
         ON CONFLICT (id) DO NOTHING`,
        it
      );
    }

    // Celulares
    const mobileDevices = [
      ['cel-001', 'CEL-001', 'Samsung', 'Galaxy A54 5G 128GB', 'emp-alex', 'dept-it', '+502 5555-0101', '354890123456781', '2025-06-15', 'ASIGNADO', JSON.stringify([{ id: '1', date: '2025-06-15', note: 'Entrega de smartphone con funda y cargador 25W', author: 'Alexander Admin' }, { id: '2', date: '2026-01-10', note: 'Cambio de mica de vidrio templado', author: 'Alexander Admin' }])],
      ['cel-002', 'CEL-002', 'Xiaomi', 'Redmi Note 13 256GB', 'emp-valeria', 'dept-mkt', '+502 5555-0103', '867123456789012', '2025-08-20', 'ASIGNADO', JSON.stringify([{ id: '1', date: '2025-08-20', note: 'Asignado para Meta Ads y WhatsApp Business', author: 'Alexander Admin' }])],
      ['cel-003', 'CEL-003', 'Samsung', 'Galaxy A54 5G 128GB', 'emp-jorge', 'dept-log', '+502 5555-0106', '359876543210987', '2025-09-01', 'ASIGNADO', JSON.stringify([{ id: '1', date: '2025-09-01', note: 'Línea de despacho y control GPS de transportistas', author: 'Alexander Admin' }])],
      ['cel-004', 'CEL-004', 'Motorola', 'Moto G54 5G 256GB', null, 'dept-bod', '+502 5555-0190', '356123987456123', '2025-11-10', 'DISPONIBLE', JSON.stringify([{ id: '1', date: '2025-11-10', note: 'Celular de respaldo en bodega', author: 'Alexander Admin' }])],
    ];
    for (const md of mobileDevices) {
      await appClient.query(
        `INSERT INTO mobile_devices (id, device_code, brand, model, employee_id, department_id, phone_number, imei, delivery_date, status, notes_history)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         ON CONFLICT (id) DO NOTHING`,
        md
      );
    }

    // Consumibles
    const consumableStocks = [
      ['cs-1', 'prod-cin-emb', 'dept-bod', 4, 'LOTE-3M-2026', 25.00, '2028-12-31'],
      ['cs-2', 'prod-mou-log', 'dept-bod', 3, 'LOTE-LOG-01', 95.00, null],
      ['cs-3', 'prod-tec-log', 'dept-bod', 12, 'LOTE-LOG-02', 115.00, null],
      ['cs-4', 'prod-cbl-patch', 'dept-bod', 18, 'LOTE-PAN-01', 35.00, null],
    ];
    for (const cs of consumableStocks) {
      await appClient.query(
        `INSERT INTO consumable_stocks (id, product_id, department_id, quantity, batch_number, unit_cost, expiration_date)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (id) DO NOTHING`,
        cs
      );
    }

    // Asignaciones
    const assignments = [
      ['asg-001', 'AA-2026-LAPD-001', 'item-001', 'prod-dell-5440', 'emp-alex', 'usr-alex', 1, 'usr-alex', 'dept-bod', 'dept-it', 'dept-it', '2026-01-15 08:30:00', null, null, null, null, 'ACTIVA', 'Equipo principal asignado'],
      ['asg-002', 'CM-2026-MOND-001', 'item-005', 'prod-mon-27', 'emp-carlos', 'usr-carlos', 1, 'usr-alex', 'dept-bod', 'dept-ger', 'dept-ger', '2026-01-18 10:15:00', null, null, null, null, 'ACTIVA', 'Monitor ejecutivo gerencia'],
      ['asg-003', 'RQ-2026-HPM-001', 'item-003', 'prod-hp-m404', 'emp-roberto', null, 1, 'usr-alex', 'dept-bod', 'dept-imp', 'dept-imp', '2026-02-01 09:00:00', null, null, null, null, 'ACTIVA', 'Impresora asignada a sala de impresión'],
    ];
    for (const a of assignments) {
      await appClient.query(
        `INSERT INTO assignments (id, assignment_code, item_id, product_id, employee_id, user_id, quantity, assigned_by_user_id, origin_department_id, target_department_id, charged_department_id, assigned_at, expected_return_date, returned_at, return_condition, return_notes, status, notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
         ON CONFLICT (id) DO NOTHING`,
        a
      );
    }

    // Movimientos
    const movements = [
      ['mov-001', 'ENTRADA', 'item-001', 'prod-dell-5440', 1, 8950.00, 8950.00, null, 'dept-bod', null, null, null, 'usr-alex', 'Ingreso inicial por compra de laptops', 'FAC-2025-9981', 'usr-alex', '2025-02-18 10:00:00'],
      ['mov-002', 'ASIGNACION', 'item-001', 'prod-dell-5440', 1, 8950.00, 8950.00, 'dept-bod', 'dept-it', null, 'emp-alex', 'usr-alex', 'usr-alex', 'Entrega de equipo asignado a IT', 'AA-2026-LAPD-001', 'usr-alex', '2026-01-15 08:30:00'],
      ['mov-003', 'ENTRADA', null, 'prod-cin-emb', 12, 25.00, 300.00, null, 'dept-bod', null, null, null, 'usr-alex', 'Recepción de caja de cintas', 'FAC-2026-014', 'usr-alex', '2026-02-10 11:20:00'],
      ['mov-004', 'ASIGNACION', null, 'prod-cin-emb', 8, 25.00, 200.00, 'dept-bod', 'dept-log', null, 'emp-jorge', 'usr-alex', 'usr-alex', 'Despacho de cintas para empaque', 'VALE-LOG-041', 'usr-alex', '2026-02-15 14:10:00'],
      ['mov-005', 'REPARACION', 'item-004', 'prod-eps-l3250', 1, 0, 0, 'dept-imp', 'dept-bod', 'emp-roberto', null, null, 'usr-alex', 'Traslado de impresora averiada a diagnóstico', 'TK-MNT-2026-01', 'usr-alex', '2026-03-20 09:00:00'],
    ];
    for (const m of movements) {
      await appClient.query(
        `INSERT INTO inventory_movements (id, movement_type, item_id, product_id, quantity, unit_cost, total_cost, from_department_id, to_department_id, from_employee_id, to_employee_id, from_user_id, to_user_id, reason, reference_code, user_id, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
         ON CONFLICT (id) DO NOTHING`,
        m
      );
    }

    // Categorías de Licencias
    const licenseCategories = [
      ['lcat-ofi', 'Ofimática y Correo', 'Suites empresariales de productividad', 1],
      ['lcat-dis', 'Diseño y Creatividad', 'Herramientas de edición gráfica', 1],
      ['lcat-cld', 'Infraestructura Cloud', 'Almacenamiento y servidores', 1],
      ['lcat-sec', 'Seguridad y Endpoint', 'Antivirus y VPN', 1],
      ['lcat-dom', 'Dominios y Hosting', 'Nombres de dominio de la empresa', 1],
    ];
    for (const lc of licenseCategories) {
      await appClient.query(
        `INSERT INTO license_categories (id, name, description, is_active)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (id) DO NOTHING`,
        lc
      );
    }

    // Servicios Digitales
    const digitalServices = [
      ['srv-001', 'Microsoft 365 Business Standard', 'lcat-ofi', 'OFIMATICA', 'Microsoft Partner', 'dept-it', 'dept-fin', 'EMPRESARIAL', 'USUARIOS', 75, 72, 'ANUAL', 73500.00, 6125.00, 'GTQ', '2025-11-01', '2026-11-01', '2026-10-25', 'SI', 'ACTIVA', 'Tarjeta Corp *4421', 'INV-MS-99412', null, 'https://example.com/invoices/m365.pdf', 'Todos los empleados', 'Suite completa Teams, Outlook, Word, Excel'],
      ['srv-002', 'Google Workspace Enterprise', 'lcat-ofi', 'OFIMATICA', 'Google LLC', 'dept-it', 'dept-mkt', 'BUSINESS', 'USUARIOS', 15, 12, 'MENSUAL', 180.00, 180.00, 'USD', '2026-01-01', '2026-12-31', '2026-11-01', 'SI', 'ACTIVA', 'Tarjeta USD *9011', 'GW-2026-90', null, null, 'Cuentas para Mercadeo', 'Facturación mensual en USD'],
      ['srv-003', 'Dominio Oficial persiluz.com', 'lcat-dom', 'DOMINIO_HOSTING', 'Namecheap Inc.', 'dept-it', 'dept-per', 'DOMINIO', 'DOMINIO', 1, 1, 'UNICO', 140.00, 11.67, 'GTQ', '2025-11-24', '2027-11-24', '2027-11-24', 'SI', 'PAGO_UNICO', 'PayPal Corp', 'NC-994112', null, null, 'Dominio principal persiluz.com', 'Pago bianual'],
    ];
    for (const ds of digitalServices) {
      await appClient.query(
        `INSERT INTO digital_services (id, name, category_id, category_legacy, provider, responsible_department_id, charged_department_id, plan_type, license_type, seats_contracted, seats_used, cost_period, amount, monthly_equivalent_cost, currency, start_date, expiration_date, renewal_date, auto_renew, status, payment_method_ref, invoice_number, warranty_document_url, invoice_document_url, assigned_users_text, notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26)
         ON CONFLICT (id) DO NOTHING`,
        ds
      );
    }

    // Registros de Costos
    const costs = [
      ['cst-001', 'item-001', 'prod-dell-5440', null, 'ADQUISICION', 'Compra de Laptop Dell Latitude 5440', 8950.00, 1074.00, 0.00, 10024.00, 'GTQ', 1.0, '2025-02-15', 'dept-it', 'dept-bod', 'dept-it', 'dept-fin', 'dept-it', 'Dell Guatemala / Intcomex', 'FAC-2025-9981', 'OC-IT-101', 'https://example.com/warranties/dell-5440.pdf', 'https://example.com/invoices/fac-9981.pdf', 'CC-IT-01', 'CONFIRMADO', 'Presupuesto de IT', 'usr-alex'],
      ['cst-002', 'item-006', 'prod-sw-cisco', null, 'ADQUISICION', 'Adquisición de Switch Cisco 2960X', 14400.00, 1728.00, 0.00, 16128.00, 'GTQ', 1.0, '2024-11-05', 'dept-it', 'dept-bod', 'dept-it', 'dept-it', 'dept-it', 'Cisco Systems Guatemala', 'FAC-2024-8742', 'OC-IT-089', null, 'https://example.com/invoices/fac-8742.pdf', 'CC-IT-01', 'CONFIRMADO', 'Modernización de red', 'usr-alex'],
      ['cst-003', null, null, 'srv-001', 'LICENCIA_SUSCRIPCION', 'Renovación Microsoft 365 75 Licencias', 73500.00, 0.00, 0.00, 73500.00, 'GTQ', 1.0, '2025-11-01', 'dept-it', 'dept-fin', 'dept-it', 'dept-fin', 'dept-fin', 'Microsoft Guatemala Partner', 'INV-MS-99412', 'OC-FIN-220', null, 'https://example.com/invoices/m365.pdf', 'CC-FIN-01', 'CONFIRMADO', 'Facturación global', 'usr-alex'],
    ];
    for (const cs of costs) {
      await appClient.query(
        `INSERT INTO cost_records (id, item_id, product_id, digital_service_id, cost_nature, concept, amount, tax_amount, discount_amount, total_amount, currency, exchange_rate, expense_date, requesting_department_id, originating_department_id, recording_department_id, budget_department_id, charged_department_id, supplier, invoice_number, purchase_order, warranty_document_url, invoice_document_url, cost_center, status, notes, recorded_by_user_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27)
         ON CONFLICT (id) DO NOTHING`,
        cs
      );
    }

    // Auditoría
    const auditLogs = [
      ['aud-001', 'usr-alex', 'alexander7tm', 'ADMIN', 'INICIALIZACION', 'SISTEMA', 'database', 'SivarStock DB', null, JSON.stringify({ country: 'Guatemala', currency: 'GTQ', admin: 'alexander7tm@gmail.com' }), 'Inicialización en PostgreSQL', '127.0.0.1'],
    ];
    for (const al of auditLogs) {
      await appClient.query(
        `INSERT INTO audit_logs (id, user_id, username, user_role, action, module, entity_id, entity_name, before_state_json, after_state_json, reason, ip_address)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
         ON CONFLICT (id) DO NOTHING`,
        al
      );
    }

    // System Settings
    const settings = [
      ['company_name', 'Persiluz / SivarStock Guatemala', 'Nombre de la empresa'],
      ['admin_email', 'alexander7tm@gmail.com', 'Correo del super-administrador'],
      ['primary_currency', 'GTQ', 'Moneda principal (Quetzales)'],
      ['currency_symbol', 'Q', 'Símbolo monetario'],
      ['secondary_currency', 'USD', 'Moneda secundaria'],
    ];
    for (const s of settings) {
      await appClient.query(
        `INSERT INTO system_settings (key, value, description)
         VALUES ($1, $2, $3)
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
        s
      );
    }
    console.log('[OK] Datos semilla insertados correctamente.');
  } else {
    console.log('[OK] Los datos semilla ya se encuentran presentes en la base de datos.');
  }

  // 6. Resumen de verificación
  const deptCount = await appClient.query("SELECT COUNT(*) as count FROM departments");
  const empCount = await appClient.query("SELECT COUNT(*) as count FROM employees");
  const usrCount = await appClient.query("SELECT COUNT(*) as count FROM users");
  const prodCount = await appClient.query("SELECT COUNT(*) as count FROM products");
  const itemCount = await appClient.query("SELECT COUNT(*) as count FROM inventory_items");
  const celCount = await appClient.query("SELECT COUNT(*) as count FROM mobile_devices");

  console.log('===============================================================');
  console.log('       ESTADO DE LA BASE DE DATOS POSTGRESQL "sivarstock"      ');
  console.log('===============================================================');
  console.log(`- Departamentos: ${deptCount.rows[0].count} (11 oficiales)`);
  console.log(`- Empleados:     ${empCount.rows[0].count}`);
  console.log(`- Usuarios:      ${usrCount.rows[0].count} (Admin: alexander7tm@gmail.com)`);
  console.log(`- Productos:     ${prodCount.rows[0].count}`);
  console.log(`- Activos:       ${itemCount.rows[0].count}`);
  console.log(`- Celulares:     ${celCount.rows[0].count}`);
  console.log('===============================================================');
  console.log('>> ¡POSTGRESQL CONFIGURADO Y 100% OPERATIVO PARA SIVARSTOCK! <<');
  console.log('===============================================================');

  await appClient.end();
}

setupPostgres().catch(err => {
  console.error('Error durante la configuración de PostgreSQL:', err);
  process.exit(1);
});
