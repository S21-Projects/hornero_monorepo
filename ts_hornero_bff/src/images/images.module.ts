import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ImagesController } from './images.controller.js';
import { ImagesService } from './images.service.js';

@Module({
  imports: [ConfigModule],
  providers: [ImagesService],
  controllers: [ImagesController],
})
export class ImagesModule {}
