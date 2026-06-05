import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, Length } from 'class-validator';

export class CreateLocationDto {
  @ApiProperty({ example: 'TU Berlin – Hauptgebäude' })
  @IsString() @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'Straße des 17. Juni 135' })
  @IsString() @IsNotEmpty()
  street: string;

  @ApiProperty({ example: '10623' })
  @IsString() @IsNotEmpty()
  postalCode: string;

  @ApiProperty({ example: 'Berlin' })
  @IsString() @IsNotEmpty()
  city: string;

  @ApiPropertyOptional({ example: 'DE', default: 'DE' })
  @IsOptional() @IsString() @Length(2, 2)
  country?: string;

  @ApiPropertyOptional({ example: 'Gebäude A, Etage 3' })
  @IsOptional() @IsString()
  notes?: string;
}
