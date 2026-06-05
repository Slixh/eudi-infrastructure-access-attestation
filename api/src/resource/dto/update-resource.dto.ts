import { PartialType, OmitType } from '@nestjs/swagger';
import { CreateResourceDto } from './create-resource.dto';

// locationId cannot be changed after creation (move resource = delete + recreate)
export class UpdateResourceDto extends PartialType(
  OmitType(CreateResourceDto, ['locationId'] as const),
) {}
