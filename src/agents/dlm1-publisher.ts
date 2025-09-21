import { createHash } from 'crypto';
 //import { createArtifact, updateArtifactVersion, getArtifact, listArtifacts } from '../db';

export interface PublishableArtifact {
  id: string;
  type: string;
  content: string;
  metadata: any;
  jobId: string;
}

export interface DLM1Manifest {
  name: string;
  description: string;
  license: string;
  classification: string;
  datasetId: string;
  provenance: {
    createdBy: string;
    createdAt: string;
    method: string;
    inputs?: string[];
  };
  contentHash: string;
  content?: {
    type: string;
    encoding?: string;
    inline?: string;
    url?: string;
  };
}

function generateContentHash(content: string): string {
  return createHash('sha256').update(content, 'utf8').digest('hex');
}

function createDLM1Manifest(artifact: PublishableArtifact): DLM1Manifest {
  const contentHash = generateContentHash(artifact.content);

  return {
    name: `Agent-Generated ${artifact.type}`,
    description: `Automatically generated artifact from job ${artifact.jobId}`,
    license: 'PROPRIETARY',
    classification: 'INTERNAL',
    datasetId: `agent-artifacts-${artifact.type.replace(/[^a-zA-Z0-9]/g, '-')}`,
    provenance: {
      createdBy: 'gitdata-agent-marketplace',
      createdAt: new Date().toISOString(),
      method: 'automated-generation',
      inputs: artifact.metadata?.inputs || []
    },
    contentHash,
    content: {
      type: artifact.type,
      encoding: 'utf8',
      inline: artifact.content
    }
  };
}

export async function publishArtifactToDLM1(
  db: Database.Database,
  artifactId: string,
  overlayUrl = 'http://localhost:8788'
): Promise<{ success: boolean; versionId?: string; error?: string }> {
  try {
    const artifact = getArtifact(db, artifactId);
    if (!artifact) {
      return { success: false, error: 'Artifact not found' };
    }

    if (artifact.version_id) {
      return { success: true, versionId: artifact.version_id }; // Already published
    }

    const content = artifact.content_data?.toString('utf8') || '';
    if (!content) {
      return { success: false, error: 'No content to publish' };
    }

    const publishableArtifact: PublishableArtifact = {
      id: artifact.artifact_id,
      type: artifact.artifact_type,
      content,
      metadata: artifact.metadata_json ? JSON.parse(artifact.metadata_json) : {},
      jobId: artifact.job_id
    };

    const manifest = createDLM1Manifest(publishableArtifact);

    // Submit to DLM1 via existing infrastructure
    const response = await fetch(`${overlayUrl}/submit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(manifest)
    });

    if (!response.ok) {
      const errorText = await response.text();
      return { success: false, error: `DLM1 submission failed: ${response.status} ${errorText}` };
    }

    const result = await response.json();

    if (result.status !== 'ok' || !result.versionId) {
      return { success: false, error: `DLM1 submission failed: ${result.error || 'Unknown error'}` };
    }

    // Update artifact with versionId
    updateArtifactVersion(db, artifactId, result.versionId);

    return { success: true, versionId: result.versionId };

  } catch (error) {
    return { success: false, error: `Publishing failed: ${error.message}` };
  }
}

export async function publishContractArtifact(
  db: Database.Database,
  jobId: string,
  contractContent: string,
  contractMetadata: any,
  overlayUrl = 'http://localhost:8788'
): Promise<{ success: boolean; artifactId?: string; versionId?: string; error?: string }> {
  try {
    const contentHash = generateContentHash(contractContent);

    // Store artifact in database
    const artifactId = createArtifact(db, {
      job_id: jobId,
      artifact_type: 'contract/markdown',
      content_hash: contentHash,
      content_data: Buffer.from(contractContent, 'utf8'),
      metadata_json: JSON.stringify(contractMetadata)
    });

    // Publish to DLM1
    const publishResult = await publishArtifactToDLM1(db, artifactId, overlayUrl);

    if (!publishResult.success) {
      return {
        success: false,
        artifactId,
        error: `Artifact stored but publishing failed: ${publishResult.error}`
      };
    }

    return {
      success: true,
      artifactId,
      versionId: publishResult.versionId
    };

  } catch (error) {
    return { success: false, error: `Contract publishing failed: ${error.message}` };
  }
}

export function createArtifactRoutes(db: Database.Database) {
  const express = require('express');
  const router = express.Router();

  // GET /artifacts - List artifacts
  router.get('/', (req: any, res: any) => {
    try {
      const { type, jobId, published, limit = 50, offset = 0 } = req.query;

      const artifacts = listArtifacts(db, {
        type: type || undefined,
        jobId: jobId || undefined,
        published: published === 'true' ? true : published === 'false' ? false : undefined,
        limit: parseInt(limit),
        offset: parseInt(offset)
      });

      const items = artifacts.map(a => ({
        artifactId: a.artifact_id,
        jobId: a.job_id,
        type: a.artifact_type,
        contentHash: a.content_hash,
        versionId: a.version_id,
        metadata: a.metadata_json ? JSON.parse(a.metadata_json) : null,
        createdAt: a.created_at,
        publishedAt: a.published_at,
        published: !!a.version_id
      }));

      res.json({ items });
    } catch (error) {
      res.status(500).json({ error: 'list-artifacts-failed', message: error.message });
    }
  });

  // GET /artifacts/:id - Get artifact
  router.get('/:id', (req: any, res: any) => {
    try {
      const artifact = getArtifact(db, req.params.id);
      if (!artifact) {
        return res.status(404).json({ error: 'not-found' });
      }

      res.json({
        artifactId: artifact.artifact_id,
        jobId: artifact.job_id,
        type: artifact.artifact_type,
        contentHash: artifact.content_hash,
        content: artifact.content_data?.toString('utf8'),
        versionId: artifact.version_id,
        metadata: artifact.metadata_json ? JSON.parse(artifact.metadata_json) : null,
        createdAt: artifact.created_at,
        publishedAt: artifact.published_at,
        published: !!artifact.version_id
      });
    } catch (error) {
      res.status(500).json({ error: 'get-artifact-failed', message: error.message });
    }
  });

  // POST /artifacts/:id/publish - Publish artifact to DLM1
  router.post('/:id/publish', async (req: any, res: any) => {
    try {
      const overlayUrl = req.body.overlayUrl || 'http://localhost:8788';
      const result = await publishArtifactToDLM1(db, req.params.id, overlayUrl);

      if (!result.success) {
        return res.status(400).json({ error: 'publish-failed', message: result.error });
      }

      res.json({ status: 'ok', versionId: result.versionId });
    } catch (error) {
      res.status(500).json({ error: 'publish-failed', message: error.message });
    }
  });

  return router;
}