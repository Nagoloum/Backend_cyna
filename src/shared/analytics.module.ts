import { Global, Module } from '@nestjs/common';
import { AnalyticsService } from './services/analytics.service';

// Module global : AnalyticsService est injectable partout sans réimport, et
// reste une instance unique (service sans état).
@Global()
@Module({
  providers: [AnalyticsService],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
