import { Body, Controller, Post, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { CurrentUser } from '../common/current-user.decorator';
import {
  MAX_CHAT_ATTACHMENT_UPLOAD_BYTES,
  UploadsService,
} from '../services/uploads.service';

@Controller('uploads')
export class UploadsController {
  constructor(private readonly uploadsService: UploadsService) {}

  @Post('chat-attachment/upload-url')
  createChatAttachmentUpload(@CurrentUser() currentUser: { userId: string }, @Body() body: Record<string, unknown>) {
    return this.uploadsService.createChatAttachmentUpload(currentUser.userId, body);
  }

  @Post('chat-attachment/complete')
  completeChatAttachmentUpload(@CurrentUser() currentUser: { userId: string }, @Body() body: Record<string, unknown>) {
    return this.uploadsService.completeChatAttachmentUpload(currentUser.userId, body);
  }

  @Post('chat-attachment/file')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        fileSize: MAX_CHAT_ATTACHMENT_UPLOAD_BYTES + 5 * 1024 * 1024,
      },
    }),
  )
  uploadChatAttachmentFile(
    @CurrentUser() currentUser: { userId: string },
    @UploadedFile() file: Express.Multer.File,
    @Body() body: Record<string, unknown>,
  ) {
    return this.uploadsService.uploadChatAttachmentFile(
      currentUser.userId,
      body,
      file,
    );
  }
}
