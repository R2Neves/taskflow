import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma, TaskStatus } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { CreateTaskDto, UpdateTaskDto } from "./dto/task.dto";

const TERMINAL_STATUSES: TaskStatus[] = [
  TaskStatus.COMPLETED,
  TaskStatus.CANCELLED,
];

@Injectable()
export class TasksService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateTaskDto) {
    const assigneeId = dto.assigneeId ?? userId;
    const interval = this.validateInterval(dto.startAt, dto.endAt);
    await this.assertAssigneeExists(assigneeId);
    await this.assertNoConflict({
      assigneeId,
      ...interval,
      force: dto.force,
      overlapReason: dto.overlapReason,
    });

    const task = await this.prisma.task.create({
      data: {
        title: dto.title.trim(),
        description: dto.description,
        ownerId: userId,
        assigneeId,
        teamId: dto.teamId,
        date: this.parseDate(dto.date),
        startAt: interval.startAt,
        endAt: interval.endAt,
        category: dto.category,
        priority: dto.priority,
        status: dto.status,
        visibility: dto.visibility,
        notes: dto.notes,
        forceOverlap: dto.force ?? false,
        overlapReason: dto.force ? dto.overlapReason?.trim() : undefined,
      },
      include: this.taskRelations,
    });
    if (
      task.status === TaskStatus.IN_PROGRESS ||
      task.status === TaskStatus.COMPLETED
    ) {
      await this.prisma.auditLog.create({
        data: {
          entityType: "Task",
          entityId: task.id,
          actorId: userId,
          action:
            task.status === TaskStatus.IN_PROGRESS
              ? "TASK_STARTED"
              : "TASK_COMPLETED",
          after: { status: task.status },
        },
      });
    }

