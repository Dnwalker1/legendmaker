const ratioOf = { 'https://a/pet.png': 1, 'https://a/legend.png': 0.75 };
let headerReadable = true;
globalThis.fetch = async (url) => {
  const r = ratioOf[url];
  if (!headerReadable || r == null) return { status: 200, body: null };
  const b = Buffer.alloc(32); b.write('PNG', 1, 'ascii'); b.writeUInt32BE(r === 1 ? 4096 : 3584, 16); b.writeUInt32BE(4096 * (r === 1 ? 1 : 1) * (r === 1 ? 1 : 4800 / 4096), 20);
  return { status: 206, arrayBuffer: async () => b };
};
const O = await import('./old/printfulShared.mjs'), N = await import('./new/printfulShared.mjs');
const C = await import('./new/productCatalog.mjs');
let fails = 0; const near = (a, b) => Math.abs(a - b) <= Math.max(2, b * 0.01);
const ok = (n, c, x = '') => { console.log((c ? 'PASS ' : 'FAIL ') + n, c ? '' : x); if (!c) fails++; };
// 1. every pet product, front and back, identical to before
for (const [key, color, size, print] of [['tee','White','L'],['tee','Ash','2XL','Back'],['hoodie','Bone','M'],['hoodie','White','XL','Back'],['sticker','','4x4'],['poster','','12×12'],['poster','','18×18']]) {
  const vid = C.getPrintfulVariantIdFor(key, color, size);
  for (const style of ['mockup', 'order']) {
    const a = JSON.stringify(await O.buildPrintFiles('https://a/pet.png', vid, {}, style, key, print));
    const b = JSON.stringify(await N.buildPrintFiles('https://a/pet.png', vid, {}, style, key, print));
    ok(`pet ${key} ${size} ${print || 'Front'} ${style} unchanged`, a === b, `\n old ${a}\n new ${b}`);
  }
}
// 2. pet lists unchanged, legend lists separate
const oldList = (await import('./old/productCatalog.mjs')).productListForPage();
ok('pet product list unchanged', JSON.stringify(oldList) === JSON.stringify(C.productListForPage()));
ok('legend list hidden until Wix IDs exist', C.productListForPage('legend').length === 0);
ok('catalogKeyFor', C.catalogKeyFor('legend','tee') === 'legendTee' && C.catalogKeyFor('legend','canvas') === 'legendCanvas' && C.catalogKeyFor('pet','tee') === 'tee' && C.catalogKeyFor('pet','legendTee') === null && C.catalogKeyFor('legend','sticker') === null);
// 3. legend placements
const pos = async (key, color, size) => (await N.buildPrintFiles('https://a/legend.png', C.getPrintfulVariantIdFor(key, color, size), {}, 'order', key))[0].position;
let p = await pos('legendTee', 'White', 'L');
ok(`legend tee 10.5x14in from 1in: ${JSON.stringify(p)}`, p.width === 1575 && near(p.height, 2100) && p.top === 150 && near(p.left, 113));
p = await pos('legendHoodie', 'White', 'L');
ok(`legend hoodie fitted in square: ${JSON.stringify(p)}`, p.area_width === 1800 && p.area_height === 1800 && near(p.width, 1238) && p.height === 1650 && p.top === 150 && p.top + p.height === 1800);
p = await pos('legendPoster', '', '12×16');
ok(`legend poster 12x16 fills, area turned upright: ${JSON.stringify(p)}`, p.area_width === 3600 && p.area_height === 4800 && near(p.width, 3600) && p.height === 4800);
p = await pos('legendPoster', '', '18×24');
ok(`legend poster 18x24 fills: ${JSON.stringify(p)}`, p.area_width === 5400 && near(p.width, 5400) && p.height === 7200);
p = await pos('legendCanvas', '', '12×16');
ok(`legend canvas covers the 12x16 front, wrap plain: ${JSON.stringify(p)}`, p.area_width === 5400 && p.area_height === 6600 && p.width === 3600 && near(p.height, 4800) && p.left === 900 && Math.abs(p.top + p.height / 2 - 3300) <= 1);
const files = await N.buildPrintFiles('https://a/legend.png', C.getPrintfulVariantIdFor('legendTee','White','L'), {}, 'order', 'legendTee');
ok('legend tee has the sleeve logo', files.length === 2 && files[1].type === 'sleeve_left');
// 4. header unreadable: falls back to 3:4 for legend, square for pets
headerReadable = false; ratioOf['https://a/legend2.png'] = 0.75;
const f2 = await N.buildPrintFiles('https://a/legend2.png', 1349, {}, 'order', 'legendPoster');
ok('unreadable legend art assumed 3:4', f2[0].position.width === 3600 && f2[0].position.height === 4800, JSON.stringify(f2[0].position));
console.log(fails ? `${fails} FAILED` : 'ALL PASSED');
