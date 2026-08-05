export interface AuditEvent {
  at: string;
  actor: string;
  action: string;
  details?: string;
}

export interface EntityBase {
  id: string;
  name: string;
  description?: string;
  ownerId?: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  version: number;
  tags: string[];
  auditTrail: AuditEvent[];
  externalRef?: string;
}
