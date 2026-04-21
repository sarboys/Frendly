ALTER TABLE "Message"
ADD COLUMN "replyToMessageId" TEXT;

ALTER TABLE "Message"
ADD CONSTRAINT "Message_replyToMessageId_fkey"
FOREIGN KEY ("replyToMessageId")
REFERENCES "Message"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "Message_chatId_replyToMessageId_idx"
ON "Message"("chatId", "replyToMessageId");
