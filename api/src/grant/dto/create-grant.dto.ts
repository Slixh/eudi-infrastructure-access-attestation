import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, Matches } from 'class-validator';

export class CreateGrantDto {
  @ApiProperty({ example: 'Front door – John Doe' })
  @IsString()
  @IsNotEmpty()
  label: string;

  @ApiProperty({ example: 'lock-001' })
  @IsString()
  @IsNotEmpty()
  resourceId: string;

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
