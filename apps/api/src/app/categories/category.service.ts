import { Injectable } from '@nestjs/common';
import { PrismaService } from '@src/prisma';
import { CreateCategoryDto } from '@src/dto';

@Injectable()
export class CategoryService {
  constructor(private readonly prisma: PrismaService) {}

  async getCategories(userId: string) {
    return this.prisma.category.findMany({
      where: {
        OR: [{ isSystem: true }, { userId }],
      },
      orderBy: [{ isSystem: 'desc' }, { name: 'asc' }],
    });
  }

  async createCategory(userId: string, dto: CreateCategoryDto) {
    return this.prisma.category.create({
      data: {
        userId,
        name: dto.name,
        colorHex: dto.colorHex,
        iconSlug: dto.iconSlug,
        isSystem: false,
      },
    });
  }
}
