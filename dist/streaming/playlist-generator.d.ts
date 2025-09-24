/**
 * HLS Playlist and DASH Manifest Generator
 *
 * Implements advanced playlist generation for streaming protocols:
 * - HLS master playlists with adaptive bitrate streaming
 * - HLS media playlists with proper EXT-X tags
 * - DASH MPD manifest generation for cross-platform compatibility
 * - Thumbnail sprite generation for video scrubbing
 * - Subtitle track integration
 */
import type { TranscodingProfile, VideoMetadata } from './transcoding-pipeline';
export interface HLSPlaylist {
    type: 'master' | 'media';
    version: number;
    content: string;
    targetDuration?: number;
    mediaSequence?: number;
    segments?: HLSSegment[];
    variants?: HLSVariant[];
}
export interface HLSVariant {
    bandwidth: number;
    resolution?: string;
    codecs?: string;
    playlistUri: string;
    audioGroup?: string;
    subtitleGroup?: string;
}
export interface HLSSegment {
    uri: string;
    duration: number;
    byteRange?: {
        length: number;
        offset: number;
    };
    discontinuity?: boolean;
    key?: {
        method: string;
        uri: string;
        iv?: string;
    };
    programDateTime?: Date;
}
export interface DASHManifest {
    type: 'static' | 'dynamic';
    duration?: string;
    minBufferTime: string;
    profiles: string;
    periods: DASHPeriod[];
    content: string;
}
export interface DASHPeriod {
    duration?: string;
    adaptationSets: DASHAdaptationSet[];
}
export interface DASHAdaptationSet {
    mimeType: string;
    contentType?: 'video' | 'audio' | 'text';
    lang?: string;
    representations: DASHRepresentation[];
}
export interface DASHRepresentation {
    id: string;
    bandwidth: number;
    width?: number;
    height?: number;
    frameRate?: string;
    codecs?: string;
    baseURL: string;
    segmentTemplate?: DASHSegmentTemplate;
}
export interface DASHSegmentTemplate {
    media: string;
    initialization: string;
    timescale: number;
    duration: number;
    startNumber?: number;
}
export interface PlaylistGenerationOptions {
    baseURL?: string;
    enableByteRange?: boolean;
    enableEncryption?: boolean;
    encryptionKeyURI?: string;
    targetDuration?: number;
    playlistType?: 'vod' | 'live';
    allowCache?: boolean;
    discontinuitySequence?: number;
    mediaSequence?: number;
}
export declare class HLSPlaylistGenerator {
    private options;
    constructor(options?: PlaylistGenerationOptions);
    /**
     * Generate HLS master playlist with multiple quality variants
     */
    generateMasterPlaylist(variants: Array<{
        profile: TranscodingProfile;
        playlistPath: string;
        metadata?: VideoMetadata;
    }>, outputPath: string): Promise<HLSPlaylist>;
    /**
     * Generate HLS media playlist for individual quality variant
     */
    generateMediaPlaylist(segments: Array<{
        uri: string;
        duration: number;
        byteRange?: {
            length: number;
            offset: number;
        };
    }>, outputPath: string, options?: {
        targetDuration?: number;
        mediaSequence?: number;
        playlistType?: 'vod' | 'live';
        allowCache?: boolean;
    }): Promise<HLSPlaylist>;
    /**
     * Generate HLS playlist with encryption support
     */
    generateEncryptedPlaylist(segments: HLSSegment[], keyURI: string, outputPath: string, iv?: string): Promise<HLSPlaylist>;
    private buildMasterPlaylistContent;
    private buildMediaPlaylistContent;
    private getCodecString;
    private generateIV;
}
export declare class DASHManifestGenerator {
    private options;
    constructor(options?: {
        baseURL?: string;
        minBufferTime?: string;
    });
    /**
     * Generate DASH MPD manifest for adaptive streaming
     */
    generateManifest(representations: Array<{
        profile: TranscodingProfile;
        outputPath: string;
        metadata?: VideoMetadata;
        segments?: string[];
    }>, outputPath: string, duration?: number): Promise<DASHManifest>;
    /**
     * Generate DASH manifest with segmented content
     */
    generateSegmentedManifest(representations: Array<{
        profile: TranscodingProfile;
        segmentTemplate: DASHSegmentTemplate;
        metadata?: VideoMetadata;
    }>, outputPath: string, duration: number): Promise<DASHManifest>;
    private createVideoRepresentation;
    private createAudioRepresentation;
    private buildManifestXML;
    private getVideoCodec;
    private getAudioCodec;
    private formatDuration;
}
/**
 * Parse HLS duration from EXTINF tag
 */
export declare function parseHLSDuration(extinfLine: string): number;
/**
 * Extract segments from HLS playlist content
 */
export declare function parseHLSPlaylist(content: string): {
    segments: HLSSegment[];
    metadata: any;
};
export declare const hlsGenerator: HLSPlaylistGenerator;
export declare const dashGenerator: DASHManifestGenerator;
