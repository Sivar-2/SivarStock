const http = require('http');

function request(options, body) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: data,
        });
      });
    });
    req.on('error', reject);
    if (body) {
      req.write(typeof body === 'string' ? body : JSON.stringify(body));
    }
    req.end();
  });
}

async function verifyAllPages() {
  console.log('--- INICIANDO VERIFICACIÓN DE PÁGINAS Y VISTAS DE INTERFAZ ---');

  // Login para obtener sesión
  const loginRes = await request(
    {
      hostname: '127.0.0.1',
      port: 3000,
      path: '/api/auth/login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    },
    { username: 'turcosivar', password: '12345679' }
  );

  const setCookie = loginRes.headers['set-cookie'];
  const cookieStr = Array.isArray(setCookie) ? setCookie.map((c) => c.split(';')[0]).join('; ') : '';
  const headers = { Cookie: cookieStr };

  const pages = [
    { name: 'Dashboard Principal', path: '/' },
    { name: 'Bodega (Inventario Físico)', path: '/inventario' },
    { name: 'Celulares y Líneas', path: '/celulares' },
    { name: 'Categorías y Productos', path: '/productos' },
    { name: 'Entradas y Movimientos', path: '/movimientos' },
    { name: 'Asignaciones y Actas', path: '/asignaciones' },
    { name: 'Averías y Mantenimiento', path: '/mantenimiento' },
    { name: 'Licencias y Contratos', path: '/servicios-digitales' },
    { name: 'Costos y Facturas', path: '/costos' },
    { name: 'Reportes y Métricas 360', path: '/reportes' },
    { name: 'Áreas y Empleados', path: '/departamentos' },
    { name: 'Usuarios y Permisos', path: '/usuarios' },
    { name: 'Bitácora de Auditoría', path: '/auditoria' },
    { name: 'Configuración del Sistema', path: '/configuracion' },
  ];

  let hasErrors = false;
  for (const page of pages) {
    const res = await request({
      hostname: '127.0.0.1',
      port: 3000,
      path: page.path,
      method: 'GET',
      headers,
    });

    if (res.statusCode === 200) {
      console.log(`✓ Página ${page.name} [${page.path}] -> HTTP 200 OK`);
    } else {
      console.error(`✗ Página ${page.name} [${page.path}] -> Error ${res.statusCode}`);
      hasErrors = true;
    }
  }

  // Verificar vista pública de acta
  const actasRes = await request({
    hostname: '127.0.0.1',
    port: 3000,
    path: '/api/actas',
    method: 'GET',
    headers,
  });
  let firstActaId = null;
  try {
    const json = JSON.parse(actasRes.body);
    if (json.actas && json.actas.length > 0) {
      firstActaId = json.actas[0].id;
    }
  } catch {}

  if (firstActaId) {
    const actaPageRes = await request({
      hostname: '127.0.0.1',
      port: 3000,
      path: `/acta/${firstActaId}`,
      method: 'GET',
    });
    if (actaPageRes.statusCode === 200) {
      console.log(`✓ Vista Pública / WhatsApp / Imprimir Acta [/acta/${firstActaId}] -> HTTP 200 OK`);
    } else {
      console.error(`✗ Vista Pública de Acta [/acta/${firstActaId}] -> Error ${actaPageRes.statusCode}`);
      hasErrors = true;
    }
  }

  if (hasErrors) {
    console.error('Se detectaron errores en una o más páginas.');
    process.exit(1);
  } else {
    console.log('\n--- TODAS LAS PÁGINAS Y VISTAS ESTÁN 100% OPERATIVAS ---');
  }
}

verifyAllPages().catch(console.error);
