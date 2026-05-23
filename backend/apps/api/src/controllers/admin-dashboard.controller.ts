import { Controller, Get } from '@nestjs/common';
import { Admin } from '../common/admin.decorator';
import { AdminDashboardService } from '../services/admin-dashboard.service';

@Admin()
@Controller('admin/dashboard')
export class AdminDashboardController {
  constructor(private readonly adminDashboardService: AdminDashboardService) {}

  @Get()
  getDashboard() {
    return this.adminDashboardService.getDashboard();
  }
}
