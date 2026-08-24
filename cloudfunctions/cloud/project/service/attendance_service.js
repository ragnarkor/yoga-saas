const JoinModel = require("../model/join_model.js");
const timeUtil = require("../../framework/utils/time_util.js");
const UserCardService = require("./user_card_service.js");
const { hasCourseEnded } = require("../utils/attendance_util.js");

class AttendanceService {
  /**
   * 延迟结算已结束课程：预约成功且未取消的记录，在课程结束后自动按已签到处理。
   * 按条件收敛查询范围，避免每次页面加载扫描全部历史数据。
   */
  async settleEndedJoins({ userId = "", meetId = "", timeMark = "" } = {}) {
    const now = timeUtil.time("Y-M-D h:m");
    const where = {
      JOIN_STATUS: JoinModel.STATUS.SUCC,
      JOIN_IS_CHECKIN: 0,
      JOIN_MEET_DAY: ["<=", now.slice(0, 10)],
    };
    if (userId) where.JOIN_USER_ID = userId;
    if (meetId) where.JOIN_MEET_ID = meetId;
    if (timeMark) where.JOIN_MEET_TIME_MARK = timeMark;

    const candidates = await JoinModel.getAll(
      where,
      "JOIN_USER_ID,JOIN_MEET_DAY,JOIN_MEET_TIME_END",
      { JOIN_MEET_DAY: "asc", JOIN_MEET_TIME_END: "asc" },
      1000,
    );
    let settled = 0;
    for (const join of candidates || []) {
      if (!hasCourseEnded(join, now)) continue;
      const updated = await JoinModel.edit(
        {
          _id: join._id,
          JOIN_STATUS: JoinModel.STATUS.SUCC,
          JOIN_IS_CHECKIN: 0,
        },
        { JOIN_IS_CHECKIN: 1 },
      );
      if (!updated) continue;
      settled += 1;
      try {
        await new UserCardService().tryActivateForJoinCheckin(
          join._id,
          join.JOIN_USER_ID,
        );
      } catch (err) {
        // 自动结算不能阻断课程页；保留签到结果并记录异常供后台排查。
        console.error("[attendance] card activation failed:", err.message);
      }
    }
    return settled;
  }
}

module.exports = AttendanceService;
