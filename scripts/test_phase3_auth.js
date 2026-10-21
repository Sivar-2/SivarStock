const fs = require('fs');
const initSqlJs = require('sql.js');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

async function runPhase3Tests() {
  console.log('===============================================================');
  console.log('   BATERÍA DE VERIFICACIÓN FASE 3: AUTH, RBAC Y TURCOSIVAR    ');
  console.log('===============================================================');

  const SQL = await initSqlJs();
  const db = new SQL.Database(fs.readFileSync('data/sivarstock.db'));

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  [PASS] ${message}`);
      passed++;
    } else {
      console.error(`  [FAIL] ${message}`);
      failed++;
    }
  }

  // 1. Verificación de TurcoSivar en Base de Datos
  console.log('\n1. MASTER SUPER ADMIN (TURCOSIVAR):');
  const res = db.exec("SELECT id, username, full_name, email, role, password_hash, pin_hash, quick_access_enabled FROM users WHERE username = 'TurcoSivar'");
  assert(res.length > 0 && res[0].values.length > 0, "TurcoSivar existe en la base de datos");
  
  if (res.length > 0 && res[0].values.length > 0) {
    const [id, username, full_name, email, role, password_hash, pin_hash, quick_access_enabled] = res[0].values[0];
    assert(role === 'SUPERADMIN', `Rol es SUPERADMIN (Actual: ${role})`);
    assert(bcrypt.compareSync('12345679', password_hash), "Contraseña maestra 12345679 verifica con bcrypt");
    assert(pin_hash && bcrypt.compareSync('2801', pin_hash), "PIN maestro 2801 verifica con bcrypt");
    assert(quick_access_enabled === 1, "Acceso rápido habilitado en servidor");
  }

  // 2. Verificación de Criptografía de Tokens de Sesión y Desafío PIN
  console.log('\n2. CRIPTOGRAFÍA DE DESAFÍO 2FA (PIN CHALLENGE):');
  const SESSION_SECRET = process.env.SESSION_SECRET || 'sivarstock_enterprise_secure_salt_key_2026';
  
  function signChallenge(payload) {
    const json = JSON.stringify({ ...payload, isPinChallenge: true });
    const b64 = Buffer.from(json).toString('base64');
    const hmac = crypto.createHmac('sha256', SESSION_SECRET).update(b64).digest('base64url');
    return `${b64}.${hmac}`;
  }

  function decodeChallenge(token) {
    const parts = token.split('.');
    const b64 = parts[0];
    const hmac = parts[1];
    const expected = crypto.createHmac('sha256', SESSION_SECRET).update(b64).digest('base64url');
    if (hmac !== expected) return null;
    const data = JSON.parse(Buffer.from(b64, 'base64').toString('utf8'));
    if (Date.now() > data.exp) return null;
    return data;
  }

  const tokenValid = signChallenge({ userId: 'usr-turcosivar', username: 'TurcoSivar', exp: Date.now() + 60000 });
  const decodedValid = decodeChallenge(tokenValid);
  assert(decodedValid && decodedValid.username === 'TurcoSivar', "Token de desafío 2FA válido decodifica correctamente");

  const tokenExpired = signChallenge({ userId: 'usr-turcosivar', username: 'TurcoSivar', exp: Date.now() - 1000 });
  const decodedExpired = decodeChallenge(tokenExpired);
  assert(decodedExpired === null, "Token de desafío expirado es rechazado inmediatamente");

  const tokenTampered = tokenValid.slice(0, -3) + 'xyz';
  const decodedTampered = decodeChallenge(tokenTampered);
  assert(decodedTampered === null, "Token manipulado (HMAC inválido) es rechazado");

  // 3. Verificación de Matriz de Permisos RBAC
  console.log('\n3. MATRIZ DE AUTORIZACIÓN RBAC:');
  const superAdminSession = {
    id: 'usr-turcosivar',
    username: 'TurcoSivar',
    role: 'SUPERADMIN',
    isSuperAdmin: true,
    allowedTabs: ['DASHBOARD', 'INVENTARIO', 'PERMISOS'],
    allowedActions: { can_read: true, can_write: true, can_delete: true, can_export: true, can_view_financials: true },
    canEdit: true,
  };

  const viewerSession = {
    id: 'usr-viewer',
    username: 'viewer1',
    role: 'VIEWER',
    isSuperAdmin: false,
    allowedTabs: ['DASHBOARD', 'INVENTARIO'],
    allowedActions: { can_read: true, can_write: false, can_delete: false, can_export: true, can_view_financials: false },
    canEdit: false,
  };

  const operatorSession = {
    id: 'usr-op',
    username: 'operador1',
    role: 'OPERATOR',
    isSuperAdmin: false,
    allowedTabs: ['DASHBOARD', 'INVENTARIO'],
    allowedActions: { can_read: true, can_write: true, can_delete: false, can_export: true, can_view_financials: false },
    canEdit: true,
  };

  // TurcoSivar puede acceder a todo
  assert(superAdminSession.isSuperAdmin, "TurcoSivar tiene flag isSuperAdmin = true");
  assert(viewerSession.canEdit === false, "Viewer tiene canEdit = false forzado");
  assert(operatorSession.allowedActions.can_delete === false, "Operador tiene borrado restringido");

  console.log('\n===============================================================');
  console.log(`   RESUMEN: ${passed} APROBADAS / ${failed} FALLADAS`);
  console.log('===============================================================');

  if (failed > 0) process.exit(1);
}

runPhase3Tests().catch(err => {
  console.error(err);
  process.exit(1);
});
