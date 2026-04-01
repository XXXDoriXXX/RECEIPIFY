import { Injectable } from '@nestjs/common';
import { PrismaService } from '@src/prisma';
import { AnalyticsFilterDto } from '@src/dto';

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async getDashboardData(userId: string, filter: AnalyticsFilterDto) {
    const period = filter.period;
    const now = new Date();
    let startDate = new Date(0);

    if (period === 'day') {
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    } else if (period === 'week') {
      startDate = new Date(now);
      startDate.setDate(now.getDate() - now.getDay());
      startDate.setHours(0, 0, 0, 0);
    } else if (period === 'month') {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    } else if (period === 'year') {
      startDate = new Date(now.getFullYear(), 0, 1);
    }

    const whereClause: any = {
      userId,
      deletedAt: null,
    };
    if (period !== 'all') {
      whereClause.purchaseDate = { gte: startDate };
    }
    const totalAgg = await this.prisma.receipt.aggregate({
      where: whereClause,
      _sum: { totalAmount: true },
    });
    const totalExpensesAmount = totalAgg._sum.totalAmount || 0;

    const items = await this.prisma.expenseItem.findMany({
      where: {
        receipt: whereClause,
      },
      include: {
        category: true,
      },
    });

    const categoryMap = new Map<string, { id: string, name: string, colorHex: string, iconSlug: string | null, total: number }>();

    for (const item of items) {
      const cat = item.category;
      const amount = Number(item.amount) * item.quantity;

      if (!categoryMap.has(cat.id)) {
        categoryMap.set(cat.id, {
          id: cat.id,
          name: cat.name,
          colorHex: cat.colorHex,
          iconSlug: cat.iconSlug,
          total: 0,
        });
      }
      categoryMap.get(cat.id)!.total += amount;
    }

    const chartData = Array.from(categoryMap.values()).sort((a, b) => b.total - a.total);

    const timeSeriesData: any[] = [];
    if (period !== 'all') {
      const receipts = await this.prisma.receipt.findMany({
        where: whereClause,
        select: { purchaseDate: true, totalAmount: true },
        orderBy: { purchaseDate: 'asc' }
      });

      const dateMap = new Map<string, number>();
      for (const r of receipts) {
        const dStr = r.purchaseDate.toISOString().split('T')[0];
        const val = Number(r.totalAmount);
        dateMap.set(dStr, (dateMap.get(dStr) || 0) + val);
      }
      for (const [date, total] of dateMap.entries()) {
        timeSeriesData.push({ date, total });
      }
    }

    return {
      period,
      totalExpensesAmount,
      chartData,
      timeSeriesData
    };
  }
}
