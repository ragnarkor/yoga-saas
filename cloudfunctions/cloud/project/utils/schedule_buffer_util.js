/**
 * 排课缓冲（block）计算与教练冲突检测
 */

const DEFAULT_CONFIG = {
  private: { bufferBefore: 15, bufferAfter: 15 },
  group: { bufferBefore: 0, bufferAfter: 10 },
  compact: { bufferBefore: 5, bufferAfter: 5 },
};

function pad2(n) {
  return n < 10 ? "0" + n : "" + n;
}

function timeToMinutes(timeStr) {
  if (!timeStr) return 0;
  const parts = String(timeStr).split(":");
  return Number(parts[0] || 0) * 60 + Number(parts[1] || 0);
}

function minutesToTime(mins) {
  let m = Number(mins) || 0;
  if (m < 0) m = 0;
  if (m >= 24 * 60) m = 24 * 60 - 1;
  const h = Math.floor(m / 60);
  const mi = m % 60;
  return pad2(h) + ":" + pad2(mi);
}

function addMinutes(timeStr, minutes) {
  return minutesToTime(timeToMinutes(timeStr) + Number(minutes || 0));
}

function subtractMinutes(timeStr, minutes) {
  return addMinutes(timeStr, -Number(minutes || 0));
}

function mergeConfig(tenantConfig) {
  const cfg = tenantConfig || {};
  return {
    private: {
      bufferBefore:
        cfg.defaultBufferBefore != null
          ? Number(cfg.defaultBufferBefore)
          : DEFAULT_CONFIG.private.bufferBefore,
      bufferAfter:
        cfg.defaultBufferAfter != null
          ? Number(cfg.defaultBufferAfter)
          : DEFAULT_CONFIG.private.bufferAfter,
    },
    group: {
      bufferBefore: 0,
      bufferAfter:
        cfg.groupBufferAfter != null
          ? Number(cfg.groupBufferAfter)
          : DEFAULT_CONFIG.group.bufferAfter,
    },
    compact: {
      bufferBefore:
        cfg.compactBufferBefore != null
          ? Number(cfg.compactBufferBefore)
          : DEFAULT_CONFIG.compact.bufferBefore,
      bufferAfter:
        cfg.compactBufferAfter != null
          ? Number(cfg.compactBufferAfter)
          : DEFAULT_CONFIG.compact.bufferAfter,
    },
  };
}

function resolveBufferForSlot(slot, slotKind, tenantConfig) {
  const cfg = mergeConfig(tenantConfig);
  const kind = slotKind === "private" ? "private" : "group";
  const base = cfg[kind] || cfg.private;

  let before = base.bufferBefore;
  let after = base.bufferAfter;

  if (slot && slot.bufferBefore != null && slot.bufferBefore !== "") {
    before = Number(slot.bufferBefore);
  }
  if (slot && slot.bufferAfter != null && slot.bufferAfter !== "") {
    after = Number(slot.bufferAfter);
  }

  before = Math.max(0, before || 0);
  after = Math.max(0, after || 0);
  return { bufferBefore: before, bufferAfter: after };
}

function resolveBufferFromPreset(preset, customBefore, customAfter, tenantConfig) {
  const cfg = mergeConfig(tenantConfig);
  if (preset === "compact") return cfg.compact;
  if (preset === "none") return { bufferBefore: 0, bufferAfter: 0 };
  if (preset === "custom") {
    return {
      bufferBefore: Math.max(0, Number(customBefore) || 0),
      bufferAfter: Math.max(0, Number(customAfter) || 0),
    };
  }
  return cfg.private;
}

function computeBlock(start, end, bufferBefore, bufferAfter) {
  const before = Math.max(0, Number(bufferBefore) || 0);
  const after = Math.max(0, Number(bufferAfter) || 0);
  return {
    start,
    end,
    bufferBefore: before,
    bufferAfter: after,
    blockStart: subtractMinutes(start, before),
    blockEnd: addMinutes(end, after),
    blockStartMin: timeToMinutes(subtractMinutes(start, before)),
    blockEndMin: timeToMinutes(addMinutes(end, after)),
  };
}

function blocksOverlap(a, b) {
  return a.blockStartMin < b.blockEndMin && a.blockEndMin > b.blockStartMin;
}

function buildBlockFromSlot(slot, slotKind, tenantConfig) {
  if (!slot || !slot.start || !slot.end) return null;
  if (slot.status === 0) return null;
  const buf = resolveBufferForSlot(slot, slotKind, tenantConfig);
  const block = computeBlock(
    slot.start,
    slot.end,
    buf.bufferBefore,
    buf.bufferAfter,
  );
  return {
    ...block,
    mark: slot.mark || "",
    title: slot.title || "",
    slotKind: slotKind || "group",
  };
}

function formatBlockLabel(block) {
  if (!block) return "";
  return (block.start || "") + "-" + (block.end || "");
}

const DEFAULT_SCHEDULE = {
  openTime: "07:00",
  closeTime: "22:00",
  advanceHours: 2,
  maxBookDays: 14,
  slotStepMinutes: 15,
};

function resolveScheduleConfig(tenantConfig) {
  const cfg = tenantConfig || {};
  return {
    openTime: cfg.openTime || DEFAULT_SCHEDULE.openTime,
    closeTime: cfg.closeTime || DEFAULT_SCHEDULE.closeTime,
    advanceHours:
      cfg.advanceHours != null
        ? Math.max(0, Number(cfg.advanceHours) || 0)
        : DEFAULT_SCHEDULE.advanceHours,
    maxBookDays:
      cfg.maxBookDays != null
        ? Math.max(1, Number(cfg.maxBookDays) || 14)
        : DEFAULT_SCHEDULE.maxBookDays,
    slotStepMinutes:
      cfg.slotStepMinutes != null
        ? Math.max(5, Number(cfg.slotStepMinutes) || 15)
        : DEFAULT_SCHEDULE.slotStepMinutes,
  };
}

function buildAvailableSlots({
  openStart,
  openEnd,
  durationMinutes,
  stepMinutes,
  bufferBefore,
  bufferAfter,
  existingBlocks,
  minBlockStartMin,
}) {
  const duration = Math.max(1, Number(durationMinutes) || 60);
  const step = Math.max(5, Number(stepMinutes) || 15);
  const openMin = timeToMinutes(openStart || "07:00");
  const closeMin = timeToMinutes(openEnd || "22:00");
  const minStart = minBlockStartMin != null ? Number(minBlockStartMin) : openMin;

  const slots = [];
  let cursor = openMin;

  while (cursor + duration <= closeMin) {
    const start = minutesToTime(cursor);
    const end = minutesToTime(cursor + duration);
    const candidate = computeBlock(start, end, bufferBefore, bufferAfter);

    if (candidate.blockStartMin >= minStart) {
      let conflict = false;
      for (let b of existingBlocks || []) {
        if (blocksOverlap(candidate, b)) {
          conflict = true;
          break;
        }
      }
      if (!conflict) {
        slots.push({
          start,
          end,
          blockStart: candidate.blockStart,
          blockEnd: candidate.blockEnd,
        });
      }
    }
    cursor += step;
  }

  return slots;
}

module.exports = {
  DEFAULT_CONFIG,
  DEFAULT_SCHEDULE,
  mergeConfig,
  resolveScheduleConfig,
  timeToMinutes,
  minutesToTime,
  addMinutes,
  subtractMinutes,
  resolveBufferForSlot,
  resolveBufferFromPreset,
  computeBlock,
  blocksOverlap,
  buildBlockFromSlot,
  formatBlockLabel,
  buildAvailableSlots,
};
