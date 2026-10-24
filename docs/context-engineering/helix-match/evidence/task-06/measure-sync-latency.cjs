// Measures MatchClient replica synchronization latency (plan Task 6, NFR-5 evidence; no threshold is claimed).
// Usage: node measure-sync-latency.cjs <test-helper-binary> [rounds]
// Requires `npm run compile` (loads out/src/native). Uses the test-only helper so that the replica can be verified.
const path = require('node:path');
const { createHash } = require('node:crypto');
const repo = path.resolve(__dirname, '../../../../..');
const { MatchClient } = require(path.join(repo, 'out/src/native/matchClient.js'));
const { detectTarget, readLockIdentity } = require(path.join(repo, 'out/src/native/helperPath.js'));

const helper = process.argv[2];
const rounds = Number(process.argv[3] ?? 30);
const target = detectTarget({ platform: process.platform, arch: process.arch, musl: false });
const runtime = path.join(repo, 'native/runtime/out', target, 'runtime');
const lock = readLockIdentity(path.join(repo, 'native/helix-lock.json'), target);

const median = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
const ms = (ns) => Number(ns) / 1e6;

function makeText(lines, language) {
  const out = [];
  for (let i = 0; i < lines; i += 1) out.push(language === 'rust' ? `fn f${i}() { let x = ${i}; }` : `line ${i} of the document with some words`);
  return out.join('\n') + '\n';
}

(async () => {
  const docs = new Map();
  const client = new MatchClient({
    target, identity: lock, helperPath: helper, runtimeRoot: runtime, startupTimeoutMs: 120000, requestTimeoutMs: 120000,
    documentSource: { snapshot: (id) => docs.get(id) && { ...docs.get(id) } },
  });
  const t0 = process.hrtime.bigint();
  await client.ensureReady();
  const startMs = ms(process.hrtime.bigint() - t0);
  const rows = [];
  for (const language of ['plaintext', 'rust']) {
    for (const lines of [1000, 10000, 100000]) {
      const id = `${language}-${lines}`;
      const text = makeText(lines, language);
      const doc = { documentId: id, uri: `file:///w/${id}.${language === 'rust' ? 'rs' : 'txt'}`, generation: 1, version: 1, languageId: language, text, eol: 'lf', trust: 'trusted' };
      docs.set(id, doc);
      const o0 = process.hrtime.bigint();
      const opened = await client.documents.open({ ...doc });
      const openMs = ms(process.hrtime.bigint() - o0);
      const times = [];
      let version = 1;
      for (let r = 0; r < rounds; r += 1) {
        // One character inserted near the middle of the document (UTF-16 offset into the base snapshot).
        const at = Math.floor(doc.text.length / 2);
        const edits = [{ start: at, end: at, text: 'x' }];
        doc.text = doc.text.slice(0, at) + 'x' + doc.text.slice(at);
        version += 1;
        doc.version = version;
        const c0 = process.hrtime.bigint();
        const res = await client.documents.change({ documentId: id, generation: 1, version, edits });
        times.push(ms(process.hrtime.bigint() - c0));
        if (res.status !== 'applied' || res.ack.version !== version) throw new Error(`unexpected result ${JSON.stringify(res)}`);
      }
      const obs = await client.requestTyped('test_observe', { documentId: id });
      const agree = obs.version === version && obs.textSha256 === createHash('sha256').update(doc.text, 'utf8').digest('hex');
      rows.push({
        language, lines, chars: text.length, openMs: Number(openMs.toFixed(2)), syntaxStateAfterOpen: opened.ack.syntaxState,
        changeMedianMs: Number(median(times).toFixed(3)), changeMinMs: Number(Math.min(...times).toFixed(3)), changeMaxMs: Number(Math.max(...times).toFixed(3)),
        syntaxStateAfterChanges: obs.syntaxState, replicaMatchesHost: agree,
      });
    }
  }
  console.log(JSON.stringify({ helper: path.basename(helper), node: process.version, platform: `${process.platform}-${process.arch}`, rounds, startupMs: Number(startMs.toFixed(0)), rows }, null, 2));
  client.dispose();
})().catch((e) => { console.error(e); process.exit(1); });
