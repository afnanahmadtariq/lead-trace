import { Transform } from 'class-transformer'
import { IsIn, IsOptional, IsString, Length, MaxLength } from 'class-validator'
import { ContactDto } from '../crm/crm.dto'
const trim = ({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value

export class CreateLeadSearchDto {
  @Transform(trim) @IsString() @Length(2, 100) title!: string
  @Transform(trim) @IsString() @Length(2, 100) industry!: string
  @Transform(trim) @IsString() @Length(2, 100) role!: string
  @Transform(trim) @IsOptional() @IsString() @MaxLength(100) location?: string
  @Transform(trim) @IsOptional() @IsString() @MaxLength(100) keywords?: string
}
export class ReviewLeadDto {
  @IsIn(['new', 'qualified', 'dismissed']) status!: 'new' | 'qualified' | 'dismissed'
}
export class ConvertLeadDto extends ContactDto {
  @IsOptional() @IsString() @Length(1, 128) existingContactId?: string
}
