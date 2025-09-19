import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

export type DeclarationRow = {
  version_id: string;
  txid: string | null;
  type: 'DLM1' | 'TRN1' | 'UNKNOWN';
  status: 'pending' | 'confirmed';
  created_at: number;
  block_hash: string | null;
  height: number | null;
  opret_vout: number | null;
  raw_tx: string | null;
  proof_json: string | null;
};

export type ManifestRow = {
  version_id: string;
  manifest_hash: string;
  content_hash: string | null;
  title: string | null;
  license: string | null;
  classification: string | null;
  created_at: string | null;
  manifest_json: string;
};

export function openDb(dbPath = process.env.DB_PATH || './data/overlay.db') {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  return db;
}

export function initSchema(db: Database.Database, schemaFile = 'src/db/schema.sql') {
  const sql = fs.readFileSync(schemaFile, 'utf8');
  db.exec(sql);
}

/* Declarations */
export function upsertDeclaration(db: Database.Database, row: Partial<DeclarationRow>) {
  // Insert or update by version_id (if provided) else by txid
  if (row.version_id) {
    const ins = db.prepare(`
      INSERT INTO declarations(version_id, txid, type, status, created_at, block_hash, height, opret_vout, raw_tx, proof_json)
      VALUES (@version_id, @txid, @type, COALESCE(@status,'pending'), COALESCE(@created_at,CAST(strftime('%s','now') AS INTEGER)), @block_hash, @height, @opret_vout, @raw_tx, @proof_json)
      ON CONFLICT(version_id) DO UPDATE SET
        txid=COALESCE(excluded.txid, declarations.txid),
        type=COALESCE(excluded.type, declarations.type),
        status=COALESCE(excluded.status, declarations.status),
        block_hash=COALESCE(excluded.block_hash, declarations.block_hash),
        height=COALESCE(excluded.height, declarations.height),
        opret_vout=COALESCE(excluded.opret_vout, declarations.opret_vout),
        raw_tx=COALESCE(excluded.raw_tx, declarations.raw_tx),
        proof_json=COALESCE(excluded.proof_json, declarations.proof_json)
    `);
    ins.run(row as any);
  } else if (row.txid) {
    const existing = db.prepare('SELECT version_id FROM declarations WHERE txid = ?').get(row.txid) as any;
    const vid = existing?.version_id || null;
    const ins = db.prepare(`
      INSERT INTO declarations(version_id, txid, type, status, created_at, block_hash, height, opret_vout, raw_tx, proof_json)
      VALUES (@version_id, @txid, @type, COALESCE(@status,'pending'), COALESCE(@created_at,CAST(strftime('%s','now') AS INTEGER)), @block_hash, @height, @opret_vout, @raw_tx, @proof_json)
      ON CONFLICT(version_id) DO UPDATE SET
        txid=COALESCE(excluded.txid, declarations.txid),
        type=COALESCE(excluded.type, declarations.type),
        status=COALESCE(excluded.status, declarations.status),
        block_hash=COALESCE(excluded.block_hash, declarations.block_hash),
        height=COALESCE(excluded.height, declarations.height),
        opret_vout=COALESCE(excluded.opret_vout, declarations.opret_vout),
        raw_tx=COALESCE(excluded.raw_tx, declarations.raw_tx),
        proof_json=COALESCE(excluded.proof_json, declarations.proof_json)
    `);
    ins.run({ ...row, version_id: vid } as any);
  } else {
    throw new Error('upsertDeclaration requires version_id or txid');
  }
}

export function getDeclarationByVersion(db: Database.Database, versionId: string): DeclarationRow | undefined {
  return db.prepare('SELECT * FROM declarations WHERE version_id = ?').get(versionId) as any;
}
export function getDeclarationByTxid(db: Database.Database, txid: string): DeclarationRow | undefined {
  return db.prepare('SELECT * FROM declarations WHERE txid = ?').get(txid) as any;
}
export function setOpretVout(db: Database.Database, versionId: string, vout: number) {
  db.prepare('UPDATE declarations SET opret_vout = ? WHERE version_id = ?').run(vout, versionId);
}
export function setProofEnvelope(db: Database.Database, versionId: string, envelopeJson: string) {
  db.prepare('UPDATE declarations SET proof_json = ? WHERE version_id = ?').run(envelopeJson, versionId);
}

/* Manifests */
export function upsertManifest(db: Database.Database, row: ManifestRow) {
  const stmt = db.prepare(`
    INSERT INTO manifests(version_id, manifest_hash, content_hash, title, license, classification, created_at, manifest_json)
    VALUES (@version_id, @manifest_hash, @content_hash, @title, @license, @classification, @created_at, @manifest_json)
    ON CONFLICT(version_id) DO UPDATE SET
      manifest_hash=excluded.manifest_hash,
      content_hash=excluded.content_hash,
      title=excluded.title,
      license=excluded.license,
      classification=excluded.classification,
      created_at=excluded.created_at,
      manifest_json=excluded.manifest_json
  `);
  stmt.run(row as any);
}
export function getManifest(db: Database.Database, versionId: string): ManifestRow | undefined {
  return db.prepare('SELECT * FROM manifests WHERE version_id = ?').get(versionId) as any;
}

/* Lineage edges */
export function replaceEdges(db: Database.Database, child: string, parents: string[]) {
  const del = db.prepare('DELETE FROM edges WHERE child_version_id = ?');
  del.run(child);
  if (parents.length === 0) return;
  const ins = db.prepare('INSERT OR IGNORE INTO edges(child_version_id, parent_version_id) VALUES (?, ?)');
  const tx = db.transaction((ps: string[]) => { for (const p of ps) ins.run(child, p); });
  tx(parents);
}
export function getParents(db: Database.Database, child: string): string[] {
  return db.prepare('SELECT parent_version_id AS p FROM edges WHERE child_version_id = ?').all(child).map((r: any) => r.p);
}

/* Prices */
export function setPrice(db: Database.Database, versionId: string, satoshis: number) {
  db.prepare(`
    INSERT INTO prices(version_id, satoshis) VALUES (?, ?)
    ON CONFLICT(version_id) DO UPDATE SET satoshis = excluded.satoshis
  `).run(versionId, satoshis);
}
export function getPrice(db: Database.Database, versionId: string): number | undefined {
  const row = db.prepare('SELECT satoshis FROM prices WHERE version_id = ?').get(versionId) as any;
  return row?.satoshis;
}

/* Listing helpers */
export function listListings(db: Database.Database, limit = 50, offset = 0) {
  const sql = `
    SELECT m.version_id, m.title, m.license, m.classification, m.content_hash,
           d.txid, d.status, d.created_at
    FROM manifests m
    LEFT JOIN declarations d ON d.version_id = m.version_id
    ORDER BY d.created_at DESC
    LIMIT ? OFFSET ?`;
  return db.prepare(sql).all(limit, offset) as any[];
}
