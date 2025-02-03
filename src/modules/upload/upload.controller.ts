import {
  Controller,
  Post,
  Get,
  Param,
  UploadedFile,
  UploadedFiles,
  UseInterceptors,
  Body,
  ParseFilePipeBuilder,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiConsumes,
  ApiBody,
  ApiResponse,
  ApiParam,
} from '@nestjs/swagger';
import { ThrottlerGuard, Throttle } from '@nestjs/throttler';

import { MAX_SIZE } from '@/common/constants/video';
import { UploadService } from './upload.service';
import { UploadVideoDto } from './dto/upload-video.dto';
import { VideoResponseDto } from './dto/video-response.dto';

@ApiTags('Upload')
@Controller('upload')
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  @ApiOperation({ summary: 'Upload a video file' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        video: {
          type: 'string',
          format: 'binary',
          description: 'Video file (mp4, mov, avi, mkv, webm)',
        },
        title: {
          type: 'string',
          description: 'Title of the video',
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Video uploaded successfully',
    type: VideoResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.UNPROCESSABLE_ENTITY,
    description: 'Invalid file type or size exceeds limit',
  })
  @Post('video')
  @UseInterceptors(FileInterceptor('video'))
  async uploadVideo(
    @UploadedFile(
      new ParseFilePipeBuilder()
        .addFileTypeValidator({
          fileType: /(mp4|mov|avi|mkv|webm)$/,
        })
        .addMaxSizeValidator({
          maxSize: MAX_SIZE,
        })
        .build({
          errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY,
        }),
    )
    file: Express.Multer.File,
    @Body() uploadVideoDto: UploadVideoDto,
  ): Promise<VideoResponseDto> {
    return this.uploadService.uploadVideo(file, uploadVideoDto.title);
  }

  @ApiOperation({ summary: 'Upload multiple video files' })
  @ApiConsumes('multipart/form-data')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { ttl: 60000, limit: 5 } }) // 5 requests per minute
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        videos: {
          type: 'array',
          items: {
            type: 'string',
            format: 'binary',
          },
          description: 'Video files (mp4, mov, avi, mkv, webm)',
        },
        titles: {
          type: 'array',
          items: {
            type: 'string',
            maxLength: 255,
            pattern: '^[a-zA-Z0-9-_. ]+$',
          },
          description: 'Titles of the videos (optional)',
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Videos upload results',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          status: {
            type: 'string',
            enum: ['success', 'failed'],
            description: 'Upload status for this file',
          },
          data: {
            type: 'object',
            description: 'Video metadata (only present if status is success)',
            properties: {
              id: { type: 'string', description: 'Video ID' },
              title: { type: 'string', description: 'Video title' },
              status: { type: 'string', description: 'Video status' },
              duration: {
                type: 'number',
                description: 'Video duration in seconds',
              },
              aspectRatio: {
                type: 'string',
                description: 'Video aspect ratio',
              },
              playbackId: {
                type: 'string',
                description: 'Playback ID for streaming',
                nullable: true,
              },
              createdAt: {
                type: 'string',
                format: 'date-time',
                description: 'Creation timestamp',
              },
              uploadId: { type: 'string', description: 'Upload ID' },
              s3Url: { type: 'string', description: 'S3 storage URL' },
            },
          },
          error: {
            type: 'string',
            description: 'Error message (only present if status is failed)',
          },
          fileName: {
            type: 'string',
            description: 'Original file name',
          },
        },
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.UNPROCESSABLE_ENTITY,
    description: 'Invalid file type or size exceeds limit',
  })
  @ApiResponse({
    status: HttpStatus.TOO_MANY_REQUESTS,
    description: 'Too many upload requests',
  })
  @Post('videos')
  @UseInterceptors(FilesInterceptor('videos'))
  async uploadMultipleVideos(
    @UploadedFiles(
      new ParseFilePipeBuilder()
        .addFileTypeValidator({
          fileType: /(mp4|mov|avi|mkv|webm)$/,
        })
        .addMaxSizeValidator({
          maxSize: MAX_SIZE,
        })
        .build({
          errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY,
        }),
    )
    files: Express.Multer.File[],
    @Body('titles') rawTitles?: string[],
  ): Promise<
    Array<{
      status: 'success' | 'failed';
      data?: VideoResponseDto;
      error?: string;
      fileName: string;
    }>
  > {
    // Sanitize titles
    const titles = Array.isArray(rawTitles)
      ? rawTitles.map(
          (title) => title?.trim().replace(/[^a-zA-Z0-9-_. ]/g, '') || '',
        )
      : [];

    return this.uploadService.uploadMultipleVideos(files, titles);
  }

  @ApiOperation({ summary: 'Get video processing status' })
  @ApiParam({
    name: 'id',
    description: 'Video ID',
    required: true,
    type: 'string',
  })
  @ApiResponse({
    status: 200,
    description: 'Video status retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          example: 'ready',
          description: 'Current status of the video',
        },
      },
    },
  })
  @Get('video/:id/status')
  async getVideoStatus(@Param('id') id: string): Promise<{ status: string }> {
    const status = await this.uploadService.getVideoStatus(id);
    return { status };
  }
}
