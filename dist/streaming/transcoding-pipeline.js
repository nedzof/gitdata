"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.TRANSCODING_EVENTS = exports.STREAMING_PROFILES = exports.TranscodingPipeline = void 0;
const child_process_1 = require("child_process");
const crypto_1 = require("crypto");
const events_1 = require("events");
const fs_1 = require("fs");
const path_1 = require("path");
// ==================== Transcoding Pipeline ====================
class TranscodingPipeline extends events_1.EventEmitter {
    constructor(outputDir = '/tmp/transcoding', ffmpegPath = 'ffmpeg', ffprobePath = 'ffprobe') {
        super();
        this.outputDir = outputDir;
        this.ffmpegPath = ffmpegPath;
        this.ffprobePath = ffprobePath;
        this.DEFAULT_OUTPUT_DIR = '/tmp/transcoding';
        this.MAX_CONCURRENT_JOBS = 3;
        this.DEFAULT_MAX_RETRIES = 2;
        this.activeJobs = new Map();
        this.jobQueue = [];
        this.runningProcesses = new Map();
        this.concurrentJobs = 0;
        this.processQueue();
    }
    // ==================== Job Management ====================
    async transcodeVideo(inputPath, profiles, options = {}) {
        const jobId = this.generateJobId();
        const outputDir = options.customOutputDir || (0, path_1.join)(this.outputDir, jobId);
        // Ensure output directory exists
        await fs_1.promises.mkdir(outputDir, { recursive: true });
        // Get video metadata
        const inputMetadata = await this.getVideoMetadata(inputPath);
        // Create transcoding job
        const job = {
            jobId,
            inputPath,
            inputMetadata,
            profiles,
            outputDir,
            status: 'queued',
            progress: 0,
            outputs: profiles.map((profile) => ({
                profileId: profile.profileId,
                outputPath: (0, path_1.join)(outputDir, profile.profileId),
                duration: 0,
                fileSize: 0,
                status: 'pending',
            })),
            priority: options.priority || 'normal',
            retries: 0,
            maxRetries: options.maxRetries || this.DEFAULT_MAX_RETRIES,
        };
        this.activeJobs.set(jobId, job);
        this.queueJob(job);
        this.emit('jobCreated', { jobId, inputPath, profiles: profiles.length });
        return job;
    }
    queueJob(job) {
        // Insert job based on priority
        const priorityOrder = { high: 0, normal: 1, low: 2 };
        let insertIndex = 0;
        for (let i = 0; i < this.jobQueue.length; i++) {
            if (priorityOrder[job.priority] <= priorityOrder[this.jobQueue[i].priority]) {
                break;
            }
            insertIndex = i + 1;
        }
        this.jobQueue.splice(insertIndex, 0, job);
        this.emit('jobQueued', { jobId: job.jobId, queuePosition: insertIndex });
    }
    async processQueue() {
        setInterval(async () => {
            if (this.concurrentJobs >= this.MAX_CONCURRENT_JOBS || this.jobQueue.length === 0) {
                return;
            }
            const job = this.jobQueue.shift();
            if (!job)
                return;
            this.concurrentJobs++;
            await this.processJob(job);
            this.concurrentJobs--;
        }, 1000);
    }
    // ==================== Job Processing ====================
    async processJob(job) {
        try {
            job.status = 'processing';
            job.startedAt = new Date();
            this.emit('jobStarted', { jobId: job.jobId });
            for (const profile of job.profiles) {
                job.currentProfile = profile.profileId;
                const output = job.outputs.find((o) => o.profileId === profile.profileId);
                output.status = 'processing';
                this.emit('profileStarted', { jobId: job.jobId, profileId: profile.profileId });
                try {
                    await this.transcodeProfile(job, profile, output);
                    output.status = 'completed';
                    this.emit('profileCompleted', { jobId: job.jobId, profileId: profile.profileId });
                }
                catch (error) {
                    output.status = 'failed';
                    this.emit('profileFailed', { jobId: job.jobId, profileId: profile.profileId, error });
                    throw error;
                }
            }
            job.status = 'completed';
            job.completedAt = new Date();
            job.progress = 100;
            this.emit('jobCompleted', { jobId: job.jobId });
        }
        catch (error) {
            job.status = 'failed';
            job.error = error instanceof Error ? error.message : String(error);
            job.completedAt = new Date();
            // Retry job if retries remaining
            if (job.retries < job.maxRetries) {
                job.retries++;
                job.status = 'queued';
                this.queueJob(job);
                this.emit('jobRetried', { jobId: job.jobId, retry: job.retries });
            }
            else {
                this.emit('jobFailed', { jobId: job.jobId, error: job.error });
            }
        }
    }
    async transcodeProfile(job, profile, output) {
        const outputPath = output.outputPath;
        await fs_1.promises.mkdir(outputPath, { recursive: true });
        switch (profile.format) {
            case 'hls':
                await this.transcodeToHLS(job, profile, output);
                break;
            case 'dash':
                await this.transcodeToDASH(job, profile, output);
                break;
            case 'mp4':
            case 'webm':
                await this.transcodeToFile(job, profile, output);
                break;
            default:
                throw new Error(`Unsupported format: ${profile.format}`);
        }
    }
    // ==================== HLS Transcoding ====================
    async transcodeToHLS(job, profile, output) {
        const playlistPath = (0, path_1.join)(output.outputPath, 'playlist.m3u8');
        const segmentPath = (0, path_1.join)(output.outputPath, 'segment_%03d.ts');
        const args = [
            '-i',
            job.inputPath,
            '-c:v',
            this.getVideoCodec(profile.codec),
            '-b:v',
            profile.bitrate.toString(),
            '-s',
            profile.resolution,
            '-g',
            (profile.keyframeInterval || 2) * (profile.framerate || 30).toString(),
            '-sc_threshold',
            '0',
        ];
        // Audio settings
        if (profile.audioCodec) {
            args.push('-c:a', profile.audioCodec);
            if (profile.audioBitrate) {
                args.push('-b:a', profile.audioBitrate.toString());
            }
        }
        // HLS specific settings
        args.push('-f', 'hls', '-hls_time', '6', // 6 second segments
        '-hls_playlist_type', 'vod', '-hls_segment_filename', segmentPath, '-start_number', '0', playlistPath);
        // Add additional options
        if (profile.additionalOptions) {
            args.push(...profile.additionalOptions);
        }
        await this.runFFmpeg(job.jobId, args, job.inputMetadata?.duration || 0);
        // Generate segments list
        output.segments = await this.getHLSSegments(output.outputPath);
        output.playlistPath = playlistPath;
        // Get output file stats
        const stats = await fs_1.promises.stat(playlistPath);
        output.fileSize = stats.size;
        output.duration = job.inputMetadata?.duration || 0;
    }
    // ==================== DASH Transcoding ====================
    async transcodeToDASH(job, profile, output) {
        const manifestPath = (0, path_1.join)(output.outputPath, 'manifest.mpd');
        const videoPath = (0, path_1.join)(output.outputPath, 'video.mp4');
        const audioPath = (0, path_1.join)(output.outputPath, 'audio.mp4');
        // First pass: create video track
        const videoArgs = [
            '-i',
            job.inputPath,
            '-c:v',
            this.getVideoCodec(profile.codec),
            '-b:v',
            profile.bitrate.toString(),
            '-s',
            profile.resolution,
            '-an', // No audio
            '-f',
            'mp4',
            '-movflags',
            'frag_keyframe+empty_moov',
            videoPath,
        ];
        await this.runFFmpeg(job.jobId + '_video', videoArgs, job.inputMetadata?.duration || 0);
        // Second pass: create audio track (if needed)
        if (job.inputMetadata?.hasAudio && profile.audioCodec) {
            const audioArgs = [
                '-i',
                job.inputPath,
                '-c:a',
                profile.audioCodec,
                '-b:a',
                (profile.audioBitrate || 128000).toString(),
                '-vn', // No video
                '-f',
                'mp4',
                '-movflags',
                'frag_keyframe+empty_moov',
                audioPath,
            ];
            await this.runFFmpeg(job.jobId + '_audio', audioArgs, job.inputMetadata?.duration || 0);
        }
        // Generate DASH manifest
        await this.generateDASHManifest(output.outputPath, profile, manifestPath);
        output.manifestPath = manifestPath;
        output.segments = [videoPath, audioPath];
        // Get total file size
        const videoStats = await fs_1.promises.stat(videoPath);
        const audioStats = job.inputMetadata?.hasAudio ? await fs_1.promises.stat(audioPath) : { size: 0 };
        output.fileSize = videoStats.size + audioStats.size;
        output.duration = job.inputMetadata?.duration || 0;
    }
    // ==================== File Transcoding ====================
    async transcodeToFile(job, profile, output) {
        const extension = profile.format === 'mp4' ? 'mp4' : 'webm';
        const outputFile = (0, path_1.join)(output.outputPath, `video.${extension}`);
        const args = [
            '-i',
            job.inputPath,
            '-c:v',
            this.getVideoCodec(profile.codec),
            '-b:v',
            profile.bitrate.toString(),
            '-s',
            profile.resolution,
        ];
        // Audio settings
        if (profile.audioCodec) {
            args.push('-c:a', profile.audioCodec);
            if (profile.audioBitrate) {
                args.push('-b:a', profile.audioBitrate.toString());
            }
        }
        // Format specific settings
        if (profile.format === 'mp4') {
            args.push('-f', 'mp4', '-movflags', 'faststart');
        }
        else if (profile.format === 'webm') {
            args.push('-f', 'webm');
        }
        // Add additional options
        if (profile.additionalOptions) {
            args.push(...profile.additionalOptions);
        }
        args.push(outputFile);
        await this.runFFmpeg(job.jobId, args, job.inputMetadata?.duration || 0);
        output.outputPath = outputFile;
        // Get output file stats
        const stats = await fs_1.promises.stat(outputFile);
        output.fileSize = stats.size;
        output.duration = job.inputMetadata?.duration || 0;
    }
    // ==================== FFmpeg Execution ====================
    async runFFmpeg(processId, args, duration) {
        return new Promise((resolve, reject) => {
            const process = (0, child_process_1.spawn)(this.ffmpegPath, args, {
                stdio: ['ignore', 'pipe', 'pipe'],
            });
            this.runningProcesses.set(processId, process);
            let lastProgress = 0;
            // Parse FFmpeg progress from stderr
            process.stderr.on('data', (data) => {
                const output = data.toString();
                // Extract time progress
                const timeMatch = output.match(/time=(\d+):(\d+):(\d+\.\d+)/);
                if (timeMatch && duration > 0) {
                    const hours = parseInt(timeMatch[1]);
                    const minutes = parseInt(timeMatch[2]);
                    const seconds = parseFloat(timeMatch[3]);
                    const currentTime = hours * 3600 + minutes * 60 + seconds;
                    const progress = Math.min(100, (currentTime / duration) * 100);
                    if (progress > lastProgress + 5) {
                        // Emit progress every 5%
                        lastProgress = progress;
                        this.emit('transcodeProgress', { processId, progress, currentTime, duration });
                    }
                }
                // Check for errors
                if (output.includes('Error') || output.includes('Invalid')) {
                    this.emit('transcodeWarning', { processId, message: output.trim() });
                }
            });
            process.on('close', (code) => {
                this.runningProcesses.delete(processId);
                if (code === 0) {
                    resolve();
                }
                else {
                    reject(new Error(`FFmpeg process exited with code ${code}`));
                }
            });
            process.on('error', (error) => {
                this.runningProcesses.delete(processId);
                reject(error);
            });
        });
    }
    // ==================== Video Metadata ====================
    async getVideoMetadata(inputPath) {
        return new Promise((resolve, reject) => {
            const args = [
                '-v',
                'quiet',
                '-print_format',
                'json',
                '-show_format',
                '-show_streams',
                inputPath,
            ];
            const process = (0, child_process_1.spawn)(this.ffprobePath, args, {
                stdio: ['ignore', 'pipe', 'pipe'],
            });
            let stdout = '';
            let stderr = '';
            process.stdout.on('data', (data) => {
                stdout += data.toString();
            });
            process.stderr.on('data', (data) => {
                stderr += data.toString();
            });
            process.on('close', (code) => {
                if (code !== 0) {
                    reject(new Error(`ffprobe failed: ${stderr}`));
                    return;
                }
                try {
                    const data = JSON.parse(stdout);
                    const videoStream = data.streams.find((s) => s.codec_type === 'video');
                    const audioStream = data.streams.find((s) => s.codec_type === 'audio');
                    if (!videoStream) {
                        reject(new Error('No video stream found'));
                        return;
                    }
                    const metadata = {
                        duration: parseFloat(data.format.duration),
                        width: videoStream.width,
                        height: videoStream.height,
                        bitrate: parseInt(data.format.bit_rate),
                        framerate: eval(videoStream.r_frame_rate), // e.g., "30/1" -> 30
                        codec: videoStream.codec_name,
                        hasAudio: !!audioStream,
                        audioCodec: audioStream?.codec_name,
                        audioBitrate: audioStream ? parseInt(audioStream.bit_rate) : undefined,
                        fileSize: parseInt(data.format.size),
                    };
                    resolve(metadata);
                }
                catch (error) {
                    reject(new Error(`Failed to parse ffprobe output: ${error}`));
                }
            });
        });
    }
    // ==================== Helper Methods ====================
    getVideoCodec(codec) {
        const codecMap = {
            h264: 'libx264',
            h265: 'libx265',
            vp9: 'libvpx-vp9',
            av1: 'libaom-av1',
        };
        return codecMap[codec] || 'libx264';
    }
    async getHLSSegments(outputDir) {
        const files = await fs_1.promises.readdir(outputDir);
        return files
            .filter((file) => file.endsWith('.ts'))
            .sort()
            .map((file) => (0, path_1.join)(outputDir, file));
    }
    async generateDASHManifest(outputDir, profile, manifestPath) {
        // Basic DASH manifest template
        const manifest = `<?xml version="1.0" encoding="UTF-8"?>
<MPD xmlns="urn:mpeg:dash:schema:mpd:2011" type="static" minBufferTime="PT1.5S" profiles="urn:mpeg:dash:profile:isoff-on-demand:2011">
  <Period duration="PT0H0M0S">
    <AdaptationSet mimeType="video/mp4">
      <Representation id="${profile.profileId}" bandwidth="${profile.bitrate}" width="${profile.resolution.split('x')[0]}" height="${profile.resolution.split('x')[1]}">
        <BaseURL>video.mp4</BaseURL>
      </Representation>
    </AdaptationSet>
    <AdaptationSet mimeType="audio/mp4">
      <Representation id="audio" bandwidth="${profile.audioBitrate || 128000}">
        <BaseURL>audio.mp4</BaseURL>
      </Representation>
    </AdaptationSet>
  </Period>
</MPD>`;
        await fs_1.promises.writeFile(manifestPath, manifest);
    }
    generateJobId() {
        return `job_${Date.now()}_${(0, crypto_1.randomBytes)(4).toString('hex')}`;
    }
    // ==================== Public API ====================
    getJob(jobId) {
        return this.activeJobs.get(jobId) || null;
    }
    async cancelJob(jobId) {
        const job = this.activeJobs.get(jobId);
        if (!job)
            return false;
        // Remove from queue if not started
        if (job.status === 'queued') {
            const queueIndex = this.jobQueue.findIndex((j) => j.jobId === jobId);
            if (queueIndex !== -1) {
                this.jobQueue.splice(queueIndex, 1);
            }
        }
        // Kill running process
        const process = this.runningProcesses.get(jobId);
        if (process) {
            process.kill('SIGTERM');
            this.runningProcesses.delete(jobId);
        }
        job.status = 'cancelled';
        job.completedAt = new Date();
        this.emit('jobCancelled', { jobId });
        return true;
    }
    getQueueStatus() {
        const jobs = Array.from(this.activeJobs.values());
        return {
            queueLength: this.jobQueue.length,
            activeJobs: jobs.filter((j) => j.status === 'processing').length,
            completedJobs: jobs.filter((j) => j.status === 'completed').length,
            failedJobs: jobs.filter((j) => j.status === 'failed').length,
        };
    }
    listJobs(status) {
        const jobs = Array.from(this.activeJobs.values());
        return status ? jobs.filter((j) => j.status === status) : jobs;
    }
}
exports.TranscodingPipeline = TranscodingPipeline;
// ==================== Predefined Profiles ====================
exports.STREAMING_PROFILES = {
    // Standard video profiles
    VIDEO_240P: {
        profileId: '240p',
        quality: '240p',
        bitrate: 400000, // 400kbps
        resolution: '426x240',
        codec: 'h264',
        format: 'hls',
        audioCodec: 'aac',
        audioBitrate: 64000,
        framerate: 30,
        keyframeInterval: 2,
    },
    VIDEO_480P: {
        profileId: '480p',
        quality: '480p',
        bitrate: 1000000, // 1Mbps
        resolution: '854x480',
        codec: 'h264',
        format: 'hls',
        audioCodec: 'aac',
        audioBitrate: 128000,
        framerate: 30,
        keyframeInterval: 2,
    },
    VIDEO_720P: {
        profileId: '720p',
        quality: '720p',
        bitrate: 2500000, // 2.5Mbps
        resolution: '1280x720',
        codec: 'h264',
        format: 'hls',
        audioCodec: 'aac',
        audioBitrate: 128000,
        framerate: 30,
        keyframeInterval: 2,
    },
    VIDEO_1080P: {
        profileId: '1080p',
        quality: '1080p',
        bitrate: 5000000, // 5Mbps
        resolution: '1920x1080',
        codec: 'h264',
        format: 'hls',
        audioCodec: 'aac',
        audioBitrate: 192000,
        framerate: 30,
        keyframeInterval: 2,
    },
};
// ==================== Export Types and Constants ====================
exports.TRANSCODING_EVENTS = {
    JOB_CREATED: 'jobCreated',
    JOB_QUEUED: 'jobQueued',
    JOB_STARTED: 'jobStarted',
    JOB_COMPLETED: 'jobCompleted',
    JOB_FAILED: 'jobFailed',
    JOB_CANCELLED: 'jobCancelled',
    JOB_RETRIED: 'jobRetried',
    PROFILE_STARTED: 'profileStarted',
    PROFILE_COMPLETED: 'profileCompleted',
    PROFILE_FAILED: 'profileFailed',
    TRANSCODE_PROGRESS: 'transcodeProgress',
    TRANSCODE_WARNING: 'transcodeWarning',
};
//# sourceMappingURL=transcoding-pipeline.js.map