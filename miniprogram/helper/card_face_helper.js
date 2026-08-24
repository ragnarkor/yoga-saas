const COLOR_PRESETS = [
  { value: "#F5A623", label: "暖橙色" },
  { value: "#4A90A4", label: "青蓝色" },
  { value: "#E57373", label: "珊瑚红" },
  { value: "#81C784", label: "薄荷绿" },
  { value: "#9B6FD4", label: "薰衣草" },
];

const COVER_PRESETS = [
  {
    id: "sage_wave",
    label: "薄荷波浪",
    url: "/images/card_faces/card_face_sage_wave.jpg",
  },
  {
    id: "terracotta_arc",
    label: "暖橙光弧",
    url: "/images/card_faces/card_face_terracotta_arc.jpg",
  },
  {
    id: "lavender_flow",
    label: "薰衣草",
    url: "/images/card_faces/card_face_lavender_flow.jpg?v=2",
  },
  {
    id: "ocean_peace",
    label: "海蓝静心",
    url: "/images/card_faces/card_face_ocean_peace.jpg?v=2",
  },
  {
    id: "cream_lotus",
    label: "莲花米色",
    url: "/images/card_faces/card_face_cream_lotus.jpg?v=3",
  },
];

const COVER_MAP = COVER_PRESETS.reduce((acc, item) => {
  acc[item.id] = item;
  return acc;
}, {});

const COLOR_MAP = COLOR_PRESETS.reduce((acc, item) => {
  acc[item.value.toLowerCase()] = item;
  return acc;
}, {});

function normalizeHexColor(color) {
  return String(color || "")
    .trim()
    .toLowerCase();
}

function getStylePickerOptions() {
  const solids = COLOR_PRESETS.map((item) => ({
    pickerKey: `solid:${item.value.toLowerCase()}`,
    label: item.label,
    solidColor: item.value,
    coverId: "",
    color: item.value,
    url: "",
  }));
  const covers = COVER_PRESETS.map((item) => ({
    pickerKey: `cover:${item.id}`,
    label: item.label,
    solidColor: "",
    coverId: item.id,
    color: "",
    url: item.url,
  }));
  return solids.concat(covers);
}

function getStyleKey(coverId, color) {
  const cid = normalizeCoverId(coverId);
  if (cid) return `cover:${cid}`;
  const hex = normalizeHexColor(color);
  if (COLOR_MAP[hex]) return `solid:${hex}`;
  return hex ? `solid:${hex}` : `solid:${COLOR_PRESETS[0].value.toLowerCase()}`;
}

function parseStylePick(pickerKey) {
  const key = String(pickerKey || "").trim();
  if (key.startsWith("cover:")) {
    return { coverId: key.slice(6), color: null };
  }
  if (key.startsWith("solid:")) {
    const hex = key.slice(6);
    const hit = COLOR_MAP[hex];
    return { coverId: "", color: (hit && hit.value) || hex || COLOR_PRESETS[0].value };
  }
  return { coverId: "", color: COLOR_PRESETS[0].value };
}

function getStyleLabel(coverId, color) {
  const key = getStyleKey(coverId, color);
  const hit = getStylePickerOptions().find((item) => item.pickerKey === key);
  if (hit) return hit.label;
  const cid = normalizeCoverId(coverId);
  if (cid) return getCoverLabel(cid);
  return "纯色";
}

function getCoverUrl(coverId) {
  if (isCustomCover(coverId)) return String(coverId).trim();
  const hit = COVER_MAP[normalizeCoverId(coverId)];
  return (hit && hit.url) || "";
}

function getCoverLabel(coverId) {
  if (isCustomCover(coverId)) return "自定义封面";
  const hit = COVER_MAP[normalizeCoverId(coverId)];
  return (hit && hit.label) || "纯色";
}

function isCustomCover(coverId) {
  return /^cloud:\/\/[\w./-]+$/i.test(String(coverId || "").trim());
}

function normalizeCoverId(coverId) {
  if (!coverId) return "";
  const id = String(coverId).trim();
  return COVER_MAP[id] || isCustomCover(id) ? id : "";
}

function enrichCardVisual(item) {
  if (!item || typeof item !== "object") return item;
  const coverId = normalizeCoverId(
    item.coverId || item.CARD_TPL_COVER || item.cover || "",
  );
  const color =
    item.color || item.CARD_TPL_COLOR || COLOR_PRESETS[0].value;
  const coverUrl = getCoverUrl(coverId);
  return {
    ...item,
    color,
    coverId,
    coverUrl,
    coverLabel: getCoverLabel(coverId),
    styleKey: getStyleKey(coverId, color),
    styleLabel: getStyleLabel(coverId, color),
  };
}

// 生成卡面渐变的深色端（与 card_shop / card_order 页的 _darken 算法一致）
function darkenColor(hex, ratio = 0.72) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || "").trim());
  if (!m) return "#3e5a4c";
  const n = parseInt(m[1], 16);
  const r = Math.round(((n >> 16) & 255) * ratio);
  const g = Math.round(((n >> 8) & 255) * ratio);
  const b = Math.round((n & 255) * ratio);
  return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}
// 卡面罩层：有封面时仅用中性黑系渐变轻微压暗（上浅下深、不改变封面色调），
// 保证白字对比；无封面时品牌色渐变直接作为卡面底色
function getCardShadeBg(color, coverUrl) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(color || "").trim());
  const base = m ? `#${m[1]}` : "#5b8a72";
  const dark = darkenColor(base);
  if (coverUrl) {
    return "background:linear-gradient(180deg,rgba(0,0,0,0.12) 0%,rgba(0,0,0,0.18) 45%,rgba(0,0,0,0.52) 100%);";
  }
  return `background:linear-gradient(140deg,${base} 0%,${dark} 100%);`;
}

module.exports = {
  COLOR_PRESETS,
  COVER_PRESETS,
  getStylePickerOptions,
  getStyleKey,
  parseStylePick,
  getStyleLabel,
  getCoverUrl,
  getCoverLabel,
  isCustomCover,
  normalizeCoverId,
  enrichCardVisual,
  darkenColor,
  getCardShadeBg,
};
