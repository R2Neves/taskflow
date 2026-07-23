import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { TeamInviteStatus, TeamRole } from "@prisma/client";
import { randomUUID } from "crypto";
import { PrismaService } from "../prisma/prisma.service";
import { CreateTeamDto, InviteMemberDto } from "./dto/team.dto";

@Injectable()
export class TeamsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateTeamDto) {
    return this.prisma.team.create({
      data: {
        name: dto.name.trim(),
        description: dto.description?.trim(),
        createdById: userId,
        members: {
          create: { userId, role: TeamRole.OWNER },
        },
      },
      include: this.teamInclude,
    });
  }

  async findMine(userId: string) {
    return this.prisma.team.findMany({
      where: { members: { some: { userId } } },
      orderBy: { name: "asc" },
      include: {
        ...this.teamInclude,
        invites: {
          where: { status: TeamInviteStatus.PENDING },
          orderBy: { createdAt: "desc" },
          include: {
            invitedBy: {
              select: { id: true, fullName: true, email: true },
            },
          },
        },
        _count: { select: { tasks: true } },
      },
    });
  }

  async findOne(userId: string, id: string) {
    const team = await this.prisma.team.findFirst({
      where: { id, members: { some: { userId } } },
      include: {
        ...this.teamInclude,
        invites: {
          where: { status: TeamInviteStatus.PENDING },
          orderBy: { createdAt: "desc" },
          include: {
            invitedBy: {
              select: { id: true, fullName: true, email: true },
            },
          },
        },
        _count: { select: { tasks: true } },
      },
    });
    if (!team) throw new NotFoundException("Equipe não encontrada");
    return team;
  }

  async inviteMember(userId: string, teamId: string, dto: InviteMemberDto) {
    await this.assertOwner(userId, teamId);
    const email = dto.email.trim().toLowerCase();
    const team = await this.prisma.team.findUnique({ where: { id: teamId } });
    if (!team) throw new NotFoundException("Equipe não encontrada");

    const invitee = await this.prisma.user.findUnique({ where: { email } });
    if (invitee) {
      const existingMember = await this.prisma.teamMember.findUnique({
        where: { teamId_userId: { teamId, userId: invitee.id } },
      });
      if (existingMember) {
        throw new ConflictException("Usuário já é membro da equipe");
      }
    }

    const pending = await this.prisma.teamInvite.findFirst({
      where: { teamId, email, status: TeamInviteStatus.PENDING },
    });
    if (pending) {
      throw new ConflictException("Já existe um convite pendente para este e-mail");
    }

    const inviter = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { id: true, fullName: true, email: true },
    });

    const invite = await this.prisma.teamInvite.create({
      data: {
        id: randomUUID(),
        teamId,
        email,
        invitedUserId: invitee?.id,
        invitedById: userId,
        status: TeamInviteStatus.PENDING,
      },
      include: {
        team: { select: { id: true, name: true } },
        invitedBy: { select: { id: true, fullName: true, email: true } },
      },
    });

    if (invitee) {
      await this.prisma.notification.create({
        data: {
          id: randomUUID(),
          userId: invitee.id,
          type: "TEAM_INVITE",
          title: `Convite para ${team.name}`,
          body: `${inviter.fullName} convidou você para entrar na equipe "${team.name}". Aceite ou recuse o convite.`,
          payload: {
            inviteId: invite.id,
            teamId: team.id,
            teamName: team.name,
            invitedByName: inviter.fullName,
          },
        },
      });
    }

    return {
      invite,
      message: invitee
        ? "Convite enviado. O usuário precisa aceitar no TaskFlow."
        : "Convite registrado. Quando a pessoa se cadastrar com este e-mail, poderá aceitar o convite.",
    };
  }

  /** Compatibility alias used by older clients */
  addMember(userId: string, teamId: string, dto: InviteMemberDto) {
    return this.inviteMember(userId, teamId, dto);
  }

  async listMyPendingInvites(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { id: true, email: true },
    });

    return this.prisma.teamInvite.findMany({
      where: {
        status: TeamInviteStatus.PENDING,
        OR: [{ invitedUserId: userId }, { email: user.email.toLowerCase() }],
      },
      orderBy: { createdAt: "desc" },
      include: {
        team: { select: { id: true, name: true, description: true } },
        invitedBy: { select: { id: true, fullName: true, email: true } },
      },
    });
  }

  async acceptInvite(userId: string, inviteId: string) {
    const invite = await this.getRespondableInvite(userId, inviteId);

    await this.prisma.$transaction(async (tx) => {
      const existing = await tx.teamMember.findUnique({
        where: {
          teamId_userId: { teamId: invite.teamId, userId },
        },
      });
      if (!existing) {
        await tx.teamMember.create({
          data: {
            id: randomUUID(),
            teamId: invite.teamId,
            userId,
            role: TeamRole.MEMBER,
          },
        });
      }

      await tx.teamInvite.update({
        where: { id: invite.id },
        data: {
          status: TeamInviteStatus.ACCEPTED,
          invitedUserId: userId,
          respondedAt: new Date(),
        },
      });

      await tx.notification.updateMany({
        where: {
          userId,
          type: "TEAM_INVITE",
          readAt: null,
        },
        data: { readAt: new Date() },
      });

      const acceptor = await tx.user.findUniqueOrThrow({
        where: { id: userId },
        select: { fullName: true },
      });
      await tx.notification.create({
        data: {
          id: randomUUID(),
          userId: invite.invitedById,
          type: "TEAM_INVITE_ACCEPTED",
          title: `${acceptor.fullName} entrou na equipe`,
          body: `${acceptor.fullName} aceitou o convite para "${invite.team.name}".`,
          payload: {
            inviteId: invite.id,
            teamId: invite.teamId,
            teamName: invite.team.name,
          },
        },
      });
    });

    return this.findOne(userId, invite.teamId);
  }

  async declineInvite(userId: string, inviteId: string) {
    const invite = await this.getRespondableInvite(userId, inviteId);

    await this.prisma.$transaction(async (tx) => {
      await tx.teamInvite.update({
        where: { id: invite.id },
        data: {
          status: TeamInviteStatus.DECLINED,
          invitedUserId: userId,
          respondedAt: new Date(),
        },
      });

      await tx.notification.updateMany({
        where: {
          userId,
          type: "TEAM_INVITE",
          readAt: null,
        },
        data: { readAt: new Date() },
      });
    });

    return { ok: true };
  }

  async cancelInvite(actorId: string, teamId: string, inviteId: string) {
    await this.assertOwner(actorId, teamId);
    const invite = await this.prisma.teamInvite.findFirst({
      where: { id: inviteId, teamId, status: TeamInviteStatus.PENDING },
    });
    if (!invite) throw new NotFoundException("Convite não encontrado");

    await this.prisma.teamInvite.update({
      where: { id: invite.id },
      data: {
        status: TeamInviteStatus.CANCELLED,
        respondedAt: new Date(),
      },
    });

    if (invite.invitedUserId) {
      await this.prisma.notification.updateMany({
        where: {
          userId: invite.invitedUserId,
          type: "TEAM_INVITE",
          readAt: null,
        },
        data: { readAt: new Date() },
      });
    }

    return this.findOne(actorId, teamId);
  }

  async removeMember(actorId: string, teamId: string, memberUserId: string) {
    await this.assertOwner(actorId, teamId);
    const member = await this.prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId, userId: memberUserId } },
    });
    if (!member) throw new NotFoundException("Membro não encontrado");
    if (member.role === TeamRole.OWNER) {
      throw new ForbiddenException("Não é possível remover o proprietário");
    }
    await this.prisma.teamMember.delete({ where: { id: member.id } });
    return this.findOne(actorId, teamId);
  }

  async assertMember(userId: string, teamId: string) {
    const membership = await this.prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId, userId } },
    });
    if (!membership) {
      throw new ForbiddenException("Você não pertence a esta equipe");
    }
    return membership;
  }

  private async getRespondableInvite(userId: string, inviteId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { id: true, email: true },
    });

    const invite = await this.prisma.teamInvite.findFirst({
      where: {
        id: inviteId,
        status: TeamInviteStatus.PENDING,
        OR: [{ invitedUserId: userId }, { email: user.email.toLowerCase() }],
      },
      include: {
        team: { select: { id: true, name: true } },
      },
    });
    if (!invite) {
      throw new NotFoundException("Convite não encontrado ou já respondido");
    }

    const alreadyMember = await this.prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId: invite.teamId, userId } },
    });
    if (alreadyMember) {
      await this.prisma.teamInvite.update({
        where: { id: invite.id },
        data: {
          status: TeamInviteStatus.ACCEPTED,
          invitedUserId: userId,
          respondedAt: new Date(),
        },
      });
      throw new BadRequestException("Você já é membro desta equipe");
    }

    return invite;
  }

  private async assertOwner(userId: string, teamId: string) {
    const membership = await this.prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId, userId } },
    });
    if (!membership) throw new NotFoundException("Equipe não encontrada");
    if (membership.role !== TeamRole.OWNER) {
      throw new ForbiddenException(
        "Somente o proprietário pode gerenciar membros",
      );
    }
  }

  private readonly teamInclude = {
    members: {
      include: {
        user: { select: { id: true, fullName: true, email: true } },
      },
      orderBy: { joinedAt: "asc" as const },
    },
  };
}
