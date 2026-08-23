-- Supabase Storage Bucket Migration Script for info-attachments
-- 1. Create storage bucket 'info-attachments' if not exists
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'info-attachments',
  'info-attachments',
  true,
  10485760, -- 10MB limit
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']
)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 2. Create Public Read Policy for info-attachments
DROP POLICY IF EXISTS "Public Read Access for info-attachments" ON storage.objects;
CREATE POLICY "Public Read Access for info-attachments" ON storage.objects
  FOR SELECT USING (bucket_id = 'info-attachments');

-- 3. Create Public Upload/Insert Policy for info-attachments
DROP POLICY IF EXISTS "Public Insert Access for info-attachments" ON storage.objects;
CREATE POLICY "Public Insert Access for info-attachments" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'info-attachments');
