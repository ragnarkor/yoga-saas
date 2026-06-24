/**
 * 默认课程封面占位图（本地静态资源）
 */

const DEFAULT_COVERS = [
  "/images/default_cover_1.jpg",
  "/images/default_cover_2.jpg",
  "/images/default_cover_3.jpg",
  "/images/default_cover_4.jpg",
  "/images/default_cover_5.jpg",
];

function hashStr(str) {
  let h = 0;
  const s = String(str || "");
  for (let i = 0; i < s.length; i++) {
    h = (h << 5) - h + s.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

function pickRandomDefaultCover() {
  const idx = Math.floor(Math.random() * DEFAULT_COVERS.length);
  return DEFAULT_COVERS[idx];
}

function pickDefaultCover(seed) {
  if (seed || seed === 0) {
    return DEFAULT_COVERS[hashStr(seed) % DEFAULT_COVERS.length];
  }
  return pickRandomDefaultCover();
}

function isLegacyDefaultCover(url) {
  if (!url || typeof url !== "string") return true;
  const trimmed = url.trim();
  if (!trimmed) return true;
  return /default_cover_pic\.(gif|png|jpg|jpeg)/i.test(trimmed);
}

/** 解析封面：空值、旧 gif、历史占位路径 → 按 seed 选一张本地图 */
function resolveCoverUrl(url, seed) {
  if (isLegacyDefaultCover(url)) {
    return pickDefaultCover(seed);
  }
  return url;
}

function getDefaultCovers() {
  return DEFAULT_COVERS.slice();
}

module.exports = {
  DEFAULT_COVERS,
  pickDefaultCover,
  pickRandomDefaultCover,
  isLegacyDefaultCover,
  resolveCoverUrl,
  getDefaultCovers,
};
