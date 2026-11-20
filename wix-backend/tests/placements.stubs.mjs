export const getSecret = async () => 'x';
export const SLEEVE_LOGO_URL = 'https://static.wixstatic.com/media/logo.png';
export const mediaManager = { upload: async () => ({ fileUrl: 'wix:image://v1/x.png/x.png' }) };
export const PNG = function () {}; PNG.sync = {};
export default {};
const AREAS = {
  71:  { front: [1800, 2400, 150], sleeve_left: [600, 525, 150], back: [1800, 2400, 150] },
  380: { front: [1800, 1800, 150], sleeve_left: [450, 1800, 150], back: [1800, 2400, 150] },
  358: { default: [1200, 1200, 300] },
};
const POSTER = { 1349: [4800, 3600], 1: [7200, 5400], 4464: [3600, 3600], 4465: [4800, 4800], 6242: [5400, 5400] };
export const fetch = async (url) => {
  const m = url.match(/printfiles\/(\d+)/);
  const pid = Number(m[1]);
  let printfiles = [], variant_printfiles = [];
  if (pid === 1 || pid === 3) {
    const table = pid === 1 ? POSTER : { 999: [6600, 5400] };
    let n = 1;
    for (const [vid, [w, h]] of Object.entries(table)) {
      printfiles.push({ printfile_id: n, width: w, height: h, dpi: 300, can_rotate: true });
      variant_printfiles.push({ variant_id: Number(vid), placements: { default: n } }); n++;
    }
  } else {
    let n = 1; const placements = {};
    for (const [name, [w, h, dpi]] of Object.entries(AREAS[pid])) { printfiles.push({ printfile_id: n, width: w, height: h, dpi }); placements[name] = n++; }
    variant_printfiles.push({ variant_id: 0, placements });
  }
  return { ok: true, json: async () => ({ result: { printfiles, variant_printfiles } }) };
};
