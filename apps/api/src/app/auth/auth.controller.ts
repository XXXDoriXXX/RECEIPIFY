import {Body, Controller, Get, Post, UseGuards, UsePipes} from '@nestjs/common';
import {AuthService} from "./auth.service";
import {LoginDto, LoginSchema, RegisterDto, RegisterSchema} from "@src/dto";
import { ZodValidationPipe } from '@src/pipes';
import {JwtAuthGuard} from "@src/guards";
import {CurrentUser} from "@src/decorators";
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getProfile(@CurrentUser() user: { id: string, email: string }) {
    return user;
  }

  @Post('register')
  async register(
    @Body(new ZodValidationPipe(RegisterSchema)) dto: RegisterDto
  ) {
    return this.authService.register(dto);
  }

  @Post('login')
  async login(
    @Body(new ZodValidationPipe(LoginSchema)) dto: LoginDto
  ) {
    return this.authService.login(dto);
  }
}
