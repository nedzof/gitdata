// src/mock/overlay-mock-extended.ts (or your server entry)
import { startHeaderHotReload, getBestHeight, getConfirmations } from '../spv/header-store';
import { verifyEnvelope } from '../spv/verify-envelope';

await startHeaderHotReload(process.env.HEADERS_FILE!, 5000);

// In /bundle: include confsUsed/bestHeight if you have a blockHash for the target proof
const env = bundle.proofs.find((p) => p.versionId.toLowerCase() === targetVersionId)?.envelope;
if (env) {
  const spv = await verifyEnvelope(env);
  bundle.confsUsed = spv.confs;
  bundle.bestHeight = getBestHeight();
}

// In /ready: require minConfs by policy
const env2 = null; // TODO: get target proof envelope
const spv2 = env2 ? await verifyEnvelope(env2) : { ok: false, confs: 0 };
const ready = spv2.ok && spv2.confs >= (policy.minConfs ?? 1) && true; // TODO: other policy checks
return res.json({
  ready,
  reasons: ready ? [] : [`confs=${spv2.confs} < minConfs`],
  confsUsed: spv2.confs,
  bestHeight: getBestHeight(),
  bundle: policy?.includeBundle ? bundle : undefined,
});
