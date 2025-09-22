# D25 — BSV Overlay Network GUI Platform

**Enterprise Web Interface for Prosumers & Consumers with BRC Standards Integration**

Labels: ui, prosumer, consumer, marketplace, listings, overlay-network, brc-standards, spv
Assignee: TBA
Estimate: 16–20 PT
Priority: High

## Overview

Transform basic GUI into a comprehensive BSV overlay network web platform that integrates BRC-22 real-time synchronization, BRC-31 identity management, BRC-26 Universal Hash Resolution Protocol (UHRP), enterprise-grade interfaces for prosumers and consumers, and sophisticated overlay network coordination with agent marketplace support.

## Purpose

- **Overlay Network Interface**: Comprehensive web platform for BSV overlay network participants with real-time BRC-22 synchronization
- **Enterprise Data Marketplace**: Advanced discovery, procurement, and management interfaces for data marketplace participants
- **BRC Standards Integration**: Full support for BRC-31 identity verification, BRC-26 content resolution, and overlay network protocols
- **Agent Marketplace GUI**: Sophisticated interfaces for AI agent registration, coordination, and marketplace participation
- **Cross-Network Management**: Support for multi-overlay network operations with unified interface

## Non-Goals

- Full node or blockchain explorer functionality
- Custodial wallet management or private key storage
- Complex content management system features
- KYC/AML processes beyond BRC-31 identity verification
- Proprietary dependencies (maintaining vendor neutrality)

## Architecture & Dependencies

### Core Dependencies
- **Overlay Network APIs**: Full D24 overlay APIs with BRC standards integration
- **Required APIs**: `/v1/discovery/listings`, `/v1/agents`, `/v1/rules`, `/v1/jobs`, `/v1/streaming`, `/v1/payments`
- **BRC Integration**: BRC-22 (real-time sync), BRC-31 (identity), BRC-26 (content resolution)
- **Optional APIs**: `/v1/ingest`, `/v1/bundle`, `/v1/ready`, `/v1/analytics`
- **Real-time Features**: Server-Sent Events (SSE), WebSocket connections for overlay network updates

## User Roles & Personas

### Primary Roles
- **Prosumer (Data Publisher/Producer/Agent Operator)**
  - Data producers and publishers
  - AI agent operators and coordinators
  - Overlay network node operators
  - Revenue recipients and analytics viewers

- **Consumer (Data Buyer/Analyst/Agent)**
  - Data consumers and purchasers
  - AI agents executing autonomous purchases
  - Data analysts and researchers
  - Application developers integrating data

- **Network Administrator (System/Overlay Manager)**
  - Overlay network configuration and monitoring
  - Cross-network coordination
  - System health and performance management

## Information Architecture & UI Components

### Authentication & Identity Management
- **BRC-31 Identity Integration**
  - Secure identity verification and certificate management
  - Trust score display and reputation tracking
  - Cross-network identity synchronization
  - Optional wallet connectivity (BRC-100 compatible)

- **Session Management**
  - Lightweight session handling with identity persistence
  - Multi-network session coordination
  - Secure logout and session cleanup

### Dashboard Interfaces

#### Prosumer Dashboard
- **Overlay Network Status**
  - Real-time network synchronization status (BRC-22)
  - Cross-network coordination and health metrics
  - Node performance and connectivity indicators

- **Agent Marketplace Overview**
  - Registered agents status and performance
  - Agent marketplace activity and revenue
  - Real-time agent coordination updates

- **Content & Revenue Management**
  - Published dataset performance and analytics
  - Revenue streams and payment tracking
  - Recent ingest events and certifications

#### Consumer Dashboard
- **Data Marketplace Explorer**
  - Advanced search with BRC-26 UHRP content resolution
  - Recently viewed and purchased datasets
  - Personalized recommendations and trending content

- **Agent Activity Monitoring**
  - AI agent purchase history and patterns
  - Agent performance analytics and ROI tracking
  - Automated procurement status and alerts

- **Payment & Usage Analytics**
  - Payment history and transaction tracking
  - Usage quotas and consumption analytics
  - Cost optimization recommendations

### Data Discovery & Marketplace

#### Enhanced Listings Interface
- **Advanced Search & Discovery**
  - Multi-field search with content-addressed discovery (BRC-26)
  - Real-time filtering by dataset properties, pricing, and availability
  - Advanced pagination with infinite scroll and virtualization
  - Geographic and network-based content routing

- **Listing Cards & Details**
  - Rich content previews with availability scores
  - Multi-host download options via BRC-26 UHRP
  - Real-time pricing with agent marketplace integration
  - Quality metrics and community ratings

- **Content Resolution & Access**
  - Universal content resolution via BRC-26 UHRP
  - Multi-host availability with automatic failover
  - Intelligent download routing and optimization
  - SPV-verified content integrity checking

#### Marketplace Features
- **Real-time Market Data**
  - Live pricing updates and market trends
  - Supply and demand analytics
  - Cross-network price comparison
  - Market depth and liquidity indicators

- **Advanced Filtering & Analytics**
  - Machine learning-powered content recommendations
  - Quality score-based filtering and ranking
  - Producer reputation and track record
  - Content freshness and update frequency

