const EMPTY_IMAGES = [
  "/images/empty_yoga_b.png",
  "/images/empty_yoga_c.png",
];

/** 组件内 image 使用相对路径，避免嵌套组件绝对路径在真机不显示 */
const EMPTY_IMAGES_REL = [
  "../../../images/empty_yoga_b.png",
  "../../../images/empty_yoga_c.png",
];

function pickEmptyImage(options = {}) {
  const { relative = false, seed } = options;
  const list = relative ? EMPTY_IMAGES_REL : EMPTY_IMAGES;

  if (seed != null && seed !== "") {
    const n = Number(seed);
    if (!Number.isNaN(n)) {
      return list[Math.abs(Math.floor(n)) % list.length];
    }
  }
  const idx = Math.floor(Math.random() * list.length);
  return list[idx];
}

module.exports = {
  EMPTY_IMAGES,
  EMPTY_IMAGES_REL,
  pickEmptyImage,
};
