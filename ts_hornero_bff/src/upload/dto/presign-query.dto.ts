import { IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export enum UploadTarget {
  ORG_PROFILE = 'org-profile',
  ORG_BANNER = 'org-banner',
  USER_PHOTO = 'user-photo',
}

export enum AllowedContentType {
  JPEG = 'image/jpeg',
  PNG = 'image/png',
  WEBP = 'image/webp',
}

export class PresignQueryDto {
  @ApiProperty({ enum: Object.values(UploadTarget) })
  @IsEnum(UploadTarget)
  type!: UploadTarget;

  @ApiProperty({ example: 'logo.png' })
  @IsString()
  filename!: string;

  @ApiProperty({ enum: Object.values(AllowedContentType) })
  @IsEnum(AllowedContentType)
  contentType!: AllowedContentType;

  @ApiPropertyOptional({ example: 42 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  entityId?: number;
}
