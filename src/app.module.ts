import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { UploadModule } from '@/modules/upload/upload.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    UploadModule,
  ],
})
export class AppModule {}
