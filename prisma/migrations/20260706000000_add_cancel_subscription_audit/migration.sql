-- Add CANCEL_SUBSCRIPTION value to the AuditAction enum
-- (used by POST /api/subscriptions/cancel to keep billing cancellations audited)
ALTER TYPE "AuditAction" ADD VALUE 'CANCEL_SUBSCRIPTION';
