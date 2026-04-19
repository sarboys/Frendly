import { Injectable } from '@nestjs/common';
import { ApiError } from '../common/api-error';
import { PrismaService } from './prisma.service';

@Injectable()
export class StoriesService {
  constructor(private readonly prismaService: PrismaService) {}

  async listStories(userId: string, eventId: string) {
    await this.assertParticipant(userId, eventId);

    const stories = await this.prismaService.client.eventStory.findMany({
      where: { eventId },
      include: {
        author: {
          include: { profile: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    return stories.map((story) => ({
      id: story.id,
      eventId: story.eventId,
      authorId: story.authorId,
      authorName: story.author.displayName,
      avatarUrl: story.author.profile?.avatarUrl ?? null,
      caption: story.caption,
      emoji: story.emoji,
      createdAt: story.createdAt.toISOString(),
    }));
  }

  async createStory(userId: string, eventId: string, body: Record<string, unknown>) {
    await this.assertParticipant(userId, eventId);

    const caption = typeof body.caption === 'string' ? body.caption.trim() : '';
    const emoji = typeof body.emoji === 'string' ? body.emoji : '✨';

    if (caption.length === 0) {
      throw new ApiError(400, 'invalid_story_caption', 'caption is required');
    }

    const story = await this.prismaService.client.eventStory.create({
      data: {
        eventId,
        authorId: userId,
        caption,
        emoji,
      },
    });

    return {
      id: story.id,
      eventId: story.eventId,
      authorId: story.authorId,
      caption: story.caption,
      emoji: story.emoji,
      createdAt: story.createdAt.toISOString(),
    };
  }

  private async assertParticipant(userId: string, eventId: string) {
    const participant = await this.prismaService.client.eventParticipant.findUnique({
      where: {
        eventId_userId: {
          eventId,
          userId,
        },
      },
    });

    if (!participant) {
      throw new ApiError(403, 'event_forbidden', 'You are not a participant of this event');
    }
  }
}
