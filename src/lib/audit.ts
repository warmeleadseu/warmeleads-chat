import { createServerClient } from './supabase';

export type AuditAction =
  | 'create_lead'
  | 'update_lead'
  | 'delete_lead'
  | 'create_customer'
  | 'update_customer'
  | 'delete_customer'
  | 'create_batch'
  | 'update_batch'
  | 'delete_batch'
  | 'login'
  | 'logout'
  | 'export_leads'
  | 'import_leads'
  | 'distribute_leads'
  | 'create_target'
  | 'update_target'
  | 'delete_target'
  | 'update_settings'
  | (string & {});

export interface AuditEntry {
  adminId?: string | null;
  adminName?: string | null;
  action: AuditAction;
  entityType: string;
  entityId?: string | null;
  details?: Record<string, unknown>;
  ipAddress?: string | null;
}

export async function logAudit(entry: AuditEntry): Promise<void> {
  try {
    const supabase = createServerClient();

    const { error } = await supabase.from('audit_log').insert({
      admin_id: entry.adminId ?? null,
      admin_name: entry.adminName ?? null,
      action: entry.action,
      entity_type: entry.entityType,
      entity_id: entry.entityId ?? null,
      details: entry.details ?? {},
      ip_address: entry.ipAddress ?? null,
    });

    if (error) {
      console.error('[audit] insert failed:', error.message);
    }
  } catch (err) {
    console.error('[audit] unexpected error:', err);
  }
}
