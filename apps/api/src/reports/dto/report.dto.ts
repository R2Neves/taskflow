import { IsISO8601, IsOptional, IsString, IsUUID, MaxLength } from "class-validator";

export class TaskReportQueryDto {
  @IsOptional()
  @IsUUID()
  teamId?: string;

  @IsOptional()
  @IsISO8601()
  from?: string;

  @IsOptional()
  @IsISO8601()
  to?: string;
}

export class EmailTaskReportDto {
  @IsUUID()
  teamId!: string;

  @IsOptional()
  @IsISO8601()
  from?: string;

  @IsOptional()
  @IsISO8601()
  to?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  subject?: string;
}
