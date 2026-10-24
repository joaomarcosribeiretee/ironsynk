-- Social feed read paths (Phase 5 / MVP).
--
-- Purely additive: no column or constraint changes, only the indexes the
-- feed, post detail, follow lists and notification list query on.
--
--   Post          — "newest first", globally and per author
--   Like          — like count / "did I like this" per post
--   Comment       — comment list and count per post, oldest first
--   Follow        — "who follows X" (the composite PK already covers "who X follows")
--   Notification  — a user's list, newest first, and the unread badge count

CREATE INDEX "Post_createdAt_idx" ON "Post"("createdAt");
CREATE INDEX "Post_userId_createdAt_idx" ON "Post"("userId", "createdAt");

CREATE INDEX "Like_postId_idx" ON "Like"("postId");

CREATE INDEX "Comment_postId_createdAt_idx" ON "Comment"("postId", "createdAt");

CREATE INDEX "Follow_followingId_idx" ON "Follow"("followingId");

CREATE INDEX "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt");
CREATE INDEX "Notification_userId_isRead_idx" ON "Notification"("userId", "isRead");
