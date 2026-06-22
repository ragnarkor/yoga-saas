const picHelper = require("./pic_helper.js");
const pageHelper = require("./page_helper.js");
const themeHelper = require("./theme_helper.js");

const W = 750;
const TIME_COL = 88;
const ROW_H = 108;
const HEAD_H = 64;
const TITLE_H = 96;

function _roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function _truncate(ctx, text, maxW) {
  if (!text) return "";
  if (ctx.measureText(text).width <= maxW) return text;
  let s = text;
  while (s.length > 0 && ctx.measureText(s + "…").width > maxW) {
    s = s.slice(0, -1);
  }
  return s + "…";
}

function _drawStars(ctx, x, y, count, max) {
  ctx.fillStyle = "rgba(255,255,255,0.95)";
  ctx.font = "18px sans-serif";
  let stars = "";
  for (let i = 0; i < max; i++) {
    stars += i < count ? "★" : "☆";
  }
  ctx.fillText(stars, x, y);
}

function calcPosterHeight(gridRows) {
  return TITLE_H + HEAD_H + (gridRows.length || 1) * ROW_H + 48;
}

function drawSchedule(ctx, opts) {
  const { tenantName, weekLabel, weekDays, gridRows, themeColor } = opts;

  const brandColor = themeHelper.normalizeHex(
    themeColor || pageHelper.getThemeColor(),
  );
  const brandLight = themeHelper.getThemeLight(brandColor);

  const dayColW = (W - TIME_COL) / 7;
  const height = calcPosterHeight(gridRows);

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, W, height);

  ctx.fillStyle = brandColor;
  ctx.fillRect(0, 0, W, TITLE_H);
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 32px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(tenantName || "瑜伽馆", W / 2, 44);
  ctx.font = "22px sans-serif";
  ctx.fillText(weekLabel || "", W / 2, 78);

  ctx.fillStyle = brandLight;
  ctx.fillRect(0, TITLE_H, W, HEAD_H);
  ctx.fillStyle = "#666666";
  ctx.font = "20px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("", TIME_COL / 2, TITLE_H + 40);
  weekDays.forEach((d, i) => {
    const cx = TIME_COL + dayColW * i + dayColW / 2;
    ctx.fillStyle = "#555555";
    ctx.font = "20px sans-serif";
    ctx.fillText(d.shortLabel || d.label, cx, TITLE_H + 40);
  });

  const rows = gridRows.length
    ? gridRows
    : [{ time: "", cells: weekDays.map(() => null) }];

  rows.forEach((row, ri) => {
    const y = TITLE_H + HEAD_H + ri * ROW_H;
    ctx.strokeStyle = "#eeeeee";
    ctx.lineWidth = 1;
    ctx.strokeRect(0, y, W, ROW_H);

    ctx.fillStyle = "#f5f5f5";
    ctx.fillRect(0, y, TIME_COL, ROW_H);
    ctx.fillStyle = "#888888";
    ctx.font = "20px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(row.time || "", TIME_COL / 2, y + ROW_H / 2 + 8);

    row.cells.forEach((cell, ci) => {
      const x = TIME_COL + ci * dayColW;
      if (!cell) return;
      const pad = 6;
      const cw = dayColW - pad * 2;
      const ch = ROW_H - pad * 2;
      ctx.fillStyle = cell.color || "#81c784";
      _roundRect(ctx, x + pad, y + pad, cw, ch, 8);
      ctx.fill();

      ctx.textAlign = "left";
      ctx.fillStyle = "#ffffff";
      ctx.font = "18px sans-serif";
      ctx.fillText(
        _truncate(ctx, cell.teacherName || "教练", cw - 12),
        x + pad + 8,
        y + pad + 24,
      );
      ctx.font = "bold 20px sans-serif";
      ctx.fillText(
        _truncate(ctx, cell.title || "课程", cw - 12),
        x + pad + 8,
        y + pad + 50,
      );
      _drawStars(ctx, x + pad + 8, y + pad + 74, cell.difficulty || 3, 5);
      ctx.font = "16px sans-serif";
      const tag = (cell.duration || 60) + "m [" + (cell.typeName || "") + "]";
      ctx.fillText(_truncate(ctx, tag, cw - 12), x + pad + 8, y + pad + 96);
    });
  });

  return height;
}

function exportScheduleImage(page, opts) {
  return new Promise((resolve, reject) => {
    const query = wx.createSelectorQuery().in(page);
    query
      .select("#scheduleCanvas")
      .fields({ node: true, size: true })
      .exec((res) => {
        if (!res || !res[0] || !res[0].node) {
          reject(new Error("canvas 未就绪"));
          return;
        }

        const canvas = res[0].node;
        const ctx = canvas.getContext("2d");
        // [AI_START TIMESTAMP=2026-06-22 14:49:41]
        const dpr = wx.getWindowInfo().pixelRatio || 2;
        // [AI_END LINES=1 TIMESTAMP=2026-06-22 14:49:41]
        const height = calcPosterHeight(opts.gridRows || []);
        canvas.width = W * dpr;
        canvas.height = height * dpr;
        ctx.scale(dpr, dpr);

        drawSchedule(ctx, opts);

        wx.canvasToTempFilePath({
          canvas,
          destWidth: W * dpr,
          destHeight: height * dpr,
          fileType: "png",
          success: (r) => resolve(r.tempFilePath),
          fail: reject,
        });
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
  calcPosterHeight,
  drawSchedule,
  exportScheduleImage,
  saveToAlbum,
};
