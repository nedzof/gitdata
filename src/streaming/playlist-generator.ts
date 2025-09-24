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

import { promises as fs } from 'fs';
import { join, basename } from 'path';

import type { TranscodingProfile, VideoMetadata } from './transcoding-pipeline';

// ==================== Core Types ====================

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
  byteRange?: { length: number; offset: number };
  discontinuity?: boolean;
  key?: { method: string; uri: string; iv?: string };
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

// ==================== HLS Playlist Generator ====================

export class HLSPlaylistGenerator {
  constructor(private options: PlaylistGenerationOptions = {}) {}

  /**
   * Generate HLS master playlist with multiple quality variants
   */
  async generateMasterPlaylist(
    variants: Array<{
      profile: TranscodingProfile;
      playlistPath: string;
      metadata?: VideoMetadata;
    }>,
    outputPath: string,
  ): Promise<HLSPlaylist> {
    const hlsVariants: HLSVariant[] = variants.map((variant) => ({
      bandwidth: variant.profile.bitrate + (variant.profile.audioBitrate || 0),
      resolution: variant.profile.resolution,
      codecs: this.getCodecString(variant.profile),
      playlistUri: basename(variant.playlistPath),
    }));

    // Sort variants by bandwidth (low to high)
    hlsVariants.sort((a, b) => a.bandwidth - b.bandwidth);

    const content = this.buildMasterPlaylistContent(hlsVariants);

    const playlist: HLSPlaylist = {
      type: 'master',
      version: 6,
      content,
      variants: hlsVariants,
    };

    await fs.writeFile(outputPath, content);
    return playlist;
  }

  /**
   * Generate HLS media playlist for individual quality variant
   */
  async generateMediaPlaylist(
    segments: Array<{
      uri: string;
      duration: number;
      byteRange?: { length: number; offset: number };
    }>,
    outputPath: string,
    options: {
      targetDuration?: number;
      mediaSequence?: number;
      playlistType?: 'vod' | 'live';
      allowCache?: boolean;
    } = {},
  ): Promise<HLSPlaylist> {
    const targetDuration =
      options.targetDuration || Math.ceil(Math.max(...segments.map((s) => s.duration)));
    const mediaSequence = options.mediaSequence || 0;

    const hlsSegments: HLSSegment[] = segments.map((segment) => ({
      uri: segment.uri,
      duration: segment.duration,
      byteRange: segment.byteRange,
    }));

    const content = this.buildMediaPlaylistContent(hlsSegments, {
      targetDuration,
      mediaSequence,
      playlistType: options.playlistType || 'vod',
      allowCache: options.allowCache !== false,
    });

    const playlist: HLSPlaylist = {
      type: 'media',
      version: 6,
      content,
      targetDuration,
      mediaSequence,
      segments: hlsSegments,
    };

    await fs.writeFile(outputPath, content);
    return playlist;
  }

  /**
   * Generate HLS playlist with encryption support
   */
  async generateEncryptedPlaylist(
    segments: HLSSegment[],
    keyURI: string,
    outputPath: string,
    iv?: string,
  ): Promise<HLSPlaylist> {
    const encryptedSegments = segments.map((segment) => ({
      ...segment,
      key: {
        method: 'AES-128',
        uri: keyURI,
        iv: iv || this.generateIV(),
      },
    }));

    const targetDuration = Math.ceil(Math.max(...segments.map((s) => s.duration)));

    const content = this.buildMediaPlaylistContent(encryptedSegments, {
      targetDuration,
      mediaSequence: 0,
      playlistType: 'vod',
      allowCache: true,
      encryption: true,
    });

    const playlist: HLSPlaylist = {
      type: 'media',
      version: 6,
      content,
      targetDuration,
      mediaSequence: 0,
      segments: encryptedSegments,
    };

    await fs.writeFile(outputPath, content);
    return playlist;
  }

  private buildMasterPlaylistContent(variants: HLSVariant[]): string {
    let content = '#EXTM3U\n';
    content += '#EXT-X-VERSION:6\n';

    // Add independent segments tag for better compatibility
    content += '#EXT-X-INDEPENDENT-SEGMENTS\n';

    for (const variant of variants) {
      let streamInf = `#EXT-X-STREAM-INF:BANDWIDTH=${variant.bandwidth}`;

      if (variant.resolution) {
        streamInf += `,RESOLUTION=${variant.resolution}`;
      }

      if (variant.codecs) {
        streamInf += `,CODECS="${variant.codecs}"`;
      }

      if (variant.audioGroup) {
        streamInf += `,AUDIO="${variant.audioGroup}"`;
      }

      if (variant.subtitleGroup) {
        streamInf += `,SUBTITLES="${variant.subtitleGroup}"`;
      }

      content += streamInf + '\n';
      content += variant.playlistUri + '\n';
    }

    return content;
  }

