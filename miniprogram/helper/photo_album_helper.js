const {
  DEFAULT_COVERS,
  isLegacyDefaultCover,
} = require("./default_cover_helper.js");

/**
 * 不应进入相册的系统插画。
 * 这些资源在课程、空状态或首页无图时有意义，但混入真实照片轮播会像“突然播到占位图”。
 */
const PLACEHOLDER_PIC_RE = /^(?:default_cover(?:_pic)?(?:_\d+)?|default_index_bg|upimg|empty_yoga(?:_[a-z])?|tenant_logo_placeholder)\.(?:jpg|jpeg|png|gif|webp)$/i;

/**
 * 课程封面占位插画 / 历史 gif 不应出现在相册缩略图里。
 * 按 basename 模式匹配，兼容 cloud://、https://、无前缀相对路径、带 query 参数等一切形态。
 */
function isPlaceholderPic(pic) {
  if (!pic || typeof pic !== "string") return true;
  const clean = pic.split("?")[0].split("#")[0].trim();
  if (!clean) return true;
  if (isLegacyDefaultCover(clean)) return true;
  if (DEFAULT_COVERS.indexOf(clean) !== -1) return true;
  const base = clean.slice(clean.lastIndexOf("/") + 1);
  return PLACEHOLDER_PIC_RE.test(base);
}

/** 相册展示：取前 4 张缩略图用于拼贴封面（剔除占位图） */
function enrichPhotoAlbum(album) {
  const photos = album.photos || [];
  const thumbs = photos
    .map((p) => p.pic || "")
    .filter((pic) => !isPlaceholderPic(pic))
    .slice(0, 4);
  return {
    ...album,
    photos,
    thumbs,
    thumbCount: thumbs.length,
    cover: thumbs[0] || "",
    count: photos.length,
  };
}

function enrichPhotoAlbumList(albums) {
  return (albums || []).map(enrichPhotoAlbum);
}

function resolveRawPhotoAlbum(item) {
  const album = (item.PHOTO_ALBUM || "").trim();
  if (album) return album;
  const desc = (item.PHOTO_DESC || "").trim();
  return desc || "未分类";
}

function buildAlbumGroupsFromPhotos(photos) {
  const map = {};
  for (const item of photos || []) {
    const name = resolveRawPhotoAlbum(item);
    if (!map[name]) {
      map[name] = { title: name, photos: [] };
    }
    map[name].photos.push(item);
  }
  return Object.values(map).map((group, index) => {
    const thumbs = group.photos
      .map((p) => p.PHOTO_PIC || "")
      .filter((pic) => !isPlaceholderPic(pic))
      .slice(0, 4);
    return {
      id: String(index),
      title: group.title,
      cover: thumbs[0] || "",
      thumbs,
      thumbCount: thumbs.length,
      count: group.photos.length,
      photos: group.photos,
    };
  });
}

module.exports = {
  isPlaceholderPic,
  enrichPhotoAlbum,
  enrichPhotoAlbumList,
  resolveRawPhotoAlbum,
  buildAlbumGroupsFromPhotos,
};
