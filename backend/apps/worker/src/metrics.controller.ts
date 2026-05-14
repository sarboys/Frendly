import { Controller, Get, Res } from '@nestjs/common';
import { getMetricsContentType, renderAppMetrics } from '@big-break/database';

type MetricsResponse = {
  type: (contentType: string) => void;
};

@Controller('metrics')
export class MetricsController {
  @Get()
  async getMetrics(@Res({ passthrough: true }) response: MetricsResponse) {
    response.type(getMetricsContentType());
    return renderAppMetrics();
  }
}
