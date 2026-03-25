import {ConflictException, Injectable} from '@nestjs/common';
import {PrismaService} from "@src/prisma";
import {RegisterDto} from "@src/dto";
import * as bcrypt from 'bcrypt';
import {InjectPinoLogger, PinoLogger} from "nestjs-pino";

@Injectable()
export class AuthService {
  constructor(
    @InjectPinoLogger(AuthService.name) private readonly logger: PinoLogger,
    private readonly prisma: PrismaService
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

}
