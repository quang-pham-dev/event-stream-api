import { ApiProperty } from '@nestjs/swagger';

export class FileMetadataDto {
  @ApiProperty({
    description: 'Image width (for images only)',
    required: false,
  })
  width?: number;

  @ApiProperty({
    description: 'Image height (for images only)',
    required: false,
  })
  height?: number;

  @ApiProperty({
    description: 'Video duration (for videos only)',
    required: false,
  })
  duration?: number;
}