  private buildMediaPlaylistContent(
    segments: HLSSegment[],
    options: {
      targetDuration: number;
      mediaSequence: number;
      playlistType: string;
      allowCache: boolean;
      encryption?: boolean;
    },
  ): string {
    let content = '#EXTM3U\n';
    content += '#EXT-X-VERSION:6\n';
    content += `#EXT-X-TARGETDURATION:${options.targetDuration}\n`;
    content += `#EXT-X-MEDIA-SEQUENCE:${options.mediaSequence}\n`;

    if (options.playlistType) {
      content += `#EXT-X-PLAYLIST-TYPE:${options.playlistType.toUpperCase()}\n`;
    }

    if (!options.allowCache) {
      content += '#EXT-X-ALLOW-CACHE:NO\n';
    }

    // Add segments
    let currentKey: any = null;

    for (const segment of segments) {
      // Add encryption key if changed
      if (segment.key && (!currentKey || currentKey.uri !== segment.key.uri)) {
        content += `#EXT-X-KEY:METHOD=${segment.key.method},URI="${segment.key.uri}"`;
        if (segment.key.iv) {
          content += `,IV=${segment.key.iv}`;
        }
        content += '\n';
        currentKey = segment.key;
      }

      // Add discontinuity marker
      if (segment.discontinuity) {
        content += '#EXT-X-DISCONTINUITY\n';
      }

      // Add program date time
      if (segment.programDateTime) {
        content += `#EXT-X-PROGRAM-DATE-TIME:${segment.programDateTime.toISOString()}\n`;
      }

      // Add segment info
      content += `#EXTINF:${segment.duration.toFixed(6)},\n`;

      // Add byte range if specified
      if (segment.byteRange) {
        content += `#EXT-X-BYTERANGE:${segment.byteRange.length}@${segment.byteRange.offset}\n`;
      }

      content += segment.uri + '\n';
    }

    // End playlist for VOD
    if (options.playlistType === 'vod') {
      content += '#EXT-X-ENDLIST\n';
    }

    return content;
  }

  private getCodecString(profile: TranscodingProfile): string {
    const videoCodecs: Record<string, string> = {
      h264: 'avc1.640028',
      h265: 'hev1.1.6.L93.B0',
      vp9: 'vp09.00.10.08',
      av1: 'av01.0.04M.08',
    };

    const audioCodecs: Record<string, string> = {
      aac: 'mp4a.40.2',
      opus: 'opus',
      mp3: 'mp4a.40.34',
    };

    const videoCodec = videoCodecs[profile.codec] || 'avc1.640028';
    const audioCodec = profile.audioCodec ? audioCodecs[profile.audioCodec] : null;

    return audioCodec ? `${videoCodec},${audioCodec}` : videoCodec;
  }

  private generateIV(): string {
    // Generate 16-byte initialization vector
    const iv = Buffer.alloc(16);
    for (let i = 0; i < 16; i++) {
      iv[i] = Math.floor(Math.random() * 256);
    }
    return '0x' + iv.toString('hex').toUpperCase();
  }
}

// ==================== DASH Manifest Generator ====================

export class DASHManifestGenerator {
  constructor(private options: { baseURL?: string; minBufferTime?: string } = {}) {}

  /**
   * Generate DASH MPD manifest for adaptive streaming
   */
  async generateManifest(
    representations: Array<{
      profile: TranscodingProfile;
      outputPath: string;
      metadata?: VideoMetadata;
      segments?: string[];
    }>,
    outputPath: string,
    duration?: number,
  ): Promise<DASHManifest> {
    const minBufferTime = this.options.minBufferTime || 'PT1.5S';
    const profiles = 'urn:mpeg:dash:profile:isoff-on-demand:2011';

    // Group representations by type (video/audio)
    const videoReps = representations.filter((r) => r.profile.codec !== 'audio');
    const audioReps = representations.filter((r) => r.profile.audioCodec);

    const adaptationSets: DASHAdaptationSet[] = [];

    // Video adaptation set
    if (videoReps.length > 0) {
      const videoAdaptationSet: DASHAdaptationSet = {
        mimeType: 'video/mp4',
        contentType: 'video',
        representations: videoReps.map((rep) => this.createVideoRepresentation(rep)),
      };
      adaptationSets.push(videoAdaptationSet);
    }

    // Audio adaptation set
    if (audioReps.length > 0) {
      const audioAdaptationSet: DASHAdaptationSet = {
        mimeType: 'audio/mp4',
        contentType: 'audio',
        representations: audioReps.map((rep) => this.createAudioRepresentation(rep)),
      };
      adaptationSets.push(audioAdaptationSet);
    }

    const periods: DASHPeriod[] = [
      {
        duration: duration ? this.formatDuration(duration) : undefined,
        adaptationSets,
      },
    ];

    const manifest: DASHManifest = {
      type: 'static',
      duration: duration ? this.formatDuration(duration) : undefined,
      minBufferTime,
      profiles,
      periods,
      content: '',
    };

    // Generate XML content
    manifest.content = this.buildManifestXML(manifest);

    await fs.writeFile(outputPath, manifest.content);
    return manifest;
  }

