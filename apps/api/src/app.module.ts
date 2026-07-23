import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { PrismaModule } from "./prisma/prisma.module";
import { AuthModule } from "./auth/auth.module";
import { UsersModule } from "./users/users.module";
import { TasksModule } from "./tasks/tasks.module";
import { TeamsModule } from "./teams/teams.module";
import { RecurringModule } from "./recurring/recurring.module";
import { ReportsModule } from "./reports/reports.module";
import { ChecklistModule } from "./checklist/checklist.module";
import { NotificationsModule } from "./notifications/notifications.module";
import { HealthController } from "./health.controller";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ["../../.env", ".env"] }),
    PrismaModule,
    AuthModule,
    UsersModule,
    TasksModule,
    TeamsModule,
    RecurringModule,
    ReportsModule,
    ChecklistModule,
    NotificationsModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
