import {Body, Controller, Post, UsePipes} from '@nestjs/common';
import {AuthService} from "./auth.service";
import {RegisterDto, RegisterSchema} from "@src/dto";
import { ZodValidationPipe } from '@src/pipes';
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @UsePipes(new ZodValidationPipe(RegisterSchema))
  async register(@Body() dto: RegisterDto){
    return this.authService.register(dto)
  }
}