### Agent Marketplace Integration

#### Agent Registration & Management
- **Comprehensive Agent Profiles**
  - Agent capabilities and specializations
  - Performance metrics and success rates
  - Integration endpoints and webhook configuration
  - Cross-network agent coordination

- **Agent Marketplace Coordination**
  - Real-time agent discovery and matching
  - Automated negotiation and procurement
  - Budget management and spending controls
  - Agent performance analytics and optimization

#### Autonomous Operations Interface
- **Agent Activity Monitoring**
  - Real-time agent decision tracking
  - Purchase approval workflows and controls
  - Performance analytics and ROI measurement
  - Budget utilization and optimization alerts

- **Marketplace Coordination**
  - Multi-agent coordination and collaboration
  - Cross-network agent communication
  - Distributed task execution monitoring
  - Agent ecosystem health and performance

### Rules & Automation (Prosumer)

#### Advanced Rule Management
- **Visual Rule Builder**
  - Drag-and-drop rule composition interface
  - Complex condition and action configuration
  - Real-time rule validation and testing
  - Cross-network rule coordination

- **Job Orchestration & Monitoring**
  - Comprehensive job lifecycle tracking
  - Real-time job status and progress monitoring
  - Evidence collection and verification interface
  - Performance analytics and optimization insights

### Payment & Revenue Management

#### BSV Payment Integration
- **Enterprise Payment Processing**
  - Quote generation with deterministic output templates
  - Multi-provider mAPI broadcasting with failover
  - Real-time SPV verification and confirmation tracking
  - Cross-network payment coordination

- **Revenue Analytics & Reporting**
  - Comprehensive revenue tracking and analytics
  - Multi-party revenue allocation and distribution
  - Real-time payment status and reconciliation
  - Tax reporting and compliance features

### Real-time Synchronization & Updates

#### BRC-22 Integration
- **Live Network Synchronization**
  - Real-time overlay network status updates
  - Cross-network coordination and consensus tracking
  - Automatic conflict resolution and merge handling
  - Network topology visualization and health monitoring

- **Event-Driven Updates**
  - Server-Sent Events (SSE) for real-time updates
  - WebSocket connections for bidirectional communication
  - Intelligent update batching and optimization
  - Offline synchronization and conflict resolution

## Core User Flows

### Enhanced Consumer Discovery Flow
1. **Intelligent Search & Discovery**
   - Advanced multi-field search with BRC-26 content resolution
   - AI-powered content recommendations and personalization
   - Real-time filtering with quality and availability scoring

2. **Content Evaluation & Selection**
   - Comprehensive content preview with metadata analysis
   - Multi-host availability verification via BRC-26 UHRP
   - Quality assessment with community ratings and reviews

3. **Purchase & Access Management**
   - Streamlined payment processing with BSV integration
   - Real-time payment verification and confirmation
   - Intelligent download routing and optimization

### Advanced Prosumer Automation Flow
1. **Agent Registration & Configuration**
   - Comprehensive agent profile setup and verification
   - Capability assessment and marketplace integration
   - Cross-network coordination and discovery

2. **Rule Creation & Management**
   - Visual rule builder with complex condition support
   - Real-time rule testing and validation
   - Cross-network rule coordination and execution

3. **Job Orchestration & Monitoring**
   - Automated job execution with real-time monitoring
   - Evidence collection and verification
   - Performance analytics and optimization

### Enterprise Data Ingest Flow (Optional)
1. **Batch Processing & Certification**
   - Large-scale data ingestion with quality validation
   - Real-time certification and verification
   - Automatic metadata extraction and indexing

2. **Live Stream Monitoring**
   - Real-time event processing and validation
   - Live certification and quality scoring
   - Automatic marketplace listing and availability

## Security & Compliance Framework

### SPV-First Architecture
- **Blockchain Verification**
  - Real-time confirmation status via `/ready` endpoints
  - Chain-of-custody verification via `/bundle` endpoints
  - SPV proof validation and storage
  - Automatic reorg detection and handling

### BRC-31 Identity Management
- **Enterprise Identity Verification**
  - Comprehensive identity certificate management
  - Trust score calculation and reputation tracking
  - Cross-network identity synchronization
  - Role-based access control and permissions

### Wallet Integration (BRC-100 Compatible)
- **Secure Wallet Connectivity**
  - Non-custodial wallet integration
  - Hardware wallet support and security
  - Multi-signature transaction coordination
  - Secure key management without browser storage

### Rate Limiting & Error Handling
- **Intelligent Rate Management**
  - Adaptive rate limiting with backoff strategies
  - Clear error messaging and recovery guidance
  - Graceful degradation under high load
  - Circuit breaker patterns for service protection

## Implementation Tasks

### Frontend Architecture & Framework
- [ ] **Modern Web Framework Selection**
  - SvelteKit/Next.js for SSR and optimal performance
  - TypeScript for type safety and developer experience
  - TailwindCSS for rapid UI development
  - Component library with accessibility compliance

