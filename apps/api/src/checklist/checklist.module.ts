import { Module } from "@nestjs/common";
import { TasksModule } from "../tasks/tasks.module";
import { ChecklistController } from "./checklist.controller";
import { ChecklistService } from "./checklist.service";

@Module({
  imports: [TasksModule],
  controllers: [ChecklistController],
  providers: [ChecklistService],
})
export class ChecklistModule {}
