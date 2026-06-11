import {
  Controller,
  Get,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  ValidationPipe,
  UseInterceptors,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { AuthorizeRoles } from '../../shared/decorators/authorize-roles.decorator';
import { UserRoles } from '../../shared/common/user-roles.enum';
import { AuthGuard } from '../../shared/guards/auth.guard';
import { AuthorizeGuard } from '../../shared/guards/authorization.guard';
import { CurrentUser } from '../../shared/decorators/current-user.decorators';
import { FormDataTransformPipe } from '../../shared/pipes/formdata-transform.pipe';
import { NoFilesInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { ChangePasswordProfilDto } from './dto/create-user.dto';
@ApiTags('Users')
@ApiBearerAuth()
@Controller('users')
@ApiConsumes('multipart/form-data')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}
  //Afficher Tous les utilisateurs
  @AuthorizeRoles(UserRoles.ADMIN)
  @UseGuards(AuthGuard, AuthorizeGuard)
  @Get()
  findAll() {
    return this.usersService.findAll();
  }

  // Profil accessible uniquement par son propriétaire ou un admin.
  @UseGuards(AuthGuard)
  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() currentUser: any) {
    return this.usersService.findOne(id, currentUser);
  }
  @UseGuards(AuthGuard)
  @Patch('profil/change-password')
  changePassword(
    @Body()
    changePasswordDto: ChangePasswordProfilDto,
    @CurrentUser() currentUser: any,
  ) {
    return this.usersService.changePassword(changePasswordDto, currentUser);
  }

  @UseGuards(AuthGuard)
  @Patch('profil/:id')
  @UseInterceptors(NoFilesInterceptor())
  update(
    @Param('id') id: string,
    @Body(FormDataTransformPipe, ValidationPipe) updateUserDto: UpdateUserDto,
    @CurrentUser() currentUser: any,
  ) {
    return this.usersService.update(id, updateUserDto, currentUser);
  }

  @UseGuards(AuthGuard)
  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() currentUser: any) {
    return this.usersService.remove(id, currentUser);
  }
}