- [ ] **State Management & Real-time Updates**
  - Centralized state management (Zustand/Redux Toolkit)
  - Real-time updates via SSE/WebSocket integration
  - Optimistic UI updates with conflict resolution
  - Offline-first architecture with sync capabilities

### Core Interface Development

#### Authentication & Identity Management
- [ ] **BRC-31 Identity Integration**
  - Identity certificate validation and display
  - Trust score visualization and reputation tracking
  - Cross-network identity synchronization
  - Secure session management with identity persistence

- [ ] **Wallet Integration (BRC-100 Compatible)**
  - Non-custodial wallet connection interface
  - Transaction signing and verification
  - Multi-signature support and coordination
  - Hardware wallet integration and security

#### Enhanced Data Discovery Interface
- [ ] **Advanced Search & Filtering**
  - Multi-field search with real-time suggestions
  - Complex filtering with faceted search
  - Geographic and network-based content routing
  - Saved searches and personalized recommendations

- [ ] **Listing Management & Display**
  - Rich content cards with availability indicators
  - Detailed content preview with metadata analysis
  - Multi-host availability via BRC-26 UHRP integration
  - Real-time pricing with market data integration

- [ ] **Content Resolution & Access**
  - Universal content resolution interface
  - Multi-host download with automatic failover
  - Progress tracking and resumable downloads
  - SPV verification status and integrity checking

#### Agent Marketplace Interface
- [ ] **Agent Registration & Management**
  - Comprehensive agent profile creation and editing
  - Capability assessment and verification interface
  - Performance metrics dashboard and analytics
  - Cross-network agent coordination interface

- [ ] **Marketplace Coordination**
  - Real-time agent discovery and matching
  - Automated negotiation and approval workflows
  - Budget management and spending controls
  - Agent performance optimization recommendations

#### Payment & Revenue Management
- [ ] **BSV Payment Processing Interface**
  - Quote generation and review interface
  - Transaction submission with status tracking
  - SPV verification and confirmation display
  - Payment history and analytics dashboard

- [ ] **Revenue Analytics & Reporting**
  - Comprehensive revenue tracking and visualization
  - Multi-party revenue allocation display
  - Real-time payment reconciliation interface
  - Tax reporting and compliance features

### Real-time Features & Synchronization

#### BRC-22 Integration
- [ ] **Live Network Status**
  - Real-time overlay network synchronization display
  - Cross-network coordination status tracking
  - Network topology visualization and health monitoring
  - Automatic conflict resolution and merge handling

- [ ] **Event-Driven Updates**
  - Server-Sent Events (SSE) implementation
  - WebSocket connections for bidirectional communication
  - Intelligent update batching and optimization
  - Offline synchronization and conflict resolution

#### Advanced User Experience Features
- [ ] **Performance Optimization**
  - Code splitting and lazy loading
  - Image optimization and caching
  - Virtual scrolling for large datasets
  - Progressive web app (PWA) capabilities

- [ ] **Accessibility & Internationalization**
  - WCAG 2.1 AA compliance
  - Keyboard navigation and screen reader support
  - Multi-language support (EN/DE minimum)
  - High contrast and dark mode themes

### Cross-Cutting Concerns

#### API Integration & Error Handling
- [ ] **Centralized API Client**
  - Type-safe API client with automatic retries
  - Intelligent error handling and recovery
  - Request/response interceptors and logging
  - Circuit breaker patterns for resilience

- [ ] **Feature Flag Management**
  - Dynamic feature toggling system
  - A/B testing and gradual rollout support
  - User-specific feature enablement
  - Real-time feature flag updates

#### Monitoring & Analytics
- [ ] **User Experience Monitoring**
  - Real-time performance metrics collection
  - User interaction tracking and analytics
  - Error reporting and crash analytics
  - Performance optimization insights

- [ ] **Security & Compliance**
  - Content Security Policy (CSP) implementation
  - XSS and CSRF protection
  - Secure cookie handling and session management
  - Data privacy and GDPR compliance

## Configuration

### Environment Variables
```bash
# Overlay Network Configuration
PUBLIC_OVERLAY_BASE_URL=http://localhost:8788
PUBLIC_NETWORK_ID=main-overlay
PUBLIC_BRC_STANDARDS_ENABLED=true

# Feature Flags
PUBLIC_FEATURE_FLAGS_JSON='{
  "payments": true,
  "ingest": true,
  "bundle": true,
  "ready": true,
  "agentMarketplace": true,
  "brcStandards": true,
  "realtimeUpdates": true
}'

# Identity & Security
PUBLIC_BRC31_IDENTITY_REQUIRED=false
PUBLIC_WALLET_CONNECT_ENABLED=true
PUBLIC_TRUST_SCORE_ENABLED=true

# UI Configuration
PUBLIC_DEFAULT_SEARCH_QUERY=""
PUBLIC_ITEMS_PER_PAGE=20
PUBLIC_LOCALE=en
PUBLIC_THEME=auto
PUBLIC_BRANDING_JSON='{
  "title": "BSV Overlay Network",
  "logoUrl": "/logo.svg",
  "description": "Enterprise Data Marketplace"
}'

# Real-time Features
PUBLIC_SSE_ENABLED=true
PUBLIC_WEBSOCKET_ENABLED=true
PUBLIC_SSE_PATH=/v1/events/stream
PUBLIC_RECONNECT_INTERVAL=5000

# Performance & Optimization
PUBLIC_CDN_BASE_URL=""
PUBLIC_IMAGE_OPTIMIZATION=true
PUBLIC_LAZY_LOADING=true
PUBLIC_PWA_ENABLED=true
```

