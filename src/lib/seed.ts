import { initDb, saveDb } from './db';
import bcrypt from 'bcryptjs';

export async function runSeed(force: boolean = false): Promise<void> {
  const db = await initDb();

  // Verificar si ya existen usuarios
  const check = db.exec("SELECT COUNT(*) FROM users;");
  const count = check[0]?.values[0]?.[0] as number || 0;
  if (count > 0 && !force) {
    console.log('La base de datos ya contiene información. Omitiendo seed.');
    return;
  }

  console.log('Iniciando sembrado de datos de demostración para SivarStock...');

  // Limpiar tablas si es forzado
  if (force) {
    db.run("DELETE FROM custom_field_values;");
    db.run("DELETE FROM custom_cost_fields;");
    db.run("DELETE FROM custom_reports;");
    db.run("DELETE FROM audit_logs;");
    db.run("DELETE FROM cost_records;");
    db.run("DELETE FROM digital_services;");
    db.run("DELETE FROM maintenance_records;");
    db.run("DELETE FROM inventory_movements;");
    db.run("DELETE FROM assignments;");
    db.run("DELETE FROM consumable_stocks;");
    db.run("DELETE FROM inventory_items;");
    db.run("DELETE FROM products;");
    db.run("DELETE FROM categories;");
    db.run("DELETE FROM locations;");
    db.run("DELETE FROM users;");
    db.run("DELETE FROM departments;");
  }

  // 1. Departamentos
  const depts = [
    ['dept-it', 'IT', 'Tecnología e Informática', 'CC-100', 'Carlos Renderos'],
    ['dept-prod', 'PROD', 'Planta de Producción', 'CC-200', 'Roberto Quintanilla'],
    ['dept-adm', 'ADM', 'Administración y Finanzas', 'CC-300', 'Claudia Morales'],
    ['dept-rrhh', 'RRHH', 'Recursos Humanos', 'CC-400', 'Patricia Vega'],
    ['dept-vta', 'VTA', 'Comercial y Ventas', 'CC-500', 'Fernando Gómez'],
    ['dept-bod', 'BOD', 'Bodega y Almacén General', 'CC-600', 'Jorge Alvarado'],
    ['dept-cont', 'CONT', 'Contabilidad y Presupuesto', 'CC-700', 'Elena Rivas'],
    ['dept-comp', 'COMP', 'Compras y Suministros', 'CC-800', 'Mauricio López'],
    ['dept-log', 'LOG', 'Logística y Distribución', 'CC-900', 'Silvia Guardado'],
  ];
  for (const d of depts) {
    db.run("INSERT OR REPLACE INTO departments (id, code, name, cost_center, manager_name) VALUES (?, ?, ?, ?, ?)", d);
  }

  // 2. Ubicaciones
  const locations = [
    ['loc-it-dc', 'dept-it', 'IT-DC', 'Data Center & Servidores', 'Sala acondicionada Piso 1'],
    ['loc-it-lab', 'dept-it', 'IT-LAB', 'Laboratorio de Soporte IT', 'Taller de reparación Piso 1'],
    ['loc-prod-l1', 'dept-prod', 'PROD-L1', 'Línea de Ensamble 1', 'Nave Industrial Principal'],
    ['loc-prod-l2', 'dept-prod', 'PROD-L2', 'Línea de Ensamble 2', 'Nave Industrial Norte'],
    ['loc-bod-ra', 'dept-bod', 'BOD-RA', 'Racks Pasillo A - Consumibles', 'Área climatizada'],
    ['loc-bod-rb', 'dept-bod', 'BOD-RB', 'Racks Pasillo B - Componentes', 'Almacén general'],
    ['loc-adm-of2', 'dept-adm', 'ADM-OF2', 'Oficinas Administrativas', 'Edificio Central Piso 2'],
    ['loc-adm-juntas', 'dept-adm', 'ADM-SJP', 'Sala de Juntas Ejecutiva', 'Edificio Central Piso 2'],
  ];
  for (const l of locations) {
    db.run("INSERT OR REPLACE INTO locations (id, department_id, code, name, description) VALUES (?, ?, ?, ?, ?)", l);
  }

  // 3. Usuarios
  const salt = bcrypt.genSaltSync(10);
  const adminPass = bcrypt.hashSync('admin123', salt);
  const subadminPass = bcrypt.hashSync('subadmin123', salt);
  const userPass = bcrypt.hashSync('user123', salt);

  const users = [
    ['usr-admin', 'admin', 'Administrador Principal', 'admin@sivarstock.com', adminPass, 'ADMIN', 'dept-it', 'AR', 1, 1, 1],
    ['usr-subadmin', 'subadmin', 'Claudia Morales (Subadministradora)', 'subadmin@sivarstock.com', subadminPass, 'SUBADMIN', 'dept-adm', 'CM', 1, 1, 0],
    ['usr-jefe-prod', 'jefe_prod', 'Roberto Quintanilla (Jefe Planta)', 'rquintanilla@sivarstock.com', userPass, 'AREA_MANAGER', 'dept-prod', 'RQ', 0, 1, 0],
    ['usr-jefe-bod', 'jefe_bodega', 'Jorge Alvarado (Jefe Bodega)', 'jalvarado@sivarstock.com', userPass, 'AREA_MANAGER', 'dept-bod', 'JA', 0, 1, 0],
    ['usr-auditor', 'auditor', 'Elena Rivas (Auditora Contable)', 'erivas@sivarstock.com', userPass, 'VIEWER', 'dept-cont', 'ER', 1, 1, 0],
    ['usr-morales', 'amorales', 'Alejandro Morales (Especialista IT)', 'amorales@sivarstock.com', userPass, 'VIEWER', 'dept-it', 'AM', 0, 0, 0],
    ['usr-castaneda', 'bcastaneda', 'Beatriz Castañeda (Ingeniera Planta)', 'bcastaneda@sivarstock.com', userPass, 'VIEWER', 'dept-prod', 'BC', 0, 0, 0],
    ['usr-gomez', 'fgomez', 'Fernando Gómez (Ejecutivo Ventas)', 'fgomez@sivarstock.com', userPass, 'VIEWER', 'dept-vta', 'FG', 0, 0, 0],
    ['usr-fuentes', 'gfuentes', 'Gabriela Fuentes (Coordinadora RRHH)', 'gfuentes@sivarstock.com', userPass, 'VIEWER', 'dept-rrhh', 'GF', 0, 0, 0],
  ];
  for (const u of users) {
    db.run("INSERT OR REPLACE INTO users (id, username, full_name, email, password_hash, role, department_id, initials, can_view_financials, can_export, can_manage_users) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", u);
  }

  // 4. Categorías
  const categories = [
    ['cat-comp', 'COMP', 'Computadoras y Laptops', 'INDIVIDUAL', 'Equipos portátiles y estaciones de trabajo', 'Laptop'],
    ['cat-mon', 'MON', 'Monitores y Pantallas', 'INDIVIDUAL', 'Monitores LCD/LED y televisores de planta', 'Monitor'],
    ['cat-red', 'RED', 'Equipos de Red y Telecom', 'INDIVIDUAL', 'Switches, routers, firewalls y puntos de acceso', 'Network'],
    ['cat-cble', 'CBLE', 'Cableado y Conectores', 'QUANTITY', 'Bobinas de cable, patch cords y conectores', 'Cable'],
    ['cat-acc', 'ACC', 'Periféricos y Accesorios', 'QUANTITY', 'Mouses, teclados, adaptadores y bases', 'Mouse'],
    ['cat-herr', 'HERR', 'Herramientas y Diagnóstico', 'INDIVIDUAL', 'Instrumentos de medición y herramientas técnicas', 'Wrench'],
    ['cat-mob', 'MOB', 'Mobiliario y Equipamiento', 'INDIVIDUAL', 'Sillas ergonómicas, escritorios y estanterías', 'Armchair'],
    ['cat-sum', 'SUM', 'Suministros de Empaque y Planta', 'QUANTITY', 'Cintas, guantes y consumibles operativos', 'Boxes'],
  ];
  for (const c of categories) {
    db.run("INSERT OR REPLACE INTO categories (id, code, name, tracking_type, description, icon) VALUES (?, ?, ?, ?, ?, ?)", c);
  }

  // 5. Productos
  const products = [
    ['prod-dell-5440', 'cat-comp', 'LAP-DELL-5440', 'Laptop Dell Latitude 5440 Core i7 16GB', 'Equipo corporativo para personal técnico y gerencial', 'Dell', 'Latitude 5440', 'unidad', 0, 2, 5, 4, 'Dell Centroamérica'],
    ['prod-len-t14', 'cat-comp', 'LAP-LEN-T14', 'Laptop Lenovo ThinkPad T14 Gen 4 32GB', 'Equipo de alta resistencia para ingeniería y planta', 'Lenovo', 'ThinkPad T14', 'unidad', 0, 1, 4, 3, 'Lenovo Enterprise'],
    ['prod-mon-27', 'cat-mon', 'MON-DELL-27', 'Monitor Dell 27" QHD P2723D', 'Monitor profesional con hub USB-C', 'Dell', 'P2723D', 'unidad', 0, 2, 8, 5, 'Dell Centroamérica'],
    ['prod-sw-cisco', 'cat-red', 'SW-CISCO-2960', 'Switch Cisco Catalyst 2960X 48 Puertos PoE', 'Switch administrable de acceso a red de planta', 'Cisco', 'Catalyst 2960X', 'unidad', 0, 1, 2, 2, 'Cisco Systems'],
    ['prod-cbl-utp', 'cat-cble', 'CBL-UTP-CAT6', 'Bobina Cable UTP Cat6 305m 100% Cobre', 'Cable para infraestructura de red industrial', 'Panduit', 'TX6000', 'caja', 1, 3, 10, 2, 'ElectroRedes S.A.'], // ALERTA: 2 < 3
    ['prod-cbl-patch', 'cat-cble', 'CBL-PATCH-2M', 'Patch Cord UTP Cat6 2 Metros Azul', 'Cables de conexión directa a estaciones', 'Panduit', 'Cat6-2M', 'unidad', 1, 20, 100, 14, 'ElectroRedes S.A.'], // ALERTA: 14 < 20
    ['prod-con-rj45', 'cat-cble', 'CON-RJ45-100', 'Conectores RJ45 Blindados Cat6 (Bolsa 100)', 'Conectores con contactos dorados', 'AMP Netconnect', 'RJ45-FTP', 'paquete', 1, 5, 20, 18, 'ElectroRedes S.A.'],
    ['prod-mou-log', 'cat-acc', 'MOU-LOG-M185', 'Mouse Inalámbrico Logitech M185', 'Periférico óptico con nano receptor USB', 'Logitech', 'M185', 'unidad', 1, 5, 25, 22, 'Office Supplies S.A.'],
    ['prod-tec-log', 'cat-acc', 'TEC-LOG-K120', 'Teclado USB Logitech K120 Resistente', 'Teclado estándar empresarial a prueba de salpicaduras', 'Logitech', 'K120', 'unidad', 1, 5, 25, 19, 'Office Supplies S.A.'],
    ['prod-sil-erg', 'cat-mob', 'SIL-STEEL-ERG', 'Silla Ergonómica Ejecutiva con Soporte Lumbar', 'Silla de malla transpirable con brazos 3D', 'Steelcase', 'Series 1', 'unidad', 0, 2, 6, 4, 'Mobiliario Corporativo'],
    ['prod-cin-emb', 'cat-sum', 'CIN-EMB-IND', 'Cinta de Embalaje Industrial 2" x 100m', 'Cinta adhesiva de polipropileno reforzada', '3M', 'Tartán 305', 'rollo', 1, 10, 50, 6, 'Empaques de El Salvador'], // ALERTA: 6 < 10
    ['prod-gua-nit', 'cat-sum', 'GUA-NIT-L', 'Guantes de Nitrilo Talla L (Caja 100)', 'Protección manual para mantenimiento y planta', 'Kimberly-Clark', 'Purple Nitrile', 'caja', 1, 8, 30, 25, 'Seguridad Industrial S.A.'],
  ];
  for (const p of products) {
    db.run("INSERT OR REPLACE INTO products (id, category_id, code, name, description, brand, model, unit_of_measure, is_consumable, min_stock, target_stock, current_stock, default_supplier) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", p);
  }

  // 6. Activos Individuales
  const items = [
    ['item-001', 'prod-dell-5440', 'SIV-IT-000001', 'DL-5440-8831', 'Dell', 'Latitude 5440', 'dept-it', 'loc-it-lab', 'usr-morales', 'ASIGNADO', 'BUENO', '2025-02-15', '2025-02-18', 'Dell Centroamérica', 1150.00, 1250.00, 200.00, 'USD', '2028-02-15', 'FAC-2025-9981', 'OC-IT-101', 'Asignada para soporte técnico en terreno', 'usr-admin'],
    ['item-002', 'prod-dell-5440', 'SIV-IT-000002', 'DL-5440-8832', 'Dell', 'Latitude 5440', 'dept-it', 'loc-it-lab', null, 'DISPONIBLE', 'NUEVO', '2025-02-15', '2025-02-18', 'Dell Centroamérica', 1150.00, 1250.00, 200.00, 'USD', '2028-02-15', 'FAC-2025-9981', 'OC-IT-101', 'Unidad en reserva para contingencias', 'usr-admin'],
    ['item-003', 'prod-len-t14', 'SIV-PROD-000003', 'LN-T14-9901', 'Lenovo', 'ThinkPad T14', 'dept-prod', 'loc-prod-l1', 'usr-castaneda', 'ASIGNADO', 'BUENO', '2025-04-10', '2025-04-12', 'Lenovo Enterprise', 1280.00, 1380.00, 250.00, 'USD', '2028-04-10', 'FAC-2025-1044', 'OC-PROD-402', 'Configurada con software SCADA de monitoreo de planta', 'usr-admin'],
    ['item-004', 'prod-mon-27', 'SIV-IT-000004', 'MD-27-1011', 'Dell', 'P2723D', 'dept-it', 'loc-it-lab', 'usr-morales', 'ASIGNADO', 'BUENO', '2025-02-15', '2025-02-18', 'Dell Centroamérica', 290.00, 320.00, 40.00, 'USD', '2028-02-15', 'FAC-2025-9982', 'OC-IT-101', 'Monitor secundario estación de soporte', 'usr-admin'],
    ['item-005', 'prod-mon-27', 'SIV-IT-000005', 'MD-27-1012', 'Dell', 'P2723D', 'dept-it', 'loc-it-dc', null, 'DISPONIBLE', 'BUENO', '2025-02-15', '2025-02-18', 'Dell Centroamérica', 290.00, 320.00, 40.00, 'USD', '2028-02-15', 'FAC-2025-9982', 'OC-IT-101', 'Disponible en bodega técnica', 'usr-admin'],
    ['item-006', 'prod-sw-cisco', 'SIV-IT-000006', 'CS-2960-4411', 'Cisco', 'Catalyst 2960X', 'dept-it', 'loc-it-dc', null, 'ASIGNADO', 'BUENO', '2024-11-05', '2024-11-10', 'Cisco Systems', 1850.00, 2100.00, 300.00, 'USD', '2027-11-05', 'FAC-2024-8742', 'OC-IT-089', 'Switch troncal Rack 01 Data Center', 'usr-admin'],
    ['item-007', 'prod-dell-5440', 'SIV-IT-000007', 'DL-5440-7711', 'Dell', 'Latitude 5440', 'dept-it', 'loc-it-lab', null, 'EN_REVISION', 'AVERIADO', '2024-08-12', '2024-08-15', 'Dell Centroamérica', 1150.00, 1250.00, 150.00, 'USD', '2027-08-12', 'FAC-2024-7411', 'OC-IT-062', 'Reportada falla de teclado y celda de batería inflada', 'usr-admin'],
    ['item-008', 'prod-sil-erg', 'SIV-ADM-000008', 'SC-ERG-301', 'Steelcase', 'Series 1', 'dept-adm', 'loc-adm-of2', 'usr-subadmin', 'ASIGNADO', 'BUENO', '2025-01-20', '2025-01-25', 'Mobiliario Corporativo', 350.00, 390.00, 50.00, 'USD', '2030-01-20', 'FAC-2025-0041', 'OC-ADM-012', 'Asignada a Gerencia de Administración', 'usr-admin'],
    ['item-009', 'prod-len-t14', 'SIV-PROD-000009', 'LN-T14-7721', 'Lenovo', 'ThinkPad T14', 'dept-prod', 'loc-prod-l2', null, 'DADO_DE_BAJA', 'DANADO', '2024-03-10', '2024-03-15', 'Lenovo Enterprise', 1200.00, 1380.00, 0.00, 'USD', '2027-03-10', 'FAC-2024-3120', 'OC-PROD-110', 'Baja por daño severo en placa tras derrame de lubricante', 'usr-admin'],
  ];
  for (const i of items) {
    db.run("INSERT OR REPLACE INTO inventory_items (id, product_id, permanent_code, serial_number, brand, model, current_department_id, current_location_id, current_assigned_user_id, operational_status, physical_condition, purchase_date, reception_date, supplier, purchase_price, replacement_value, residual_value, currency, warranty_expiration, invoice_number, purchase_order, notes, registered_by_user_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", i);
  }

  // 7. Existencias de Consumibles
  const stocks = [
    ['stk-001', 'prod-cbl-utp', 'dept-bod', 'loc-bod-ra', 2, 'LOTE-2025-01', 125.00, null], // Alerta: 2 cajas
    ['stk-002', 'prod-cbl-patch', 'dept-bod', 'loc-bod-ra', 14, 'LOTE-2025-02', 4.50, null], // Alerta: 14 unidades
    ['stk-003', 'prod-con-rj45', 'dept-bod', 'loc-bod-ra', 18, 'LOTE-2025-03', 22.00, null],
    ['stk-004', 'prod-mou-log', 'dept-bod', 'loc-bod-rb', 22, 'LOTE-2025-04', 12.00, null],
    ['stk-005', 'prod-tec-log', 'dept-bod', 'loc-bod-rb', 19, 'LOTE-2025-05', 14.50, null],
    ['stk-006', 'prod-cin-emb', 'dept-bod', 'loc-bod-ra', 6, 'LOTE-2025-06', 3.20, null], // Alerta: 6 rollos
    ['stk-007', 'prod-gua-nit', 'dept-bod', 'loc-bod-ra', 25, 'LOTE-2025-07', 11.50, '2028-12-31'],
  ];
  for (const s of stocks) {
    db.run("INSERT OR REPLACE INTO consumable_stocks (id, product_id, department_id, location_id, quantity, batch_number, unit_cost, expiration_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?)", s);
  }

  // 8. Asignaciones con códigos estructurados AM-2026-CBLE-001
  const assignments = [
    ['asg-001', 'AM-2026-LAPD-001', 'item-001', 'prod-dell-5440', 1, 'usr-morales', 'usr-admin', 'dept-it', 'dept-it', 'dept-it', '2026-01-15 08:30:00', null, null, null, null, 'ACTIVA', 'Equipo principal asignado'],
    ['asg-002', 'AM-2026-MOND-001', 'item-004', 'prod-mon-27', 1, 'usr-morales', 'usr-admin', 'dept-it', 'dept-it', 'dept-it', '2026-01-15 08:35:00', null, null, null, null, 'ACTIVA', 'Monitor complementario'],
    ['asg-003', 'BC-2026-LENT-001', 'item-003', 'prod-len-t14', 1, 'usr-castaneda', 'usr-admin', 'dept-it', 'dept-prod', 'dept-prod', '2026-02-01 09:15:00', null, null, null, null, 'ACTIVA', 'Equipo asignado para control de línea de producción'],
    ['asg-004', 'CM-2026-SIL-001', 'item-008', 'prod-sil-erg', 1, 'usr-subadmin', 'usr-admin', 'dept-bod', 'dept-adm', 'dept-adm', '2026-01-22 14:00:00', null, null, null, null, 'ACTIVA', 'Mobiliario asignado'],
    // Historial de asignación previa devuelta
    ['asg-005', 'AM-2025-MOU-012', null, 'prod-mou-log', 1, 'usr-morales', 'usr-admin', 'dept-bod', 'dept-it', 'dept-it', '2025-06-10 10:00:00', '2025-12-15 17:00:00', '2025-12-15 16:30:00', 'BUENO', 'Devuelto por cambio de estación de trabajo', 'DEVUELTO', 'Préstamo temporal finalizado'],
  ];
  for (const a of assignments) {
    db.run("INSERT OR REPLACE INTO assignments (id, assignment_code, item_id, product_id, quantity, user_id, assigned_by_user_id, origin_department_id, target_department_id, charged_department_id, assigned_at, expected_return_date, returned_at, return_condition, return_notes, status, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", a);
  }

  // 9. Movimientos (Kardex)
  const movements = [
    ['mov-001', 'RECEPCION', 'item-001', 'prod-dell-5440', 1, 1150.00, 1150.00, null, 'dept-it', null, 'usr-admin', 'Recepción de compra inicial Laptops Dell', 'FAC-2025-9981', 'usr-admin', '2025-02-18 10:00:00'],
    ['mov-002', 'ASIGNACION', 'item-001', 'prod-dell-5440', 1, null, null, 'dept-it', 'dept-it', 'usr-admin', 'usr-morales', 'Asignación a especialista técnico', 'AM-2026-LAPD-001', 'usr-admin', '2026-01-15 08:30:00'],
    ['mov-003', 'ENTRADA', null, 'prod-cbl-utp', 5, 125.00, 625.00, null, 'dept-bod', null, 'usr-jefe-bod', 'Ingreso por compra de bobinas de red', 'FAC-2026-014', 'usr-jefe-bod', '2026-02-10 11:20:00'],
    ['mov-004', 'CONSUMO', null, 'prod-cbl-utp', 3, 125.00, 375.00, 'dept-bod', 'dept-prod', 'usr-jefe-bod', 'usr-castaneda', 'Tendido de red para sensores Nave 1', 'VALE-REQ-44', 'usr-jefe-bod', '2026-03-05 14:10:00'],
    ['mov-005', 'REPARACION', 'item-007', 'prod-dell-5440', 1, 0, 0, 'dept-it', 'dept-it', 'usr-morales', null, 'Ingreso a laboratorio para diagnóstico por batería', 'TK-MNT-2026-08', 'usr-morales', '2026-03-20 09:00:00'],
    ['mov-006', 'BAJA', 'item-009', 'prod-len-t14', 1, 1200.00, 1200.00, 'dept-prod', null, 'usr-jefe-prod', null, 'Baja por pérdida total en derrame de químicos', 'ACTA-BAJA-2024-03', 'usr-admin', '2024-03-22 16:00:00'],
  ];
  for (const m of movements) {
    db.run("INSERT OR REPLACE INTO inventory_movements (id, movement_type, item_id, product_id, quantity, unit_cost, total_cost, from_department_id, to_department_id, from_user_id, to_user_id, reason, reference_code, user_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", m);
  }

  // 10. Mantenimiento y Averías
  const maintenance = [
    ['mnt-001', 'item-007', '2026-03-20 09:00:00', 'usr-morales', 'Falla de teclado (teclas espaciadora y shift pegadas) y batería no retiene carga superior al 15%', 'MODERADA', 'Dell Support Partner El Salvador', 160.00, 'dept-it', 'EN_REPARACION', null, null],
    ['mnt-002', 'item-006', '2025-10-12 11:30:00', 'usr-admin', 'Ventilador 2 del chasis con exceso de ruido y alerta térmica en consola', 'LEVE', 'Cisco Certified Specialist', 85.00, 'dept-it', 'REPARADO', '2025-10-15 15:00:00', 'Reemplazo preventivo de ventilador modular y limpieza con aire seco'],
  ];
  for (const mt of maintenance) {
    db.run("INSERT OR REPLACE INTO maintenance_records (id, item_id, reported_date, reported_by_user_id, fault_description, severity, technician_supplier, repair_cost, charged_department_id, status, resolved_date, resolution_notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", mt);
  }

  // 11. Servicios Digitales y Licencias
  const services = [
    ['srv-001', 'Microsoft 365 Business Standard', 'OFIMATICA', 'Microsoft El Salvador', 'dept-it', 'dept-adm', 'EMPRESARIAL', 'USUARIOS', 75, 72, 'ANUAL', 9450.00, 787.50, 'USD', '2025-11-01', '2026-11-01', '2026-10-25', 'SI', 'ACTIVA', 'Tarjeta Corporativa BAC *4421', 'INV-MS-99412', 'Todos los usuarios administrativos y jefaturas', 'Suite completa Teams, Exchange, OneDrive'],
    ['srv-002', 'Adobe Creative Cloud All Apps', 'DISENO', 'Adobe Systems', 'dept-it', 'dept-vta', 'PRO', 'USUARIOS', 5, 5, 'MENSUAL', 420.00, 420.00, 'USD', '2026-01-10', '2026-10-22', '2026-10-22', 'SI', 'ACTIVA', 'Tarjeta BAC *4421', 'INV-AD-2026-10', 'Equipo de mercadeo y diseño industrial', 'Alerta vencimiento en 12 días'],
    ['srv-003', 'Canva Pro Equipos', 'DISENO', 'Canva Pty Ltd', 'dept-rrhh', 'dept-rrhh', 'EQUIPO', 'USUARIOS', 10, 8, 'ANUAL', 300.00, 25.00, 'USD', '2025-10-15', '2026-10-15', '2026-10-15', 'SI', 'ACTIVA', 'Transferencia BAC', 'INV-CNV-4412', 'Comunicaciones internas y RRHH', 'Alerta vencimiento en 5 días'],
    ['srv-004', 'AWS Cloud Infrastructure', 'NUBE', 'Amazon Web Services', 'dept-it', 'dept-it', 'PAYG', 'SERVICIOS', 1, 1, 'MENSUAL', 1850.00, 1850.00, 'USD', '2026-01-01', '2026-11-01', '2026-11-01', 'SI', 'ACTIVA', 'Tarjeta BAC *4421', 'INV-AWS-882190', 'Bases de datos ERP y respaldos remotos', 'Consumo mensual aproximado variable'],
    ['srv-005', 'Dominio Oficial sivarstock.com', 'DOMINIO_HOSTING', 'Namecheap Inc.', 'dept-it', 'dept-it', 'DOMINIO', 'DOMINIO', 1, 1, 'ANUAL', 18.00, 1.50, 'USD', '2025-11-24', '2026-11-24', '2026-11-24', 'SI', 'ACTIVA', 'PayPal Corp', 'NC-994112', 'Dominio corporativo con DNS Cloudflare', 'Renovación automática activada'],
    ['srv-006', 'Bitdefender GravityZone Security', 'SEGURIDAD', 'Bitdefender', 'dept-it', 'dept-it', 'BUSINESS', 'DISPOSITIVOS', 100, 88, 'ANUAL', 1600.00, 133.33, 'USD', '2026-03-01', '2027-03-01', '2027-02-25', 'SI', 'ACTIVA', 'Cheque BAC 008129', 'FAC-BIT-4019', 'Protección endpoint para estaciones y servidores', 'Licencia multi-dispositivo'],
    ['srv-007', 'Visual Studio Code & Git', 'HERRAMIENTAS', 'Open Source', 'dept-it', 'dept-it', 'COMMUNITY', 'ILIMITADA', 10, 10, 'GRATUITO', 0.00, 0.00, 'USD', '2024-01-01', null, null, 'NO', 'GRATUITA', null, null, 'Desarrolladores y equipo técnico IT', 'Herramientas de código abierto'],
  ];
  for (const s of services) {
    db.run("INSERT OR REPLACE INTO digital_services (id, name, category, provider, responsible_department_id, charged_department_id, plan_type, license_type, seats_contracted, seats_used, cost_period, amount, monthly_equivalent_cost, currency, start_date, expiration_date, renewal_date, auto_renew, status, payment_method_ref, invoice_number, assigned_users_text, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", s);
  }

  // 12. Registros de Costos con multi-dimensión de áreas
  const costs = [
    ['cst-001', 'item-001', 'prod-dell-5440', null, 'ADQUISICION', 'Compra de Laptop Dell Latitude 5440', 1150.00, 149.50, 0.00, 1299.50, 'USD', 1.0, '2025-02-15', 'dept-it', 'dept-it', 'dept-it', 'dept-adm', 'dept-it', 'Dell Centroamérica', 'FAC-2025-9981', 'OC-IT-101', 'CC-100', 'PAGADO', 'Costo imputado a IT con presupuesto aprobado de Adm', 'usr-admin'],
    ['cst-002', 'item-006', 'prod-sw-cisco', null, 'ADQUISICION', 'Adquisición de Switch Cisco 2960X para Data Center', 1850.00, 240.50, 0.00, 2090.50, 'USD', 1.0, '2024-11-05', 'dept-it', 'dept-it', 'dept-it', 'dept-it', 'dept-it', 'Cisco Systems', 'FAC-2024-8742', 'OC-IT-089', 'CC-100', 'PAGADO', 'Renovación de infraestructura de red', 'usr-admin'],
    ['cst-003', null, 'prod-cbl-utp', null, 'OPERATIVO', 'Suministro de 5 bobinas de red UTP Cat6', 625.00, 81.25, 0.00, 706.25, 'USD', 1.0, '2026-02-10', 'dept-it', 'dept-bod', 'dept-bod', 'dept-it', 'dept-prod', 'ElectroRedes S.A.', 'FAC-2026-014', 'OC-BOD-045', 'CC-200', 'PAGADO', 'Gasto originado por Bodega pero cargado al presupuesto de Producción', 'usr-jefe-bod'],
    ['cst-004', null, null, 'srv-001', 'LICENCIA_SUSCRIPCION', 'Renovación Anual Microsoft 365 75 Licencias', 9450.00, 0.00, 0.00, 9450.00, 'USD', 1.0, '2025-11-01', 'dept-it', 'dept-adm', 'dept-it', 'dept-adm', 'dept-adm', 'Microsoft El Salvador', 'INV-MS-99412', 'OC-ADM-220', 'CC-300', 'PAGADO', 'Costo cargado al presupuesto general de Administración', 'usr-admin'],
    ['cst-005', 'item-007', 'prod-dell-5440', null, 'MANTENIMIENTO', 'Servicio Técnico Autorizado y Reemplazo de Repuestos', 160.00, 20.80, 0.00, 180.80, 'USD', 1.0, '2026-03-22', 'dept-it', 'dept-it', 'dept-it', 'dept-it', 'dept-it', 'Dell Support Partner', 'FAC-SRV-102', 'OT-IT-44', 'CC-100', 'REGISTRADO', 'Cotización aprobada para reparación de teclado y batería', 'usr-morales'],
  ];
  for (const cs of costs) {
    db.run("INSERT OR REPLACE INTO cost_records (id, item_id, product_id, digital_service_id, cost_nature, concept, amount, tax_amount, discount_amount, total_amount, currency, exchange_rate, expense_date, requesting_department_id, originating_department_id, recording_department_id, budget_department_id, charged_department_id, supplier, invoice_number, purchase_order, cost_center, status, notes, recorded_by_user_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", cs);
  }

  // 13. Campos Personalizados de Costos
  const customFields = [
    ['fld-cc-sec', 'centro_costo_secundario', 'Centro de Costos Secundario', 'Código para reporte financiero analítico', 'TEXT', 0, '[]', '["INVENTARIO","COSTOS"]', '[]', 1, 1, 1, 1, 1, 1],
    ['fld-sap-ord', 'codigo_orden_sap', 'Código de Orden SAP / ERP', 'Referencia cruzada con el sistema contable corporativo', 'TEXT', 0, '[]', '["COSTOS"]', '[]', 1, 1, 1, 1, 2, 1],
    ['fld-deprec', 'tasa_depreciacion_anual', 'Tasa Depreciación Anual (%)', 'Porcentaje estimado de depreciación contable', 'PERCENTAGE', 0, '[]', '["INVENTARIO","COSTOS"]', '["cat-comp","cat-red","cat-mob"]', 1, 1, 1, 1, 3, 1],
    ['fld-leasing', 'es_activo_arrendado', '¿Activo bajo Leasing?', 'Indica si el activo es propio o en modalidad de renta financiera', 'BOOLEAN', 0, '[]', '["INVENTARIO"]', '[]', 1, 1, 1, 1, 4, 1],
    ['fld-fisc', 'clasificacion_fiscal', 'Clasificación Fiscal', 'Categoría de deducción contable según ley tributaria', 'SELECT', 0, '["Gasto Operativo Deducible","Activo Fijo Depreciable","Activo Intangible Amortizable","Costo Directo de Fabricación"]', '["COSTOS"]', '[]', 1, 1, 1, 1, 5, 1],
  ];
  for (const cf of customFields) {
    db.run("INSERT OR REPLACE INTO custom_cost_fields (id, field_key, name, description, field_type, is_required, options_json, applicable_modules_json, applicable_categories_json, visible_in_forms, visible_in_queries, visible_in_exports, visible_in_reports, display_order, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", cf);
  }

  // 14. Reportes Personalizados Preconfigurados
  const savedReports = [
    ['rep-001', 'Valor registrado de los activos de IT al día de hoy', 'Listado de equipos individuales pertenecientes al área de Tecnología con sus costos de adquisición y reposición', 'INVENTARIO', '["permanent_code","product_name","brand","model","operational_status","purchase_price","replacement_value"]', '[{"field":"department_id","operator":"eq","value":"dept-it"}]', 'operational_status', 'purchase_price', 'DESC', 'TABLE', 'ALL', '["ADMIN","SUBADMIN","AREA_MANAGER","VIEWER"]', 'usr-admin'],
    ['rep-002', 'Costos originados por Bodega e imputados a otras áreas', 'Análisis de suministros y cables despachados desde bodega con cargo a producción o administración', 'COSTOS', '["concept","amount","total_amount","originating_dept_name","charged_dept_name","expense_date"]', '[{"field":"originating_department_id","operator":"eq","value":"dept-bod"}]', 'charged_dept_name', 'total_amount', 'DESC', 'BAR_CHART', 'THIS_YEAR', '["ADMIN","SUBADMIN","AREA_MANAGER"]', 'usr-admin'],
    ['rep-003', 'Materiales consumibles con stock inferior al mínimo', 'Monitoreo de suministros en estado crítico que requieren orden de compra inmediata', 'INVENTARIO', '["code","name","current_stock","min_stock","target_stock","unit_of_measure","default_supplier"]', '[{"field":"is_consumable","operator":"eq","value":1}]', null, 'current_stock', 'ASC', 'CARDS', 'ALL', '["ADMIN","SUBADMIN","AREA_MANAGER"]', 'usr-admin'],
    ['rep-004', 'Licencias y servicios digitales próximos a vencer (30 días)', 'Control preventivo de renovaciones contractuales y cobros automáticos de plataformas SaaS', 'SERVICIOS', '["name","provider","cost_period","amount","monthly_equivalent_cost","expiration_date","auto_renew","status"]', '[{"field":"status","operator":"eq","value":"ACTIVA"}]', null, 'expiration_date', 'ASC', 'TABLE', 'NEXT_30_DAYS', '["ADMIN","SUBADMIN"]', 'usr-admin'],
  ];
  for (const sr of savedReports) {
    db.run("INSERT OR REPLACE INTO custom_reports (id, name, description, module, columns_json, filters_json, group_by, sort_by, sort_direction, visualization_type, date_range_preset, allowed_roles_json, created_by_user_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", sr);
  }

  // 15. Auditoría Inicial
  const auditLogs = [
    ['aud-001', 'usr-admin', 'admin', 'ADMIN', 'SEMBRADO_INICIAL', 'SISTEMA', 'database', 'SivarStock DB', null, JSON.stringify({ version: '1.0.0', status: 'ready' }), 'Inicialización de datos maestros del sistema', '127.0.0.1'],
    ['aud-002', 'usr-admin', 'admin', 'ADMIN', 'ASIGNACION', 'INVENTARIO', 'item-001', 'SIV-IT-000001', null, JSON.stringify({ assignedTo: 'amorales', code: 'AM-2026-LAPD-001' }), 'Entrega de equipo para soporte técnico', '192.168.1.10'],
    ['aud-003', 'usr-morales', 'amorales', 'VIEWER', 'REPORTE_FALLA', 'MANTENIMIENTO', 'item-007', 'SIV-IT-000007', null, JSON.stringify({ issue: 'Batería inflada y teclado' }), 'Ingreso a laboratorio de mantenimiento', '192.168.1.15'],
  ];
  for (const al of auditLogs) {
    db.run("INSERT OR REPLACE INTO audit_logs (id, user_id, username, user_role, action, module, entity_id, entity_name, before_state_json, after_state_json, reason, ip_address) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", al);
  }

  // 16. Configuraciones del Sistema
  const settings = [
    ['company_name', 'SivarStock Manufactura S.A. (Guatemala)', 'Nombre de la razón social de la empresa'],
    ['primary_currency', 'GTQ', 'Moneda principal de visualización (Quetzales de Guatemala)'],
    ['currency_symbol', 'Q', 'Símbolo monetario oficial'],
    ['country', 'Guatemala', 'País de operación principal'],
    ['timezone', 'America/Guatemala', 'Zona horaria para correlativos y fechas (Guatemala)'],
    ['rule_permanent_code', 'SIV-{DEPT}-{SEQ:6}', 'Patrón para identificadores inmutables de activos'],
    ['rule_assignment_code', '{INITIALS}-{YEAR}-{PROD}-{SEQ:3}', 'Patrón para códigos de entrega'],
    ['alert_expiry_thresholds', '30,15,7', 'Días de anticipación para alertas de servicios digitales'],
    ['demo_mode_active', '1', 'Modo demostración con datos de muestra identificados'],
  ];
  for (const st of settings) {
    db.run("INSERT OR REPLACE INTO system_settings (key, value, description) VALUES (?, ?, ?)", st);
  }

  saveDb();
  console.log('Sembrado completado con éxito. Base de datos lista.');
}
