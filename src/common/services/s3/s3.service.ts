import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

import { s3Config } from '@/config';
import { FileUploadException } from '@/common/exceptions';

const { region, credentials, bucket } = s3Config;
const { accessKeyId, secretAccessKey } = credentials;

@Injectable()
export class S3Service {
  private s3Client: S3Client;
  private bucketName: string;
  private readonly logger: Logger;

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
   * Upload a single video file to S3
   * @param file - The uploaded file
   * @returns an object containing the uploaded file URL and key
   */
  async uploadFile(
    file: Express.Multer.File,
    folder: string = 'videos',
  ): Promise<{
    url: string;
    key: string;
  }> {
    if (!file) return;

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
}
