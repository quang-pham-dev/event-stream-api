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
import { ThrottlerGuard, Throttle } from '@nestjs/throttler';
import {
  ApiTags,
  ApiOperation,
  ApiConsumes,
  ApiBody,
  ApiResponse,
  ApiParam,
} from '@nestjs/swagger';

import { MAX_SIZE } from '@/common/constants/video';
import { UploadService } from './upload.service';
import { UploadResponseDto } from './dto/upload-response.dto';

@ApiTags('Upload')
@Controller('upload')
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  @ApiOperation({ summary: 'Upload a single video file' })
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
          description: 'Title of the video (optional)',
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Video uploaded successfully',
    type: UploadResponseDto,
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
    @Body('title') title?: string,
  ): Promise<UploadResponseDto> {
    return this.uploadService.uploadVideo(file, title);
  }

  @ApiOperation({ summary: 'Upload a single image file' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        image: {
          type: 'string',
          format: 'binary',
          description: 'Image file (jpeg, png, gif, webp)',
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Image uploaded successfully',
    type: UploadResponseDto,
  })
  @Post('image')
  @UseInterceptors(FileInterceptor('image'))
  async uploadImage(
    @UploadedFile(
      new ParseFilePipeBuilder()
        .addFileTypeValidator({
          fileType: /(jpg|jpeg|png|gif|webp)$/,
        })
        .addMaxSizeValidator({
          maxSize: 5 * 1024 * 1024, // 5MB
        })
        .build({
          errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY,
        }),
    )
    file: Express.Multer.File,
  ): Promise<UploadResponseDto> {
    return this.uploadService.uploadImage(file);
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
          },
          description: 'Titles for the videos (optional)',
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Videos upload results',
    type: [UploadResponseDto],
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
  ): Promise<UploadResponseDto[]> {
    // Sanitize titles
    const titles = Array.isArray(rawTitles)
      ? rawTitles.map(
          (title) => title?.trim().replace(/[^a-zA-Z0-9-_. ]/g, '') || '',
        )
      : undefined;

    return this.uploadService.uploadMultipleVideos(files, titles);
  }

  @ApiOperation({ summary: 'Upload multiple image files' })
  @ApiConsumes('multipart/form-data')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        images: {
          type: 'array',
          items: {
            type: 'string',
            format: 'binary',
          },
          description: 'Image files (jpeg, png, gif, webp)',
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Images upload results',
    type: [UploadResponseDto],
  })
  @Post('images')
  @UseInterceptors(FilesInterceptor('images'))
  async uploadMultipleImages(
    @UploadedFiles(
      new ParseFilePipeBuilder()
        .addFileTypeValidator({
          fileType: /(jpg|jpeg|png|gif|webp)$/,
        })
        .addMaxSizeValidator({
          maxSize: 5 * 1024 * 1024, // 5MB
        })
        .build({
          errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY,
        }),
    )
    files: Express.Multer.File[],
  ): Promise<UploadResponseDto[]> {
    return this.uploadService.uploadMultipleImages(files);
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
  async getVideoStatus(@Param('id') id: string): Promise<string> {
    return this.uploadService.getVideoStatus(id);
  }
}
