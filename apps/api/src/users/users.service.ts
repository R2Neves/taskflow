import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

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
}
