import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

export class CreateGrantDto {
  @ApiProperty({ example: 'Front door – John Doe' })
  @IsString()
  @IsNotEmpty()
  label: string;

  @ApiProperty({ example: 'lock-001' })
  @IsString()
  @IsNotEmpty()
  resourceId: string;
}
