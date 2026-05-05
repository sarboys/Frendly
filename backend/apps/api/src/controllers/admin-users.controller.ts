import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { Admin } from '../common/admin.decorator';
import { AdminUsersService } from '../services/admin-users.service';

@Admin()
@Controller('admin/users')
export class AdminUsersController {
  constructor(private readonly adminUsersService: AdminUsersService) {}

  @Get()
  listUsers(@Query() query: Record<string, unknown>) {
    return this.adminUsersService.listUsers(query);
  }

  @Get(':userId')
  getUser(@Param('userId') userId: string) {
    return this.adminUsersService.getUser(userId);
  }

  @Patch(':userId/profile')
  updateProfile(
    @Param('userId') userId: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.adminUsersService.updateProfile(userId, body);
  }

  @Post(':userId/verify')
  verifyUser(@Param('userId') userId: string) {
    return this.adminUsersService.verifyUser(userId);
  }

  @Post(':userId/unverify')
  unverifyUser(@Param('userId') userId: string) {
    return this.adminUsersService.unverifyUser(userId);
  }

  @Post(':userId/suspend')
  suspendUser(
    @Param('userId') userId: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.adminUsersService.suspendUser(userId, body);
  }

  @Post(':userId/unsuspend')
  unsuspendUser(@Param('userId') userId: string) {
    return this.adminUsersService.unsuspendUser(userId);
  }

  @Post(':userId/revoke-sessions')
  revokeSessions(@Param('userId') userId: string) {
    return this.adminUsersService.revokeSessions(userId);
  }

  @Get(':userId/meetups')
  listUserMeetups(
    @Param('userId') userId: string,
    @Query() query: Record<string, unknown>,
  ) {
    return this.adminUsersService.listUserMeetups(userId, query);
  }

  @Get(':userId/reports')
  listUserReports(
    @Param('userId') userId: string,
    @Query() query: Record<string, unknown>,
  ) {
    return this.adminUsersService.listUserReports(userId, query);
  }

  @Get(':userId/audit')
  listUserAudit(
    @Param('userId') userId: string,
    @Query() query: Record<string, unknown>,
  ) {
    return this.adminUsersService.listUserAudit(userId, query);
  }
}
