import {
  IsEmail,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from "class-validator";

export class CreateTeamDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}

export class InviteMemberDto {
  @IsEmail()
  email!: string;
}

/** @deprecated Use InviteMemberDto — kept for compatibility */
export class AddMemberDto extends InviteMemberDto {}
