import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  PutObjectCommand,
  S3Client,
  DeleteObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';

import { s3Config } from '@/config';
import { FileUploadException } from '@/common/exceptions';

const { region, credentials, bucket } = s3Config;
const { accessKeyId, secretAccessKey } = credentials;

export interface S3UploadResult {
  url: string;
  key: string;
  contentType: string;
  size: number;
  metadata?: {
    width?: number;
    height?: number;
    duration?: number;
  };
}

/**
 * Service for handling file operations with AWS S3
 * Provides functionality for uploading and deleting video files and images
 * Includes validation for file types and handles multiple file operations
 */
@Injectable()
export class S3Service {
  private s3Client: S3Client;
  private bucketName: string;
  private readonly logger: Logger;

  private readonly ALLOWED_VIDEO_TYPES = [
    'video/mp4',
    'video/quicktime', // mov
    'video/x-msvideo', // avi
    'video/x-matroska', // mkv
    'video/webm',
  ];

  private readonly ALLOWED_IMAGE_TYPES = [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
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
   * @param fileType - Type of file to validate (video or image)
   * @throws FileUploadException if validation fails
   * @private
   */
  private validateFile(file: Express.Multer.File, fileType: 'video' | 'image') {
    const allowedTypes =
      fileType === 'video'
        ? this.ALLOWED_VIDEO_TYPES
        : this.ALLOWED_IMAGE_TYPES;

    if (!file.mimetype || !allowedTypes.includes(file.mimetype)) {
      throw new FileUploadException(
        `Invalid ${fileType} type. Allowed types: ${allowedTypes.join(', ')}`,
      );
    }

    // Add size validation
    const maxSize = fileType === 'video' ? 100 * 1024 * 1024 : 5 * 1024 * 1024; // 100MB for videos, 5MB for images
    if (file.size > maxSize) {
      throw new FileUploadException(
        `File size exceeds limit. Maximum size for ${fileType} is ${maxSize / (1024 * 1024)}MB`,
      );
    }
  }

  /**
   * Get metadata for an uploaded file
   * @param key - The S3 key of the file
   * @returns Object containing file metadata
   * @private
   */
  private async getFileMetadata(key: string): Promise<{
    contentType: string;
    size: number;
  }> {
    try {
      const headParams = {
        Bucket: this.bucketName,
        Key: key,
      };

      const response = await this.s3Client.send(
        new HeadObjectCommand(headParams),
      );
      return {
        contentType: response.ContentType || 'application/octet-stream',
        size: response.ContentLength || 0,
      };
    } catch (error) {
      this.logger.error(`Failed to get file metadata: ${error.message}`);
      throw new FileUploadException(
        `Failed to get file metadata: ${error.message}`,
      );
    }
  }

  /**
   * Upload a single file (video or image) to S3 bucket
   * @param file - The file to upload (from Multer)
   * @param fileType - Type of file (video or image)
   * @param folder - Target folder in S3 bucket
   * @returns Object containing the uploaded file's details
   * @throws FileUploadException if upload fails or validation fails
   */
  async uploadFile(
    file: Express.Multer.File,
    fileType: 'video' | 'image',
    folder: string = fileType === 'video' ? 'videos' : 'images',
  ): Promise<S3UploadResult> {
    if (!file) throw new FileUploadException('No file provided');

    this.validateFile(file, fileType);

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
      const metadata = await this.getFileMetadata(fileName);
      const { contentType, size } = metadata;

      const result: S3UploadResult = {
        url: `https://${this.bucketName}.s3.${region}.amazonaws.com/${fileName}`,
        key: fileName,
        contentType,
        size,
      };

      return result;
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
   * @param fileType - Type of files (video or image)
   * @param folder - Target folder in S3 bucket
   * @returns Array of results, each containing either success data or failure reason
   * @throws FileUploadException if the batch process fails entirely
   */
  async uploadMultipleFiles(
    files: Express.Multer.File[],
    fileType: 'video' | 'image',
    folder?: string,
  ): Promise<
    Array<{
      status: 'fulfilled' | 'rejected';
      value?: S3UploadResult;
      reason?: string;
      fileName: string;
    }>
  > {
    if (!files || files.length === 0) return [];

    const uploadPromises = files.map((file) =>
      this.uploadFile(file, fileType, folder)
        .then((value) => ({
          status: 'fulfilled' as const,
          value,
          fileName: file.originalname,
        }))
        .catch((error) => ({
          status: 'rejected' as const,
          reason: error.message,
          fileName: file.originalname,
        })),
    );

    try {
      return await Promise.all(uploadPromises);
    } catch (error) {
      this.logger.error(`Failed to process upload batch: ${error.message}`);
      throw new FileUploadException(
        `Failed to process upload batch: ${error.message}`,
      );
    }
  }
}
