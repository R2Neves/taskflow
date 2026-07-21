import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { SystemRole } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { UpdateAdminUserDto } from "./dto/admin-user.dto";

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  findByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });
  }

  findById(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      include: { workSchedule: true },
    });
  }

  async getProfile(userId: string) {
    const user = await this.findById(userId);
    if (!user) return null;
    const { passwordHash: _, ...safe } = user;
    return safe;
  }

  listAccounts() {
    return this.prisma.user.findMany({
      orderBy: [{ systemRole: "asc" }, { fullName: "asc" }],
      select: {
        id: true,
        fullName: true,
        email: true,
        systemRole: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            ownedTasks: true,
            assignedTasks: true,
            memberships: true,
          },
        },
      },
    });
  }

  async updateAccount(
    actorId: string,
    targetId: string,
    dto: UpdateAdminUserDto,
  ) {
    const target = await this.prisma.user.findUnique({
      where: { id: targetId },
      select: { id: true, email: true },
    });
    if (!target) throw new NotFoundException("Acesso não encontrado");

    const bootstrapAdmin = this.config
      .get<string>("ADMIN_EMAIL", "rneves@beautyservices.com.br")
      .toLowerCase();
    if (
      target.email.toLowerCase() === bootstrapAdmin &&
      dto.systemRole === SystemRole.USER
    ) {
      throw new ForbiddenException(
        "O administrador principal não pode ser rebaixado",
      );
    }
    if (actorId === targetId && dto.systemRole === SystemRole.USER) {
      throw new ForbiddenException(
        "Você não pode remover seu próprio acesso administrativo",
      );
    }

    return this.prisma.user.update({
      where: { id: targetId },
      data: {
        fullName: dto.fullName?.trim(),
        systemRole: dto.systemRole,
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        systemRole: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            ownedTasks: true,
            assignedTasks: true,
            memberships: true,
          },
        },
      },
    });
  }
}
