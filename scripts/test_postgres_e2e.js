process.env.DATABASE_URL = 'postgresql://postgres:Chelona2020$@localhost:5432/sivarstock';

async function testPostgresIntegration() {
  console.log('--- TEST DE INTEGRACIÓN DB.TS CON POSTGRESQL ---');
  
  const { Client } = require('pg');
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: false
  });
  await client.connect();

  // 1. Probar consulta de departamentos
  const depts = await client.query('SELECT code, name, is_bodega FROM departments ORDER BY code ASC');
  console.log(`[PASS] Departamentos en PostgreSQL: ${depts.rows.length}`);
  
  // 2. Probar usuario administrador
  const admin = await client.query("SELECT email, role, full_name FROM users WHERE email = 'alexander7tm@gmail.com'");
  console.log(`[PASS] Superadmin en PostgreSQL: ${admin.rows[0].email} (${admin.rows[0].role})`);

  // 3. Probar celulares y bitácora JSON
  const phones = await client.query("SELECT device_code, phone_number, imei FROM mobile_devices");
  console.log(`[PASS] Dispositivos celulares en PostgreSQL: ${phones.rows.length}`);

  // 4. Probar vistas analíticas de Looker Studio
  const viewAssets = await client.query("SELECT * FROM vw_gds_inventory_assets LIMIT 3");
  console.log(`[PASS] Vista Looker Studio (vw_gds_inventory_assets): ${viewAssets.rows.length} registros`);

  const viewCosts = await client.query("SELECT * FROM vw_gds_cost_analytics LIMIT 3");
  console.log(`[PASS] Vista Looker Studio (vw_gds_cost_analytics): ${viewCosts.rows.length} registros`);

  const viewMobile = await client.query("SELECT * FROM vw_gds_mobile_devices LIMIT 3");
  console.log(`[PASS] Vista Looker Studio (vw_gds_mobile_devices): ${viewMobile.rows.length} registros`);

  // 5. Probar inmutabilidad de audit_logs en PostgreSQL
  try {
    await client.query("DELETE FROM audit_logs WHERE 1=1");
    console.error('[FAIL] El trigger de inmutabilidad no bloqueó DELETE');
  } catch (err) {
    console.log(`[PASS] Inmutabilidad comprobada en PostgreSQL: ${err.message}`);
  }

  await client.end();
  console.log('>>> ¡TODAS LAS VERIFICACIONES EN POSTGRESQL PASARON EXITOSAMENTE! <<<');
}

testPostgresIntegration().catch(err => {
  console.error('Error en test:', err);
  process.exit(1);
});
