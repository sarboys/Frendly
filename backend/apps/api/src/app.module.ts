import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { AuthController } from './controllers/auth.controller';
import { AdminAfficheController } from './controllers/admin-affiche.controller';
import { AdminAppOverlaysController } from './controllers/admin-app-overlays.controller';
import { AdminCommunitiesController } from './controllers/admin-communities.controller';
import { AdminDashboardController } from './controllers/admin-dashboard.controller';
import { AdminAuthController } from './controllers/admin-auth.controller';
import { AdminDropsController } from './controllers/admin-drops.controller';
import { AdminEveningController } from './controllers/admin-evening.controller';
import { AdminMeetupsController } from './controllers/admin-meetups.controller';
import { AdminPartnerAccountsController } from './controllers/admin-partner-accounts.controller';
import { AdminReportsController } from './controllers/admin-reports.controller';
import { AdminSubscriptionSettingsController } from './controllers/admin-subscription-settings.controller';
import { AdminUsersController } from './controllers/admin-users.controller';
import { AdminVerificationController } from './controllers/admin-verification.controller';
import { AfficheClientGeoController } from './controllers/affiche-client-geo.controller';
import { AfficheController } from './controllers/affiche.controller';
import { AfterDarkController } from './controllers/after-dark.controller';
import { AppOverlayController } from './controllers/app-overlay.controller';
import { ChatsController } from './controllers/chats.controller';
import { CheckoutController } from './controllers/checkout.controller';
import { CommunitiesController } from './controllers/communities.controller';
import { DatingController } from './controllers/dating.controller';
import { DropsController } from './controllers/drops.controller';
import { EveningController } from './controllers/evening.controller';
import { EventsController } from './controllers/events.controller';
import { HealthController } from './controllers/health.controller';
import { HostController } from './controllers/host.controller';
import { InternalTelegramController } from './controllers/internal-telegram.controller';
import { MatchesController } from './controllers/matches.controller';
import { MediaController } from './controllers/media.controller';
import { MetricsController } from './controllers/metrics.controller';
import { NotificationsController } from './controllers/notifications.controller';
import { OnboardingController } from './controllers/onboarding.controller';
import { PeopleController } from './controllers/people.controller';
import { PartnerAuthController } from './controllers/partner-auth.controller';
import { PartnerPortalController } from './controllers/partner-portal.controller';
import { PaymentsController } from './controllers/payments.controller';
import { PlacesController } from './controllers/places.controller';
import { ProfileController } from './controllers/profile.controller';
import { PublicCodeController } from './controllers/public-code.controller';
import { SafetyController } from './controllers/safety.controller';
import { SearchController } from './controllers/search.controller';
import { SettingsController } from './controllers/settings.controller';
import { SharesController } from './controllers/shares.controller';
import { StoriesController } from './controllers/stories.controller';
import { SubscriptionController } from './controllers/subscription.controller';
import { SupportController } from './controllers/support.controller';
import { TokensController } from './controllers/tokens.controller';
import { UploadsController } from './controllers/uploads.controller';
import { VerificationController } from './controllers/verification.controller';
import { ApiExceptionFilter } from './common/api-exception.filter';
import { AdminAuditInterceptor } from './common/admin-audit.interceptor';
import { AuthGuard } from './common/auth.guard';
import { AdminTokenGuard } from './common/admin-token.guard';
import { PartnerAuthGuard } from './common/partner-auth.guard';
import { RequestContextMiddleware } from './common/request-context.middleware';
import { AuthService } from './services/auth.service';
import { AdminAfficheService } from './services/admin-affiche.service';
import { AdminCommunitiesService } from './services/admin-communities.service';
import { AdminDashboardService } from './services/admin-dashboard.service';
import { AdminAuthService } from './services/admin-auth.service';
import { AdminEveningAnalyticsService } from './services/admin-evening-analytics.service';
import { AdminEveningAiService } from './services/admin-evening-ai.service';
import { AdminEveningRouteService } from './services/admin-evening-route.service';
import { AdminMeetupsService } from './services/admin-meetups.service';
import { AdminReportsService } from './services/admin-reports.service';
import { AdminRouteReviewService } from './services/admin-route-review.service';
import { AdminUsersService } from './services/admin-users.service';
import { AdminVenueService } from './services/admin-venue.service';
import { AfficheService } from './services/affiche.service';
import { AfterDarkService } from './services/after-dark.service';
import { AppOverlayService } from './services/app-overlay.service';
import { AppleInAppPurchaseService } from './services/apple-in-app-purchase.service';
import { ChatsService } from './services/chats.service';
import { CheckoutService } from './services/checkout.service';
import { CommunitiesService } from './services/communities.service';
import { ContentModerationService } from './services/content-moderation.service';
import { DatingService } from './services/dating.service';
import { DropsDrawService } from './services/drops-draw.service';
import { DropsRewardService } from './services/drops-reward.service';
import { DropsService } from './services/drops.service';
import { EveningAnalyticsService } from './services/evening-analytics.service';
import { EveningAiDraftService } from './services/evening-ai-draft.service';
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
import { PaymentsService } from './services/payments.service';
import { PlacesService } from './services/places.service';
import { PrismaService } from './services/prisma.service';
import { ProfileService } from './services/profile.service';
import { RedisCacheService } from './services/redis-cache.service';
import { SafetyService } from './services/safety.service';
import { SearchService } from './services/search.service';
import { SettingsService } from './services/settings.service';
import { SharesService } from './services/shares.service';
import { SocialAuthService } from './services/social-auth.service';
import { SocialIdentityVerifier } from './services/social-identity-verifier.service';
import { StoriesService } from './services/stories.service';
import { SupportService } from './services/support.service';
import { TelegramAuthService } from './services/telegram-auth.service';
import { PhoneOtpService } from './services/phone-otp.service';
import { SubscriptionService } from './services/subscription.service';
import { TbankAcquiringService } from './services/tbank-acquiring.service';
import { TokensService } from './services/tokens.service';
import { UploadsService } from './services/uploads.service';
import { VerificationService } from './services/verification.service';
import { VenueGeocoderService } from './services/venue-geocoder.service';

