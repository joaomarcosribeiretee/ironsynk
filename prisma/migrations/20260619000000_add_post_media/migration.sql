-- Add structured carousel media to Post (imageUrls/videoUrl retained for backward compatibility)
ALTER TABLE "Post" ADD COLUMN "media" JSONB;
