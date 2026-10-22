import { Transform } from 'class-transformer'
import { IsEmail, IsIn, IsOptional, IsString, IsUrl, Length, MaxLength } from 'class-validator'

function trimmed({ value }: { value: unknown }) {
  return typeof value === 'string' ? value.trim() : value
}

export class CreateResearchRunDto {
  @IsOptional()
  @IsString()
  @Length(1, 128)
  prospectId?: string

  @Transform(trimmed)
  @IsString()
  @Length(2, 120)
  prospectName!: string

  @Transform(trimmed)
  @IsOptional()
  @IsEmail()
  prospectEmail?: string

  @Transform(trimmed)
  @IsOptional()
  @IsString()
  @MaxLength(160)
  companyName?: string

  @Transform(trimmed)
  @IsOptional()
  @IsString()
  @MaxLength(253)
  companyDomain?: string

  @Transform(trimmed)
  @IsOptional()
  @IsUrl({ protocols: ['https'], require_protocol: true })
  linkedinUrl?: string

  @Transform(trimmed)
  @IsOptional()
  @IsString()
  @MaxLength(50)
  xHandle?: string

  @Transform(trimmed)
  @IsString()
  @Length(2, 120)
  offerName!: string

  @Transform(trimmed)
  @IsString()
  @Length(20, 4000)
  offerContext!: string

  @Transform(trimmed)
  @IsOptional()
  @IsString()
  @MaxLength(500)
  targetPersona?: string

  @IsIn(['outreach', 'meeting'])
  goal!: 'outreach' | 'meeting'
}