@Module({
  controllers: [
    AdminAfficheController,
    AdminAppOverlaysController,
    AdminCommunitiesController,
    AdminDashboardController,
    AdminEveningController,
    AdminMeetupsController,
    AdminAuthController,
    AdminDropsController,
    AdminPartnerAccountsController,
    AdminReportsController,
    AdminSubscriptionSettingsController,
    AdminUsersController,
    AdminVerificationController,
    AfficheClientGeoController,
    AfficheController,
    AfterDarkController,
    AppOverlayController,
    AuthController,
    ChatsController,
    CheckoutController,
    CommunitiesController,
    DatingController,
    DropsController,
    EveningController,
    EventsController,
    HealthController,
    HostController,
    InternalTelegramController,
    MatchesController,
    MediaController,
    MetricsController,
    NotificationsController,
    OnboardingController,
    PeopleController,
    PartnerAuthController,
    PartnerPortalController,
    PaymentsController,
    PlacesController,
    ProfileController,
    PublicCodeController,
    SafetyController,
    SearchController,
    SettingsController,
    SharesController,
    StoriesController,
    SubscriptionController,
    SupportController,
    TokensController,
    UploadsController,
    VerificationController,
  ],
  providers: [
    AdminTokenGuard,
    AdminAuditInterceptor,
    PartnerAuthGuard,
    AdminAfficheService,
    AdminCommunitiesService,
    AdminDashboardService,
    AdminEveningAnalyticsService,
    AdminEveningAiService,
    AdminEveningRouteService,
    AdminMeetupsService,
    AdminReportsService,
    AdminRouteReviewService,
    AdminUsersService,
    AdminVenueService,
    AfficheService,
    AfterDarkService,
    AppOverlayService,
    AppleInAppPurchaseService,
    AdminAuthService,
    AuthService,
    ChatsService,
    CheckoutService,
    CommunitiesService,
    ContentModerationService,
    DatingService,
    DropsDrawService,
    DropsRewardService,
    DropsService,
    EveningAnalyticsService,
    EveningAiDraftService,
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
    PaymentsService,
    PlacesService,
    PhoneOtpService,
    PrismaService,
    ProfileService,
    RedisCacheService,
    SafetyService,
    SearchService,
    SettingsService,
    SharesService,
    SocialAuthService,
    SocialIdentityVerifier,
    StoriesService,
    SupportService,
    TelegramAuthService,
    SubscriptionService,
    TbankAcquiringService,
    TokensService,
    UploadsService,
    VerificationService,
    VenueGeocoderService,
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
