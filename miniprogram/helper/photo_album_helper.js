/** 相册展示：取前 4 张缩略图用于拼贴封面 */
function enrichPhotoAlbum(album) {
  const photos = album.photos || [];
  const thumbs = photos
    .slice(0, 4)
    .map((p) => p.pic || "")
    .filter(Boolean);
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
      .slice(0, 4)
      .map((p) => p.PHOTO_PIC || "")
      .filter(Boolean);
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
  enrichPhotoAlbum,
  enrichPhotoAlbumList,
  resolveRawPhotoAlbum,
  buildAlbumGroupsFromPhotos,
};
