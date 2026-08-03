import { Controller, Get, Query, ValidationPipe } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { SearchService } from './search.service';
import { CreateSearchDto } from './dto/create-search.dto';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('Search')
@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  // Endpoint public (recherche catalogue). Limite dediee : l'agregation Mongo
  // sous-jacente est plus couteuse qu'une lecture simple.
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Get()
  async search(
    @Query(new ValidationPipe({ transform: true, whitelist: true }))
    query: CreateSearchDto,
  ) {
    return this.searchService.advancedSearch(query);
  }
}
