import 'multer';
import {ConflictException, Injectable, Logger, UnauthorizedException} from '@nestjs/common';
import {PrismaService} from "@src/prisma";
import {RegisterDto, LoginDto} from "@src/dto";
import {JwtService} from "@nestjs/jwt";
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService
  ) {}

  async register(dto: RegisterDto) {
    this.logger.log(`Attempting to register new user: ${dto.email}`);
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email },
    })
    if (existingUser) {
      throw new ConflictException('User already exists');
    }
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(dto.password, salt);

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
    this.logger.log(`Attempting to login user: ${dto.email}`);

    const user = await this.prisma.user.findUnique({
      where: {email: dto.email},
    })
    if (!user) {
      this.logger.warn(`Login failed: User not found - ${dto.email}`);
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isPasswordValid) {
      this.logger.warn(`Login failed: Invalid password - ${dto.email}`);
      throw new UnauthorizedException('Invalid credentials');
    }

    const payload = {sub: user.id, email: user.email};
    this.logger.log(`Login successful, generating JWT token: ${dto.email}`);
    return {
      accessToken: await this.jwtService.signAsync(payload),
    }
  }

}
