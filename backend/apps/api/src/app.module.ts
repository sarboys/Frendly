import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { AuthController } from './controllers/auth.controller';
import { ChatsController } from './controllers/chats.controller';
import { EventsController } from './controllers/events.controller';
import { HealthController } from './controllers/health.controller';
import { HostController } from './controllers/host.controller';
import { MatchesController } from './controllers/matches.controller';
import { NotificationsController } from './controllers/notifications.controller';
import { OnboardingController } from './controllers/onboarding.controller';
import { PeopleController } from './controllers/people.controller';
import { ProfileController } from './controllers/profile.controller';
import { SafetyController } from './controllers/safety.controller';
import { SettingsController } from './controllers/settings.controller';
import { StoriesController } from './controllers/stories.controller';
import { SubscriptionController } from './controllers/subscription.controller';
import { UploadsController } from './controllers/uploads.controller';
import { VerificationController } from './controllers/verification.controller';
import { ApiExceptionFilter } from './common/api-exception.filter';
import { AuthGuard } from './common/auth.guard';
import { RequestContextMiddleware } from './common/request-context.middleware';
import { AuthService } from './services/auth.service';
import { ChatsService } from './services/chats.service';
import { EventsService } from './services/events.service';
import { HostService } from './services/host.service';
import { MatchesService } from './services/matches.service';
import { NotificationsService } from './services/notifications.service';
import { OnboardingService } from './services/onboarding.service';
import { PeopleService } from './services/people.service';
import { PrismaService } from './services/prisma.service';
import { ProfileService } from './services/profile.service';
import { SafetyService } from './services/safety.service';
import { SettingsService } from './services/settings.service';
import { StoriesService } from './services/stories.service';
import { SubscriptionService } from './services/subscription.service';
import { UploadsService } from './services/uploads.service';
import { VerificationService } from './services/verification.service';

@Module({
  controllers: [
    AuthController,
    ChatsController,
    EventsController,
    HealthController,
    HostController,
    MatchesController,
    NotificationsController,
    OnboardingController,
    PeopleController,
    ProfileController,
    SafetyController,
    SettingsController,
    StoriesController,
    SubscriptionController,
    UploadsController,
    VerificationController,
  ],
  providers: [
    AuthService,
    ChatsService,
    EventsService,
    HostService,
    MatchesService,
    NotificationsService,
    OnboardingService,
    PeopleService,
    PrismaService,
    ProfileService,
    SafetyService,
    SettingsService,
    StoriesService,
    SubscriptionService,
    UploadsService,
    VerificationService,
    {
      provide: APP_FILTER,
      useClass: ApiExceptionFilter,
    },
    {
      provide: APP_GUARD,
      useClass: AuthGuard,
    },
  ],
})
export class ApiAppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestContextMiddleware).forRoutes('*');
  }
}
