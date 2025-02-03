import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestExpressApplication } from '@nestjs/platform-express';
import * as express from 'express';
import 'reflect-metadata';
import * as requestIp from 'request-ip';
import helmet from 'helmet';
import * as compression from 'compression';
import * as bodyParser from 'body-parser';

import { AppModule } from '@/app.module';
import { bootstrapSwagger } from '@/config/swagger.config';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
  });
  const configService = app.get(ConfigService);
  const PORT = configService.get<number>('PORT') || 8081;

  // #Application Settings
  app.use(requestIp.mw());

  // #Security
  app.enable('trust proxy');
  app.use(helmet());
  // Gzip
  app.use(compression());

  // #BodyParser
  app.use(bodyParser.json({ limit: '50mb' }));
  app.use(
    bodyParser.urlencoded({
      limit: '50mb',
      extended: true,
      parameterLimit: 50000,
    }),
  );

  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true }));

  app.setGlobalPrefix('api');

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );

  // #DocumentAPI
  bootstrapSwagger(app);

  await app.listen(PORT, () => {
    console.log('🚀📢Application is running on PORT', PORT);
  });
}
bootstrap()
  .then(() => console.log('🚀Bootstrap', new Date().toLocaleString()))
  .catch(console.error);
