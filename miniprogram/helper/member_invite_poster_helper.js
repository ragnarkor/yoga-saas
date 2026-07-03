const picHelper = require("./pic_helper.js");

const W = 750;
const H = 960;
const FOOT_H = 96;
const MAIN_H = H - FOOT_H;
const POSTER_BG = "/pages/coach/images/member_invite_poster.jpg";

function _loadImagePath(src) {
  return new Promise((resolve, reject) => {
    wx.getImageInfo({
      src,
      success: (res) => resolve(res.path),
      fail: reject,
    });
  });
}

function _download(url) {
  return new Promise((resolve, reject) => {
    wx.downloadFile({
      url,
      success: (res) => {
        if (res.statusCode === 200) resolve(res.tempFilePath);
        else reject(new Error("download failed"));
      },
      fail: reject,
    });
  });
}

function _createImage(canvas, src) {
  return new Promise((resolve, reject) => {
    const img = canvas.createImage();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function _truncate(ctx, text, maxW) {
  if (!text) return "";
  if (ctx.measureText(text).width <= maxW) return text;
  let s = text;
  while (s.length > 0 && ctx.measureText(`${s}…`).width > maxW) {
    s = s.slice(0, -1);
  }
  return `${s}…`;
}

async function drawInvitePoster(canvas, ctx, opts) {
  const tenantName = opts.tenantName || "瑜伽馆";
  const slogan = opts.slogan || "邀你加入 · 随时约课";
  const themeColor = opts.themeColor || "#6fae96";

  const bgPath = await _loadImagePath(POSTER_BG);
  const bgImg = await _createImage(canvas, bgPath);
  ctx.drawImage(bgImg, 0, 0, W, MAIN_H);

  const overlay = ctx.createLinearGradient(0, 0, 0, MAIN_H);
  overlay.addColorStop(0, "rgba(255,255,255,0.12)");
  overlay.addColorStop(0.42, "rgba(255,255,255,0.04)");
  overlay.addColorStop(1, "rgba(0,0,0,0.12)");
  ctx.fillStyle = overlay;
  ctx.fillRect(0, 0, W, MAIN_H);

  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 36px sans-serif";
  ctx.textAlign = "center";
  ctx.shadowColor = "rgba(0,0,0,0.28)";
  ctx.shadowBlur = 8;
  ctx.shadowOffsetY = 2;
  ctx.fillText(slogan, W / 2, 150);
  ctx.shadowColor = "transparent";

  const qrPath = await _download(opts.qrUrl);
  const qrImg = await _createImage(canvas, qrPath);

  const cx = W / 2;
  const cy = 400;
  const outerR = 132;
  const innerR = 118;

  ctx.save();
  ctx.shadowColor = "rgba(0, 0, 0, 0.18)";
  ctx.shadowBlur = 24;
  ctx.shadowOffsetY = 8;
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(cx, cy, outerR, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, innerR, 0, Math.PI * 2);
  ctx.clip();
  ctx.drawImage(qrImg, cx - innerR, cy - innerR, innerR * 2, innerR * 2);
  ctx.restore();

  ctx.fillStyle = "#ffffff";
  ctx.font = "26px sans-serif";
  ctx.textAlign = "center";
  ctx.shadowColor = "rgba(0,0,0,0.25)";
  ctx.shadowBlur = 6;
  ctx.shadowOffsetY = 2;
  ctx.fillText("微信扫一扫或", W / 2, cy + outerR + 56);
  ctx.fillText("微信长按识别", W / 2, cy + outerR + 90);
  ctx.shadowColor = "transparent";

  ctx.fillStyle = themeColor;
  ctx.fillRect(0, MAIN_H, W, FOOT_H);

  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 30px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(
    _truncate(ctx, `${tenantName}（门店）`, W - 80),
    W / 2,
    MAIN_H + FOOT_H / 2,
  );
}

function exportInvitePoster(component, opts) {
  return new Promise((resolve, reject) => {
    wx.createSelectorQuery()
      .in(component)
      .select("#inviteCanvas")
      .fields({ node: true, size: true })
      .exec(async (res) => {
        if (!res || !res[0] || !res[0].node) {
          reject(new Error("canvas 未就绪"));
          return;
        }

        const canvas = res[0].node;
        const ctx = canvas.getContext("2d");
        const dpr = wx.getWindowInfo().pixelRatio || 2;
        canvas.width = W * dpr;
        canvas.height = H * dpr;
        ctx.scale(dpr, dpr);

        try {
          await drawInvitePoster(canvas, ctx, opts);
          wx.canvasToTempFilePath({
            canvas,
            destWidth: W * dpr,
            destHeight: H * dpr,
            fileType: "png",
            success: (r) => resolve(r.tempFilePath),
            fail: reject,
          });
        } catch (e) {
          reject(e);
        }
      });
  });
}

function saveToAlbum(filePath) {
  return new Promise((resolve, reject) => {
    picHelper.getWritePhotosAlbum(() => {
      wx.saveImageToPhotosAlbum({
        filePath,
        success: resolve,
        fail: reject,
      });
    });
  });
}

module.exports = {
  exportInvitePoster,
  saveToAlbum,
};
