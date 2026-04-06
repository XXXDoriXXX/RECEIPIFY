import { Body, Controller, Get, Patch, UseGuards, UsePipes } from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '@src/guards';
import { CurrentUser } from '@src/decorators';
import { UpdateUserDto, UpdateUserSchema } from '@src/dto';
import { ZodValidationPipe } from '@src/pipes';
@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  async getProfile(@CurrentUser('id') userId: string) {
    return this.usersService.getProfile(userId);
  }

  @Patch('me')
  async updateProfile(
    @CurrentUser('id') userId: string,
    @Body(new ZodValidationPipe(UpdateUserSchema)) dto: UpdateUserDto
  ) {
    return this.usersService.updateProfile(userId, dto);
  }
}
