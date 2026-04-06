import { Body, Controller, Get, Post, UseGuards, UsePipes } from '@nestjs/common';
import { CategoryService } from './category.service';
import { JwtAuthGuard } from '@src/guards';
import { CurrentUser } from '@src/decorators';
import { ZodValidationPipe } from '@src/pipes';
import { CreateCategoryDto, CreateCategorySchema } from '@src/dto';
@Controller('categories')
@UseGuards(JwtAuthGuard)
export class CategoryController {
  constructor(private readonly categoryService: CategoryService) {}

  @Get()
  async getCategories(@CurrentUser('id') userId: string) {
    return this.categoryService.getCategories(userId);
  }

  @Post()
  async createCategory(
    @CurrentUser('id') userId: string,
    @Body(new ZodValidationPipe(CreateCategorySchema)) dto: CreateCategoryDto
  ) {
    return this.categoryService.createCategory(userId, dto);
  }
}
