import { Injectable, Logger } from '@nestjs/common';

import { S3Service } from '@/common/services/s3/s3.service';
import { MuxService } from '@/common/services/mux/mux.service';
import { FileUploadException } from '@/common/exceptions';

export interface UploadResult {
  status: 'success' | 'failed';
  data?: {
    id?: string;
    title?: string;
    url: string;
    status?: string;
    duration?: number;
    aspectRatio?: string;
    playbackId?: string;
    createdAt?: Date;
    uploadId?: string;
    s3Url: string;
    contentType: string;
    size: number;
    metadata?: {
      width?: number;
      height?: number;
      duration?: number;
    };
  };
  error?: string;
  fileName: string;
}

/**
 * Service for handling file uploads
 * Manages both video and image uploads, including processing with Mux for videos
 */
@Injectable()
export class UploadService {
  private readonly logger = new Logger(UploadService.name);

  constructor(
    private readonly s3Service: S3Service,
    private readonly muxService: MuxService,
  ) {}

  /**
   * Upload and process a single video file
   * @param file - The video file to upload
   * @param title - Optional title for the video
   * @returns Video metadata including both S3 and Mux details
   */
  async uploadVideo(
    file: Express.Multer.File,
    title?: string,
  ): Promise<UploadResult> {
    try {
      // Upload to S3
      const s3Result = await this.s3Service.uploadFile(file, 'video');

      // Process with Mux
      const muxResult = await this.muxService.createAsset(
        s3Result.url,
        title || file.originalname,
      );

      return {
        status: 'success',
        data: {
          ...muxResult,
          url: s3Result.url,
          contentType: s3Result.contentType,
          size: s3Result.size,
        },
        fileName: file.originalname,
      };
    } catch (error) {
      this.logger.error(`Failed to upload video: ${error.message}`);
      return {
        status: 'failed',
        error: error.message,
        fileName: file.originalname,
      };
    }
  }

  /**
   * Upload a single image file
   * @param file - The image file to upload
   * @returns Upload result with image details
   */
  async uploadImage(file: Express.Multer.File): Promise<UploadResult> {
    try {
      const result = await this.s3Service.uploadFile(file, 'image');
      const { url, contentType, size, metadata } = result;

      return {
        status: 'success',
        data: {
          url,
          s3Url: url,
          contentType,
          size,
          metadata,
        },

        fileName: file.originalname,
      };
    } catch (error) {
      this.logger.error(`Failed to upload image: ${error.message}`);
      return {
        status: 'failed',
        error: error.message,
        fileName: file.originalname,
      };
    }
  }

  /**
   * Upload multiple videos and process them with Mux
   * @param files - Array of video files to upload
   * @param titles - Optional array of titles for the videos
   * @returns Array of upload results
   */
  async uploadMultipleVideos(
    files: Express.Multer.File[],
    titles?: string[],
  ): Promise<UploadResult[]> {
    if (!files || files.length === 0) {
      return [];
    }

    try {
      // Upload all files to S3
      const s3Results = await this.s3Service.uploadMultipleFiles(
        files,
        'video',
      );

      // Process successful uploads with Mux
      const results = await Promise.all(
        s3Results.map(async (result, index) => {
          if (result.status === 'fulfilled' && result.value) {
            try {
              const title = titles?.[index] || files[index].originalname;
              const muxResult = await this.muxService.createAsset(
                result.value.url,
                title,
              );

              const resultSuccess: UploadResult = {
                status: 'success',
                data: {
                  ...muxResult,
                  url: result.value.url,
                  contentType: result.value.contentType,
                  size: result.value.size,
                },
                fileName: result.fileName,
              };

              return resultSuccess;
            } catch (error) {
              // Clean up S3 file if Mux processing fails
              await this.s3Service.deleteFile(result.value.key).catch((err) => {
                this.logger.error(
                  `Failed to delete failed upload from S3: ${err.message}`,
                );
              });

              const resultFailed: UploadResult = {
                status: 'failed',
                error: `Mux processing failed: ${error.message}`,
                fileName: result.fileName,
              };

              return resultFailed;
            }
          }

          const { reason, fileName } = result;
          const resultRejected: UploadResult = {
            status: 'failed',
            error: reason,
            fileName,
          };

          return resultRejected;
        }),
      );

      return results as UploadResult[];
    } catch (error) {
      this.logger.error(`Batch upload failed: ${error.message}`);
      throw new FileUploadException(`Batch upload failed: ${error.message}`);
    }
  }

  /**
   * Upload multiple image files
   * @param files - Array of image files to upload
   * @returns Array of upload results
   */
  async uploadMultipleImages(
    files: Express.Multer.File[],
  ): Promise<UploadResult[]> {
    if (!files || files.length === 0) {
      return [];
    }

    try {
      const results = await this.s3Service.uploadMultipleFiles(files, 'image');

      return results.map((result) => {
        if (result.status === 'fulfilled' && result.value) {
          return {
            status: 'success',
            data: {
              url: result.value.url,
              s3Url: result.value.url,
              contentType: result.value.contentType,
              size: result.value.size,
              metadata: result.value.metadata,
            },
            fileName: result.fileName,
          };
        }

        return {
          status: 'failed',
          error: result.reason,
          fileName: result.fileName,
        };
      });
    } catch (error) {
      this.logger.error(`Batch image upload failed: ${error.message}`);
      throw new FileUploadException(
        `Batch image upload failed: ${error.message}`,
      );
    }
  }

  /**
   * Get the processing status of a video
   * @param id - The Mux asset ID
   * @returns Current status of the video
   */
  async getVideoStatus(id: string): Promise<string> {
    return this.muxService.getAssetStatus(id);
  }
}
