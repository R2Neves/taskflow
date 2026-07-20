import { Controller, Get, NotFoundException, UseGuards } from "@nestjs/common";
import { UsersService } from "./users.service";
import { CurrentUser, JwtAuthGuard } from "../auth/jwt-auth.guard";

@Controller("users")
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @UseGuards(JwtAuthGuard)
  @Get("me")
  async me(
    @CurrentUser() user: { userId: string; email: string; systemRole: string },
  ) {
    const profile = await this.users.getProfile(user.userId);
    if (!profile) {
      throw new NotFoundException("Usuário não encontrado");
    }
    return profile;
  }
}
