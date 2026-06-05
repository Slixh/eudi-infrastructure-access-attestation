import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class CreateResourceDto {
  @ApiProperty({ example: 'Serverraum EG' })
  @IsString() @IsNotEmpty()
  name: string;

  @ApiProperty({
    example: 'door:building-a:floor-0:server',
    description: 'Unique machine-readable identifier used in the EAA credential claim',
  })
  @IsString() @IsNotEmpty()
  identifier: string;

  @ApiPropertyOptional({ example: 'Zugangskontrolle Serverraum Erdgeschoss' })
  @IsOptional() @IsString()
  description?: string;

  @ApiProperty({ example: 'clx123abc' })
  @IsString() @IsNotEmpty()
  locationId: string;
}
