import {
  Controller,
  Post,
  Get,
  Param,
  UploadedFile,
  UseInterceptors,
  Body,
  ParseFilePipeBuilder,
  HttpStatus,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiConsumes,
  ApiBody,
  ApiResponse,
  ApiParam,
} from '@nestjs/swagger';

import { UploadService } from './upload.service';
import { UploadVideoDto } from './dto/upload-video.dto';
import { VideoResponseDto } from './dto/video-response.dto';
import { MAX_SIZE } from '@/common/constants/video';

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
