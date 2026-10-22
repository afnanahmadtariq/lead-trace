import { Transform } from 'class-transformer'
import { IsBoolean, IsDateString, IsEmail, IsIn, IsNumber, IsOptional, IsString, IsUUID, Length, Matches, Max, MaxLength, Min } from 'class-validator'

const trim = ({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value
export const stages = ['new', 'qualified', 'proposal', 'negotiation', 'won', 'lost'] as const
export const lifecycles = ['lead', 'qualified', 'customer', 'inactive'] as const

export class ContactDto {
  @Transform(trim) @IsString() @Length(2, 120) name!: string
  @Transform(trim) @IsOptional() @IsEmail() @MaxLength(254) email?: string
  @Transform(trim) @IsOptional() @IsString() @MaxLength(160) companyName?: string
  @Transform(trim) @IsOptional() @IsString() @MaxLength(253) companyDomain?: string
  @Transform(trim) @IsOptional() @IsString() @MaxLength(120) jobTitle?: string
  @Transform(trim) @IsOptional() @IsString() @MaxLength(50) phone?: string
  @IsOptional() @IsIn(lifecycles) lifecycle?: string
  @IsOptional() @IsString() @MaxLength(128) ownerId?: string
}
export class DealDto {
  @IsString() @Length(1, 128) prospectId!: string
  @Transform(trim) @IsString() @Length(2, 160) title!: string
  @IsIn(stages) stage!: string
  @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @Max(999999999999.99) value!: number
  @Matches(/^[A-Z]{3}$/) currency!: string
  @IsOptional() @IsDateString() expectedCloseAt?: string
  @IsOptional() @IsString() @MaxLength(128) ownerId?: string
}
export class NoteDto {
  @Transform(trim) @IsString() @Length(1, 8000) body!: string
}
export class TaskDto {
  @IsString() @Length(1, 128) prospectId!: string
  @Transform(trim) @IsString() @Length(2, 200) title!: string
  @IsDateString() dueAt!: string
  @IsOptional() @IsString() @MaxLength(128) ownerId?: string
}
export class CompleteTaskDto {
  @Transform(({ obj, key }) => obj[key]) @IsBoolean() completed!: boolean
}
export class ImportContactsDto {
  @IsString() @Length(1, 500000) csv!: string
}
export class MeetingDto {
  @IsUUID() id!: string
  @IsString() @Length(1, 128) prospectId!: string
  @Transform(trim) @IsString() @Length(2, 200) title!: string
  @IsDateString() startsAt!: string
  @IsDateString() endsAt!: string
  @Transform(({ obj, key }) => obj[key]) @IsBoolean() inviteContact!: boolean
}
