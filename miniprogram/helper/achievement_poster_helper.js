const picHelper = require("./pic_helper.js");

const W = 750;
const H = 1100;
const FOOT_H = 72;

function addDays(day, offset) {
  const d = new Date(day.replace(/-/g, "/") + " 12:00:00");
  d.setDate(d.getDate() + offset);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

function _roundRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function _truncate(ctx, text, maxW) {
  if (!text) return "";
  if (ctx.measureText(text).width <= maxW) return text;
  let s = text;
  while (s.length > 0 && ctx.measureText(`${s}…`).width > maxW) s = s.slice(0, -1);
  return `${s}…`;
}

function _createImage(canvas, src) {
  return new Promise((resolve, reject) => {
    const img = canvas.createImage();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
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

function _drawHeatmap(ctx, heatmap, startDay, x, y, totalW, totalH, themeColor) {
  const cols = 12;
  const rows = 7;
  const gap = 3;
  const cellW = (totalW - gap * (cols - 1)) / cols;
  const cellH = (totalH - gap * (rows - 1)) / rows;
  for (let col = 0; col < cols; col++) {
    for (let row = 0; row < rows; row++) {
      const date = addDays(startDay, col * 7 + row);
      const attended = !!(heatmap && heatmap[date]);
      ctx.fillStyle = attended ? themeColor : "#EBEDF0";
      _roundRect(
        ctx,
        x + col * (cellW + gap),
        y + row * (cellH + gap),
        cellW,
        cellH,
        3,
      );
      ctx.fill();
    }
  }
}

function _drawBadges(ctx, badges, x, y, totalW) {
  const unlocked = (badges || []).filter((b) => b.unlocked).slice(0, 6);
  if (!unlocked.length) return;
  const colW = totalW / unlocked.length;
  unlocked.forEach((badge, i) => {
    const cx = x + colW * i + colW / 2;
    ctx.font = "44px sans-serif";
    ctx.textAlign = "center";
    ctx.fillStyle = "#323233";
    ctx.fillText(badge.emoji || "🏅", cx, y);
    ctx.font = "18px sans-serif";
    ctx.fillStyle = "#888888";
    ctx.fillText(badge.name || "", cx, y + 32);
  });
}

async function drawAchievementPoster(canvas, ctx, opts) {
  const themeColor = opts.themeColor || "#6fae96";
  const tenantName = opts.tenantName || "瑜伽馆";
  const streak = opts.streak || {};
  const userName = opts.userName || "瑜伽爱好者";

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = themeColor;
  ctx.fillRect(0, 0, W, 120);
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 34px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(_truncate(ctx, tenantName, W - 80), W / 2, 72);

  let avatarY = 170;
  if (opts.avatarSrc) {
    try {
      const path = opts.avatarSrc.startsWith("http")
        ? await _download(opts.avatarSrc)
        : opts.avatarSrc;
      const img = await _createImage(canvas, path);
      const r = 60;
      const cx = W / 2;
      const cy = avatarY;
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(img, cx - r, cy - r, r * 2, r * 2);
      ctx.restore();
      avatarY = 250;
    } catch (e) {
      console.warn("[achievement_poster] avatar", e);
    }
  }

  ctx.fillStyle = "#323233";
  ctx.font = "bold 30px sans-serif";
  ctx.fillText(_truncate(ctx, userName, W - 120), W / 2, avatarY);

  ctx.fillStyle = "#969799";
  ctx.font = "24px sans-serif";
  ctx.fillText("—— 我的瑜伽成就 ——", W / 2, avatarY + 48);

  const statY = avatarY + 100;
  const half = W / 2;
  ctx.fillStyle = themeColor;
  ctx.font = "bold 56px sans-serif";
  ctx.fillText(String(streak.totalClasses || 0), half / 2, statY);
  ctx.fillText(String(streak.current || 0), half + half / 2, statY);
  ctx.fillStyle = "#646566";
  ctx.font = "22px sans-serif";
  ctx.fillText("累计上课次", half / 2, statY + 36);
  ctx.fillText("连续周数", half + half / 2, statY + 36);

  const heatX = 55;
  const heatY = statY + 90;
  _drawHeatmap(
    ctx,
    opts.heatmap,
    opts.heatmapStartDay,
    heatX,
    heatY,
    640,
    150,
    themeColor,
  );

  ctx.fillStyle = "#323233";
  ctx.font = "24px sans-serif";
  ctx.fillText("已获得的徽章", W / 2, heatY + 190);
  _drawBadges(ctx, opts.badges, 55, heatY + 220, 640);

  ctx.fillStyle = themeColor;
  ctx.fillRect(0, H - FOOT_H, W, FOOT_H);
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 26px sans-serif";
  ctx.textBaseline = "middle";
  ctx.fillText(
    _truncate(ctx, `${tenantName} · 瑜伽`, W - 80),
    W / 2,
    H - FOOT_H / 2,
  );
}

function exportAchievementPoster(component, opts) {
  return new Promise((resolve, reject) => {
    wx.createSelectorQuery()
      .in(component)
      .select("#achievementCanvas")
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
          await drawAchievementPoster(canvas, ctx, opts);
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
  exportAchievementPoster,
  saveToAlbum,
};
