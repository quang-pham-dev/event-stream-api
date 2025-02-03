import { Injectable, Logger } from '@nestjs/common';
import { Mux } from '@mux/mux-node';

import { VideoMetadata } from '@/common/interfaces';
import { muxConfig } from '@/config/mux.config';

/**
 * Service for handling video processing operations with Mux
 * Provides functionality for uploading, streaming, and managing video assets
 */
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

  /**
   * Upload a single video to Mux and create thumbnails
   * @param videoUrl - The URL of the video file (typically from S3)
   * @returns Object containing streaming URL and thumbnail URLs
   * @throws Error if upload or processing fails
   */
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

      // Generate thumbnails at specific timestamps (1s, 5s, 10s)
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

  /**
   * Create a new live stream
   * @returns Object containing the live stream URL
   * @throws Error if stream creation fails
   */
  async liveStream() {
    try {
      const { video } = this.muxClient;

      // Create a live stream with public playback policy
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

  /**
   * Create a new video asset with metadata
   * @param videoUrl - The URL of the video file (typically from S3)
   * @param title - The title to assign to the video
   * @returns VideoMetadata object containing asset details
   * @throws Error if asset creation fails
   */
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

  /**
   * Get the current processing status of a video asset
   * @param assetId - The Mux asset ID
   * @returns Current status of the asset
   * @throws Error if status retrieval fails
   */
  async getAssetStatus(assetId: string): Promise<string> {
    try {
      const asset = await this.muxClient.video.assets.retrieve(assetId);
      return asset.status;
    } catch (error) {
      this.logger.error(`Failed to get asset status: ${error.message}`);
      throw new Error('Failed to get video status');
    }
  }

  /**
   * Upload multiple videos to Mux concurrently
   * Uses Promise.allSettled to handle partial failures
   * @param videoUrls - Array of video URLs to process
   * @returns Array of results, each containing either success data or failure reason
   * @throws Error if the batch process fails entirely
   */
  async uploadMultipleVideos(videoUrls: string[]): Promise<
    Array<{
      status: 'fulfilled' | 'rejected';
      value?: {
        url: string;
        thumbnail: string;
        thumbnails: string[];
      };
      reason?: string;
    }>
  > {
    try {
      const uploadPromises = videoUrls.map((url) => this.uploadVideo(url));
      const results = await Promise.allSettled(uploadPromises);

      return results.map((result) => {
        if (result.status === 'fulfilled') {
          return {
            status: 'fulfilled',
            value: result.value,
          };
        } else {
          this.logger.error(`Failed to upload video to Mux: ${result.reason}`);
          return {
            status: 'rejected',
            reason: result.reason?.toString() || 'Unknown error',
          };
        }
      });
    } catch (error) {
      throw new Error(
        `[MuxService] Upload multiple videos failed: ${error.message}`,
      );
    }
  }

  /**
   * Create multiple video assets concurrently
   * Uses Promise.allSettled to handle partial failures
   * @param videos - Array of objects containing video URL and title
   * @returns Array of results, each containing either VideoMetadata or failure reason
   * @throws Error if the batch process fails entirely
   */
  async createMultipleAssets(
    videos: Array<{ url: string; title: string }>,
  ): Promise<
    Array<{
      status: 'fulfilled' | 'rejected';
      value?: VideoMetadata;
      reason?: string;
    }>
  > {
    try {
      const assetPromises = videos.map((video) =>
        this.createAsset(video.url, video.title),
      );

      const results = await Promise.allSettled(assetPromises);
      return results.map((result) => {
        if (result.status === 'fulfilled') {
          return {
            status: 'fulfilled',
            value: result.value,
          };
        } else {
          this.logger.error(`Failed to create Mux asset: ${result.reason}`);
          return {
            status: 'rejected',
            reason: result.reason?.toString() || 'Unknown error',
          };
        }
      });
    } catch (error) {
      this.logger.error(
        `Failed to create multiple Mux assets: ${error.message}`,
      );
      throw new Error('Failed to process multiple videos with Mux');
    }
  }
}
