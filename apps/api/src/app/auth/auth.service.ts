import {ConflictException, Injectable, UnauthorizedException} from '@nestjs/common';
import {PrismaService} from "@src/prisma";
import {RegisterDto, LoginDto} from "@src/dto";
import * as bcrypt from 'bcrypt';
import {InjectPinoLogger, PinoLogger} from "nestjs-pino";
import {JwtService} from "@nestjs/jwt";

@Injectable()
export class AuthService {
  constructor(
    @InjectPinoLogger(AuthService.name) private readonly logger: PinoLogger,
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService
  ) {}

  async register(dto: RegisterDto) {
    this.logger.info({ email: dto.email }, 'Attempting to register new user');
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email },
    })
    if (existingUser) {
      throw new ConflictException('User already exists');
    }
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(dto.password, salt);[]

    const user = await this.prisma.user.create({
      data:{
        email:dto.email,
        passwordHash:passwordHash,
        fullName:dto.fullName,
      },
      select:{
        id: true,
        email: true,
        fullName: true,
        createdAt: true,
      }
    });
    return user;
  }
  async login(dto:LoginDto) {
    this.logger.info({email: dto.email}, 'Attempting to login user');

    const user = await this.prisma.user.findUnique({
      where: {email: dto.email},
    })
    if (!user) {
      this.logger.warn({email: dto.email}, 'Login failed: User not found');
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isPasswordValid) {
      this.logger.warn({email: dto.email}, 'Login failed: Invalid password');
      throw new UnauthorizedException('Invalid credentials');
    }

    const payload = {sub: user.id, email: user.email};
    this.logger.info({email: dto.email}, 'Login successful, generating JWT token');
    return {
      accessToken: await this.jwtService.signAsync(payload),
    }
  }

}
