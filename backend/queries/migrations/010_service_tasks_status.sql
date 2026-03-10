-- Migration 010: Update constraints for maintenance_requests to include pending_admin_review

ALTER TABLE maintenance_requests DROP CONSTRAINT IF EXISTS maintenance_requests_status_check;

ALTER TABLE maintenance_requests 
  ADD CONSTRAINT maintenance_requests_status_check 
  CHECK (status IN ('pending', 'pending_admin_review', 'assigned', 'in_progress', 'completed'));
