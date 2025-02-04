import { ApiProperty } from '@nestjs/swagger';
import { FileMetadataDto } from './file-metadata.dto';

export class UploadDataDto {
  @ApiProperty({ description: 'Video ID (for videos only)', required: false })
  id?: string;

  @ApiProperty({ description: 'File title', required: false })
  title?: string;

  @ApiProperty({ description: 'File URL' })
  url: string;

  @ApiProperty({
    description: 'Processing status (for videos only)',
    required: false,
  })
  status?: string;

  @ApiProperty({
    description: 'Video duration in seconds (for videos only)',
    required: false,
  })
  duration?: number;

  @ApiProperty({
    description: 'Video aspect ratio (for videos only)',
    required: false,
  })
  aspectRatio?: string;

  @ApiProperty({
    description: 'Mux playback ID (for videos only)',
    required: false,
  })
  playbackId?: string;

  @ApiProperty({ description: 'Creation timestamp', required: false })
  createdAt?: Date;

  @ApiProperty({ description: 'Upload ID', required: false })
  uploadId?: string;

  @ApiProperty({ description: 'S3 storage URL' })
  s3Url: string;

  @ApiProperty({ description: 'File MIME type' })
  contentType: string;

  @ApiProperty({ description: 'File size in bytes' })
  size: number;

  @ApiProperty({ type: FileMetadataDto, required: false })
  metadata?: FileMetadataDto;
}