### Feature Flag Schema
```typescript
interface OverlayFeatureFlags {
  // Core features
  payments: boolean;
  ingest: boolean;
  bundle: boolean;
  ready: boolean;

  // Advanced features
  agentMarketplace: boolean;
  brcStandards: boolean;
  realtimeUpdates: boolean;
  crossNetworkSync: boolean;

  // UI enhancements
  advancedSearch: boolean;
  contentPreview: boolean;
  personalizedRecommendations: boolean;
  darkModeDefault: boolean;
}
```

## Definition of Done

- [ ] **Core Platform Integration**
  - Comprehensive overlay network API integration with BRC standards support
  - Real-time synchronization via BRC-22 with automatic conflict resolution
  - Universal content resolution via BRC-26 UHRP with multi-host failover

- [ ] **Enhanced User Interfaces**
  - Advanced data discovery with intelligent search and filtering
  - Comprehensive agent marketplace with registration and coordination
  - Enterprise payment processing with BSV integration and SPV verification

- [ ] **Real-time Features**
  - Live network status updates and synchronization indicators
  - Event-driven UI updates with Server-Sent Events and WebSocket support
  - Offline-first architecture with intelligent sync and conflict resolution

- [ ] **Security & Compliance**
  - BRC-31 identity management with trust scoring and reputation tracking
  - SPV-first architecture with blockchain verification and proof display
  - Comprehensive security measures including CSP, XSS, and CSRF protection

## Acceptance Criteria

### Functional Requirements
- [ ] **Discovery Performance**: Sub-2-second search results with advanced filtering
- [ ] **Real-time Updates**: Live synchronization with <500ms latency
- [ ] **BRC Compliance**: Full integration with BRC-22, BRC-26, and BRC-31 standards
- [ ] **Cross-Network Support**: Seamless operation across multiple overlay networks

### User Experience Requirements
- [ ] **Accessibility**: WCAG 2.1 AA compliance with full keyboard navigation
- [ ] **Performance**: First contentful paint <1.5 seconds, interactive <3 seconds
- [ ] **Reliability**: 99.9% uptime with graceful degradation under high load
- [ ] **Internationalization**: Multi-language support with proper RTL handling

### Security Requirements
- [ ] **Identity Management**: Secure BRC-31 identity verification and session handling
- [ ] **Payment Security**: Comprehensive fraud detection with 99.99% accuracy
- [ ] **Data Protection**: Full GDPR compliance with privacy-by-design architecture
- [ ] **Network Security**: End-to-end encryption with certificate pinning

## Artifacts

- [ ] **Design Documentation**
  - Comprehensive UI/UX design system and component library
  - User journey maps and interaction flow diagrams
  - Accessibility audit results and compliance documentation

- [ ] **Testing Artifacts**
  - End-to-end test suites for all user flows and edge cases
  - Performance testing results and optimization recommendations
  - Security audit reports and penetration testing results

- [ ] **Deployment Resources**
  - Progressive web app manifests and service worker configurations
  - Content delivery network setup and optimization guides
  - Production deployment guides and monitoring setup

## Risk Mitigation

### Technical Risks
- **Network Latency**: Implement intelligent caching and prefetching strategies
- **API Dependencies**: Use circuit breaker patterns and graceful degradation
- **Browser Compatibility**: Progressive enhancement with polyfills and fallbacks

### User Experience Risks
- **Complex Interfaces**: Implement progressive disclosure and contextual help
- **Performance Issues**: Use lazy loading, code splitting, and optimization techniques
- **Accessibility Barriers**: Comprehensive testing and compliance monitoring

### Security Risks
- **Identity Spoofing**: Multi-factor authentication and advanced verification
- **Payment Fraud**: Machine learning-based fraud detection and prevention
- **Data Breaches**: Zero-trust architecture with comprehensive encryption

## BSV Overlay Network Alignment

### Digital Asset Principles
- **SPV-First Architecture**: Blockchain verification without central indexer dependencies
- **Vendor Neutrality**: BRC-100 wallet compatibility and open standards
- **UTXO Model**: Deterministic payment flows with clear ownership transfer

### BRC Standards Integration
- **BRC-22**: Real-time overlay network data synchronization
- **BRC-26**: Universal Hash Resolution Protocol for content discovery
- **BRC-31**: Identity verification and trust management

### Peer-to-Peer Operations
- **Direct Content Access**: Presigned URLs and direct downloads without proxies
- **SPV Verification**: Client-side proof validation and confirmation tracking
- **Decentralized Identity**: Self-sovereign identity with reputation tracking

## Implementation Notes

