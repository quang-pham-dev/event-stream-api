import { IsString, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UploadVideoDto {
  @ApiProperty({
    description: 'Title of the video',
    required: false,
    example: 'My awesome video',
  })
  @IsString()
  @IsOptional()
  title?: string;
}
