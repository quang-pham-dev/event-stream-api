import { ApiProperty } from '@nestjs/swagger';

import { UploadDataDto } from './upload-data.dto';

export class UploadResponseDto {
  @ApiProperty({ enum: ['success', 'failed'] })
  status: 'success' | 'failed';

  @ApiProperty({ type: UploadDataDto, required: false })
  data?: UploadDataDto;

  @ApiProperty({
    description: 'Error message if upload failed',
    required: false,
  })
  error?: string;

  @ApiProperty({ description: 'Original filename' })
  fileName: string;
}
