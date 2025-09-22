# Streaming File Support Design for BRC-26 UHRP

## Overview

This document outlines the design for streaming file support in the BRC-26 Universal Hash Resolution Protocol (UHRP) implementation. This extends the current static file storage to support large files, video streaming, and real-time content distribution.

## Current Implementation

The current BRC-26 UHRP implementation supports:
- Static file storage (PDF, TXT, images, etc.)
- File upload via HTTP POST with multer
- Content-based addressing using SHA-256 hashes
- UTXO-based content advertisements
- Multi-host content resolution and download
- PostgreSQL storage with metadata indexing

**File Size Limitations:**
- Current: 100MB per file (multer limit)
- Storage: Local filesystem with hash-based naming
- Transfer: Complete file upload/download only

## Streaming Requirements

### 1. **Large File Support**
- Files up to 10GB+ (video, datasets, models)
- Chunked upload/download with resume capability
- Progress tracking and error recovery
- Bandwidth optimization

### 2. **Video Streaming**
- HLS (HTTP Live Streaming) support
- DASH (Dynamic Adaptive Streaming) support
- Multiple quality levels (240p, 480p, 720p, 1080p)
- Adaptive bitrate streaming
- Live streaming capabilities

### 3. **Real-time Content Distribution**
- WebRTC-based peer-to-peer streaming
- CDN-style distribution across overlay nodes
- Content replication and caching strategies
- Edge node content delivery

### 4. **Content Transcoding**
- Video format conversion (MP4, WebM, AV1)
- Image optimization and multiple resolutions
- Audio transcoding for streaming
- Thumbnail generation

## Technical Architecture

### 1. **Chunked Storage System**

```typescript
interface StreamableContent extends UHRPContent {
  isStreamable: boolean;
  chunkSize: number;
  totalChunks: number;
  streamingProfiles?: StreamingProfile[];
  transcoded?: boolean;
}

interface StreamingProfile {
  profileId: string;
  quality: '240p' | '480p' | '720p' | '1080p' | '4k';
  bitrate: number;
  codec: string;
  format: 'hls' | 'dash' | 'mp4';
  playlistUrl?: string;
}

interface ContentChunk {
  contentHash: string;
  chunkIndex: number;
  chunkHash: string;
  size: number;
  localPath: string;
  uploadedAt: number;
}
```

### 2. **Database Schema Extensions**

```sql
-- Streaming content table
CREATE TABLE uhrp_streaming_content (
  id SERIAL PRIMARY KEY,
  content_hash TEXT NOT NULL REFERENCES uhrp_content(content_hash),
  is_streamable BOOLEAN DEFAULT FALSE,
  chunk_size INTEGER DEFAULT 1048576, -- 1MB chunks
  total_chunks INTEGER NOT NULL,
  transcoded BOOLEAN DEFAULT FALSE,
  transcoding_status VARCHAR(20) DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Content chunks table
CREATE TABLE uhrp_content_chunks (
  id SERIAL PRIMARY KEY,
  content_hash TEXT NOT NULL,
  chunk_index INTEGER NOT NULL,
  chunk_hash TEXT UNIQUE NOT NULL,
  size_bytes INTEGER NOT NULL,
  local_path TEXT NOT NULL,
  uploaded_at BIGINT NOT NULL,
  UNIQUE(content_hash, chunk_index)
);

-- Streaming profiles table
CREATE TABLE uhrp_streaming_profiles (
  id SERIAL PRIMARY KEY,
  content_hash TEXT NOT NULL,
  profile_id TEXT NOT NULL,
  quality VARCHAR(10) NOT NULL,
  bitrate INTEGER NOT NULL,
  codec VARCHAR(20) NOT NULL,
  format VARCHAR(10) NOT NULL,
  playlist_url TEXT,
  file_path TEXT,
  transcoding_completed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(content_hash, profile_id)
);

-- Streaming sessions table (for analytics)
CREATE TABLE uhrp_streaming_sessions (
  id SERIAL PRIMARY KEY,
  content_hash TEXT NOT NULL,
  profile_id TEXT,
  session_id TEXT NOT NULL,
  client_ip INET,
  user_agent TEXT,
  started_at BIGINT NOT NULL,
  ended_at BIGINT,
  bytes_served BIGINT DEFAULT 0,
  quality_switches INTEGER DEFAULT 0
);
```

### 3. **Chunked Upload API**

```typescript
// Initialize chunked upload
POST /overlay/files/stream/init
{
  "filename": "large-video.mp4",
  "contentType": "video/mp4",
  "totalSize": 1073741824, // 1GB
  "chunkSize": 1048576,    // 1MB chunks
  "enableStreaming": true,
  "streamingProfiles": ["720p", "1080p"]
}

// Upload chunk
PUT /overlay/files/stream/:uploadId/chunk/:chunkIndex
Content-Type: application/octet-stream
Body: [chunk data]

// Complete upload
POST /overlay/files/stream/:uploadId/complete
{
  "chunkHashes": ["hash1", "hash2", ...] // Verification
}

// Get upload status
GET /overlay/files/stream/:uploadId/status
```

### 4. **Streaming Playback API**

