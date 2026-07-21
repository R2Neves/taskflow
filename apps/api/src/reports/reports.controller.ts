import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Res,
  UseGuards,
} from "@nestjs/common";
import type { Response } from "express";
import { CurrentUser, JwtAuthGuard } from "../auth/jwt-auth.guard";
import { EmailTaskReportDto, TaskReportQueryDto } from "./dto/report.dto";
import { ReportsService } from "./reports.service";

type AuthenticatedUser = {
  userId: string;
};

@UseGuards(JwtAuthGuard)
@Controller("reports")
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get("tasks.pdf")
  async downloadTasks(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: TaskReportQueryDto,
    @Res() response: Response,
  ) {
    const report = await this.reports.createTaskReport(user.userId, query);
    response.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${report.filename}"`,
      "Content-Length": report.buffer.length,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    });
    response.end(report.buffer);
  }

  @Post("tasks/email")
  emailTasks(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: EmailTaskReportDto,
  ) {
    return this.reports.emailTaskReport(user.userId, dto);
  }
}
