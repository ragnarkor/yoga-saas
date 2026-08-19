const picHelper = require("./pic_helper.js");
const pageHelper = require("./page_helper.js");
const themeHelper = require("./theme_helper.js");

const W = 750;
const TIME_COL = 88;
// 海报是给人看的课表，不沿用页面端的紧凑行高；保证一节课的四行信息完整可读。
const ROW_H = 148;
const HEAD_H = 64;
const TITLE_H = 132;
const FOOT_H = 42;

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

function _twoLineText(ctx, text, maxW) {
  const value = String(text || "课程");
  const lines = [];
  let line = "";
  for (let i = 0; i < value.length; i++) {
    const candidate = line + value[i];
    if (line && ctx.measureText(candidate).width > maxW) {
      lines.push(line);
      line = value[i];
      if (lines.length === 2) break;
    } else {
      line = candidate;
    }
  }
  if (line && lines.length < 2) lines.push(line);
  if (lines.length === 2 && lines.join("").length < value.length) {
    lines[1] = _truncate(ctx, lines[1] + "…", maxW);
  }
  return lines;
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
  return TITLE_H + HEAD_H + (gridRows.length || 1) * ROW_H + FOOT_H;
}

function _createImage(canvas, src) {
  return new Promise((resolve, reject) => {
    const img = canvas.createImage();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

async function drawSchedule(canvas, ctx, opts) {
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
  let flowImage = null;
  // 使用统一的薰衣草流纹卡面作为完整横幅背景。
  try {
    flowImage = await _createImage(canvas, '/images/card_faces/card_face_lavender_flow.jpg');
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, W, TITLE_H);
    ctx.clip();
    ctx.globalAlpha = 1;
    const drawH = W * flowImage.height / flowImage.width;
    ctx.drawImage(flowImage, 0, (TITLE_H - drawH) / 2, W, drawH);
    ctx.restore();
    // 保留场馆的动态主题色，让卡面和不同主题不冲突。
    ctx.fillStyle = `${brandColor}33`;
    ctx.fillRect(0, 0, W, TITLE_H);
  } catch (e) {
    console.warn('[schedule_poster] header illustration', e);
  }
  ctx.fillStyle = "#49395F";
  ctx.font = "bold 32px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(tenantName || "瑜伽馆", W / 2, 60);
  ctx.font = "22px sans-serif";
  ctx.fillStyle = "#665576";
  ctx.fillText(weekLabel || "", W / 2, 100);

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
    // 海报顶部已展示完整日期范围，表头只保留周几，阅读更快也避免七列拥挤。
    ctx.fillText(d.weekday || `周${"一二三四五六日"[i]}`, cx, TITLE_H + 40);
  });

  const rows = gridRows.length
    ? gridRows
    : [{ time: "", cells: weekDays.map(() => null) }];

  let y = TITLE_H + HEAD_H;
  rows.forEach((row) => {
    const rowH = ROW_H;
    ctx.strokeStyle = "#eeeeee";
    ctx.lineWidth = 1;
    ctx.strokeRect(0, y, W, rowH);

    ctx.fillStyle = "#f5f5f5";
    ctx.fillRect(0, y, TIME_COL, rowH);
    ctx.fillStyle = "#888888";
    ctx.font = "bold 19px sans-serif";
    ctx.textAlign = "center";
    const axisY = y + rowH / 2;
    ctx.fillText(row.time || "", TIME_COL / 2, axisY - (row.end ? 10 : -7));
    if (row.end) {
      ctx.strokeStyle = "#c9cec7";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(TIME_COL / 2, axisY - 3);
      ctx.lineTo(TIME_COL / 2, axisY + 5);
      ctx.stroke();
      ctx.fillStyle = "#888888";
      ctx.font = "bold 19px sans-serif";
      ctx.fillText(row.end, TIME_COL / 2, axisY + 25);
    }

    row.cells.forEach((cell, ci) => {
      const x = TIME_COL + ci * dayColW;
      if (!cell) return;
      const pad = 6;
      const cw = dayColW - pad * 2;
      const ch = rowH - pad * 2;
      const items =
        cell.mode === 'multi' && cell.items && cell.items.length
          ? cell.items
          : [cell];

      if (items.length >= 2) {
        const gap = 4;
        const miniH = (ch - gap) / 2;
        items.slice(0, 2).forEach((item, ii) => {
          const yOff = y + pad + ii * (miniH + gap);
          ctx.fillStyle = item.color || "#81c784";
          _roundRect(ctx, x + pad, yOff, cw, miniH, 6);
          ctx.fill();
          ctx.textAlign = "left";
          ctx.fillStyle = "#ffffff";
          ctx.font = "15px sans-serif";
          ctx.fillText(
            _truncate(ctx, item.teacherName || "教练", cw - 12),
            x + pad + 6,
            yOff + 20,
          );
          ctx.font = "bold 17px sans-serif";
          ctx.fillText(
            _truncate(ctx, item.title || "课程", cw - 12),
            x + pad + 6,
            yOff + miniH - 9,
          );
        });
        if (cell.overflow > 0) {
          ctx.fillStyle = 'rgba(0,0,0,0.35)';
          ctx.font = '14px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('+' + cell.overflow, x + pad + cw / 2, y + pad + ch - 4);
        }
        return;
      }

      const slot = items[0];
      ctx.fillStyle = slot.color || "#81c784";
      _roundRect(ctx, x + pad, y + pad, cw, ch, 8);
      ctx.fill();

      ctx.textAlign = "left";
      ctx.fillStyle = "#ffffff";
      ctx.font = "18px sans-serif";
      ctx.fillText(
        _truncate(ctx, slot.teacherName || "教练", cw - 12),
        x + pad + 8,
        y + pad + 24,
      );
      ctx.font = "bold 18px sans-serif";
      const titleLines = _twoLineText(ctx, slot.title || "课程", cw - 12);
      ctx.fillText(titleLines[0] || "", x + pad + 8, y + pad + 49);
      if (titleLines[1]) {
        ctx.fillText(titleLines[1], x + pad + 8, y + pad + 71);
      }
      _drawStars(ctx, x + pad + 8, y + pad + 98, slot.difficulty || 3, 5);
      ctx.font = "16px sans-serif";
      const tag = (slot.duration || 60) + "m [" + (slot.typeName || "") + "]";
      ctx.fillText(_truncate(ctx, tag, cw - 12), x + pad + 8, y + pad + 124);
    });
    y += rowH;
  });

  // 用同款流纹为课表收尾，保留轻盈留白而不是突然截成纯白底。
  if (flowImage) {
    const drawH = W * flowImage.height / flowImage.width;
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, y, W, FOOT_H);
    ctx.clip();
    ctx.drawImage(flowImage, 0, y + (FOOT_H - drawH) / 2, W, drawH);
    ctx.restore();
  }

  return height;
}

function exportScheduleImage(page, opts) {
  return new Promise((resolve, reject) => {
    const query = wx.createSelectorQuery().in(page);
    query
      .select("#scheduleCanvas")
      .fields({ node: true, size: true })
      .exec((res) => {
        (async () => {
          try {
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

            await drawSchedule(canvas, ctx, opts);

            wx.canvasToTempFilePath({
              canvas,
              destWidth: W * dpr,
              destHeight: height * dpr,
              fileType: "png",
              success: (r) => resolve(r.tempFilePath),
              fail: reject,
            });
          } catch (err) {
            reject(err);
          }
        })();
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
