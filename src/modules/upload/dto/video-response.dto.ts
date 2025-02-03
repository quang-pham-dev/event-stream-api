import { ApiProperty } from '@nestjs/swagger';

export class VideoResponseDto {
  @ApiProperty({
    description: 'Unique identifier of the video',
    example: 'video_123xyz',
  })
  id: string;

  @ApiProperty({
    description: 'Title of the video',
    example: 'My awesome video',
  })
  title: string;

  @ApiProperty({
    description: 'Current status of the video',
    example: 'ready',
  })
  status: string;

  @ApiProperty({
    description: 'URL where the video can be uploaded',
    example: 'https://storage.example.com/upload/video_123xyz',
  })
  uploadUrl: string;

  @ApiProperty({
    description: 'Playback ID for streaming the video',
    example: 'playback_456abc',
    required: false,
  })
  playbackId?: string;

  @ApiProperty({
    description: 'Duration of the video in seconds',
    example: 120.5,
    required: false,
  })
  duration?: number;

  @ApiProperty({
    description: 'Aspect ratio of the video',
    example: '16:9',
    required: false,
  })
  aspectRatio?: string;

  @ApiProperty({
    description: 'Creation timestamp of the video',
    example: '2025-02-02T13:06:43Z',
  })
  createdAt: Date;
}