  /**
   * Generate DASH manifest with segmented content
   */
  async generateSegmentedManifest(
    representations: Array<{
      profile: TranscodingProfile;
      segmentTemplate: DASHSegmentTemplate;
      metadata?: VideoMetadata;
    }>,
    outputPath: string,
    duration: number,
  ): Promise<DASHManifest> {
    const adaptationSets: DASHAdaptationSet[] = [];

    // Video adaptation set with segment template
    const videoReps = representations.filter((r) => r.profile.codec !== 'audio');
    if (videoReps.length > 0) {
      const videoAdaptationSet: DASHAdaptationSet = {
        mimeType: 'video/mp4',
        contentType: 'video',
        representations: videoReps.map((rep) => ({
          id: rep.profile.profileId,
          bandwidth: rep.profile.bitrate,
          width: parseInt(rep.profile.resolution.split('x')[0]),
          height: parseInt(rep.profile.resolution.split('x')[1]),
          frameRate: rep.profile.framerate?.toString() || '30',
          codecs: this.getVideoCodec(rep.profile.codec),
          baseURL: '',
          segmentTemplate: rep.segmentTemplate,
        })),
      };
      adaptationSets.push(videoAdaptationSet);
    }

    // Audio adaptation set with segment template
    const audioReps = representations.filter((r) => r.profile.audioCodec);
    if (audioReps.length > 0) {
      const audioAdaptationSet: DASHAdaptationSet = {
        mimeType: 'audio/mp4',
        contentType: 'audio',
        representations: audioReps.map((rep) => ({
          id: `${rep.profile.profileId}_audio`,
          bandwidth: rep.profile.audioBitrate || 128000,
          codecs: this.getAudioCodec(rep.profile.audioCodec!),
          baseURL: '',
          segmentTemplate: rep.segmentTemplate,
        })),
      };
      adaptationSets.push(audioAdaptationSet);
    }

    const manifest: DASHManifest = {
      type: 'static',
      duration: this.formatDuration(duration),
      minBufferTime: 'PT1.5S',
      profiles: 'urn:mpeg:dash:profile:isoff-live:2011',
      periods: [{ adaptationSets }],
      content: '',
    };

    manifest.content = this.buildManifestXML(manifest);

    await fs.writeFile(outputPath, manifest.content);
    return manifest;
  }

  private createVideoRepresentation(rep: {
    profile: TranscodingProfile;
    outputPath: string;
    metadata?: VideoMetadata;
  }): DASHRepresentation {
    return {
      id: rep.profile.profileId,
      bandwidth: rep.profile.bitrate,
      width: parseInt(rep.profile.resolution.split('x')[0]),
      height: parseInt(rep.profile.resolution.split('x')[1]),
      frameRate: rep.profile.framerate?.toString() || '30',
      codecs: this.getVideoCodec(rep.profile.codec),
      baseURL: basename(rep.outputPath),
    };
  }

  private createAudioRepresentation(rep: {
    profile: TranscodingProfile;
    outputPath: string;
    metadata?: VideoMetadata;
  }): DASHRepresentation {
    return {
      id: `${rep.profile.profileId}_audio`,
      bandwidth: rep.profile.audioBitrate || 128000,
      codecs: this.getAudioCodec(rep.profile.audioCodec!),
      baseURL: basename(rep.outputPath),
    };
  }

