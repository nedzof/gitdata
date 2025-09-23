/**
 * Setup D08 Real-time Streaming Schema
 */

import { getHybridDatabase } from '../src/db/hybrid.js';
import fs from 'fs';

async function setupD08Schema() {
  const db = getHybridDatabase();

  try {
    console.log('🔄 Applying D08 Real-time Streaming Schema...');

    const schema = fs.readFileSync('./src/db/schema-d08-realtime-packets.sql', 'utf8');
    await db.pg.query(schema);

    console.log('✅ D08 schema applied successfully');
    console.log('   - streaming tables created');
    console.log('   - streaming columns added to manifests');
    console.log('   - sample streaming data inserted');

  } catch (error) {
    console.error('❌ Error applying D08 schema:', error);
    throw error;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  setupD08Schema()
    .then(() => process.exit(0))
    .catch(error => {
      console.error(error);
      process.exit(1);
    });
}

export { setupD08Schema };