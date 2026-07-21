import { SystemRole } from "@prisma/client";
import { IsEnum, IsOptional, IsString, MaxLength, MinLength } from "class-validator";

export class UpdateAdminUserDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  fullName?: string;

  @IsOptional()
  @IsEnum(SystemRole)
  systemRole?: SystemRole;
}
