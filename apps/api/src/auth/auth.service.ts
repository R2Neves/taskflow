import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import { SystemRole } from "@prisma/client";
import * as bcrypt from "bcrypt";
import { createHash, randomBytes } from "crypto";
import { PrismaService } from "../prisma/prisma.service";
import { UsersService } from "../users/users.service";
import { LoginDto } from "./dto/login.dto";
import { RegisterDto } from "./dto/register.dto";

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async register(dto: RegisterDto) {
    if (dto.password !== dto.confirmPassword) {
      throw new BadRequestException("Senhas não conferem");
    }
    const existing = await this.users.findByEmail(dto.email);
    if (existing) {
      throw new ConflictException("E-mail já cadastrado");
    }
    const passwordHash = await bcrypt.hash(dto.password, 10);
    const email = dto.email.trim().toLowerCase();
    const user = await this.prisma.user.create({
      data: {
        fullName: dto.fullName,
        email,
        passwordHash,
        systemRole: this.isBootstrapAdmin(email)
          ? SystemRole.ADMIN
          : SystemRole.USER,
        workSchedule: { create: {} },
      },
    });
    const authorizedUser = await this.ensureBootstrapAdmin(user);
    return this.issueTokens(
      authorizedUser.id,
      authorizedUser.email,
      authorizedUser.systemRole,
    );
  }

  async login(dto: LoginDto) {
    const user = await this.users.findByEmail(dto.email);
    if (!user) {
      throw new UnauthorizedException("Credenciais inválidas");
    }
    const ok = await bcrypt.compare(dto.password, user.passwordHash);
    if (!ok) {
      throw new UnauthorizedException("Credenciais inválidas");
    }
    const authorizedUser = await this.ensureBootstrapAdmin(user);
    return this.issueTokens(
      authorizedUser.id,
      authorizedUser.email,
      authorizedUser.systemRole,
    );
  }

  async refresh(rawToken: string) {
    const tokenHash = this.hashToken(rawToken);
    const stored = await this.prisma.refreshToken.findFirst({
      where: { tokenHash, revokedAt: null, expiresAt: { gt: new Date() } },
      include: { user: true },
    });
    if (!stored) {
      throw new UnauthorizedException("Refresh inválido");
    }
    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });
    const authorizedUser = await this.ensureBootstrapAdmin(stored.user);
    return this.issueTokens(
      authorizedUser.id,
      authorizedUser.email,
      authorizedUser.systemRole,
    );
  }

  async logout(rawToken: string) {
    const tokenHash = this.hashToken(rawToken);
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return { ok: true };
  }

  private async issueTokens(
    userId: string,
    email: string,
    systemRole: string,
  ) {
    const accessSecret = this.config.getOrThrow<string>("JWT_ACCESS_SECRET");
    const refreshSecret = this.config.getOrThrow<string>("JWT_REFRESH_SECRET");
    const accessExpires = this.config.get("JWT_ACCESS_EXPIRES", "15m");
    const refreshExpires = this.config.get("JWT_REFRESH_EXPIRES", "7d");

    const accessToken = await this.jwt.signAsync(
      { sub: userId, email, systemRole },
      { secret: accessSecret, expiresIn: accessExpires },
    );

    const rawRefresh = randomBytes(48).toString("hex");
    const days = refreshExpires.endsWith("d")
      ? Number(refreshExpires.replace("d", ""))
      : 7;
    const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash: this.hashToken(rawRefresh),
        expiresAt,
      },
    });

    return {
      accessToken,
      refreshToken: rawRefresh,
      tokenType: "Bearer",
      expiresIn: accessExpires,
    };
  }

  private hashToken(token: string) {
    return createHash("sha256").update(token).digest("hex");
  }

  private isBootstrapAdmin(email: string) {
    return (
      email.toLowerCase() ===
      this.config
        .get<string>("ADMIN_EMAIL", "rneves@beautyservices.com.br")
        .toLowerCase()
    );
  }

  private async ensureBootstrapAdmin<T extends {
    id: string;
    email: string;
    systemRole: SystemRole;
  }>(user: T) {
    if (
      this.isBootstrapAdmin(user.email) &&
      user.systemRole !== SystemRole.ADMIN
    ) {
      return this.prisma.user.update({
        where: { id: user.id },
        data: { systemRole: SystemRole.ADMIN },
      });
    }
    return user;
  }
}
