const picHelper = require("./pic_helper.js");
const achievementAssetHelper = require("./achievement_asset_helper.js");

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

async function _drawBadges(canvas, ctx, badges, x, y, totalW, themeColor) {
  const unlocked = (badges || []).filter((b) => b.unlocked).slice(0, 4);
  const slotCount = 4;
  const colW = totalW / slotCount;
  if (!unlocked.length) {
    ctx.textAlign = "center";
    ctx.fillStyle = "#9A9A92";
    ctx.font = "22px sans-serif";
    ctx.fillText("继续练习，解锁你的第一枚徽章", x + totalW / 2, y + 52);
    return;
  }
  // 本地徽章同时解码，避免海报生成时逐枚等待造成明显卡顿。
  const icons = await Promise.all(
    unlocked.map(async (badge) => {
      try {
        return await _createImage(canvas, achievementAssetHelper.getBadgePosterIcon(badge.id));
      } catch (e) {
        return null;
      }
    }),
  );
  const startSlot = (slotCount - unlocked.length) / 2;
  ctx.textAlign = "center";
  for (let i = 0; i < unlocked.length; i++) {
    const badge = unlocked[i];
    // 始终占用四个等宽槽位，但按已解锁数量居中，避免两枚徽章贴在左边。
    const cx = x + colW * (startSlot + i) + colW / 2;
    ctx.fillStyle = `${themeColor}22`;
    ctx.beginPath();
    ctx.arc(cx, y + 36, 40, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = `${themeColor}66`;
    ctx.lineWidth = 2;
    ctx.stroke();
    const icon = icons[i];
    if (icon) {
      ctx.drawImage(icon, cx - 40, y - 4, 80, 80);
    } else {
      ctx.font = "38px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = "#4D675A";
      ctx.fillText(badge.emoji || "🏅", cx, y + 36);
    }
    ctx.textBaseline = "alphabetic";
    ctx.font = "18px sans-serif";
    ctx.fillStyle = "#59635D";
    ctx.fillText(_truncate(ctx, badge.name || "成就", colW - 12), cx, y + 102);
  }
}

async function drawAchievementPoster(canvas, ctx, opts) {
  const themeColor = opts.themeColor || "#6fae96";
  const tenantName = opts.tenantName || "瑜伽馆";
  const streak = opts.streak || {};
  const userName = opts.userName || "瑜伽爱好者";

  const darkColor = "#29483C";
  const paper = "#F8F5EE";
  const ink = "#29443A";
  ctx.fillStyle = paper;
  ctx.fillRect(0, 0, W, H);

  // 顶部品牌主视觉：整幅插画铺陈，保留留白和呼吸感。
  const hero = ctx.createLinearGradient(0, 0, W, 320);
  hero.addColorStop(0, darkColor);
  hero.addColorStop(1, themeColor);
  ctx.fillStyle = hero;
  _roundRect(ctx, 0, 0, W, 320, 0);
  ctx.fill();
  if (opts.heroSrc) {
    try {
      const heroPath = opts.heroSrc.startsWith("http") ? await _download(opts.heroSrc) : opts.heroSrc;
      const heroImg = await _createImage(canvas, heroPath);
      ctx.save();
      ctx.globalAlpha = 0.78;
      const scale = Math.max(W / heroImg.width, 340 / heroImg.height);
      const iw = heroImg.width * scale;
      const ih = heroImg.height * scale;
      ctx.drawImage(heroImg, (W - iw) / 2, (340 - ih) / 2, iw, ih);
      ctx.restore();
    } catch (e) {
      console.warn("[achievement_poster] hero illustration", e);
    }
  }
  const heroShade = ctx.createLinearGradient(0, 0, 0, 330);
  heroShade.addColorStop(0, "rgba(21,48,38,.48)");
  heroShade.addColorStop(.62, "rgba(21,48,38,.12)");
  heroShade.addColorStop(1, "rgba(21,48,38,.64)");
  ctx.fillStyle = heroShade;
  ctx.fillRect(0, 0, W, 340);
  ctx.textAlign = "left";
  ctx.fillStyle = "rgba(255,255,255,.82)";
  ctx.font = "22px sans-serif";
  ctx.fillText(_truncate(ctx, tenantName, 390), 48, 58);
  ctx.fillStyle = "#FFFFFF";
  ctx.font = "bold 46px sans-serif";
  ctx.fillText("我的瑜伽旅程", 48, 132);
  ctx.font = "24px sans-serif";
  ctx.fillStyle = "rgba(255,255,255,.82)";
  ctx.fillText("每一次来到垫上，都是给自己的礼物", 48, 176);

  let avatarY = 214;
  if (opts.avatarSrc) {
    try {
      const path = opts.avatarSrc.startsWith("http")
        ? await _download(opts.avatarSrc)
        : opts.avatarSrc;
      const img = await _createImage(canvas, path);
      const r = 54;
      const cx = 630;
      const cy = avatarY;
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(img, cx - r, cy - r, r * 2, r * 2);
      ctx.restore();
    } catch (e) {
      console.warn("[achievement_poster] avatar", e);
    }
  }
  ctx.textAlign = "left";
  ctx.fillStyle = "#FFFFFF";
  ctx.font = "bold 27px sans-serif";
  ctx.fillText(_truncate(ctx, userName, 420), 48, 246);

  // 数据卡片
  const statY = 278;
  ctx.fillStyle = "#FFFFFF";
  _roundRect(ctx, 36, statY, W - 72, 142, 24); ctx.fill();
  ctx.shadowColor = "rgba(41,68,58,.12)"; ctx.shadowBlur = 18; ctx.shadowOffsetY = 8;
  _roundRect(ctx, 36, statY, W - 72, 142, 24); ctx.fill();
  ctx.shadowColor = "transparent"; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
  const statCols = [150, 375, 600];
  const statValues = [streak.totalClasses || 0, streak.current || 0, streak.max || 0];
  const statLabels = ["累计上课", "连续周数", "最长连续"];
  statCols.forEach((cx, i) => {
    ctx.textAlign = "center";
    ctx.fillStyle = themeColor;
    ctx.font = "bold 46px sans-serif";
    ctx.fillText(String(statValues[i]), cx, statY + 63);
    ctx.fillStyle = "#7C877F";
    ctx.font = "21px sans-serif";
    ctx.fillText(statLabels[i], cx, statY + 98);
  });

  // 分享海报只保留一句练习宣言，热力图留在成就页中展示。
  ctx.fillStyle = "#FFFFFF";
  _roundRect(ctx, 36, 464, W - 72, 150, 24); ctx.fill();
  ctx.textAlign = "left";
  ctx.fillStyle = ink;
  ctx.font = "bold 27px sans-serif";
  ctx.fillText("我的练习宣言", 60, 508);
  ctx.fillStyle = "#8A968D";
  ctx.font = "22px sans-serif";
  ctx.fillText("把每一次练习，变成与自己相处的时间", 60, 554);
  ctx.fillStyle = themeColor;
  ctx.font = "20px sans-serif";
  ctx.fillText("今日也在向更好的自己靠近", 60, 586);

  // 徽章墙卡片
  ctx.fillStyle = "#FFFFFF";
  _roundRect(ctx, 36, 646, W - 72, 250, 24); ctx.fill();
  ctx.textAlign = "left";
  ctx.fillStyle = ink;
  ctx.font = "bold 27px sans-serif";
  ctx.fillText("已获得的徽章", 60, 688);
  ctx.fillStyle = "#8A968D";
  ctx.font = "20px sans-serif";
  ctx.fillText(`${(opts.badges || []).filter((b) => b.unlocked).length} 枚成就已点亮`, 60, 718);
  await _drawBadges(canvas, ctx, opts.badges, 58, 748, 634, themeColor);

  ctx.fillStyle = themeColor;
  ctx.fillRect(0, H - FOOT_H, W, FOOT_H);
  ctx.fillStyle = "#FFFFFF";
  ctx.font = "bold 23px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("坚持，终会成为身体的一部分", W / 2, H - FOOT_H / 2);
  ctx.textBaseline = "alphabetic";
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
        // 同一 canvas 多次生成海报时重置变换矩阵，避免 scale 叠加导致元素放大、移位。
        if (typeof ctx.setTransform === "function") ctx.setTransform(1, 0, 0, 1, 0, 0);
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
