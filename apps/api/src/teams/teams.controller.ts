import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from "@nestjs/common";
import { CurrentUser, JwtAuthGuard } from "../auth/jwt-auth.guard";
import { InviteMemberDto, CreateTeamDto } from "./dto/team.dto";
import { TeamsService } from "./teams.service";

type AuthenticatedUser = {
  userId: string;
  email: string;
  systemRole: string;
};

@UseGuards(JwtAuthGuard)
@Controller("teams")
export class TeamsController {
  constructor(private readonly teams: TeamsService) {}

  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateTeamDto) {
    return this.teams.create(user.userId, dto);
  }

  @Get()
  findMine(@CurrentUser() user: AuthenticatedUser) {
    return this.teams.findMine(user.userId);
  }

  @Get("invites/pending")
  listPendingInvites(@CurrentUser() user: AuthenticatedUser) {
    return this.teams.listMyPendingInvites(user.userId);
  }

  @Post("invites/:inviteId/accept")
  acceptInvite(
    @CurrentUser() user: AuthenticatedUser,
    @Param("inviteId", ParseUUIDPipe) inviteId: string,
  ) {
    return this.teams.acceptInvite(user.userId, inviteId);
  }

  @Post("invites/:inviteId/decline")
  declineInvite(
    @CurrentUser() user: AuthenticatedUser,
    @Param("inviteId", ParseUUIDPipe) inviteId: string,
  ) {
    return this.teams.declineInvite(user.userId, inviteId);
  }

  @Get(":id")
  findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.teams.findOne(user.userId, id);
  }

  @Post(":id/invites")
  inviteMember(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: InviteMemberDto,
  ) {
    return this.teams.inviteMember(user.userId, id, dto);
  }

  @Post(":id/members")
  addMember(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: InviteMemberDto,
  ) {
    return this.teams.inviteMember(user.userId, id, dto);
  }

  @Delete(":id/invites/:inviteId")
  cancelInvite(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Param("inviteId", ParseUUIDPipe) inviteId: string,
  ) {
    return this.teams.cancelInvite(user.userId, id, inviteId);
  }

  @Delete(":id/members/:memberUserId")
  removeMember(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Param("memberUserId", ParseUUIDPipe) memberUserId: string,
  ) {
    return this.teams.removeMember(user.userId, id, memberUserId);
  }
}
