import { Controller, Get, Param, ParseUUIDPipe, Patch, UseGuards } from "@nestjs/common";
import { CurrentUser, JwtAuthGuard } from "../auth/jwt-auth.guard";
import { NotificationsService } from "./notifications.service";

type AuthenticatedUser = {
  userId: string;
  email: string;
  systemRole: string;
};

@UseGuards(JwtAuthGuard)
@Controller("notifications")
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  listMine(@CurrentUser() user: AuthenticatedUser) {
    return this.notifications.listMine(user.userId);
  }

  @Patch("read-all")
  markAllRead(@CurrentUser() user: AuthenticatedUser) {
    return this.notifications.markAllRead(user.userId);
  }

  @Patch(":id/read")
  markRead(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.notifications.markRead(user.userId, id);
  }
}