The BSV Overlay Network GUI Platform extends the basic interface concept into a comprehensive enterprise platform that maintains the principles of simplicity and functionality while providing advanced features for overlay network participants. The implementation focuses on vendor neutrality, SPV-first architecture, and seamless integration with BRC standards to create a powerful yet accessible interface for the next generation of data marketplace participants.

Definition of Done (DoD)
- [ ] Listings integriert:
  - /listings zeigt paginierte Treffer; q/Filter funktionieren; Empty State korrekt.
  - /listings/:versionId lädt Details; 404 wird im UI klar angezeigt.
  - Optionales Preis-Snippet degradiert sauber (Timeout → kein Preis, UI bleibt nutzbar).
- [ ] Consumer kann: Item via Listings finden → Detail ansehen → Ready/Bundle (Anzeige) → optional Quote/Submit (dryrun möglich) → Receipt-Status → Download-Link (falls konfiguriert).
- [ ] Prosumer kann: Agent registrieren → Regel anlegen → Regel triggern → Jobs/Evidence ansehen; Fehler (dead Job) werden im UI verständlich dargestellt.
- [ ] Ingest (falls aktiv): Batch → Events im Feed → Live-Updates via /watch → Event-Detail zeigt normalized/certified & VersionId.
- [ ] SPV-first Darstellung: Ready/Bundle ohne Indexer, Proof-/Confs-Status sichtbar.
- [ ] A11y/i18n: Kernflüsse per Tastatur bedienbar; Basis-Übersetzungen de/en.
- [ ] Dokumentation (Setup, Flows, Screenshots) vorhanden.

Abnahmekriterien (Tests)
- [ ] Listings E2E:
  - Liste 200 mit items:[] bei leerem Index; Detail-Request ohne versionId wird übersprungen/abgefedert.
  - Mit Daten: Liste speichert versionId; Detail verifiziert die gleiche versionId.
  - Paging deterministisch (limit/offset).
- [ ] Fehlerfälle: ungültige Params → UI meldet 400; unbekannte ID → 404-Hinweis; Timeout beim Preis-Snippet bricht unkritisch ab.
- [ ] Consumer Flow: Ready/Bundle Anzeige; Payment dryrun (falls aktiv) → Receipt-Status.
- [ ] Prosumer Flow: Jobs laufen done → Evidence (notify body.ok) sichtbar; enqueued=0 wird erklärt.
- [ ] SSE: Live-Events < 2 s sichtbar; Reconnect nach Netzunterbruch.
- [ ] Performance: Erste inhaltsvolle Anzeige < 2 s lokal; UI bleibt responsiv bei API-Fehlern.

Nichtfunktionale Anforderungen
- Einfaches Deployment (statisches Frontend, ENV-gestützt).
- Responsives Layout (Desktop-first, Tablet tauglich).
- Stabilität: Keine UI-Crashes bei API-Fehlern; Rate-Limits freundlich kommuniziert.

Artefakte/Evidence
- Wireframes/Mockups (Listings, Detail, Agenten, Regeln, Jobs, Ingest, Payments).
- Screenshots & kurze GIFs der Kernflüsse.
- UI-Test-Plan (manuell) inkl. Fehlerfälle.
- Beispiel-ENV (.env.example) mit BASE_URL, FEATURE_FLAGS_JSON, DEFAULT_QUERY.
- README (Setup, Flows, Screenshots).

Risiken/Rollback
- Leerer Datenbestand → UI zeigt sinnvolle Empty States; Hinweise zur Datenseed/Find-Query.
- Preis-Fan-Out (falls aktiv) → Feature-Flag, kurze Timeouts, keine Blockade der Liste.
- SSE hinter Proxies → Fallback Polling, Reconnect-Backoff.

ENV (Vorschlag)
- BASE_URL=http://localhost:8788
- FEATURE_FLAGS_JSON={"payments":true,"ingest":true,"bundle":true,"ready":true,"priceSnippet":false}
- UI_DEFAULT_LISTING_QUERY=
- UI_SSE_PATH=/watch
- UI_DOWNLOAD_MODE=presigned|stream
- UI_LOCALE=de|en
- UI_BRANDING_JSON={"title":"D24 Demo","logoUrl":"/logo.svg"}

Hinweise zur D24‑Ausrichtung
- BSV als digitaler Vermögenswert: SPV bleibt maßgeblich; UI zeigt Proof-/Confs-Status, keine Indexer-Abhängigkeit.
- BRC‑31 Identität optional; BRC‑100 Wallet‑Connect als vendor-neutraler Weg.
- UTXO/Idempotenz: Payment‑Flows sauber und deterministisch abbilden.
- Peer‑to‑Peer: Presigned-/SPV-Flows statt serverseitiges Proxy/Indexer-Paradigma.




______________



Klar! Hier ist ein schlanker, SvelteKit‑basierter GUI‑Entwurf, der direkt auf eure D24 Overlay‑APIs (insb. /listings) setzt. Fokus: sofort nutzbare, friktionsarme Suche auf der Startseite, SEO‑freundliches SSR, klare Fehlerzustände. Ich liefere dir:

- Anforderungen, Architektur und Projektstruktur
- ENV/Config
- Kern‑Snippets für SvelteKit (Pages, Server‑Load, API‑Wrapper, UI‑Komponenten)
- Optional‑Hooks für Ready/Bundle (SPV‑first) und Payments (Feature‑Flag, sauber degradiert)

