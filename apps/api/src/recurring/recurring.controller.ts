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
import {
  CreateRecurringDto,
  GenerateMonthDto,
  UpdateRecurringDto,
} from "./dto/recurring.dto";
import { RecurringService } from "./recurring.service";

type AuthenticatedUser = {
  userId: string;
  email: string;
  systemRole: string;
};

@UseGuards(JwtAuthGuard)
@Controller("recurring")
export class RecurringController {
  constructor(private readonly recurring: RecurringService) {}

  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateRecurringDto,
  ) {
    return this.recurring.create(user.userId, dto);
  }

  @Get()
  findMine(@CurrentUser() user: AuthenticatedUser) {
    return this.recurring.findMine(user.userId);
  }

  @Post("generate-month")
  generateMonth(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: GenerateMonthDto,
  ) {
    return this.recurring.generateMonth(user.userId, dto);
  }

  @Get(":id")
  findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.recurring.findOne(user.userId, id);
  }

  @Patch(":id")
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateRecurringDto,
  ) {
    return this.recurring.update(user.userId, id, dto);
  }

  @Delete(":id")
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.recurring.remove(user.userId, id);
  }
}
