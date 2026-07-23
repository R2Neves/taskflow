import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { ChecklistScope, Visibility } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { TasksService } from "../tasks/tasks.service";
import {
  CreateChecklistDto,
  ScheduleChecklistDto,
  UpdateChecklistDto,
} from "./dto/checklist.dto";

@Injectable()
export class ChecklistService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tasks: TasksService,
  ) {}

  private readonly include = {
    team: { select: { id: true, name: true } },
    convertedTask: {
      select: { id: true, title: true, date: true, startAt: true, endAt: true },
    },
  } as const;

  async create(userId: string, dto: CreateChecklistDto) {
    const scope = dto.scope ?? ChecklistScope.PERSONAL;
    const teamId =
      scope === ChecklistScope.TEAM ? await this.assertTeamAccess(userId, dto.teamId) : null;

    return this.prisma.checklistItem.create({
      data: {
        ownerId: userId,
        title: dto.title.trim(),
        notes: dto.notes?.trim(),
        scope,
        teamId,
      },
      include: this.include,
    });
  }

  findMine(userId: string) {
    return this.prisma.checklistItem.findMany({
      where: {
        OR: [
          { ownerId: userId },
          {
            scope: ChecklistScope.TEAM,
            team: { members: { some: { userId } } },
          },
        ],
      },
      orderBy: [{ done: "asc" }, { sortOrder: "asc" }, { createdAt: "desc" }],
      include: this.include,
    });
  }

  async update(userId: string, id: string, dto: UpdateChecklistDto) {
    await this.requireAccessible(userId, id);
    const scope = dto.scope;
    let teamId = dto.teamId;
    if (scope === ChecklistScope.PERSONAL) {
      teamId = null;
    } else if (scope === ChecklistScope.TEAM || teamId) {
      teamId = await this.assertTeamAccess(userId, teamId ?? undefined);
    }

    return this.prisma.checklistItem.update({
      where: { id },
      data: {
        title: dto.title?.trim(),
        notes: dto.notes?.trim(),
        scope: dto.scope,
        teamId,
        done: dto.done,
        sortOrder: dto.sortOrder,
      },
      include: this.include,
    });
  }

  async remove(userId: string, id: string) {
    await this.requireAccessible(userId, id);
    await this.prisma.checklistItem.delete({ where: { id } });
    return { ok: true };
  }

  async schedule(userId: string, id: string, dto: ScheduleChecklistDto) {
    const item = await this.requireAccessible(userId, id);
    if (item.convertedTaskId) {
      throw new BadRequestException("Este item já foi convertido em atividade");
    }

    const teamId =
      dto.teamId ??
      (item.scope === ChecklistScope.TEAM ? item.teamId ?? undefined : undefined);

    if (teamId) {
      await this.assertTeamAccess(userId, teamId);
    }

    const startAt = `${dto.date}T${dto.startTime}:00-03:00`;
    const endAt = `${dto.date}T${dto.endTime}:00-03:00`;

    const task = await this.tasks.create(userId, {
      title: item.title,
      description: item.notes ?? undefined,
      date: dto.date,
      startAt: new Date(startAt).toISOString(),
      endAt: new Date(endAt).toISOString(),
      priority: dto.priority,
      teamId,
      visibility: teamId
        ? dto.visibility ?? Visibility.TEAM
        : Visibility.PRIVATE,
      force: dto.force,
      overlapReason: dto.overlapReason,
    });

    const updated = await this.prisma.checklistItem.update({
      where: { id },
      data: {
        done: true,
        convertedTaskId: task.id,
        scope: teamId ? ChecklistScope.TEAM : ChecklistScope.PERSONAL,
        teamId: teamId ?? null,
      },
      include: this.include,
    });

    return { item: updated, task };
  }

  private async requireAccessible(userId: string, id: string) {
    const item = await this.prisma.checklistItem.findFirst({
      where: {
        id,
        OR: [
          { ownerId: userId },
          {
            scope: ChecklistScope.TEAM,
            team: { members: { some: { userId } } },
          },
        ],
      },
    });
    if (!item) throw new NotFoundException("Item do checklist não encontrado");
    return item;
  }

  private async requireOwned(userId: string, id: string) {
    return this.requireAccessible(userId, id);
  }

  private async assertTeamAccess(userId: string, teamId?: string | null) {
    if (!teamId) {
      throw new BadRequestException("Selecione uma equipe para o item");
    }
    const membership = await this.prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId, userId } },
    });
    if (!membership) {
      throw new BadRequestException("Você não pertence a esta equipe");
    }
    return teamId;
  }
}
