import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
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
  ) {
    return this.chatsService.listChats(currentUser.userId, 'meetup', {
      cursor,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Get('personal')
  listPersonalChats(
    @CurrentUser() currentUser: { userId: string },
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    return this.chatsService.listChats(currentUser.userId, 'direct', {
      cursor,
      limit: limit ? Number(limit) : undefined,
    });
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
}
