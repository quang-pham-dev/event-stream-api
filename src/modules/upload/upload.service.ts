import { Injectable, Logger } from '@nestjs/common';

import { S3Service } from '@/common/services/s3/s3.service';
import { MuxService } from '@/common/services/mux/mux.service';
import { FileUploadException } from '@/common/exceptions/upload.exception';
import { VideoResponseDto } from './dto/video-response.dto';

@Injectable()
export class UploadService {
  private readonly logger = new Logger(UploadService.name);

  private readonly MAX_CONCURRENT_UPLOADS = 5;
  private readonly MAX_FILES_PER_REQUEST = 10;

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

  private async cleanupS3File(key: string) {
    try {
      await this.s3Service.deleteFile(key);
    } catch (error) {
      this.logger.error(`Failed to cleanup S3 file ${key}: ${error.message}`);
    }
  }

  async uploadMultipleVideos(
    files: Express.Multer.File[],
    titles?: string[],
  ): Promise<
    Array<{
      status: 'success' | 'failed';
      data?: VideoResponseDto;
      error?: string;
      fileName: string;
    }>
  > {
    // Validate input
    if (files.length > this.MAX_FILES_PER_REQUEST) {
      throw new FileUploadException(
        `Maximum ${this.MAX_FILES_PER_REQUEST} files allowed per request`,
      );
    }

    if (titles && titles.length !== files.length) {
      throw new FileUploadException(
        'Number of titles must match number of files',
      );
    }

    try {
      // Process files in batches to prevent memory issues
      const results: Array<{
        status: 'success' | 'failed';
        data?: VideoResponseDto;
        error?: string;
        fileName: string;
      }> = [];

      // Process files in batches
      for (let i = 0; i < files.length; i += this.MAX_CONCURRENT_UPLOADS) {
        const batch = files.slice(i, i + this.MAX_CONCURRENT_UPLOADS);
        const batchTitles = titles?.slice(i, i + this.MAX_CONCURRENT_UPLOADS);

        // Upload batch to S3
        const s3Results = await this.s3Service.uploadMultipleFiles(batch);
        this.logger.log(`Batch processed by S3: ${s3Results.length} files`);

        // Filter successful S3 uploads
        const successfulS3Uploads = s3Results
          .map((result, index) => ({
            ...result,
            file: batch[index],
            title: batchTitles?.[index] || batch[index].originalname,
          }))
          .filter(
            (
              result,
            ): result is {
              status: 'fulfilled';
              value: { url: string; key: string };
              file: Express.Multer.File;
              title: string;
            } => result.status === 'fulfilled' && !!result.value,
          );

        // Create Mux Assets for successful S3 uploads
        const muxResults = await this.muxService.createMultipleAssets(
          successfulS3Uploads.map((result) => ({
            url: result.value.url,
            title: result.title,
          })),
        );

        // Process batch results
        for (let j = 0; j < batch.length; j++) {
          const file = batch[j];
          const s3Result = s3Results[j];
          const muxResult = muxResults[j];

          if (s3Result.status === 'rejected') {
            results.push({
              status: 'failed',
              error: s3Result.reason,
              fileName: file.originalname,
            });
            continue;
          }

          if (!muxResult || muxResult.status === 'rejected') {
            // Cleanup S3 file if Mux processing failed
            await this.cleanupS3File(s3Result.value.key);

            results.push({
              status: 'failed',
              error: muxResult?.reason || 'Failed to process with Mux',
              fileName: file.originalname,
            });
            continue;
          }

          results.push({
            status: 'success',
            data: {
              id: muxResult.value.id,
              title: muxResult.value.title,
              status: muxResult.value.status,
              uploadUrl: muxResult.value.s3Url,
              playbackId: muxResult.value.playbackId,
              duration: muxResult.value.duration,
              aspectRatio: muxResult.value.aspectRatio,
              createdAt: muxResult.value.createdAt,
            },
            fileName: file.originalname,
          });
        }
      }

      return results;
    } catch (error) {
      this.logger.error(
        `Multiple video upload process failed: ${error.message}`,
      );
      throw new FileUploadException(
        'Failed to process multiple video upload: ' + error.message,
      );
    }
  }
}
