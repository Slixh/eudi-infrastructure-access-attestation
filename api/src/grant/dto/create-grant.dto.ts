import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, Matches, IsArray, ArrayMinSize } from 'class-validator';

export class CreateGrantDto {
  @ApiProperty({ example: 'Berlin – Serverraum EG' })
  @IsString()
  @IsNotEmpty()
  label: string;

  @ApiProperty({
    example: ['clx123abc', 'clx456def'],
    description: 'IDs of Resource entities to grant access to (at least one required)',
    type: [String],
  })
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  resourceEntityIds: string[];

  // ── Optional PID binding ──────────────────────────────────────────────────
  // If any field is provided, the presented PID must match during OID4VP.

  @ApiPropertyOptional({ example: 'Max' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  pidFirstName?: string;

  @ApiPropertyOptional({ example: 'Mustermann' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  pidFamilyName?: string;

  @ApiPropertyOptional({ example: '1990-01-15' })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'pidBirthdate must be ISO-8601 (YYYY-MM-DD)' })
  pidBirthdate?: string;
}