Hinweis: Ich beziehe mich ausschließlich auf eure D24 Endpunkte wie /listings, /listings/:versionId, optional /ready und /bundle. Bitte überprüft die Snippets mit eurer Community.

Ziele
- Startseite zeigt GitData kurz an (Hero), mit direkter Suchleiste über /listings
- Ergebnissliste mit Paginierung (limit/offset) und Detailseite
- SSR‑first (SvelteKit load auf dem Server) für schnelle Time‑to‑Content und SEO
- Keine Keys/Secrets im Client (nur PUBLIC_ Variablen)
- Sanftes Degradieren, wenn optionale Endpunkte fehlen (Ready/Bundle/Payments)

Nicht‑Ziele
- Kein Custodial Wallet; keine Private Keys im Browser
- Kein Indexer im Frontend; SPV/Lineage wird nur angezeigt, wenn Backend bereitstellt
- Kein komplexes CMS; nur die minimalen UI‑Flows

Projektstruktur (SvelteKit)
- src/lib
  - api.ts: Fetch‑Wrapper zu Overlay
  - config.ts: ENV/Flags
  - components/
    - SearchBar.svelte
    - ListingCard.svelte
- src/routes
  - +layout.svelte: Grundgerüst/Branding
  - +layout.server.ts: Feature‑Flags bereitstellen
  - +page.svelte: Home (Hero + Suche)
  - search/+page.server.ts: Listings‑Abfrage
  - search/+page.svelte: Ergebnisliste + Paging
  - listings/[versionId]/+page.server.ts: Detail, optional Ready/Bundle
  - listings/[versionId]/+page.svelte: Anzeige
- static/ (Logo, Favicons)

ENV (.env.local)
- PUBLIC_OVERLAY_BASE_URL=http://localhost:8788
- PUBLIC_FEATURE_FLAGS_JSON={"ready":true,"bundle":true,"payments":false}
- PUBLIC_DEFAULT_QUERY=

Core Snippets

1) src/lib/config.ts
Liest öffentliche ENV und Feature‑Flags.

export const OVERLAY_BASE = import.meta.env.PUBLIC_OVERLAY_BASE_URL || 'http://localhost:8788';

let flags: Record<string, boolean>;
try {
  flags = JSON.parse(import.meta.env.PUBLIC_FEATURE_FLAGS_JSON || '{}');
} catch { flags = {}; }

export const FEATURES = {
  ready: !!flags.ready,
  bundle: !!flags.bundle,
  payments: !!flags.payments,
};

export const DEFAULT_QUERY = import.meta.env.PUBLIC_DEFAULT_QUERY || '';

2) src/lib/api.ts
Sicherer Fetch‑Wrapper (SSR/CSR), nur GETs für Listings/Detail. Optional Ready/Bundle.

import { OVERLAY_BASE } from './config';

async function fetchJson(input: string, init?: RequestInit) {
  const r = await fetch(input, { headers: { accept: 'application/json' }, ...init });
  const txt = await r.text();
  let js: any; try { js = JSON.parse(txt); } catch { js = { raw: txt }; }
  if (!r.ok) throw new Error(`${r.status} ${JSON.stringify(js)}`);
  return js;
}

export const api = {
  async listings(q = '', limit = 20, offset = 0) {
    const u = `${OVERLAY_BASE}/listings?q=${encodeURIComponent(q)}&limit=${limit}&offset=${offset}`;
    return fetchJson(u);
  },
  async listingDetail(versionId: string) {
    const u = `${OVERLAY_BASE}/listings/${encodeURIComponent(versionId)}`;
    return fetchJson(u);
  },
  async ready(versionId: string) {
    const u = `${OVERLAY_BASE}/ready?versionId=${encodeURIComponent(versionId)}`;
    return fetchJson(u);
  },
  async bundle(versionId: string) {
    const u = `${OVERLAY_BASE}/bundle?versionId=${encodeURIComponent(versionId)}&depth=99`;
    return fetchJson(u);
  }
};

3) src/lib/components/SearchBar.svelte
Einfache GET‑Suche (SvelteKit Form), landet auf /search?q=...

<script lang="ts">
  export let q = '';
</script>

<form method="GET" action="/search">
  <input name="q" placeholder="Suche nach Daten..." value={q} />
  <input type="number" name="limit" value="20" min="1" />
  <input type="number" name="offset" value="0" min="0" />
  <button type="submit">Suchen</button>
</form>

4) src/lib/components/ListingCard.svelte
Einzelnes Listing‑Item mit Link zur Detailseite.

<script lang="ts">
  export let item: any;
</script>

<div class="card">
  <div><strong>{item.versionId}</strong></div>
  <div class="meta">
    datasetId: {item.datasetId || '-'} | producerId: {item.producerId || '-'}
  </div>
  <a href={`/listings/${encodeURIComponent(item.versionId)}`}>Details</a>
</div>

