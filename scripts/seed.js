const path = require('path');
const fs = require('fs');
const initSqlJs = require('sql.js');
const bcrypt = require('bcryptjs');

async function main() {
  const wasmPath = path.resolve(__dirname, '..', 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm');
  const SQL = await initSqlJs({
    locateFile: () => wasmPath
  });

  const dbDir = path.resolve(__dirname, '..', 'data');
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  const dbFile = path.resolve(dbDir, 'sivarstock.db');
  let db;

  const schemaPath = path.resolve(__dirname, '..', 'src', 'lib', 'schema.sql');
  const schemaSql = fs.readFileSync(schemaPath, 'utf8');

  db = new SQL.Database();
  db.run(schemaSql);

  console.log('Schema inicial aplicado correctamente.');

  // Importar seed logic
  // Ejecutamos el seed
  const { runSeed } = require('../dist_seed/seed.js');
}

// Para ejecutar directamente en Node sin transpilar TS, creamos el script JS directo
