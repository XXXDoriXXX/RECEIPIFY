import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@src/prisma';
import { UpdateUserDto } from '@src/dto';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        fullName: true,
        avatarUrl: true,
        currencyCode: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async updateProfile(userId: string, dto: UpdateUserDto) {
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        fullName: dto.fullName,
        currencyCode: dto.currencyCode,
        avatarUrl: dto.avatarUrl,
      },
      select: {
        id: true,
        email: true,
        fullName: true,
        avatarUrl: true,
        currencyCode: true,
        updatedAt: true,
      },
    });
  }
}
