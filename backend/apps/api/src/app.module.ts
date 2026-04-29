import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { AuthController } from './controllers/auth.controller';
import { AdminEveningController } from './controllers/admin-evening.controller';
import { AfterDarkController } from './controllers/after-dark.controller';
import { ChatsController } from './controllers/chats.controller';
import { CommunitiesController } from './controllers/communities.controller';
import { DatingController } from './controllers/dating.controller';
import { EveningController } from './controllers/evening.controller';
import { EventsController } from './controllers/events.controller';
import { HealthController } from './controllers/health.controller';
import { HostController } from './controllers/host.controller';
import { InternalTelegramController } from './controllers/internal-telegram.controller';
import { MatchesController } from './controllers/matches.controller';
import { MediaController } from './controllers/media.controller';
import { NotificationsController } from './controllers/notifications.controller';
import { OnboardingController } from './controllers/onboarding.controller';
import { PeopleController } from './controllers/people.controller';
import { PostersController } from './controllers/posters.controller';
import { ProfileController } from './controllers/profile.controller';
import { SafetyController } from './controllers/safety.controller';
import { SettingsController } from './controllers/settings.controller';
import { SharesController } from './controllers/shares.controller';
import { StoriesController } from './controllers/stories.controller';
import { SubscriptionController } from './controllers/subscription.controller';
import { UploadsController } from './controllers/uploads.controller';
import { VerificationController } from './controllers/verification.controller';
import { ApiExceptionFilter } from './common/api-exception.filter';
import { AuthGuard } from './common/auth.guard';
import { AdminTokenGuard } from './common/admin-token.guard';
import { RequestContextMiddleware } from './common/request-context.middleware';
import { AuthService } from './services/auth.service';
import { AdminVenueService } from './services/admin-venue.service';
import { AfterDarkService } from './services/after-dark.service';
import { ChatsService } from './services/chats.service';
import { CommunitiesService } from './services/communities.service';
import { DatingService } from './services/dating.service';
import { EveningAnalyticsService } from './services/evening-analytics.service';
import { EveningRouteTemplateService } from './services/evening-route-template.service';
import { EveningService } from './services/evening.service';
import { EventsService } from './services/events.service';
import { HostService } from './services/host.service';
import { MatchesService } from './services/matches.service';
import { MediaService } from './services/media.service';
import { NotificationsService } from './services/notifications.service';
import { OnboardingService } from './services/onboarding.service';
import { PeopleService } from './services/people.service';
import { PostersService } from './services/posters.service';
import { PrismaService } from './services/prisma.service';
import { ProfileService } from './services/profile.service';
import { SafetyService } from './services/safety.service';
import { SettingsService } from './services/settings.service';
import { SharesService } from './services/shares.service';
import { SocialAuthService } from './services/social-auth.service';
import { SocialIdentityVerifier } from './services/social-identity-verifier.service';
import { StoriesService } from './services/stories.service';
import { TelegramAuthService } from './services/telegram-auth.service';
import { PhoneOtpService } from './services/phone-otp.service';
import { SubscriptionService } from './services/subscription.service';
import { UploadsService } from './services/uploads.service';
import { VerificationService } from './services/verification.service';

@Module({
  controllers: [
    AdminEveningController,
    AfterDarkController,
    AuthController,
    ChatsController,
    CommunitiesController,
    DatingController,
    EveningController,
    EventsController,
    HealthController,
    HostController,
    InternalTelegramController,
    MatchesController,
    MediaController,
    NotificationsController,
    OnboardingController,
    PeopleController,
    PostersController,
    ProfileController,
    SafetyController,
    SettingsController,
    SharesController,
    StoriesController,
    SubscriptionController,
    UploadsController,
    VerificationController,
  ],
  providers: [
    AdminTokenGuard,
    AdminVenueService,
    AfterDarkService,
    AuthService,
    ChatsService,
    CommunitiesService,
    DatingService,
    EveningAnalyticsService,
    EveningRouteTemplateService,
    EveningService,
    EventsService,
    HostService,
    MatchesService,
    MediaService,
    NotificationsService,
    OnboardingService,
    PeopleService,
    PhoneOtpService,
    PostersService,
    PrismaService,
    ProfileService,
    SafetyService,
    SettingsService,
    SharesService,
    SocialAuthService,
    SocialIdentityVerifier,
    StoriesService,
    TelegramAuthService,
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
