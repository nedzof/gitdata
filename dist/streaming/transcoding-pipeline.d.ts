/**
 * Video Transcoding Pipeline for Streaming Implementation
 *
 * Implements the complete video transcoding system as specified in D43 Phase 3:
 * - FFmpeg integration with multiple output formats
 * - HLS playlist generation with adaptive bitrates
 * - DASH manifest creation for cross-platform compatibility
 * - Progress tracking and error handling
 * - Job queue management and worker coordination
 */
import { EventEmitter } from 'events';
export interface TranscodingProfile {
    profileId: string;
    quality: string;
    bitrate: number;
    resolution: string;
    codec: string;
    format: 'hls' | 'dash' | 'mp4' | 'webm';
    audioCodec?: string;
    audioBitrate?: number;
    framerate?: number;
    keyframeInterval?: number;
    additionalOptions?: string[];
}
export interface TranscodingJob {
    jobId: string;
    inputPath: string;
    inputMetadata?: VideoMetadata;
    profiles: TranscodingProfile[];
    outputDir: string;
    status: 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled';
    progress: number;
    currentProfile?: string;
    startedAt?: Date;
    completedAt?: Date;
    error?: string;
    outputs: TranscodingOutput[];
    priority: 'low' | 'normal' | 'high';
    retries: number;
    maxRetries: number;
}
export interface TranscodingOutput {
    profileId: string;
    outputPath: string;
    playlistPath?: string;
    manifestPath?: string;
    segments?: string[];
    duration: number;
    fileSize: number;
    status: 'pending' | 'processing' | 'completed' | 'failed';
}
export interface VideoMetadata {
    duration: number;
    width: number;
    height: number;
    bitrate: number;
    framerate: number;
    codec: string;
    hasAudio: boolean;
    audioCodec?: string;
    audioBitrate?: number;
    fileSize: number;
}
export interface TranscodingProgress {
    jobId: string;
    currentProfile: string;
    profileProgress: number;
    totalProgress: number;
    framesProcessed: number;
    fps: number;
    timeProcessed: number;
    estimatedTimeRemaining: number;
}
export declare class TranscodingPipeline extends EventEmitter {
    private outputDir;
    private ffmpegPath;
    private ffprobePath;
    private readonly DEFAULT_OUTPUT_DIR;
    private readonly MAX_CONCURRENT_JOBS;
    private readonly DEFAULT_MAX_RETRIES;
    private activeJobs;
    private jobQueue;
    private runningProcesses;
    private concurrentJobs;
    constructor(outputDir?: string, ffmpegPath?: string, ffprobePath?: string);
    transcodeVideo(inputPath: string, profiles: TranscodingProfile[], options?: {
        priority?: 'low' | 'normal' | 'high';
        maxRetries?: number;
        customOutputDir?: string;
    }): Promise<TranscodingJob>;
    private queueJob;
    private processQueue;
    private processJob;
    private transcodeProfile;
    private transcodeToHLS;
    private transcodeToDASH;
    private transcodeToFile;
    private runFFmpeg;
    getVideoMetadata(inputPath: string): Promise<VideoMetadata>;
    private getVideoCodec;
    private getHLSSegments;
    private generateDASHManifest;
    private generateJobId;
    getJob(jobId: string): TranscodingJob | null;
    cancelJob(jobId: string): Promise<boolean>;
    getQueueStatus(): {
        queueLength: number;
        activeJobs: number;
        completedJobs: number;
        failedJobs: number;
    };
    listJobs(status?: TranscodingJob['status']): TranscodingJob[];
}
export declare const STREAMING_PROFILES: {
    readonly VIDEO_240P: {
        readonly profileId: "240p";
        readonly quality: "240p";
        readonly bitrate: 400000;
        readonly resolution: "426x240";
        readonly codec: "h264";
        readonly format: "hls";
        readonly audioCodec: "aac";
        readonly audioBitrate: 64000;
        readonly framerate: 30;
        readonly keyframeInterval: 2;
    };
    readonly VIDEO_480P: {
        readonly profileId: "480p";
        readonly quality: "480p";
        readonly bitrate: 1000000;
        readonly resolution: "854x480";
        readonly codec: "h264";
        readonly format: "hls";
        readonly audioCodec: "aac";
        readonly audioBitrate: 128000;
        readonly framerate: 30;
        readonly keyframeInterval: 2;
    };
    readonly VIDEO_720P: {
        readonly profileId: "720p";
        readonly quality: "720p";
        readonly bitrate: 2500000;
        readonly resolution: "1280x720";
        readonly codec: "h264";
        readonly format: "hls";
        readonly audioCodec: "aac";
        readonly audioBitrate: 128000;
        readonly framerate: 30;
        readonly keyframeInterval: 2;
    };
    readonly VIDEO_1080P: {
        readonly profileId: "1080p";
        readonly quality: "1080p";
        readonly bitrate: 5000000;
        readonly resolution: "1920x1080";
        readonly codec: "h264";
        readonly format: "hls";
        readonly audioCodec: "aac";
        readonly audioBitrate: 192000;
        readonly framerate: 30;
        readonly keyframeInterval: 2;
    };
};
export declare const TRANSCODING_EVENTS: {
    readonly JOB_CREATED: "jobCreated";
    readonly JOB_QUEUED: "jobQueued";
    readonly JOB_STARTED: "jobStarted";
    readonly JOB_COMPLETED: "jobCompleted";
    readonly JOB_FAILED: "jobFailed";
    readonly JOB_CANCELLED: "jobCancelled";
    readonly JOB_RETRIED: "jobRetried";
    readonly PROFILE_STARTED: "profileStarted";
    readonly PROFILE_COMPLETED: "profileCompleted";
    readonly PROFILE_FAILED: "profileFailed";
    readonly TRANSCODE_PROGRESS: "transcodeProgress";
    readonly TRANSCODE_WARNING: "transcodeWarning";
};
