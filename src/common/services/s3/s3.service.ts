import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  PutObjectCommand,
  S3Client,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';

import { s3Config } from '@/config';
import { FileUploadException } from '@/common/exceptions';

const { region, credentials, bucket } = s3Config;
const { accessKeyId, secretAccessKey } = credentials;

/**
 * Service for handling file operations with AWS S3
 * Provides functionality for uploading and deleting video files
 * Includes validation for file types and handles multiple file operations
 */
@Injectable()
export class S3Service {
  private s3Client: S3Client;
  private bucketName: string;
  private readonly logger: Logger;

  private readonly ALLOWED_MIME_TYPES = [
    'video/mp4',
    'video/quicktime', // mov
    'video/x-msvideo', // avi
    'video/x-matroska', // mkv
    'video/webm',
  ];

  constructor() {
    this.s3Client = new S3Client({
      region,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });

    this.bucketName = bucket;
    this.logger = new Logger(S3Service.name);
  }

  /**
   * Validates uploaded file against allowed MIME types and other criteria
   * @param file - The file to validate
   * @throws FileUploadException if validation fails
   * @private
   */
  private validateFile(file: Express.Multer.File) {
    if (!file.mimetype || !this.ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      throw new FileUploadException(
        `Invalid file type. Allowed types: ${this.ALLOWED_MIME_TYPES.join(', ')}`,
      );
    }

    // Additional validation can be added here
    // e.g., check file signature, validate dimensions, etc.
  }

  /**
   * Upload a single video file to S3 bucket
   * @param file - The file to upload (from Multer)
   * @param folder - Target folder in S3 bucket (default: 'videos')
   * @returns Object containing the uploaded file's URL and S3 key
   * @throws FileUploadException if upload fails or validation fails
   */
  async uploadFile(
    file: Express.Multer.File,
    folder: string = 'videos',
  ): Promise<{
    url: string;
    key: string;
  }> {
    if (!file) return;

    // Validate file before upload
    this.validateFile(file);

    const { originalname, mimetype, buffer } = file;
    const fileName = `${folder}/${randomUUID()}-${originalname}`;

    const uploadParams = {
      Bucket: this.bucketName,
      Key: fileName,
      Body: buffer,
      ContentType: mimetype,
    };

    try {
      await this.s3Client.send(new PutObjectCommand(uploadParams));

      return {
        url: `https://${this.bucketName}.s3.${region}.amazonaws.com/${fileName}`,
        key: fileName,
      };
    } catch (error) {
      this.logger.error(`Failed to upload file to S3: ${error.message}`);

      throw new FileUploadException(
        `Failed to upload file to S3: ${error.message}`,
      );
    }
  }

  /**
   * Delete a file from S3 bucket using its key
   * @param key - The S3 key of the file to delete
   * @throws FileUploadException if deletion fails
   */
  async deleteFile(key: string): Promise<void> {
    try {
      const deleteParams = {
        Bucket: this.bucketName,
        Key: key,
      };

      await this.s3Client.send(new DeleteObjectCommand(deleteParams));
      this.logger.log(`Successfully deleted file from S3: ${key}`);
    } catch (error) {
      this.logger.error(`Failed to delete file from S3: ${error.message}`);
      throw new FileUploadException(
        `Failed to delete file from S3: ${error.message}`,
      );
    }
  }

  /**
   * Upload multiple files to S3 bucket concurrently
   * Uses Promise.allSettled to handle partial failures
   * @param files - Array of files to upload (from Multer)
   * @param folder - Target folder in S3 bucket (default: 'videos')
   * @returns Array of results, each containing either success data or failure reason
   * @throws FileUploadException if the batch process fails entirely
   */
  async uploadMultipleFiles(
    files: Express.Multer.File[],
    folder: string = 'videos',
  ): Promise<
    Array<{
      status: 'fulfilled' | 'rejected';
      value?: { url: string; key: string };
      reason?: string;
    }>
  > {
    if (!files || files.length === 0) return [];

    const uploadPromises = files.map((file) => this.uploadFile(file, folder));

    try {
      const results = await Promise.allSettled(uploadPromises);

      return results.map((result) => {
        if (result.status === 'fulfilled') {
          return {
            status: 'fulfilled',
            value: result.value,
          };
        } else {
          this.logger.error(`Failed to upload file to S3: ${result.reason}`);
          return {
            status: 'rejected',
            reason: result.reason?.toString() || 'Unknown error',
          };
        }
      });
    } catch (error) {
      this.logger.error(`Failed to process upload batch: ${error.message}`);
      throw new FileUploadException(
        `Failed to process upload batch: ${error.message}`,
      );
    }
  }
}
