import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
  ValidationPipe,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CouponsService } from './coupons.service';
import { CreateCouponDto } from './dto/create-coupon.dto';
import { UpdateCouponDto } from './dto/update-coupon.dto';
import { AuthGuard } from '../../shared/guards/auth.guard';
import { AuthorizeGuard } from '../../shared/guards/authorization.guard';
import { AuthorizeRoles } from '../../shared/decorators/authorize-roles.decorator';
import { UserRoles } from '../../shared/common/user-roles.enum';
import { QueryDto } from '../../shared/dto/query.dto';

@ApiTags('Coupons')
@Controller('coupons')
export class CouponsController {
  constructor(private readonly couponsService: CouponsService) {}

  // Validation d'un code promo (panier) : public, rate-limité pour éviter le
  // brute-force de codes.
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post('validate')
  validate(@Body() body: { code: string; amount: number }) {
    return this.couponsService.validateForResponse(
      body?.code,
      Number(body?.amount) || 0,
    );
  }

  // ── Administration ──
  @ApiBearerAuth()
  @AuthorizeRoles(UserRoles.ADMIN)
  @UseGuards(AuthGuard, AuthorizeGuard)
  @Post()
  create(@Body(ValidationPipe) dto: CreateCouponDto) {
    return this.couponsService.create(dto);
  }

  @ApiBearerAuth()
  @AuthorizeRoles(UserRoles.ADMIN)
  @UseGuards(AuthGuard, AuthorizeGuard)
  @Get()
  findAll(@Query() queryDto: QueryDto) {
    return this.couponsService.findAll(queryDto);
  }

  @ApiBearerAuth()
  @AuthorizeRoles(UserRoles.ADMIN)
  @UseGuards(AuthGuard, AuthorizeGuard)
  @Patch(':id')
  update(@Param('id') id: string, @Body(ValidationPipe) dto: UpdateCouponDto) {
    return this.couponsService.update(id, dto);
  }

  @ApiBearerAuth()
  @AuthorizeRoles(UserRoles.ADMIN)
  @UseGuards(AuthGuard, AuthorizeGuard)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.couponsService.remove(id);
  }
}
