import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { AuthController } from './controllers/auth.controller';
import { AdminAuthController } from './controllers/admin-auth.controller';
import { AdminEveningController } from './controllers/admin-evening.controller';
import { AdminPartnerAccountsController } from './controllers/admin-partner-accounts.controller';
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
import { PartnerAuthController } from './controllers/partner-auth.controller';
import { PartnerPortalController } from './controllers/partner-portal.controller';
import { PostersController } from './controllers/posters.controller';
import { ProfileController } from './controllers/profile.controller';
import { PublicCodeController } from './controllers/public-code.controller';
import { SafetyController } from './controllers/safety.controller';
import { SearchController } from './controllers/search.controller';
import { SettingsController } from './controllers/settings.controller';
import { SharesController } from './controllers/shares.controller';
import { StoriesController } from './controllers/stories.controller';
import { SubscriptionController } from './controllers/subscription.controller';
import { UploadsController } from './controllers/uploads.controller';
import { VerificationController } from './controllers/verification.controller';
import { ApiExceptionFilter } from './common/api-exception.filter';
import { AdminAuditInterceptor } from './common/admin-audit.interceptor';
import { AuthGuard } from './common/auth.guard';
import { AdminTokenGuard } from './common/admin-token.guard';
import { PartnerAuthGuard } from './common/partner-auth.guard';
import { RequestContextMiddleware } from './common/request-context.middleware';
import { AuthService } from './services/auth.service';
import { AdminAuthService } from './services/admin-auth.service';
import { AdminEveningAnalyticsService } from './services/admin-evening-analytics.service';
import { AdminEveningAiService } from './services/admin-evening-ai.service';
import { AdminEveningRouteService } from './services/admin-evening-route.service';
import { AdminVenueService } from './services/admin-venue.service';
import { AfterDarkService } from './services/after-dark.service';
import { ChatsService } from './services/chats.service';
import { CommunitiesService } from './services/communities.service';
import { DatingService } from './services/dating.service';
import { EveningAnalyticsService } from './services/evening-analytics.service';
import { EveningRouteAiCandidatesService } from './services/evening-route-ai-candidates.service';
import { EveningRouteAiValidatorService } from './services/evening-route-ai-validator.service';
import { EveningRouteTemplateService } from './services/evening-route-template.service';
import { EveningService } from './services/evening.service';
import { EventsService } from './services/events.service';
import { HostService } from './services/host.service';
import { MatchesService } from './services/matches.service';
import { MediaService } from './services/media.service';
import { NotificationsService } from './services/notifications.service';
import { OnboardingService } from './services/onboarding.service';
import { OpenRouterService } from './services/openrouter.service';
import { PeopleService } from './services/people.service';
import { PartnerAuthService } from './services/partner-auth.service';
import { PartnerOfferCodeService } from './services/partner-offer-code.service';
import { PartnerPortalService } from './services/partner-portal.service';
import { PostersService } from './services/posters.service';
import { PrismaService } from './services/prisma.service';
import { ProfileService } from './services/profile.service';
import { SafetyService } from './services/safety.service';
import { SearchService } from './services/search.service';
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
    AdminAuthController,
    AdminPartnerAccountsController,
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
    PartnerAuthController,
    PartnerPortalController,
    PostersController,
    ProfileController,
    PublicCodeController,
    SafetyController,
    SearchController,
    SettingsController,
    SharesController,
    StoriesController,
    SubscriptionController,
    UploadsController,
    VerificationController,
  ],
  providers: [
    AdminTokenGuard,
    AdminAuditInterceptor,
    PartnerAuthGuard,
    AdminEveningAnalyticsService,
    AdminEveningAiService,
    AdminEveningRouteService,
    AdminVenueService,
    AfterDarkService,
    AdminAuthService,
    AuthService,
    ChatsService,
    CommunitiesService,
    DatingService,
    EveningAnalyticsService,
    EveningRouteAiCandidatesService,
    EveningRouteAiValidatorService,
    EveningRouteTemplateService,
    EveningService,
    EventsService,
    HostService,
    MatchesService,
    MediaService,
    NotificationsService,
    OnboardingService,
    OpenRouterService,
    PeopleService,
    PartnerAuthService,
    PartnerOfferCodeService,
    PartnerPortalService,
    PhoneOtpService,
    PostersService,
    PrismaService,
    ProfileService,
    SafetyService,
    SearchService,
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
