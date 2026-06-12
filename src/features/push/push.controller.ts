import {
  Body,
  Controller,
  Delete,
  Post,
  UseGuards,
  ValidationPipe,
} from '@nestjs/common';
import { IsString, IsObject, ValidateNested, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '../../shared/guards/auth.guard';
import { AuthorizeGuard } from '../../shared/guards/authorization.guard';
import { AuthorizeRoles } from '../../shared/decorators/authorize-roles.decorator';
import { CurrentUser } from '../../shared/decorators/current-user.decorators';
import { UserRoles } from '../../shared/common/user-roles.enum';
import { PushService, PushPayload } from './push.service';
import { ApiResponse } from '../../shared/responses/api-response';

class PushKeysDto {
  @IsString() p256dh!: string;
  @IsString() auth!: string;
}

class SubscribeDto {
  @IsString() endpoint!: string;
  @IsObject() @ValidateNested() @Type(() => PushKeysDto) keys!: PushKeysDto;
}

class UnsubscribeDto {
  @IsString() endpoint!: string;
}

class BroadcastDto {
  @IsString() title!: string;
  @IsString() body!: string;
  @IsString() @IsOptional() url?: string;
}

@ApiTags('Push')
@ApiBearerAuth()
@Controller('push')
export class PushController {
  constructor(private readonly pushService: PushService) {}

  @UseGuards(AuthGuard)
  @Post('subscribe')
  async subscribe(
    @Body(ValidationPipe) dto: SubscribeDto,
    @CurrentUser() currentUser: any,
  ) {
    const userId = currentUser?.data?._id?.toString();
    if (!userId) return ApiResponse.unauthorized('Non authentifié');
    await this.pushService.subscribe(dto, userId);
    return ApiResponse.success('Souscription enregistrée');
  }

  @UseGuards(AuthGuard)
  @Post('unsubscribe')
  async unsubscribe(
    @Body(ValidationPipe) dto: UnsubscribeDto,
    @CurrentUser() currentUser: any,
  ) {
    const userId = currentUser?.data?._id?.toString();
    if (!userId) return ApiResponse.unauthorized('Non authentifié');
    await this.pushService.unsubscribe(dto.endpoint, userId);
    return ApiResponse.success('Souscription supprimée');
  }

  // Diffusion manuelle (admin) — utile pour tester ou pour des annonces globales.
  @AuthorizeRoles(UserRoles.ADMIN)
  @UseGuards(AuthGuard, AuthorizeGuard)
  @Post('broadcast')
  async broadcast(@Body(ValidationPipe) dto: BroadcastDto) {
    await this.pushService.sendToAll(dto as PushPayload);
    return ApiResponse.success('Notification diffusée');
  }
}
