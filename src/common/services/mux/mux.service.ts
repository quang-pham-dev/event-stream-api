import { Injectable, Logger } from '@nestjs/common';
import { Mux } from '@mux/mux-node';

import { VideoMetadata } from '@/common/interfaces';
import { muxConfig } from '@/config/mux.config';

@Injectable()
export class MuxService {
  private muxClient: Mux;
  private readonly MUX_VIDEO_BASE_URL: string;
  private readonly MUX_THUMBNAIL_BASE_URL: string;
  private readonly logger = new Logger(MuxService.name);

  constructor() {
    this.muxClient = new Mux({
      tokenId: muxConfig.tokenId,
      tokenSecret: muxConfig.tokenSecret,
    });

    this.MUX_VIDEO_BASE_URL = muxConfig.videoBaseUrl;
    this.MUX_THUMBNAIL_BASE_URL = muxConfig.thumbnailBaseUrl;
  }

  async uploadVideo(videoUrl: string) {
    try {
      const { video } = this.muxClient;

      // Upload video to Mux

      const asset = await video.assets.create({
        input: [{ url: videoUrl }],
        playback_policy: ['public'],
        video_quality: 'basic',
      });

      const playbackId = asset.playback_ids[0]?.id;
      const url = `${this.MUX_VIDEO_BASE_URL}/${playbackId}.m3u8`;

      // get original thumbnail
      const originalThumbnail = `${this.MUX_THUMBNAIL_BASE_URL}/${playbackId}/thumbnail.png`;

      // get list of thumbnails at certain times (ví dụ: 1s, 5s, 10s)
      const thumbnails = [
        `${this.MUX_THUMBNAIL_BASE_URL}/${playbackId}/thumbnail.png?time=1`,
        `${this.MUX_THUMBNAIL_BASE_URL}/${playbackId}/thumbnail.png?time=5`,
        `${this.MUX_THUMBNAIL_BASE_URL}/${playbackId}/thumbnail.png?time=10`,
      ];

      return {
        url,
        thumbnail: originalThumbnail,
        thumbnails,
      };
    } catch (error) {
      throw new Error(`[MuxService] Upload video failed: ${error.message}`);
    }
  }

  async liveStream() {
    try {
      const { video } = this.muxClient;

      // Create a live stream
      const asset = await video.liveStreams.create({
        playback_policy: ['public'],
        new_asset_settings: { playback_policy: ['public'] },
      });

      const playbackId = asset.playback_ids[0]?.id;
      const url = `${this.MUX_VIDEO_BASE_URL}/${playbackId}.m3u8`;

      return {
        url,
      };
    } catch (error) {
      throw new Error(`[MuxService] Live stream failed: ${error.message}`);
    }
  }

  async createAsset(videoUrl: string, title: string): Promise<VideoMetadata> {
    try {
      const asset = await this.muxClient.video.assets.create({
        input: [{ url: videoUrl }],
        playback_policy: ['public'],
        mp4_support: 'standard',
      });

      return {
        id: asset.id,
        title,
        status: asset.status,
        duration: asset.duration,
        aspectRatio: asset.aspect_ratio,
        playbackId: asset.playback_ids?.[0]?.id,
        createdAt: new Date(asset.created_at),
        uploadId: asset.upload_id,
        s3Url: videoUrl,
      };
    } catch (error) {
      this.logger.error(`Failed to create Mux asset: ${error.message}`);
      throw new Error('Failed to process video with Mux');
    }
  }

  async getAssetStatus(assetId: string): Promise<string> {
    try {
      const asset = await this.muxClient.video.assets.retrieve(assetId);
      return asset.status;
    } catch (error) {
      this.logger.error(`Failed to get asset status: ${error.message}`);
      throw new Error('Failed to get video status');
    }
  }
}
