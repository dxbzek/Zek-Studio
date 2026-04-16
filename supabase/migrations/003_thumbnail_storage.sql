-- Create public bucket for competitor thumbnails
INSERT INTO storage.buckets (id, name, public)
VALUES ('competitor-thumbnails', 'competitor-thumbnails', true)
ON CONFLICT (id) DO NOTHING;

-- Allow public read
CREATE POLICY "Public read competitor thumbnails"
ON storage.objects FOR SELECT
USING (bucket_id = 'competitor-thumbnails');

-- Allow service role to insert/update/delete
CREATE POLICY "Service role manages competitor thumbnails"
ON storage.objects FOR ALL
USING (bucket_id = 'competitor-thumbnails');
