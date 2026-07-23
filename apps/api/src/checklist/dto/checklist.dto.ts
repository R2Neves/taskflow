import { ChecklistScope, Priority, Visibility } from "@prisma/client";
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
  ValidateIf,
} from "class-validator";

export class CreateChecklistDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  notes?: string;

  @IsOptional()
  @IsEnum(ChecklistScope)
  scope?: ChecklistScope;

  @IsOptional()
  @IsUUID()
  teamId?: string;
}

export class UpdateChecklistDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  notes?: string;

  @IsOptional()
  @IsEnum(ChecklistScope)
  scope?: ChecklistScope;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsUUID()
  teamId?: string | null;

  @IsOptional()
  @IsBoolean()
  done?: boolean;

  @IsOptional()
  @IsInt()
  sortOrder?: number;
}

export class ScheduleChecklistDto {
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  date!: string;

  @Matches(/^\d{2}:\d{2}$/)
  startTime!: string;

  @Matches(/^\d{2}:\d{2}$/)
  endTime!: string;

  @IsOptional()
  @IsEnum(Priority)
  priority?: Priority;

  /** When set, schedules as team activity. */
  @IsOptional()
  @IsUUID()
  teamId?: string;

  @IsOptional()
  @IsEnum(Visibility)
  visibility?: Visibility;

  @IsOptional()
  @IsBoolean()
  force?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  overlapReason?: string;
}
