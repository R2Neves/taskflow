import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import { CurrentUser, JwtAuthGuard } from "../auth/jwt-auth.guard";
import { ChecklistService } from "./checklist.service";
import {
  CreateChecklistDto,
  ScheduleChecklistDto,
  UpdateChecklistDto,
} from "./dto/checklist.dto";

type AuthenticatedUser = {
  userId: string;
  email: string;
  systemRole: string;
};

@UseGuards(JwtAuthGuard)
@Controller("checklist")
export class ChecklistController {
  constructor(private readonly checklist: ChecklistService) {}

  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateChecklistDto,
  ) {
    return this.checklist.create(user.userId, dto);
  }

  @Get()
  findMine(@CurrentUser() user: AuthenticatedUser) {
    return this.checklist.findMine(user.userId);
  }

  @Patch(":id")
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateChecklistDto,
  ) {
    return this.checklist.update(user.userId, id, dto);
  }

  @Delete(":id")
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.checklist.remove(user.userId, id);
  }

  @Post(":id/schedule")
  schedule(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: ScheduleChecklistDto,
  ) {
    return this.checklist.schedule(user.userId, id, dto);
  }
}
