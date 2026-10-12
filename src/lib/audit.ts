import { run } from './db';

export interface AuditEntry {
  userId?: string | null;
  username: string;
  userRole: string;
  action: string;
  module: string;
  entityId?: string | null;
  entityName?: string | null;
  beforeState?: any;
  afterState?: any;
  reason?: string | null;
  ipAddress?: string | null;
}

export async function logAudit(entry: AuditEntry): Promise<void> {
  try {
    const id = `aud-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const beforeJson = entry.beforeState ? JSON.stringify(entry.beforeState) : null;
    const afterJson = entry.afterState ? JSON.stringify(entry.afterState) : null;

    await run(
      `INSERT INTO audit_logs (
        id, user_id, username, user_role, action, module, 
        entity_id, entity_name, before_state_json, after_state_json, 
        reason, ip_address, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
      [
        id,
        entry.userId || null,
        entry.username || 'SISTEMA',
        entry.userRole || 'SISTEMA',
        entry.action,
        entry.module,
        entry.entityId || null,
        entry.entityName || null,
        beforeJson,
        afterJson,
        entry.reason || null,
        entry.ipAddress || '127.0.0.1'
      ]
    );
  } catch (error) {
    console.error('Error al registrar auditoría:', error);
  }
}
