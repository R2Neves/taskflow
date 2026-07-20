import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Priority, Prisma, TaskStatus, Visibility } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import {
  CreateRecurringDto,
  GenerateMonthDto,
  UpdateRecurringDto,
} from "./dto/recurring.dto";

const TERMINAL_STATUSES: TaskStatus[] = [
  TaskStatus.COMPLETED,
  TaskStatus.CANCELLED,
];

@Injectable()
export class RecurringService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateRecurringDto) {
    this.assertTimeRange(dto.startTime, dto.endTime);
    if (dto.teamId) await this.assertTeamMember(userId, dto.teamId);

    return this.prisma.recurringActivity.create({
      data: {
        ownerId: userId,
        title: dto.title.trim(),
        description: dto.description?.trim(),
        category: dto.category ?? "OUTROS",
        dayOfMonth: dto.dayOfMonth,
        startTime: dto.startTime,
        endTime: dto.endTime,
        priority: (dto.priority as Priority | undefined) ?? Priority.MEDIUM,
        active: dto.active ?? true,
        notes: dto.notes?.trim(),
        teamId: dto.teamId,
      },
      include: this.include,
    });
  }

  async findMine(userId: string) {
    return this.prisma.recurringActivity.findMany({
      where: {
        OR: [
          { ownerId: userId },
          { team: { members: { some: { userId } } } },
        ],
      },
      orderBy: [{ dayOfMonth: "asc" }, { startTime: "asc" }],
      include: this.include,
    });
  }

  async findOne(userId: string, id: string) {
    const item = await this.findAccessible(userId, id);
    return item;
  }

  async update(userId: string, id: string, dto: UpdateRecurringDto) {
    const current = await this.findAccessible(userId, id);
    if (current.ownerId !== userId) {
      throw new ForbiddenException(
        "Somente o proprietário pode editar a atividade recorrente",
      );
    }

    const startTime = dto.startTime ?? current.startTime;
    const endTime = dto.endTime ?? current.endTime;
    this.assertTimeRange(startTime, endTime);

    if (dto.teamId) await this.assertTeamMember(userId, dto.teamId);

    return this.prisma.recurringActivity.update({
      where: { id },
      data: {
        title: dto.title?.trim(),
        description: dto.description?.trim(),
        category: dto.category,
        dayOfMonth: dto.dayOfMonth,
        startTime: dto.startTime,
        endTime: dto.endTime,
        priority: dto.priority as Priority | undefined,
        active: dto.active,
        notes: dto.notes?.trim(),
        teamId: dto.teamId === undefined ? undefined : dto.teamId,
      },
      include: this.include,
    });
  }

  async remove(userId: string, id: string) {
    const current = await this.findAccessible(userId, id);
    if (current.ownerId !== userId) {
      throw new ForbiddenException(
        "Somente o proprietário pode excluir a atividade recorrente",
      );
    }
    await this.prisma.recurringActivity.delete({ where: { id } });
    return { ok: true };
  }

  async generateMonth(userId: string, dto: GenerateMonthDto) {
    const { year, month } = this.parseYearMonth(dto.yearMonth);
    const templates = await this.prisma.recurringActivity.findMany({
      where: {
        active: true,
        OR: [
          { ownerId: userId },
          { team: { members: { some: { userId } } } },
        ],
      },
      orderBy: [{ dayOfMonth: "asc" }, { startTime: "asc" }],
    });

    const created: unknown[] = [];
    const skipped: Array<{ id: string; title: string; reason: string }> = [];

    for (const template of templates) {
      if (template.ownerId !== userId) {
        skipped.push({
          id: template.id,
          title: template.title,
          reason: "Somente o proprietário gera ocorrências desta atividade",
        });
        continue;
      }

      const day = this.resolveDay(year, month, template.dayOfMonth);
      const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      const date = new Date(`${dateStr}T00:00:00.000Z`);
      const startAt = new Date(`${dateStr}T${template.startTime}:00`);
      const endAt = new Date(`${dateStr}T${template.endTime}:00`);

      const existing = await this.prisma.task.findFirst({
        where: {
          recurringActivityId: template.id,
          date,
        },
        select: { id: true },
      });
      if (existing) {
        skipped.push({
          id: template.id,
          title: template.title,
          reason: "Já existe ocorrência neste mês",
        });
        continue;
      }

      try {
        await this.assertNoConflict({
          assigneeId: userId,
          startAt,
          endAt,
          force: dto.force,
          overlapReason: dto.overlapReason,
        });

        const task = await this.prisma.task.create({
          data: {
            title: template.title,
            description: template.description,
            ownerId: userId,
            assigneeId: userId,
            teamId: template.teamId,
            recurringActivityId: template.id,
            date,
            startAt,
            endAt,
            category: template.category,
            priority: template.priority,
            status: TaskStatus.NOT_STARTED,
            visibility: template.teamId ? Visibility.TEAM : Visibility.PRIVATE,
            notes: template.notes,
            forceOverlap: dto.force ?? false,
            overlapReason: dto.force ? dto.overlapReason?.trim() : undefined,
          },
          include: {
            owner: { select: { id: true, fullName: true, email: true } },
            assignee: { select: { id: true, fullName: true, email: true } },
            team: { select: { id: true, name: true } },
          },
        });
        created.push(task);
      } catch (error) {
        const reason =
          error instanceof ConflictException
            ? "Conflito de horário"
            : error instanceof Error
              ? error.message
              : "Falha ao gerar";
        skipped.push({ id: template.id, title: template.title, reason });
      }
    }

    return {
      yearMonth: dto.yearMonth,
      createdCount: created.length,
      skippedCount: skipped.length,
      created,
      skipped,
    };
  }

  private readonly include = {
    team: { select: { id: true, name: true } },
    owner: { select: { id: true, fullName: true, email: true } },
    _count: { select: { tasks: true } },
  } satisfies Prisma.RecurringActivityInclude;

  private async findAccessible(userId: string, id: string) {
    const item = await this.prisma.recurringActivity.findFirst({
      where: {
        id,
        OR: [
          { ownerId: userId },
          { team: { members: { some: { userId } } } },
        ],
      },
      include: this.include,
    });
    if (!item) {
      throw new NotFoundException("Atividade recorrente não encontrada");
    }
    return item;
  }

  private async assertTeamMember(userId: string, teamId: string) {
    const membership = await this.prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId, userId } },
    });
    if (!membership) {
      throw new ForbiddenException("Você não é membro desta equipe");
    }
  }

  private assertTimeRange(startTime: string, endTime: string) {
    const start = this.timeToMinutes(startTime);
    const end = this.timeToMinutes(endTime);
    if (end <= start) {
      throw new BadRequestException("Horário final deve ser posterior ao inicial");
    }
    if (start % 15 !== 0 || end % 15 !== 0) {
      throw new BadRequestException(
        "Início e fim devem respeitar blocos de 15 minutos",
      );
    }
  }

  private timeToMinutes(value: string) {
    const [h, m] = value.split(":").map(Number);
    if (
      Number.isNaN(h) ||
      Number.isNaN(m) ||
      h < 0 ||
      h > 23 ||
      m < 0 ||
      m > 59
    ) {
      throw new BadRequestException("Horário inválido");
    }
    return h * 60 + m;
  }

  private parseYearMonth(value: string) {
    const [yearStr, monthStr] = value.split("-");
    const year = Number(yearStr);
    const month = Number(monthStr);
    if (
      !Number.isInteger(year) ||
      !Number.isInteger(month) ||
      month < 1 ||
      month > 12
    ) {
      throw new BadRequestException("yearMonth inválido (use YYYY-MM)");
    }
    return { year, month };
  }

  private resolveDay(year: number, month: number, dayOfMonth: number) {
    const lastDay = new Date(year, month, 0).getDate();
    return Math.min(Math.max(1, dayOfMonth), lastDay);
  }

  private async assertNoConflict(input: {
    assigneeId: string;
    startAt: Date;
    endAt: Date;
    force?: boolean;
    overlapReason?: string;
  }) {
    const conflict = await this.prisma.task.findFirst({
      where: {
        assigneeId: input.assigneeId,
        status: { notIn: TERMINAL_STATUSES },
        startAt: { lt: input.endAt },
        endAt: { gt: input.startAt },
      },
      select: { id: true, title: true },
    });
    if (!conflict) return;

    if (!input.force) {
      throw new ConflictException({
        message: "Conflito de horário",
        conflict,
      });
    }
    if (!input.overlapReason?.trim()) {
      throw new BadRequestException(
        "O motivo é obrigatório para confirmar um conflito",
      );
    }
  }
}
