const VALID_IDS = [
  "",
  "sage_wave",
  "terracotta_arc",
  "lavender_flow",
  "ocean_peace",
  "cream_lotus",
];

function isCustomCover(cover) {
  return /^cloud:\/\/[\w./-]+$/i.test(String(cover || "").trim());
}

function normalizeCover(coverId) {
  if (!coverId) return "";
  const id = String(coverId).trim();
  // 预设封面保存 ID；馆主上传的封面只接受云存储 fileID，避免写入任意外链。
  return VALID_IDS.includes(id) || isCustomCover(id) ? id : "";
}

module.exports = {
  normalizeCover,
  isCustomCover,
};
