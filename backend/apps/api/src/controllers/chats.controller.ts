import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import { CurrentUser } from '../common/current-user.decorator';
import { ChatsService } from '../services/chats.service';

@Controller('chats')
export class ChatsController {
  constructor(private readonly chatsService: ChatsService) {}

  @Get('meetups')
  listMeetupChats(
    @CurrentUser() currentUser: { userId: string },
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
    @Query('includeSocial') includeSocial?: string,
    @Headers('if-none-match') ifNoneMatch?: string,
    @Res({ passthrough: true }) response?: Response,
  ) {
    return this.respondWithChatListCache(
      response,
      this.chatsService.listChatsWithCache(
        currentUser.userId,
        'meetup',
        {
          cursor,
          limit: limit ? Number(limit) : undefined,
          includeSocial: includeSocial !== 'false',
        },
        ifNoneMatch,
      ),
    );
  }

  @Get('personal')
  listPersonalChats(
    @CurrentUser() currentUser: { userId: string },
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
    @Headers('if-none-match') ifNoneMatch?: string,
    @Res({ passthrough: true }) response?: Response,
  ) {
    return this.respondWithChatListCache(
      response,
      this.chatsService.listChatsWithCache(
        currentUser.userId,
        'direct',
        {
          cursor,
          limit: limit ? Number(limit) : undefined,
        },
        ifNoneMatch,
      ),
    );
  }

  @Get(':chatId/messages')
  getMessages(
    @CurrentUser() currentUser: { userId: string },
    @Param('chatId') chatId: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    return this.chatsService.getMessages(currentUser.userId, chatId, {
      cursor,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Post(':chatId/read')
  markRead(
    @CurrentUser() currentUser: { userId: string },
    @Param('chatId') chatId: string,
    @Body() body: { messageId?: string },
  ) {
    return this.chatsService.markRead(currentUser.userId, chatId, body.messageId ?? '');
  }

  @Post(':chatId/pin')
  setPinned(
    @CurrentUser() currentUser: { userId: string },
    @Param('chatId') chatId: string,
    @Body() body: { isPinned?: boolean; pinned?: boolean },
  ) {
    return this.chatsService.setPinned(
      currentUser.userId,
      chatId,
      body.isPinned ?? body.pinned ?? true,
    );
  }

  @Delete(':chatId')
  deleteChat(
    @CurrentUser() currentUser: { userId: string },
    @Param('chatId') chatId: string,
  ) {
    return this.chatsService.deleteChat(currentUser.userId, chatId);
  }

  private async respondWithChatListCache(
    response: Response | undefined,
    resultPromise: ReturnType<ChatsService['listChatsWithCache']>,
  ) {
    const result = await resultPromise;
    response?.setHeader('ETag', result.etag);
    response?.setHeader('Cache-Control', 'private, max-age=0, must-revalidate');
    response?.setHeader('Vary', 'Authorization');

    if ('notModified' in result) {
      response?.status(304).end();
      return;
    }

    return result.response;
  }
}
