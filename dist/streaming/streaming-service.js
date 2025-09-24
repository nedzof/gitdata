"use strict";
/**
 * Complete Streaming Service Integration
 *
 * Integrates all streaming components into a unified service:
 * - ChunkingEngine for file processing
 * - TranscodingPipeline for video processing
 * - HLS/DASH playlist generation
 * - P2P distribution network
 * - Content delivery and load balancing
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.STREAMING_EVENTS = exports.StreamingService = void 0;
const events_1 = require("events");
const fs_1 = require("fs");
const path_1 = require("path");
const chunking_engine_1 = require("./chunking-engine");
const p2p_distribution_1 = require("./p2p-distribution");
const playlist_generator_1 = require("./playlist-generator");
const transcoding_pipeline_1 = require("./transcoding-pipeline");
// ==================== Main Streaming Service ====================
class StreamingService extends events_1.EventEmitter {
    constructor(database, storageDir = '/tmp/streaming', myHostId, myEndpoint, options = {}) {
        super();
        this.database = database;
        this.storageDir = storageDir;
        this.myHostId = myHostId;
        this.myEndpoint = myEndpoint;
        this.options = options;
        this.streamingFiles = new Map();
        this.activeStreams = new Map();
        // Initialize components
        this.chunker = new chunking_engine_1.ChunkingEngine(options.chunkingOptions);
        this.transcoder = new transcoding_pipeline_1.TranscodingPipeline(storageDir);
        this.hlsGenerator = new playlist_generator_1.HLSPlaylistGenerator();
        this.dashGenerator = new playlist_generator_1.DASHManifestGenerator();
        if (options.p2pEnabled !== false) {
            this.p2pNetwork = new p2p_distribution_1.P2PDistributionNetwork(database, myHostId, myEndpoint);
        }
        this.setupEventHandlers();
        this.startMaintenanceLoop();
    }
    // ==================== File Upload and Chunking ====================
    async initiateUpload(fileName, contentType, totalSize, options = {}) {
        const fileId = this.generateFileId();
        const chunkSize = options.chunkSize || this.calculateOptimalChunkSize(totalSize);
        const streamingFile = {
            fileId,
            originalFileName: fileName,
            contentType,
            totalSize,
            uploadId: '', // Will be set when chunking starts
            status: 'uploading',
            chunks: {
                total: Math.ceil(totalSize / chunkSize),
                uploaded: 0,
                chunkSize,
                metadata: {},
            },
            streaming: {
                formats: [],
                playlists: {},
            },
            p2p: {
                advertised: false,
                hosts: 0,
                availability: 0,
            },
            createdAt: new Date(),
            expiresAt: new Date(Date.now() + (options.expiryHours || 168) * 60 * 60 * 1000), // Default 7 days
        };
        this.streamingFiles.set(fileId, streamingFile);
        this.emit('uploadInitiated', { fileId, fileName, totalSize });
        return { fileId, uploadId: fileId, chunkSize };
    }
    async uploadChunk(fileId, chunkIndex, chunkData) {
        const file = this.streamingFiles.get(fileId);
        if (!file) {
            throw new Error(`File not found: ${fileId}`);
        }
        if (file.status !== 'uploading') {
            throw new Error(`Cannot upload chunk to file in status: ${file.status}`);
        }
        // Store chunk
        const chunkPath = (0, path_1.join)(this.storageDir, fileId, 'chunks', `chunk_${chunkIndex}`);
        await fs_1.promises.mkdir((0, path_1.dirname)(chunkPath), { recursive: true });
        await fs_1.promises.writeFile(chunkPath, chunkData);
        // Update progress
        file.chunks.uploaded++;
        const uploadProgress = (file.chunks.uploaded / file.chunks.total) * 100;
        this.emit('chunkUploaded', { fileId, chunkIndex, progress: uploadProgress });
        // Check if upload is complete
        if (file.chunks.uploaded >= file.chunks.total) {
            await this.completeUpload(fileId);
        }
        return { success: true, uploadProgress };
    }
    async completeUpload(fileId) {
        const file = this.streamingFiles.get(fileId);
        if (!file) {
            throw new Error(`File not found: ${fileId}`);
        }
        file.status = 'processing';
        // Reassemble file from chunks
        await this.reassembleFile(fileId);
        // Start processing pipeline
        if (this.isVideoFile(file.contentType)) {
            await this.startVideoProcessing(fileId);
        }
        else {
            await this.startFileProcessing(fileId);
        }
        this.emit('uploadCompleted', { fileId });
    }
    // ==================== Video Processing Pipeline ====================
    async startVideoProcessing(fileId) {
        const file = this.streamingFiles.get(fileId);
        if (!file)
            return;
        file.status = 'transcoding';
        const inputPath = (0, path_1.join)(this.storageDir, fileId, 'original', file.originalFileName);
        const profiles = this.getTranscodingProfiles(file.totalSize);
        try {
            const transcodingJob = await this.transcoder.transcodeVideo(inputPath, profiles, {
                customOutputDir: (0, path_1.join)(this.storageDir, fileId, 'transcoded'),
            });
            file.transcoding = {
                jobId: transcodingJob.jobId,
                profiles: profiles.map((p) => p.profileId),
                status: 'processing',
            };
            this.emit('transcodingStarted', { fileId, jobId: transcodingJob.jobId });
        }
        catch (error) {
            file.status = 'failed';
            this.emit('processingFailed', { fileId, error });
        }
    }
    async onTranscodingCompleted(jobId) {
        const file = Array.from(this.streamingFiles.values()).find((f) => f.transcoding?.jobId === jobId);
        if (!file)
            return;
        const job = this.transcoder.getJob(jobId);
        if (!job || job.status !== 'completed')
            return;
        file.transcoding.status = 'completed';
        // Generate streaming formats
        for (const output of job.outputs) {
            if (output.status !== 'completed')
                continue;
            const profile = job.profiles.find((p) => p.profileId === output.profileId);
            if (!profile)
                continue;
            const format = {
                profileId: output.profileId,
                quality: profile.quality,
                format: profile.format,
                bitrate: profile.bitrate,
                resolution: profile.resolution,
                path: output.outputPath,
                playlistPath: output.playlistPath,
                manifestPath: output.manifestPath,
                segments: output.segments,
                ready: true,
            };
            file.streaming.formats.push(format);
        }
        // Generate master playlists
        await this.generateMasterPlaylists(file.fileId);
        // Setup P2P distribution
        if (this.p2pNetwork) {
            await this.setupP2PDistribution(file.fileId);
        }
        file.status = 'ready';
        file.processedAt = new Date();
        this.emit('processingCompleted', { fileId: file.fileId });
    }
    // ==================== Playlist Generation ====================
    async generateMasterPlaylists(fileId) {
        const file = this.streamingFiles.get(fileId);
        if (!file)
            return;
        const outputDir = (0, path_1.join)(this.storageDir, fileId, 'playlists');
        await fs_1.promises.mkdir(outputDir, { recursive: true });
        // Generate HLS master playlist
        const hlsVariants = file.streaming.formats
            .filter((f) => f.format === 'hls')
            .map((format) => ({
            profile: this.getProfileById(format.profileId),
            playlistPath: format.playlistPath,
        }));
        if (hlsVariants.length > 0) {
            const hlsMasterPath = (0, path_1.join)(outputDir, 'master.m3u8');
            await this.hlsGenerator.generateMasterPlaylist(hlsVariants, hlsMasterPath);
            file.streaming.playlists.hls = hlsMasterPath;
        }
        // Generate DASH manifest
        const dashRepresentations = file.streaming.formats
            .filter((f) => f.format === 'dash')
            .map((format) => ({
            profile: this.getProfileById(format.profileId),
            outputPath: format.path,
            segments: format.segments,
        }));
        if (dashRepresentations.length > 0) {
            const dashManifestPath = (0, path_1.join)(outputDir, 'manifest.mpd');
            await this.dashGenerator.generateManifest(dashRepresentations, dashManifestPath);
            file.streaming.playlists.dash = dashManifestPath;
        }
    }
    // ==================== P2P Distribution ====================
    async setupP2PDistribution(fileId) {
        if (!this.p2pNetwork)
            return;
        const file = this.streamingFiles.get(fileId);
        if (!file)
            return;
        // Chunk ready formats for P2P distribution
        for (const format of file.streaming.formats) {
            if (!format.ready)
                continue;
            // Create chunks for this format
            const formatBuffer = await fs_1.promises.readFile(format.path);
            const chunking = await this.chunker.chunkFile(formatBuffer, `${file.originalFileName}_${format.profileId}`, file.contentType);
            // Calculate checksums
            const checksums = chunking.chunks.map((chunk) => chunk.hash);
            // Advertise content
            await this.p2pNetwork.advertiseContent(formatBuffer.toString('hex'), // Content hash
            chunking.chunks.map((c) => c.index), // Available chunks
            chunking.chunks.length, {
                contentType: file.contentType,
                totalSize: formatBuffer.length,
                chunkSize: chunking.chunks[0]?.size || 0,
                checksums,
            }, {
                requiresAuth: false,
                requiresPayment: false,
                bandwidth: format.bitrate,
                priority: 'normal',
            });
        }
        file.p2p.advertised = true;
        this.emit('p2pAdvertised', { fileId });
    }
    // ==================== Content Delivery ====================
    async getStreamingInfo(fileId) {
        const file = this.streamingFiles.get(fileId);
        if (!file) {
            throw new Error(`File not found: ${fileId}`);
        }
        const streamingUrls = {};
        // HLS streaming URL
        if (file.streaming.playlists.hls) {
            streamingUrls.hls = `${this.myEndpoint}/streaming/hls/${fileId}/master.m3u8`;
        }
        // DASH streaming URL
        if (file.streaming.playlists.dash) {
            streamingUrls.dash = `${this.myEndpoint}/streaming/dash/${fileId}/manifest.mpd`;
        }
        // Direct file URLs
        const mp4Formats = file.streaming.formats.filter((f) => f.format === 'mp4');
        if (mp4Formats.length > 0) {
            streamingUrls.mp4 = mp4Formats.map((f) => `${this.myEndpoint}/streaming/mp4/${fileId}/${f.profileId}.mp4`);
        }
        const webmFormats = file.streaming.formats.filter((f) => f.format === 'webm');
        if (webmFormats.length > 0) {
            streamingUrls.webm = webmFormats.map((f) => `${this.myEndpoint}/streaming/webm/${fileId}/${f.profileId}.webm`);
        }
        return { file, streamingUrls };
    }
    async getFileChunk(fileId, chunkIndex) {
        const chunkPath = (0, path_1.join)(this.storageDir, fileId, 'chunks', `chunk_${chunkIndex}`);
        return await fs_1.promises.readFile(chunkPath);
    }
    async getHLSPlaylist(fileId, playlistType) {
        const file = this.streamingFiles.get(fileId);
        if (!file) {
            throw new Error(`File not found: ${fileId}`);
        }
        if (playlistType === 'master') {
            if (!file.streaming.playlists.hls) {
                throw new Error(`HLS master playlist not available for file: ${fileId}`);
            }
            return await fs_1.promises.readFile(file.streaming.playlists.hls, 'utf8');
        }
        // Individual quality playlist
        const format = file.streaming.formats.find((f) => f.profileId === playlistType && f.format === 'hls');
        if (!format?.playlistPath) {
            throw new Error(`HLS playlist not found for profile: ${playlistType}`);
        }
        return await fs_1.promises.readFile(format.playlistPath, 'utf8');
    }
    async getDASHManifest(fileId) {
        const file = this.streamingFiles.get(fileId);
        if (!file?.streaming.playlists.dash) {
            throw new Error(`DASH manifest not available for file: ${fileId}`);
        }
        return await fs_1.promises.readFile(file.streaming.playlists.dash, 'utf8');
    }
    // ==================== Helper Methods ====================
    async reassembleFile(fileId) {
        const file = this.streamingFiles.get(fileId);
        if (!file)
            return;
        const chunks = [];
        for (let i = 0; i < file.chunks.total; i++) {
            const chunkPath = (0, path_1.join)(this.storageDir, fileId, 'chunks', `chunk_${i}`);
            const chunkData = await fs_1.promises.readFile(chunkPath);
            chunks.push(chunkData);
        }
        const reassembledBuffer = Buffer.concat(chunks);
        const originalPath = (0, path_1.join)(this.storageDir, fileId, 'original');
        await fs_1.promises.mkdir(originalPath, { recursive: true });
        await fs_1.promises.writeFile((0, path_1.join)(originalPath, file.originalFileName), reassembledBuffer);
    }
    async startFileProcessing(fileId) {
        const file = this.streamingFiles.get(fileId);
        if (!file)
            return;
        // For non-video files, just setup direct serving
        file.status = 'ready';
        file.processedAt = new Date();
        this.emit('processingCompleted', { fileId });
    }
    isVideoFile(contentType) {
        return contentType.startsWith('video/');
    }
    calculateOptimalChunkSize(fileSize) {
        if (fileSize < 10 * 1024 * 1024) {
            // < 10MB
            return chunking_engine_1.CHUNK_SIZES.SMALL;
        }
        else if (fileSize < 100 * 1024 * 1024) {
            // < 100MB
            return chunking_engine_1.CHUNK_SIZES.MEDIUM;
        }
        else if (fileSize < 1024 * 1024 * 1024) {
            // < 1GB
            return chunking_engine_1.CHUNK_SIZES.LARGE;
        }
        else {
            return chunking_engine_1.CHUNK_SIZES.XLARGE;
        }
    }
    getTranscodingProfiles(fileSize) {
        // Return appropriate profiles based on file size
        if (fileSize < 100 * 1024 * 1024) {
            // < 100MB
            return [transcoding_pipeline_1.STREAMING_PROFILES.VIDEO_480P, transcoding_pipeline_1.STREAMING_PROFILES.VIDEO_720P];
        }
        else if (fileSize < 500 * 1024 * 1024) {
            // < 500MB
            return [
                transcoding_pipeline_1.STREAMING_PROFILES.VIDEO_240P,
                transcoding_pipeline_1.STREAMING_PROFILES.VIDEO_480P,
                transcoding_pipeline_1.STREAMING_PROFILES.VIDEO_720P,
            ];
        }
        else {
            return [
                transcoding_pipeline_1.STREAMING_PROFILES.VIDEO_240P,
                transcoding_pipeline_1.STREAMING_PROFILES.VIDEO_480P,
                transcoding_pipeline_1.STREAMING_PROFILES.VIDEO_720P,
                transcoding_pipeline_1.STREAMING_PROFILES.VIDEO_1080P,
            ];
        }
    }
    getProfileById(profileId) {
        const profiles = Object.values(transcoding_pipeline_1.STREAMING_PROFILES);
        return profiles.find((p) => p.profileId === profileId) || transcoding_pipeline_1.STREAMING_PROFILES.VIDEO_720P;
    }
    generateFileId() {
        return `stream_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    setupEventHandlers() {
        this.transcoder.on('jobCompleted', (event) => {
            this.onTranscodingCompleted(event.jobId);
        });
        this.chunker.on('chunkingCompleted', (event) => {
            this.emit('chunkingCompleted', event);
        });
        if (this.p2pNetwork) {
            this.p2pNetwork.on('contentAdvertised', (event) => {
                this.emit('p2pContentAdvertised', event);
            });
        }
    }
    startMaintenanceLoop() {
        setInterval(() => {
            this.cleanupExpiredFiles();
            this.updateStreamingStats();
        }, 60000); // Every minute
    }
    async cleanupExpiredFiles() {
        const now = new Date();
        const expiredFiles = [];
        for (const [fileId, file] of this.streamingFiles) {
            if (file.expiresAt < now) {
                expiredFiles.push(fileId);
            }
        }
        for (const fileId of expiredFiles) {
            await this.deleteFile(fileId);
        }
    }
    updateStreamingStats() {
        const stats = this.getStats();
        this.emit('statsUpdated', stats);
    }
    // ==================== Public API ====================
    getFile(fileId) {
        return this.streamingFiles.get(fileId) || null;
    }
    async deleteFile(fileId) {
        const file = this.streamingFiles.get(fileId);
        if (!file)
            return false;
        try {
            // Cancel transcoding if running
            if (file.transcoding && file.transcoding.status === 'processing') {
                await this.transcoder.cancelJob(file.transcoding.jobId);
            }
            // Remove file directory
            const filePath = (0, path_1.join)(this.storageDir, fileId);
            await fs_1.promises.rm(filePath, { recursive: true, force: true });
            // Remove from memory
            this.streamingFiles.delete(fileId);
            this.emit('fileDeleted', { fileId });
            return true;
        }
        catch (error) {
            this.emit('fileDeletionFailed', { fileId, error });
            return false;
        }
    }
    listFiles(status) {
        const files = Array.from(this.streamingFiles.values());
        return status ? files.filter((f) => f.status === status) : files;
    }
    getStats() {
        const files = Array.from(this.streamingFiles.values());
        const totalStorage = files.reduce((sum, f) => sum + f.totalSize, 0);
        const totalBandwidth = files
            .filter((f) => f.status === 'ready')
            .reduce((sum, f) => sum + f.streaming.formats.reduce((s, fmt) => s + fmt.bitrate, 0), 0);
        return {
            totalFiles: this.streamingFiles.size,
            processingFiles: files.filter((f) => f.status === 'processing' || f.status === 'transcoding')
                .length,
            readyFiles: files.filter((f) => f.status === 'ready').length,
            totalStorage,
            totalBandwidth,
            p2pHosts: this.p2pNetwork ? this.p2pNetwork.getNetworkStats().hosts : 0,
            activeStreams: this.activeStreams.size,
        };
    }
    async getUploadStatus(fileId) {
        const file = this.streamingFiles.get(fileId);
        if (!file)
            return null;
        const progress = file.chunks.total > 0 ? (file.chunks.uploaded / file.chunks.total) * 100 : 0;
        return {
            status: file.status,
            progress,
            chunksUploaded: file.chunks.uploaded,
            totalChunks: file.chunks.total,
        };
    }
}
exports.StreamingService = StreamingService;
// ==================== Export Types and Events ====================
exports.STREAMING_EVENTS = {
    UPLOAD_INITIATED: 'uploadInitiated',
    CHUNK_UPLOADED: 'chunkUploaded',
    UPLOAD_COMPLETED: 'uploadCompleted',
    TRANSCODING_STARTED: 'transcodingStarted',
    PROCESSING_COMPLETED: 'processingCompleted',
    PROCESSING_FAILED: 'processingFailed',
    P2P_ADVERTISED: 'p2pAdvertised',
    P2P_CONTENT_ADVERTISED: 'p2pContentAdvertised',
    FILE_DELETED: 'fileDeleted',
    FILE_DELETION_FAILED: 'fileDeletionFailed',
    STATS_UPDATED: 'statsUpdated',
    CHUNKING_COMPLETED: 'chunkingCompleted',
};
//# sourceMappingURL=streaming-service.js.map