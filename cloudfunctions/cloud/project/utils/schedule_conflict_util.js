/**
 * 排课时段的教练占用冲突校验。
 *
 * 通过注入 loadTeacherBlocks 与 onError，让该规则保持独立、可单测，
 * 不依赖后台服务或数据库实现。
 */
const bufferUtil = require("./schedule_buffer_util.js");
const privateMeetUtil = require("./private_meet_util.js");

function buildSlotBlock(meet, slot, tenantConfig, privateCategoryIds) {
  if (!slot || slot.status === 0 || !slot.start || !slot.end) return null;
  const style = meet.MEET_STYLE_SET || {};
  const teacherId = slot.teacherId || style.teacherId || "";
  if (!teacherId) return null;

  const isPrivate =
    slot.slotType === "private" ||
    privateMeetUtil.isPrivateMeet(meet, privateCategoryIds);
  const kind = isPrivate ? "private" : "group";
  const buffer = bufferUtil.resolveBufferForSlot(slot, kind, tenantConfig);
  const block = bufferUtil.computeBlock(
    slot.start,
    slot.end,
    buffer.bufferBefore,
    buffer.bufferAfter,
  );

  return {
    ...block,
    teacherId: String(teacherId),
    mark: slot.mark || "",
    title: meet.MEET_TITLE || "",
  };
}

async function validateDayTeacherTimes({
  meet,
  meetId,
  day,
  times,
  tenantConfig,
  privateCategoryIds,
  loadTeacherBlocks,
  onError,
}) {
  const activeSlots = (times || []).filter(
    (slot) => slot && slot.status !== 0 && slot.start && slot.end,
  );
  const batchBlocks = [];

  for (const slot of activeSlots) {
    const candidate = buildSlotBlock(
      meet,
      slot,
      tenantConfig,
      privateCategoryIds,
    );
    if (!candidate) continue;

    const existing = await loadTeacherBlocks(candidate.teacherId, day);
    const external = (existing || []).filter(
      (block) => String(block.meetId) !== String(meetId),
    );

    for (const block of external) {
      if (!bufferUtil.blocksOverlap(candidate, block)) continue;
      onError(
        "与教练已有排课冲突：「" +
          (block.title || "课程") +
          "」" +
          bufferUtil.formatBlockLabel(block) +
          "（占用 " +
          block.blockStart +
          "-" +
          block.blockEnd +
          "）",
      );
    }

    for (const block of batchBlocks) {
      if (block.teacherId !== candidate.teacherId) continue;
      if (String(block.mark) === String(candidate.mark)) continue;
      if (!bufferUtil.blocksOverlap(candidate, block)) continue;
      onError(
        "时段 " +
          slot.start +
          "-" +
          slot.end +
          " 与同日其他时段冲突（占用 " +
          candidate.blockStart +
          "-" +
          candidate.blockEnd +
          "）",
      );
    }

    batchBlocks.push(candidate);
  }
}

module.exports = {
  buildSlotBlock,
  validateDayTeacherTimes,
};