<style>
  .card { border: 1px solid #e5e7eb; border-radius: 8px; padding: 10px; margin: 8px 0; }
  .meta { color: #6b7280; font-size: 12px; }
</style>

5) src/routes/+layout.svelte
Branding/Navigation. Startet mit GitData Hero.

<script>
  export let data;
</script>

<nav style="padding:10px;border-bottom:1px solid #eee;display:flex;gap:12px;">
  <a href="/">GitData</a>
  <a href="/search">Katalog</a>
</nav>
<slot />

<footer style="padding:12px;color:#666;border-top:1px solid #eee;">
  SPV-first. Vendor-neutral. Powered by D24 Overlay.
</footer>

6) src/routes/+layout.server.ts
Feature‑Flags für Client bereitstellen.

import type { LayoutServerLoad } from './$types';
import { FEATURES } from '$lib/config';

export const load: LayoutServerLoad = async () => {
  return { features: FEATURES };
};

7) src/routes/+page.svelte (Home)
Hero + direkte Suche (friktionsarm).

<script lang="ts">
  import SearchBar from '$lib/components/SearchBar.svelte';
  import { DEFAULT_QUERY } from '$lib/config';
</script>

<section style="padding:20px;">
  <h1>GitData</h1>
  <p>Finde und nutze Daten in Sekunden – ohne Reibung.</p>
  <SearchBar q={DEFAULT_QUERY} />
</section>

8) src/routes/search/+page.server.ts
Serverseitiges Laden der Listings.

import type { PageServerLoad } from './$types';
import { api } from '$lib/api';

export const load: PageServerLoad = async ({ url }) => {
  const q = url.searchParams.get('q') ?? '';
  const limit = Number(url.searchParams.get('limit') ?? '20');
  const offset = Number(url.searchParams.get('offset') ?? '0');

  try {
    const res = await api.listings(q, limit, offset);
    return { q, limit, offset, items: res.items ?? [] };
  } catch (e: any) {
    return { q, limit, offset, items: [], error: String(e?.message || e) };
  }
};

9) src/routes/search/+page.svelte
Ergebnisliste mit Paging.

<script lang="ts">
  export let data;
  import ListingCard from '$lib/components/ListingCard.svelte';

  const q = data.q || '';
  const limit = data.limit || 20;
  const offset = data.offset || 0;
  const items = data.items || [];
</script>

