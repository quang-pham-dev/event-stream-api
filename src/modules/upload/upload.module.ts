import { Module } from '@nestjs/common';
import { UploadController } from './upload.controller';
import { UploadService } from './upload.service';
import { S3Module } from '../../common/services/s3/s3.module';
import { MuxModule } from '../../common/services/mux/mux.module';

@Module({
  imports: [S3Module, MuxModule],
  controllers: [UploadController],
  providers: [UploadService],
})
export class UploadModule {}
