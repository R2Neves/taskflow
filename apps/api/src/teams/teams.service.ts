import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { TeamRole } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { AddMemberDto, CreateTeamDto } from "./dto/team.dto";

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
        _count: { select: { tasks: true } },
      },
    });
  }

  async findOne(userId: string, id: string) {
    const team = await this.prisma.team.findFirst({
      where: { id, members: { some: { userId } } },
      include: {
        ...this.teamInclude,
        _count: { select: { tasks: true } },
      },
    });
    if (!team) throw new NotFoundException("Equipe não encontrada");
    return team;
  }

  async addMember(userId: string, teamId: string, dto: AddMemberDto) {
    await this.assertOwner(userId, teamId);
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });
    if (!user) throw new NotFoundException("Usuário com este e-mail não encontrado");

    const existing = await this.prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId, userId: user.id } },
    });
    if (existing) throw new ConflictException("Usuário já é membro da equipe");

    await this.prisma.teamMember.create({
      data: { teamId, userId: user.id, role: TeamRole.MEMBER },
    });
    return this.findOne(userId, teamId);
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

  private async assertOwner(userId: string, teamId: string) {
    const membership = await this.prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId, userId } },
    });
    if (!membership) throw new NotFoundException("Equipe não encontrada");
    if (membership.role !== TeamRole.OWNER) {
      throw new ForbiddenException("Somente o proprietário pode gerenciar membros");
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