<section style="padding:20px;">
  <h2>Ergebnisse</h2>
  {#if data.error}
    <div style="color:#b91c1c;">Fehler: {data.error}</div>
  {/if}
  {#if items.length === 0}
    <div>Keine Listings gefunden.</div>
  {:else}
    {#each items as it}
      <ListingCard {item} />
    {/each}
  {/if}

  <nav style="margin-top:10px;display:flex;gap:8px;">
    {#if offset > 0}
      <a href={`/search?q=${encodeURIComponent(q)}&limit=${limit}&offset=${Math.max(0, offset - limit)}`}>« Zurück</a>
    {/if}
    <a href={`/search?q=${encodeURIComponent(q)}&limit=${limit}&offset=${offset + limit}`}>Weiter »</a>
  </nav>
</section>

10) src/routes/listings/[versionId]/+page.server.ts
Detail + optional Ready/Bundle (Feature‑Flags).

import type { PageServerLoad } from './$types';
import { api } from '$lib/api';
import { FEATURES } from '$lib/config';

export const load: PageServerLoad = async ({ params }) => {
  const versionId = params.versionId!;
  let detail: any = null, ready: any = null, bundle: any = null, errs: string[] = [];
  try {
    detail = await api.listingDetail(versionId);
  } catch (e: any) {
    errs.push(`detail: ${String(e?.message || e)}`);
  }
  if (FEATURES.ready) {
    try { ready = await api.ready(versionId); } catch (e: any) { errs.push(`ready: ${String(e?.message || e)}`); }
  }
  if (FEATURES.bundle) {
    try { bundle = await api.bundle(versionId); } catch (e: any) { errs.push(`bundle: ${String(e?.message || e)}`); }
  }
  return { versionId, detail, ready, bundle, errs };
};

11) src/routes/listings/[versionId]/+page.svelte
Anzeige inkl. SPV‑Hinweisen.

<script lang="ts">
  export let data;
</script>

<section style="padding:20px;">
  <h2>Listing: {data.versionId}</h2>
  {#if data.errs?.length}
    <div style="color:#b45309;">Hinweise: {data.errs.join(' | ')}</div>
  {/if}

  <details open>
    <summary>Detail</summary>
    <pre>{JSON.stringify(data.detail, null, 2)}</pre>
  </details>

  {#if data.ready}
    <details>
      <summary>Ready (SPV/Warnings)</summary>
      <pre>{JSON.stringify(data.ready, null, 2)}</pre>
    </details>
  {/if}

  {#if data.bundle}
    <details>
      <summary>Bundle (Lineage)</summary>
      <pre>{JSON.stringify(data.bundle, null, 2)}</pre>
    </details>
  {/if}
</section>

Setup‑Hinweise
- npm create svelte@latest my-gitdata-ui
- cd my-gitdata-ui && npm i
- Lege die Dateien wie oben an, setze .env.local (PUBLIC_OVERLAY_BASE_URL)
- npm run dev
- Teste: Home → Suche → Liste → Detail; Ready/Bundle nur, wenn vom Overlay bereitgestellt

Qualität/UX
- SSR‑Load sorgt für schnelle Anzeige (kein FOUC)
- Fehler degradieren sanft (keine Blocker bei fehlenden Optionalen)
- Minimal‑CSS inline; du kannst später Tailwind oder ein Design‑System ergänzen
- I18n/A11y: einfache Struktur, semantische Elemente (details/summary), gute Tastatur‑Bedienbarkeit

Erweiterungen (optional)
- Clientseitige Enhance‑Navigation (Progress Bar, Skeletons)
- Preis‑Snippet (Feature‑Flag) per eigenem API‑Call (kurzer Timeout, Caching)
- Payments‑CTA (D21): wenn payments==true, „Jetzt kaufen“ → /payments/quote Flow
- Prosumer‑Tabs (Agents/Rules/Jobs) in separaten Routen analog zu den früheren Snippets

Damit hast du eine SvelteKit‑Startbasis, die GitData auf der Homepage präsentiert und sofortige Datensuche ermöglicht — simpel, friktionsarm, D24‑kompatibel und SPV‑erst.s





Detail-Konzept der einzelnen Bereiche
1. Die Landing Page (/)

    Ein einziges Element: Ein großes, zentriertes Suchfeld mit dem Placeholder "versionId, txid, contentHash...".
    Keine Menüs, keine Bilder, kein Marketing-Blabla. Darunter in kleiner Schrift: "Genius System Explorer. A trust layer for the AI economy. [Docs] [Explorer]".
    Funktion: Gibt man eine ID ein und drückt Enter, wird man direkt zur Explorer-Detailansicht explorer/version/[id] weitergeleitet. Das ist der schnellste Weg zum Ziel.

3. Der Explorer (/explorer/...)

    Die Listenansicht 
        Eine simple, paginierte Tabelle oder Liste von Datensätzen.
        Spalten: versionId, Typ, Produzent, Erstellt am, Preis.
        Oben ein paar einfache Filter: "Zeige nur Klassifizierung: internal" oder "Produzent: ...".
        Kein "infinite scroll", sondern klare "Weiter" / "Zurück"-Buttons. Schnell und ressourcenschonend.
    Die Detailansicht Das ist das Herzstück für den Menschen.
        Header: Die versionId als große Überschrift. Darunter die wichtigsten Metadaten (Produzent, Erstellungsdatum, Content-Hash, Lizenz).
        Lineage-Visualisierung: Eine simple, vertikale Darstellung der Herkunftskette. Kein komplexer, interaktiver Graph. Eher wie eine Git-History:

        Beispiel:
        ◉ TOXSIM-REPORT-12 (this)
        │   - License: Internal-Use-Only
        │   - Producer: ToxSimAgent
        │
        └─┬ ◉ MOLECULA-DESIGNS-45
          │   - License: Research-License-v2
          │   - Producer: MoleculaAgent
          │
          └─┬ ◉ GENOSCREEN-RESULT-01
            │   - License: Data-Provider-ABC-License
            │   - Producer: GenoScreenerAgent
            │
            └── ◉ PHARMA-GENOME-73 (root)
                - License: PharmaCorp-Proprietary
                - Producer: human@pharmaco.corp

        Aktionen: Ein Button "[Download Manifest (JSON)]" und "[Download Data (if paid)]".
        Policy Check: Ein kleines Widget "Run /ready Check". Man kann eine Policy (als JSON) einfügen und der Button leuchtet grün ("Ready") oder rot ("Not Ready") mit Begründung. Das macht die Governance greifbar.

4. Die Dokumentation (/docs/...)

    Stil: Extrem minimalistisch, einspaltig, hoher Kontrast (Dark Mode by default).
    Inhalt: Reine Markdown-Dateien, die von SvelteKit in HTML umgewandelt werden. Schnell, versionierbar und einfach zu pflegen.
    Features: Code-Beispiele mit "Copy"-Button. Eine klare Beschreibung jedes API-Endpunkts mit Request- und Response-Beispielen.

Design- und UX-Prinzipien

    Radikale Simplizität: Wenn ein Element nicht absolut notwendig ist, um eine Aufgabe zu erfüllen, wird es entfernt.
    Dark Mode by Default: Angenehmer für Entwickler, die oft in dunklen IDEs arbeiten.
    Funktion über Form: Die Ästhetik ergibt sich aus der Klarheit und der Struktur, nicht aus Dekoration.
    Keine Ladezeiten: Die Seite muss sich augenblicklich anfühlen. SvelteKit's serverseitiges Rendering und die minimalistische Codebase machen das möglich.
    Informationsdichte: Wichtige Informationen (wie Hashes und IDs) sind immer sichtbar und kopierbar. Unwichtige Informationen sind standardmäßig ausgeblendet.

Diese Website wäre kein "Portal", sondern ein scharfes, präzises Werkzeug. Sie respektiert beide Zielgruppen, indem sie ihnen genau das gibt, was sie brauchen, und alles andere weglässt.