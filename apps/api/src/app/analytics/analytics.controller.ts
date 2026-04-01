import { Controller, Get, Query, UseGuards, UsePipes } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { JwtAuthGuard } from '@src/guards';
import { CurrentUser } from '@src/decorators';
import { AnalyticsFilterDto, AnalyticsFilterSchema } from '@src/dto';
import { ZodValidationPipe } from '@src/pipes';

@Controller('analytics')
@UseGuards(JwtAuthGuard)
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('dashboard')
  async getDashboardData(
    @CurrentUser('id') userId: string,
    @Query(new ZodValidationPipe(AnalyticsFilterSchema)) query: AnalyticsFilterDto
  ) {
    return this.analyticsService.getDashboardData(userId, query);
  }
}