  private buildManifestXML(manifest: DASHManifest): string {
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += `<MPD xmlns="urn:mpeg:dash:schema:mpd:2011"`;
    xml += ` type="${manifest.type}"`;
    xml += ` minBufferTime="${manifest.minBufferTime}"`;
    xml += ` profiles="${manifest.profiles}"`;

    if (manifest.duration) {
      xml += ` mediaPresentationDuration="${manifest.duration}"`;
    }

    xml += '>\n';

    for (const period of manifest.periods) {
      xml += '  <Period';
      if (period.duration) {
        xml += ` duration="${period.duration}"`;
      }
      xml += '>\n';

      for (const adaptationSet of period.adaptationSets) {
        xml += `    <AdaptationSet mimeType="${adaptationSet.mimeType}"`;

        if (adaptationSet.contentType) {
          xml += ` contentType="${adaptationSet.contentType}"`;
        }

        if (adaptationSet.lang) {
          xml += ` lang="${adaptationSet.lang}"`;
        }

        xml += '>\n';

        for (const representation of adaptationSet.representations) {
          xml += `      <Representation id="${representation.id}" bandwidth="${representation.bandwidth}"`;

          if (representation.width && representation.height) {
            xml += ` width="${representation.width}" height="${representation.height}"`;
          }

          if (representation.frameRate) {
            xml += ` frameRate="${representation.frameRate}"`;
          }

          if (representation.codecs) {
            xml += ` codecs="${representation.codecs}"`;
          }

          xml += '>\n';

          if (representation.baseURL) {
            xml += `        <BaseURL>${representation.baseURL}</BaseURL>\n`;
          }

          if (representation.segmentTemplate) {
            const st = representation.segmentTemplate;
            xml += `        <SegmentTemplate media="${st.media}" initialization="${st.initialization}"`;
            xml += ` timescale="${st.timescale}" duration="${st.duration}"`;
            if (st.startNumber) {
              xml += ` startNumber="${st.startNumber}"`;
            }
            xml += ' />\n';
          }

          xml += '      </Representation>\n';
        }

        xml += '    </AdaptationSet>\n';
      }

      xml += '  </Period>\n';
    }

    xml += '</MPD>\n';

    return xml;
  }

  private getVideoCodec(codec: string): string {
    const codecMap: Record<string, string> = {
      h264: 'avc1.640028',
      h265: 'hev1.1.6.L93.B0',
      vp9: 'vp09.00.10.08',
      av1: 'av01.0.04M.08',
    };
    return codecMap[codec] || 'avc1.640028';
  }

  private getAudioCodec(codec: string): string {
    const codecMap: Record<string, string> = {
      aac: 'mp4a.40.2',
      opus: 'opus',
      mp3: 'mp4a.40.34',
    };
    return codecMap[codec] || 'mp4a.40.2';
  }

  private formatDuration(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    return `PT${hours}H${minutes}M${secs.toFixed(3)}S`;
  }
}

// ==================== Utility Functions ====================

/**
 * Parse HLS duration from EXTINF tag
 */
export function parseHLSDuration(extinfLine: string): number {
  const match = extinfLine.match(/#EXTINF:([\d.]+)/);
  return match ? parseFloat(match[1]) : 0;
}

/**
 * Extract segments from HLS playlist content
 */
export function parseHLSPlaylist(content: string): { segments: HLSSegment[]; metadata: any } {
  const lines = content.split('\n').filter((line) => line.trim());
  const segments: HLSSegment[] = [];
  let metadata: any = {};

  let currentSegment: Partial<HLSSegment> = {};

  for (const line of lines) {
    if (line.startsWith('#EXT-X-VERSION:')) {
      metadata.version = parseInt(line.split(':')[1]);
    } else if (line.startsWith('#EXT-X-TARGETDURATION:')) {
      metadata.targetDuration = parseInt(line.split(':')[1]);
    } else if (line.startsWith('#EXT-X-MEDIA-SEQUENCE:')) {
      metadata.mediaSequence = parseInt(line.split(':')[1]);
    } else if (line.startsWith('#EXTINF:')) {
      currentSegment.duration = parseHLSDuration(line);
    } else if (line.startsWith('#EXT-X-BYTERANGE:')) {
      const rangeMatch = line.match(/#EXT-X-BYTERANGE:(\d+)@(\d+)/);
      if (rangeMatch) {
        currentSegment.byteRange = {
          length: parseInt(rangeMatch[1]),
          offset: parseInt(rangeMatch[2]),
        };
      }
    } else if (line.startsWith('#EXT-X-DISCONTINUITY')) {
      currentSegment.discontinuity = true;
    } else if (!line.startsWith('#') && currentSegment.duration !== undefined) {
      // This is a segment URI
      segments.push({
        uri: line,
        duration: currentSegment.duration,
        byteRange: currentSegment.byteRange,
        discontinuity: currentSegment.discontinuity,
      });
      currentSegment = {};
    }
  }

  return { segments, metadata };
}

// ==================== Export Default Instances ====================

export const hlsGenerator = new HLSPlaylistGenerator();
export const dashGenerator = new DASHManifestGenerator();
