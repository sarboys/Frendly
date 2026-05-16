import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { CurrentUser } from '../common/current-user.decorator';
import {
  MAX_PROFILE_ASSET_UPLOAD_BYTES,
  ProfileService,
} from '../services/profile.service';

@Controller('profile')
export class ProfileController {
  constructor(private readonly profileService: ProfileService) {}

  @Get('me')
  getProfile(@CurrentUser() currentUser: { userId: string }) {
    return this.profileService.getProfile(currentUser.userId);
  }

  @Get('me/frendly-season')
  getFrendlySeason(@CurrentUser() currentUser: { userId: string }) {
    return this.profileService.getFrendlySeason(currentUser.userId);
  }

  @Post('me/frendly-season/rewards/:rewardKey/claim')
  claimFrendlySeasonReward(
    @CurrentUser() currentUser: { userId: string },
    @Param('rewardKey') rewardKey: string,
  ) {
    return this.profileService.claimFrendlySeasonReward(
      currentUser.userId,
      rewardKey,
    );
  }

  @Get('me/frendly-history')
  listFrendlyHistory(
    @CurrentUser() currentUser: { userId: string },
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    return this.profileService.listFrendlyHistory(currentUser.userId, {
      cursor,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Get('me/frendly-people')
  listFrendlyPeople(
    @CurrentUser() currentUser: { userId: string },
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    return this.profileService.listFrendlyPeople(currentUser.userId, {
      cursor,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Patch('me')
  updateProfile(@CurrentUser() currentUser: { userId: string }, @Body() body: Record<string, unknown>) {
    return this.profileService.updateProfile(currentUser.userId, body);
  }

  @Post('me/avatar/upload-url')
  getAvatarUploadUrl(@CurrentUser() currentUser: { userId: string }, @Body() body: Record<string, unknown>) {
    return this.profileService.getAvatarUploadUrl(currentUser.userId, body);
  }

  @Post('me/avatar/complete')
  completeAvatarUpload(@CurrentUser() currentUser: { userId: string }, @Body() body: Record<string, unknown>) {
    return this.profileService.completeAvatarUpload(currentUser.userId, body);
  }

  @Post('me/avatar/file')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        fileSize: MAX_PROFILE_ASSET_UPLOAD_BYTES,
      },
    }),
  )
  uploadAvatarFile(
    @CurrentUser() currentUser: { userId: string },
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.profileService.uploadAvatarFile(currentUser.userId, file);
  }

  @Post('me/photos/file')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        fileSize: MAX_PROFILE_ASSET_UPLOAD_BYTES,
      },
    }),
  )
  uploadProfilePhotoFile(
    @CurrentUser() currentUser: { userId: string },
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.profileService.uploadProfilePhotoFile(currentUser.userId, file);
  }

  @Delete('me/photos/:photoId')
  deleteProfilePhoto(
    @CurrentUser() currentUser: { userId: string },
    @Param('photoId') photoId: string,
  ) {
    return this.profileService.deleteProfilePhoto(currentUser.userId, photoId);
  }

  @Post('me/photos/:photoId/primary')
  makePrimaryPhoto(
    @CurrentUser() currentUser: { userId: string },
    @Param('photoId') photoId: string,
  ) {
    return this.profileService.makePrimaryPhoto(currentUser.userId, photoId);
  }

  @Patch('me/photos/order')
  reorderProfilePhotos(
    @CurrentUser() currentUser: { userId: string },
    @Body() body: Record<string, unknown>,
  ) {
    return this.profileService.reorderProfilePhotos(currentUser.userId, body);
  }
}
