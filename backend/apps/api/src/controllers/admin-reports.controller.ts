import { Body, Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { Admin } from '../common/admin.decorator';
import { AdminReportsService } from '../services/admin-reports.service';

@Admin()
@Controller('admin/reports')
export class AdminReportsController {
  constructor(private readonly adminReportsService: AdminReportsService) {}

  @Get()
  listReports(@Query() query: Record<string, unknown>) {
    return this.adminReportsService.listReports(query);
  }

  @Get(':reportId')
  getReport(@Param('reportId') reportId: string) {
    return this.adminReportsService.getReport(reportId);
  }

  @Patch(':reportId')
  updateReport(
    @Param('reportId') reportId: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.adminReportsService.updateReport(reportId, body);
  }
}
