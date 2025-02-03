export interface VideoMetadata {
  id: string;
  title: string;
  status: string;
  duration: number;
  aspectRatio: string;
  playbackId?: string;
  createdAt: Date;
  uploadId: string;
  s3Url: string;
}
