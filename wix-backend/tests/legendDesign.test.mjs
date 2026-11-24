import fs from 'node:fs';
let src = fs.readFileSync('/home/claude/legendmaker/wix-backend/legendDesign.web.js','utf8');
src = src.replace(/import\s*\{([^}]*)\}\s*from\s*'([^']+)';/g, (m, names, mod) => `const {${names.replace(/ as /g, ': ')}} = globalThis.__stubs['${mod}'];`);
src = src.replace(/import\s+(\w+)\s+from\s*'([^']+)';/g, (m, name, mod) => `const ${name} = globalThis.__stubs['${mod}'].default;`);
src = src.replace(/import\s*\*\s*as\s+(\w+)\s+from\s*'([^']+)';/g, (m, name, mod) => `const ${name} = globalThis.__stubs['${mod}'];`);
src = src.replace(/^export /gm, '');
src += `\nglobalThis.__t = { startLegendDesign, getLegendDesignStatus, getLegendPersonas, legendPersonaKey, buildPrompt, LEGEND_PERSONAS, NO_PERSON_NOTE, MINOR_NOTE, CROWD_NOTE, FAMOUS_NOTE, getLegendProductChoices, listMyLegendDesigns, getMyLegendAllowance };`;
const db = new Map(); let seq = 0; let dropFields = false; const deleted = []; const uploads = [];
let photoVerdict, figureVerdicts, bannerMatches = true;
const jsonResp = (o, ok = true) => ({ ok, status: ok ? 200 : 500, json: async () => o });
const gem = (o) => jsonResp({ candidates: [{ content: { parts: [{ text: JSON.stringify(o) }] } }] });
globalThis.__stubs = {
  'wix-web-module': { Permissions: { Anyone: 1 }, webMethod: (_p, f) => f },
  'wix-secrets-backend': { getSecret: async () => 'key' },
  'wix-media-backend': { mediaManager: { upload: async (folder, buf, name) => { uploads.push(name); return { fileUrl: `wix:image://v1/${name}/${name}` }; } } },
  'wix-fetch': { fetch: async (url, init) => {
      const body = JSON.parse(init.body); const text = body.contents[0].parts.map(p => p.text || '').join(' ');
      if (url.includes('pro-image')) return jsonResp({ candidates: [{ content: { parts: [{ inlineData: { data: Buffer.from('art').toString('base64'), mimeType: 'image/png' } }] } }] });
      if (text.includes('uploaded this photo')) return gem(photoVerdict);
      if (text.includes('typed this text')) return gem({ reject: /BATMAN/.test(text.split('The text is:')[1]) });
      if (text.includes('has a banner')) return gem({ reads: 'x', matches: bannerMatches });
      if (text.includes('"harm": true|false') ) return gem({ harm: false });
      if (text.includes('"brandMark"')) return gem(figureVerdicts.shift() || { people: 1, looksUnder18: false, brandMark: false, otherText: '' });
      if (text.includes('"flagged"')) return gem({ flagged: false });
      throw new Error('unexpected checker prompt');
  } },
  'backend/petDesigns': {
    createDesignRecord: async (d) => { const id = 'd' + (++seq); const rec = { ...d, _id: id, _createdDate: new Date() }; if (dropFields) { delete rec.subject; delete rec.subjectMode; delete rec.whoConsentAt; } db.set(id, rec); return id; },
    updateDesignRecord: async (id, d) => db.set(id, { ...db.get(id), ...d }),
    getDesignRecord: async (id) => db.get(id),
    countRecentDesignsForVisitor: async () => 0, countGoodDesignsForVisitor: async () => 0, countRecentDesignsSiteWide: async () => 0,
    toPublicImageUrl: (u) => u.startsWith('http') ? u : 'https://static.wixstatic.com/media/' + u.split('/')[3],
  },
  'backend/imageTools': { toCheckJpeg: (b) => b, toWebPng: (b) => b, clearOuterWhite: (b) => ({ buffer: b, changed: false }) },
  'backend/watermark': { watermarkPreview: async (b) => b },
  '@wix/media': { files: { getFileDescriptor: async () => ({ operationStatus: 'READY' }), bulkDeleteFiles: async (ids) => { deleted.push(...ids); } } },
  '@wix/essentials': { auth: { elevate: (f) => f } },
  'wix-data': { default: { query: () => {
    const q = { f: {}, eq(k, v) { this.f[k] = v; return this; }, gt() { return this; }, hasSome() { return this; },
      descending() { return this; }, ascending() { return this; }, limit() { return this; },
      async find() { return { items: (globalThis.__pageRows || []).filter(r => r.visitorId === this.f.visitorId) }; } };
    return q; } } },
  'backend/productCatalog': { DEFAULT_LEGEND_PRODUCT: 'legendPoster', productListForPage: (app) => app === 'legend'
    ? [{ value: 'legendTee', label: 'T-Shirt' }, { value: 'legendHoodie', label: 'Hoodie' }, { value: 'legendPoster', label: 'Poster' }, { value: 'legendCanvas', label: 'Canvas' }]
    : [{ value: 'tee', label: 'T-Shirt' }] },
};
globalThis.fetch = async () => ({ ok: true, arrayBuffer: async () => Buffer.from('photo'), headers: { get: () => 'image/jpeg' } });
fs.writeFileSync('/tmp/ld-test.mjs', src); await import('/tmp/ld-test.mjs');
const t = globalThis.__t; const wait = () => new Promise(r => setTimeout(r, 60));
const good = { reject: false, people: 1, faceClear: true, minor: false, famous: false, harm: false, describe: 'short grey hair, beard, glasses {x}' };
const P = 'wix:image://v1/abc~mv2.jpg/abc~mv2.jpg'; let fails = 0;
const check = (name, cond, extra='') => { console.log((cond ? 'PASS ' : 'FAIL ') + name, cond ? '' : extra); if (!cond) fails++; };

