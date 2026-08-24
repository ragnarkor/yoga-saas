// 外部链接跳转承载页：仅允许 https 协议地址进入 web-view，防止 javascript:/file:/data: 等协议注入
function isSafeUrl(url) {
  if (!url || typeof url !== "string") return false;
  return /^https:\/\//i.test(url.trim());
}

Page({
  data: {
    url: "",
  },
  onLoad(options) {
    let raw = "";
    if (options && options.url) {
      try {
        raw = decodeURIComponent(options.url);
      } catch (e) {
        raw = "";
      }
    }
    this.setData({ url: isSafeUrl(raw) ? raw : "" });
  },
});
