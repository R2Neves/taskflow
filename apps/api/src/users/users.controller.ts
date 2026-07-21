import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  UseGuards,
} from "@nestjs/common";
import { UsersService } from "./users.service";
import { CurrentUser, JwtAuthGuard } from "../auth/jwt-auth.guard";
import { AdminGuard } from "../auth/admin.guard";
import { UpdateAdminUserDto } from "./dto/admin-user.dto";

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

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Get("admin/accounts")
  accounts() {
    return this.users.listAccounts();
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Patch("admin/accounts/:id")
  updateAccount(
    @CurrentUser() user: { userId: string },
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateAdminUserDto,
  ) {
    return this.users.updateAccount(user.userId, id, dto);
  }
}
