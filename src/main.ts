import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { json, urlencoded } from 'express';
import { WinstonModule } from 'nest-winston';
import { winstonLogger } from './common/logger/winston.config';
import { GlobalExceptionFilter } from './common/filters/http-exception.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';

async function bootstrap() {
  // Validate JWT_SECRET at startup
  if (!process.env.JWT_SECRET) {
    throw new Error('CRITICAL: JWT_SECRET environment variable is not set. Application cannot start.');
  }

  const app = await NestFactory.create(AppModule, {
    logger: WinstonModule.createLogger(winstonLogger as any),
  });
  
  // Configure CORS: only allow requests from frontend domain
  const allowedOrigins = [
    process.env.FRONTEND_URL || 'http://localhost:5175',
    'http://localhost:5173',
    'http://localhost:5174',
    'http://localhost:5175',
  ];
  
  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    allowedHeaders: 'Content-Type,Authorization',
  });

  app.use(json({ limit: '50mb' }));
  app.use(urlencoded({ extended: true, limit: '50mb' }));

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true, // Throws an error if extra fields are sent
    }),
  );

  app.useGlobalFilters(new GlobalExceptionFilter());
  app.useGlobalInterceptors(new TransformInterceptor());

  // --- Swagger Setup ---
  const config = new DocumentBuilder()
    .setTitle('Event Platform API')
    .setDescription('The core API for the Event Management Platform')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const documentFactory = () => SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, documentFactory);
  // ---------------------

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
