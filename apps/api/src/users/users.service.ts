import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { SystemRole } from "@prisma/client";
import * as bcrypt from "bcrypt";
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
      where: { email: email.toLowerCase().trim() },
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

  private readonly accountSelect = {
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
  } as const;

  listAccounts() {
    return this.prisma.user.findMany({
      orderBy: [{ systemRole: "asc" }, { fullName: "asc" }],
      select: this.accountSelect,
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
    const nextRole = dto.systemRole;
    if (
      target.email.toLowerCase() === bootstrapAdmin &&
      nextRole === SystemRole.USER
    ) {
      throw new ForbiddenException(
        "O administrador principal não pode ser rebaixado",
      );
    }
    if (actorId === targetId && nextRole === SystemRole.USER) {
      throw new ForbiddenException(
        "Você não pode remover seu próprio acesso administrativo",
      );
    }

    const nextEmail = dto.email?.trim().toLowerCase();
    if (nextEmail && nextEmail !== target.email.toLowerCase()) {
      if (target.email.toLowerCase() === bootstrapAdmin) {
        throw new ForbiddenException(
          "O e-mail do administrador principal não pode ser alterado",
        );
      }
      const clash = await this.prisma.user.findUnique({
        where: { email: nextEmail },
        select: { id: true },
      });
      if (clash && clash.id !== targetId) {
        throw new ConflictException("E-mail já cadastrado");
      }
    }

    const password = dto.password?.trim();
    const passwordHash = password
      ? await bcrypt.hash(password, 10)
      : undefined;

    const updated = await this.prisma.user.update({
      where: { id: targetId },
      data: {
        fullName: dto.fullName?.trim(),
        email: nextEmail,
        systemRole: dto.systemRole,
        passwordHash,
      },
      select: this.accountSelect,
    });

    if (passwordHash) {
      await this.prisma.refreshToken.updateMany({
        where: { userId: targetId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }

    return updated;
  }
}
