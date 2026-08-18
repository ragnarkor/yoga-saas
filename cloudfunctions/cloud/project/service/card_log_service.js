/** 会员卡流水写入职责。 */
const UserCardLogModel = require("../model/user_card_log_model.js");
const timeUtil = require("../../framework/utils/time_util.js");

class CardLogService {
  async claimRefund(logId) {
    return UserCardLogModel.edit(
      { _id: logId, CARD_LOG_STATUS: UserCardLogModel.STATUS.VALID },
      { CARD_LOG_STATUS: UserCardLogModel.STATUS.REFUNDED, CARD_LOG_EDIT_TIME: timeUtil.time() },
    );
  }

  async releaseRefundClaim(logId) {
    return UserCardLogModel.edit(
      { _id: logId, CARD_LOG_STATUS: UserCardLogModel.STATUS.REFUNDED },
      { CARD_LOG_STATUS: UserCardLogModel.STATUS.VALID, CARD_LOG_EDIT_TIME: timeUtil.time() },
    );
  }

  async insertDeductLog({ userId, cardId, joinId, meet, join, needTimes, coachName }) {
    const now = timeUtil.time();
    await UserCardLogModel.insert({
      CARD_LOG_USER_ID: userId,
      CARD_LOG_USER_CARD_ID: cardId,
      CARD_LOG_JOIN_ID: joinId,
      CARD_LOG_MEET_ID: meet._id || join.JOIN_MEET_ID,
      CARD_LOG_MEET_TITLE: join.JOIN_MEET_TITLE || meet.MEET_TITLE || "",
      CARD_LOG_MEET_TYPE_NAME: meet.MEET_TYPE_NAME || "",
      CARD_LOG_MEET_DAY: join.JOIN_MEET_DAY || "",
      CARD_LOG_TIME_START: join.JOIN_MEET_TIME_START || "",
      CARD_LOG_TIME_END: join.JOIN_MEET_TIME_END || "",
      CARD_LOG_COACH_NAME: coachName || "",
      CARD_LOG_TIMES: needTimes,
      CARD_LOG_ACTION: UserCardLogModel.ACTION.DEDUCT,
      CARD_LOG_STATUS: UserCardLogModel.STATUS.VALID,
      CARD_LOG_ADD_TIME: now,
      CARD_LOG_EDIT_TIME: now,
    });
  }
}
module.exports = CardLogService;
