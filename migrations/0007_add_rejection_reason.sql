-- Add rejectionReason column to partnership_removal_requests
ALTER TABLE "partnership_removal_requests" ADD COLUMN "rejection_reason" text;