check('persona keys', t.legendPersonaKey('monarch') === 'legendMonarch' && t.legendPersonaKey('Rock Star') === 'legendRockStar' && t.legendPersonaKey('legendNoble') === 'legendNoble' && t.legendPersonaKey('travelStamp') === null);
let r = await t.startLegendDesign(P, 'monarch', 'v1', 'King Don', 'self', false);
check('no tick refused', r.ok === false && r.step === 'consent' && db.size === 0);
r = await t.startLegendDesign(P, 'monarch', 'v1', 'King Don', 'friend', true);
check('unknown who refused', r.step === 'consent');
r = await t.startLegendDesign(P, 'nope', 'v1', '', 'self', true);
check('unknown persona refused', r.step === 'style');
r = await t.startLegendDesign(P, 'monarch', 'v1', 'BATMAN', 'self', true);
check('protected name refused', r.step === 'text' && db.size === 0);
dropFields = true; r = await t.startLegendDesign(P, 'monarch', 'v1', '', 'self', true); dropFields = false;
check('missing collection fields fails closed', r.ok === false && r.step === 'setup' && uploads.length === 0, JSON.stringify(r));

async function run(verdict, { text = 'King Don', figures = [] , persona = 'monarch', who = 'gift' } = {}) {
  photoVerdict = verdict; figureVerdicts = figures; uploads.length = 0; deleted.length = 0;
  const r = await t.startLegendDesign(P, persona, 'v1', text, who, true); await wait();
  return { r, d: db.get(r.designRecordId), status: await t.getLegendDesignStatus(r.designRecordId) };
}
let o = await run(good);
check('happy path ready', o.d.status === 'ready' && o.d.subjectMode === 'gift' && o.d.whoConsentAt instanceof Date && o.d.customText === 'KING DON' && o.d.styleChoice === 'legendMonarch', JSON.stringify(o.d));
check('two files saved, preview only returned', uploads.length === 2 && o.status.previewArtUrl.includes('legend-preview') && !JSON.stringify(o.status).includes('legend-design-'));
o = await run({ ...good, people: 0 });            check('no person', o.d.moderationNote === t.NO_PERSON_NOTE && deleted.length === 1 && uploads.length === 0);
o = await run({ ...good, faceClear: false });     check('face not clear', o.d.moderationNote === t.NO_PERSON_NOTE);
o = await run({ ...good, minor: true });          check('minor refused', o.d.moderationNote === t.MINOR_NOTE && o.d.status === 'blocked' && deleted.length === 1);
const { minor, ...noMinorField } = good;
o = await run(noMinorField);                      check('missing minor field fails closed', o.d.moderationNote === t.MINOR_NOTE);
o = await run({ ...good, people: 2 });            check('two people refused', o.d.moderationNote === t.CROWD_NOTE);
o = await run({ ...good, famous: true });         check('famous refused', o.d.moderationNote === t.FAMOUS_NOTE);
o = await run({ ...good, harm: true });           check('harm refused', o.d.status === 'blocked');
o = await run({ ...good, reject: true, reason: 'nudity' }); check('content refused', o.d.status === 'blocked' && /nudity/.test(o.d.moderationNote));
o = await run(good, { figures: [{ people: 1, brandMark: true, reason: 'team crest' }] });
check('brand mark redrawn once then ready', o.d.status === 'ready' && /\[2 drawn/.test(o.d.moderationNote), o.d.moderationNote);
o = await run(good, { figures: [{ people: 1, otherText: 'WANTED' }, { people: 2 }] });
check('two bad drawings not shown', o.d.status === 'unclean' && uploads.length === 0 && o.status.previewArtUrl === null);
bannerMatches = false; o = await run(good); bannerMatches = true;
check('misspelled name not shown', o.d.status === 'unclean');
o = await run(good, { persona: 'noble', text: 'IGNORED' });
check('noble takes no text', o.d.customText === '' && o.d.status === 'ready');
const prompt = t.buildPrompt('legendMonarch', 'KING DON', 'grey hair');
check('prompt has name once, notes, no braces left', prompt.includes('"KING DON"') && prompt.includes('grey hair') && !/\{[A-Z]+\}/.test(prompt));
o = await run({ ...good, reject: true, reason: 'child', minor: true, people: 5 }); check('minor named even with catch-all', o.d.moderationNote === t.MINOR_NOTE, o.d.moderationNote);
o = await run({ ...good, reject: true, reason: 'celebrity', famous: true }); check('famous named even with catch-all', o.d.moderationNote === t.FAMOUS_NOTE, o.d.moderationNote);
o = await run({ reject: true, reason: 'no person', people: 0, faceClear: false, minor: false, famous: false, harm: false }); check('empty photo named even with catch-all', o.d.moderationNote === t.NO_PERSON_NOTE, o.d.moderationNote);
o = await run({ reject: true, reason: 'no person', people: 0 }); check('empty photo with fields missing still refused as no face', o.d.status === 'blocked' && o.d.moderationNote === t.NO_PERSON_NOTE, o.d.moderationNote);
const { faceClear, ...noFaceField } = good;
o = await run(noFaceField); check('missing faceClear fails closed', o.d.moderationNote === t.NO_PERSON_NOTE);
o = await run({ ...good, people: undefined }); check('missing people count fails closed', o.d.status === 'blocked');
o = await run(good, { figures: [{ people: 1, edgeIsDark: false }] }); check('light edge redrawn once', o.d.status === 'ready' && /\[2 drawn/.test(o.d.moderationNote) && !/Light outer edge/.test(o.d.moderationNote), o.d.moderationNote);
o = await run(good, { figures: [{ people: 1, edgeIsDark: false }, { people: 1, edgeIsDark: false }] }); check('light edge twice is kept and noted', o.d.status === 'ready' && /Light outer edge accepted/.test(o.d.moderationNote), o.d.moderationNote);
o = await run(good, { figures: [{ people: 1, edgeIsDark: false }, { people: 1, brandMark: true }] }); check('edge redraw that fails falls back to first', o.d.status === 'ready' && /Light outer edge accepted/.test(o.d.moderationNote), o.d.status + ' ' + o.d.moderationNote);
o = await run(good, { persona: 'outlaw', figures: [{ people: 1, edgeIsDark: false }] }); check('western paper edge not redrawn', o.d.status === 'ready' && /\[1 drawn/.test(o.d.moderationNote), o.d.moderationNote);
check('edge rule: navy by default, paper for the western', t.buildPrompt('legendChef','','').includes('all four edges') && t.buildPrompt('legendOutlaw','','').includes('pure white') && !t.buildPrompt('legendOutlaw','','').includes('{EDGE}') && !t.buildPrompt('legendOutlaw','','').includes('band of solid ink navy'));
check('portrait shape asked for', /aspectRatio: ART_ASPECT/.test(src) && /const ART_ASPECT = '3:4'/.test(src) && t.buildPrompt('legendChef','','').includes('four tall'));
check('prompt without text is pictorial', t.buildPrompt('legendNoble', '', '').includes('entirely pictorial'));
// The web page's three helpers (24 Nov 2026).
const pc = await t.getLegendProductChoices();
check('page products: wall art first, legend only, poster default', pc.ok && pc.products.map(p => p.value).join() === 'legendPoster,legendCanvas,legendTee,legendHoodie' && pc.defaultProduct === 'legendPoster', JSON.stringify(pc));
const day = new Date(Date.now() - 3 * 3600e3);
globalThis.__pageRows = [
  { _id: 'a', visitorId: 'v1', styleChoice: 'legendChef', previewArtUrl: 'https://static.wixstatic.com/media/p.png', generatedArtUrl: 'PRINT', _createdDate: day },
  { _id: 'b', visitorId: 'v1', styleChoice: 'travelStamp', previewArtUrl: 'https://static.wixstatic.com/media/q.png', _createdDate: day }
];
const mine = await t.listMyLegendDesigns('v1');
check('page tray: legend designs only, no print file', mine.length === 1 && mine[0].styleName === 'Head Chef' && !JSON.stringify(mine).includes('PRINT'), JSON.stringify(mine));
check('page tray: no visitor, nothing', (await t.listMyLegendDesigns('')).length === 0);
const al = await t.getMyLegendAllowance('v1');
check('page allowance counts this browser', al.ok && al.limit === 5 && al.left === 3 && al.nextFreeAt === null, JSON.stringify(al));
console.log(fails ? `\n${fails} FAILED` : '\nALL PASSED'); process.exit(fails ? 1 : 0);
