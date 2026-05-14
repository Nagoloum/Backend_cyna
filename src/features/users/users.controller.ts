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
import { AuthorizeRoles } from 'src/shared/decorators/authorize-roles.decorator';
import { UserRoles } from 'src/shared/common/user-roles.enum';
import { AuthGuard } from 'src/shared/guards/auth.guard';
import { AuthorizeGuard } from 'src/shared/guards/authorization.guard';
import { CurrentUser } from 'src/shared/decorators/current-user.decorators';
import { FormDataTransformPipe } from 'src/shared/pipes/formdata-transform.pipe';
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

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.usersService.findOne(id);
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
  remove(@Param('id') id: string) {
    return this.usersService.remove(id);
  }
}