```typescript
// Get streaming info
GET /overlay/files/stream/:hash/info
{
  "hash": "abc123...",
  "filename": "video.mp4",
  "duration": 3600, // seconds
  "profiles": [
    {
      "profileId": "720p",
      "quality": "720p",
      "bitrate": 2500000,
      "format": "hls",
      "playlistUrl": "/overlay/files/stream/abc123/720p/playlist.m3u8"
    }
  ]
}

// HLS playlist
GET /overlay/files/stream/:hash/:profile/playlist.m3u8

// HLS segments
GET /overlay/files/stream/:hash/:profile/segment_:index.ts

// DASH manifest
GET /overlay/files/stream/:hash/manifest.mpd

// Direct chunk access
GET /overlay/files/stream/:hash/chunk/:index
Range: bytes=0-1048575
```

### 5. **Transcoding Pipeline**

```typescript
interface TranscodingJob {
  contentHash: string;
  sourceFile: string;
  targetProfiles: StreamingProfile[];
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  startedAt?: number;
  completedAt?: number;
  error?: string;
}

class TranscodingService {
  async transcodeVideo(
    inputPath: string,
    outputDir: string,
    profiles: StreamingProfile[]
  ): Promise<void> {
    // Use FFmpeg for video transcoding
    // Generate HLS/DASH manifests
    // Create multiple quality levels
  }

  async generateThumbnails(
    videoPath: string,
    outputDir: string,
    timestamps: number[]
  ): Promise<string[]> {
    // Extract thumbnails at specific timestamps
  }
}
```

## Implementation Phases

### Phase 1: Chunked Upload/Download (4-6 weeks)
1. **Chunked Storage Backend**
   - Implement content chunking system
   - Add chunk verification and integrity checks
   - Database schema for chunks

2. **Upload API**
   - Multipart/chunked upload endpoints
   - Resume capability for failed uploads
   - Progress tracking and status endpoints

3. **Download API**
   - Range request support (HTTP 206)
   - Chunk-based download with resume
   - Parallel chunk downloads for speed

### Phase 2: Video Streaming (6-8 weeks)
1. **Transcoding Integration**
   - FFmpeg integration for video processing
   - HLS playlist generation
   - Multiple quality profiles

2. **Streaming Endpoints**
   - HLS/DASH manifest serving
   - Segment serving with caching
   - Adaptive bitrate logic

3. **Player Integration**
   - JavaScript player library
   - Quality switching and buffering
   - Analytics and performance metrics

### Phase 3: Distributed Streaming (8-10 weeks)
1. **P2P Distribution**
   - WebRTC integration for peer-to-peer
   - Content replication across overlay nodes
   - Load balancing and failover

2. **CDN Features**
   - Edge caching strategies
   - Geographic content distribution
   - Bandwidth optimization

3. **Live Streaming**
   - Real-time ingestion endpoints
   - Low-latency streaming protocols
   - Live transcoding pipeline

## Performance Considerations

### 1. **Storage Optimization**
- Chunk deduplication across files
- Compression for cold storage
- Tiered storage (hot/warm/cold)
- Automatic cleanup of expired content

### 2. **Network Optimization**
- HTTP/2 for multiplexed connections
- Content compression (gzip, brotli)
- Edge caching with TTL management
- Peer-to-peer offloading

### 3. **Processing Optimization**
- Background transcoding queues
- GPU acceleration for video processing
- Distributed transcoding across nodes
- Priority-based job scheduling

## Security Considerations

### 1. **Content Protection**
- DRM integration for premium content
- Token-based access control
- Watermarking for content tracking
- Encrypted chunks for sensitive data

### 2. **Bandwidth Protection**
- Rate limiting per client/content
- Abuse detection and prevention
- Geographic restrictions
- Cost monitoring and alerts

### 3. **Privacy Protection**
- Anonymous streaming sessions
- No-logging policies for privacy
- Encrypted metadata storage
- User consent for analytics

## Monitoring and Analytics

### 1. **Performance Metrics**
- Streaming quality metrics
- Buffer health and rebuffering events
- Network throughput and latency
- Transcoding performance

### 2. **Usage Analytics**
- Content popularity tracking
- Geographic usage patterns
- Device and browser analytics
- Quality preferences

### 3. **Operational Metrics**
- Storage utilization
- Transcoding queue health
- Network bandwidth usage
- Error rates and availability

## Future Enhancements

### 1. **Advanced Features**
- AI-powered content optimization
- Automatic quality adjustment
- Predictive pre-loading
- Content recommendation engine

### 2. **Integration Opportunities**
- Blockchain-based content licensing
- Micropayments for streaming
- Creator revenue sharing
- Content verification and authenticity

### 3. **Platform Extensions**
- Mobile app streaming
- Smart TV integration
- VR/AR content support
- Interactive streaming features

## Conclusion

The streaming file support design provides a comprehensive foundation for:
- **Scalable Content Distribution**: Handle files from MB to GB+ sizes
- **Modern Streaming Protocols**: Support HLS, DASH, and WebRTC
- **Distributed Architecture**: Leverage overlay network for CDN capabilities
- **Content Processing**: Transcoding and optimization pipeline
- **Enterprise Features**: Analytics, security, and monitoring

This design positions the BRC-26 UHRP implementation as a complete content distribution platform suitable for video streaming, large dataset distribution, and real-time content delivery within the BSV overlay network ecosystem.