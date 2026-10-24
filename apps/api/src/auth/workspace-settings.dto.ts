import { Transform } from 'class-transformer'
import { IsString, Length } from 'class-validator'

export class UpdateWorkspaceDto {
  // Keep the reflected type as Object so implicit conversion cannot turn 123 into a valid name.
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsString()
  @Length(2, 80)
  name!: unknown
}
