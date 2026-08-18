const dataUtil = require("../../../framework/utils/data_util.js");
const timeUtil = require("../../../framework/utils/time_util.js");
const DayModel = require("../../model/day_model.js");
const scheduleDateUtil = require("../../utils/schedule_date_util.js");

class ScheduleCopyService {
  constructor({ normTimes, syncMeetDaysAfterChange }) {
    this._normTimes = normTimes;
    this._syncMeetDaysAfterChange = syncMeetDaysAfterChange;
  }

  async copyScheduleWeek({ startDay, endDay, excludeDays = [] }) {
    if (!startDay || !endDay) this.AppError("请选择复制范围");
    const excludeSet = new Set((excludeDays || []).map(String));
    const dayRecords = await DayModel.getAllBig(
      { day: ["between", startDay, endDay] },
      "day,times,DAY_MEET_ID,dayDesc",
      { day: "asc" },
      2000,
    );

    let copiedDays = 0;
    let copiedSlots = 0;
    let skippedSlots = 0;
    const now = timeUtil.time();
    const meetIds = new Set();

    for (const rec of dayRecords || []) {
      const targetDay = scheduleDateUtil.addDays(rec.day, 7);
      if (excludeSet.has(targetDay)) continue;

      const sourceTimes = (rec.times || []).filter(
        (t) => t && t.slotType !== "private" && t.status == 1,
      );
      if (!sourceTimes.length) continue;

      const newTimes = [];
      for (const t of sourceTimes) {
        const slot = dataUtil.deepClone(t);
        slot.mark =
          "T" +
          targetDay.replace(/-/g, "") +
          dataUtil.genRandomAlpha(10).toUpperCase();
        slot.stat = { succCnt: 0, cancelCnt: 0, adminCancelCnt: 0 };
        newTimes.push(slot);
      }

      let targetRec = await DayModel.getOne(
        { DAY_MEET_ID: rec.DAY_MEET_ID, day: targetDay },
        "times,dayDesc",
      );

      if (targetRec) {
        const existing = targetRec.times || [];
        const existKeys = new Set(
          existing.map((t) => `${t.start}-${t.end}-${t.teacherId || ""}`),
        );
        const toAdd = newTimes.filter(
          (t) => !existKeys.has(`${t.start}-${t.end}-${t.teacherId || ""}`),
        );
        skippedSlots += newTimes.length - toAdd.length;
        if (!toAdd.length) continue;
        const merged = this._normTimes([...existing, ...toAdd], targetDay);
        await DayModel.edit(
          { DAY_MEET_ID: rec.DAY_MEET_ID, day: targetDay },
          { times: merged, DAY_EDIT_TIME: now },
        );
        copiedSlots += toAdd.length;
      } else {
        const weekday = timeUtil.week(targetDay);
        const dayDesc =
          timeUtil.fmtDateCHN(targetDay) + " (" + weekday + ")";
        await DayModel.insert({
          DAY_MEET_ID: rec.DAY_MEET_ID,
          day: targetDay,
          dayDesc,
          times: this._normTimes(newTimes, targetDay),
          DAY_ADD_TIME: now,
          DAY_EDIT_TIME: now,
        });
        copiedSlots += newTimes.length;
      }

      meetIds.add(rec.DAY_MEET_ID);
      copiedDays++;
    }

    for (const meetId of meetIds) {
      await this._syncMeetDaysAfterChange(meetId);
    }

    return {
      copiedDays,
      copiedSlots,
      skippedSlots,
      targetStartDay: scheduleDateUtil.addDays(startDay, 7),
      targetEndDay: scheduleDateUtil.addDays(endDay, 7),
    };
  }

}
module.exports = ScheduleCopyService;
