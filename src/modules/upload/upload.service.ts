import { Injectable, Logger } from '@nestjs/common';
import { VideoResponseDto } from './dto/video-response.dto';
import { S3Service } from '../../common/services/s3/s3.service';
import { MuxService } from '../../common/services/mux/mux.service';
import { FileUploadException } from '../../common/exceptions/upload.exception';

@Injectable()
export class UploadService {
  private readonly logger = new Logger(UploadService.name);

  constructor(
    private readonly s3Service: S3Service,
    private readonly muxService: MuxService,
  ) {}

  async uploadVideo(
    file: Express.Multer.File,
    title?: string,
  ): Promise<VideoResponseDto> {
    try {
      // Upload to S3
      const s3Url = await this.s3Service.uploadFile(file);
      const s3UrlString = s3Url.url;
      this.logger.log(`Video uploaded to S3: ${s3UrlString}`);

      // Create Mux Asset
      const videoMetadata = await this.muxService.createAsset(
        s3UrlString,
        title || file.originalname,
      );

      return {
        id: videoMetadata.id,
        title: videoMetadata.title,
        status: videoMetadata.status,
        uploadUrl: s3UrlString,
        playbackId: videoMetadata.playbackId,
        duration: videoMetadata.duration,
        aspectRatio: videoMetadata.aspectRatio,
        createdAt: videoMetadata.createdAt,
      };
    } catch (error) {
      this.logger.error(`Video upload failed: ${error.message}`);

      throw new FileUploadException(
        'Failed to process video upload: ' + error.message,
      );
    }
  }

  async getVideoStatus(videoId: string): Promise<string> {
    return this.muxService.getAssetStatus(videoId);
  }
}
