import { ApiProperty } from '@nestjs/swagger';

export class UpdateStatusDto {
  @ApiProperty({ enum: ['approved', 'rejected'] })
  status!: 'approved' | 'rejected';
}