    return this.withDerivedStatus(task);
  }

  async findAll(userId: string, from?: string, to?: string) {
    const where: Prisma.TaskWhereInput = {
      OR: [
        { ownerId: userId },
        { assigneeId: userId },
        { participants: { some: { userId } } },
        { team: { members: { some: { userId } } } },
      ],
    };

    if (from || to) {
      where.startAt = {
        ...(from ? { gte: this.parseDateTime(from, "from") } : {}),
        ...(to ? { lte: this.parseDateTime(to, "to") } : {}),
      };
    }

    const tasks = await this.prisma.task.findMany({
      where,
      orderBy: [{ startAt: "asc" }, { createdAt: "asc" }],
      include: this.taskRelations,
    });
    return this.withTimingForMany(tasks.map((task) => this.withDerivedStatus(task)));
  }

  async findOne(userId: string, id: string) {
    const task = await this.findAccessible(userId, id);
    return this.withActualTiming(task);
  }

  async update(userId: string, id: string, dto: UpdateTaskDto) {
    const current = await this.findAccessible(userId, id);
    const statusOnly =
      dto.status !== undefined &&
      dto.title === undefined &&
      dto.description === undefined &&
      dto.assigneeId === undefined &&
      dto.teamId === undefined &&
      dto.date === undefined &&
      dto.startAt === undefined &&
      dto.endAt === undefined &&
      dto.category === undefined &&
      dto.priority === undefined &&
      dto.visibility === undefined &&
      dto.notes === undefined &&
      dto.force === undefined &&
      dto.overlapReason === undefined;

    const canEditFully = current.ownerId === userId;
    const canControlTimer =
      current.ownerId === userId || current.assigneeId === userId;

    if (!canEditFully && !(statusOnly && canControlTimer)) {
      throw new ForbiddenException(
        "Somente o proprietário pode editar a atividade",
      );
    }

    const assigneeId = dto.assigneeId ?? current.assigneeId;
    const interval = this.validateInterval(
      dto.startAt ?? current.startAt.toISOString(),
      dto.endAt ?? current.endAt.toISOString(),
    );
    if (!statusOnly) {
      await this.assertAssigneeExists(assigneeId);
      const schedulingChanged =
        dto.assigneeId !== undefined ||
        dto.startAt !== undefined ||
        dto.endAt !== undefined;
      if (schedulingChanged) {
        await this.assertNoConflict({
          assigneeId,
          ...interval,
          force: dto.force,
          overlapReason: dto.overlapReason,
          excludeTaskId: id,
        });
      }
    }

    const task = await this.prisma.task.update({
      where: { id },
      data: statusOnly
        ? { status: dto.status }
        : {
            title: dto.title?.trim(),
            description: dto.description,
            assigneeId: dto.assigneeId,
            teamId: dto.teamId,
            date: dto.date ? this.parseDate(dto.date) : undefined,
            startAt: dto.startAt ? interval.startAt : undefined,
            endAt: dto.endAt ? interval.endAt : undefined,
            category: dto.category,
            priority: dto.priority,
            status: dto.status,
            visibility: dto.visibility,
            notes: dto.notes,
            forceOverlap: dto.force,
            overlapReason: dto.force ? dto.overlapReason?.trim() : undefined,
          },
      include: this.taskRelations,
    });

    if (dto.status !== undefined && dto.status !== current.status) {
      const action =
        dto.status === TaskStatus.IN_PROGRESS
          ? "TASK_STARTED"
          : dto.status === TaskStatus.PAUSED
            ? "TASK_PAUSED"
            : dto.status === TaskStatus.COMPLETED
              ? "TASK_COMPLETED"
              : null;
      if (action) {
        await this.prisma.auditLog.create({
          data: {
            entityType: "Task",
            entityId: id,
            actorId: userId,
            action,
            before: { status: current.status },
            after: { status: dto.status },
          },
        });
      }
    }

    const [enriched] = await this.withTimingForMany([
      this.withDerivedStatus(task),
    ]);
    return enriched;
  }

  async remove(userId: string, id: string) {
    const task = await this.findAccessible(userId, id);
    if (task.ownerId !== userId) {
      throw new ForbiddenException("Somente o proprietário pode excluir a atividade");
    }
    await this.prisma.task.delete({ where: { id } });
    return { ok: true };
  }

  private readonly taskRelations = {
    owner: { select: { id: true, fullName: true, email: true } },
    assignee: { select: { id: true, fullName: true, email: true } },
    team: { select: { id: true, name: true } },
    participants: {
      include: {
        user: { select: { id: true, fullName: true, email: true } },
      },
    },
  } satisfies Prisma.TaskInclude;

  private async findAccessible(userId: string, id: string) {
    const task = await this.prisma.task.findFirst({
      where: {
        id,
        OR: [
          { ownerId: userId },
          { assigneeId: userId },
          { participants: { some: { userId } } },
          { team: { members: { some: { userId } } } },
        ],
      },
      include: this.taskRelations,
    });
    if (!task) {
      throw new NotFoundException("Atividade não encontrada");
    }
    return task;
  }

  private async assertAssigneeExists(userId: string) {
    const exists = await this.prisma.user.count({ where: { id: userId } });
    if (!exists) {
      throw new NotFoundException("Responsável não encontrado");
    }
  }

  private async assertNoConflict(input: {
    assigneeId: string;
    startAt: Date;
    endAt: Date;
    force?: boolean;
    overlapReason?: string;
    excludeTaskId?: string;
  }) {
    const conflict = await this.prisma.task.findFirst({
      where: {
        assigneeId: input.assigneeId,
        id: input.excludeTaskId ? { not: input.excludeTaskId } : undefined,
        status: { notIn: TERMINAL_STATUSES },
        startAt: { lt: input.endAt },
        endAt: { gt: input.startAt },
      },
      select: { id: true, title: true, startAt: true, endAt: true },
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

  private validateInterval(startValue: string, endValue: string) {
    const startAt = this.parseDateTime(startValue, "startAt");
    const endAt = this.parseDateTime(endValue, "endAt");
    if (endAt <= startAt) {
      throw new BadRequestException("endAt deve ser posterior a startAt");
    }
    this.assertQuarterHour(startAt, "Início");
    this.assertQuarterHour(endAt, "Fim");
    return { startAt, endAt };
  }

  private assertQuarterHour(value: Date, label: string) {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: "America/Sao_Paulo",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }).formatToParts(value);
    const minute = Number(parts.find((part) => part.type === "minute")?.value);
    const second = Number(parts.find((part) => part.type === "second")?.value);
    if (Number.isNaN(minute) || Number.isNaN(second) || second !== 0 || minute % 15 !== 0) {
      throw new BadRequestException(
        `${label} deve respeitar blocos de 15 minutos`,
      );
    }
  }

  private parseDateTime(value: string, field: string) {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException(`${field} inválido`);
    }
    return parsed;
  }

  private parseDate(value: string) {
    const parsed = new Date(`${value}T00:00:00.000Z`);
    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException("date inválida");
    }
    return parsed;
  }

  private withDerivedStatus<T extends { status: TaskStatus; endAt: Date }>(
    task: T,
  ) {
    const derivedStatus =
      !TERMINAL_STATUSES.includes(task.status) && task.endAt < new Date()
        ? "OVERDUE"
        : task.status;
    return { ...task, derivedStatus };
  }

  private async withTimingForMany<
    T extends { id: string; status: TaskStatus; derivedStatus: string },
  >(tasks: T[]) {
    if (tasks.length === 0) return tasks;
    const events = await this.prisma.auditLog.findMany({
      where: {
        entityType: "Task",
        entityId: { in: tasks.map((task) => task.id) },
        action: { in: ["TASK_STARTED", "TASK_PAUSED", "TASK_COMPLETED"] },
      },
      orderBy: { createdAt: "asc" },
      select: { entityId: true, action: true, createdAt: true },
    });

    const byTask = new Map<string, Array<{ action: string; createdAt: Date }>>();
    for (const event of events) {
      const list = byTask.get(event.entityId) ?? [];
      list.push({ action: event.action, createdAt: event.createdAt });
      byTask.set(event.entityId, list);
    }

    return tasks.map((task) => {
      const timeline = byTask.get(task.id) ?? [];
      let workedMs = 0;
      let openStart: Date | null = null;
      for (const event of timeline) {
        if (event.action === "TASK_STARTED") {
          openStart = event.createdAt;
        } else if (
          (event.action === "TASK_PAUSED" ||
            event.action === "TASK_COMPLETED") &&
          openStart
        ) {
          workedMs += event.createdAt.getTime() - openStart.getTime();
          openStart = null;
        }
      }
      const timerStartedAt =
        task.status === TaskStatus.IN_PROGRESS && openStart
          ? openStart.toISOString()
          : null;
      return {
        ...task,
        timerStartedAt,
        actualDurationMinutes: Math.max(0, Math.round(workedMs / 60_000)),
      };
    });
  }

  private async withActualTiming<
    T extends {
      id: string;
      status: TaskStatus;
      startAt: Date;
      endAt: Date;
      updatedAt: Date;
    },
  >(task: T) {
    const [enriched] = await this.withTimingForMany([
      this.withDerivedStatus(task),
    ]);
    return enriched;
  }
}
