/**
 * 预约写事务边界：后续扣卡与流水也必须通过此服务接入事务。
 */
const cloudBase = require("../../framework/cloud/cloud_base.js");
const JoinModel = require("../model/join_model.js");
const timeUtil = require("../../framework/utils/time_util.js");

class BookingTransactionService {
  async createJoinAndConsume({ data, timeSet, pid, cardInfo, onError }) {
    const db = cloudBase.getCloud().database();
    const now = timeUtil.time();
    data._pid = String(pid || "ONE");
    data.JOIN_ID = JoinModel.makeID();
    data.JOIN_ADD_TIME = now;
    data.JOIN_EDIT_TIME = now;
    data = JoinModel.clearCreateData(data);
    return db.runTransaction(async (tx) => {
      const where = { _pid: data._pid, JOIN_MEET_ID: data.JOIN_MEET_ID, JOIN_MEET_TIME_MARK: data.JOIN_MEET_TIME_MARK, JOIN_STATUS: JoinModel.STATUS.SUCC };
      const duplicate = await tx.collection(JoinModel.CL).where({ ...where, JOIN_USER_ID: data.JOIN_USER_ID }).count();
      if (duplicate.total) return onError("您本时段已经预约，无须重复预约");
      if (timeSet.isLimit) {
        const occupied = await tx.collection(JoinModel.CL).where(where).count();
        if (occupied.total >= Number(timeSet.limit)) return onError("该时段预约人员已满，请选择其他");
      }
      if (cardInfo) {
        const cardRes = await tx.collection("ax_user_card").doc(cardInfo.cardId).get();
        const card = cardRes.data;
        if (!card || card.USER_CARD_USER_ID !== cardInfo.userId || card.USER_CARD_STATUS !== 1) return onError("会员卡状态已变更，请重试");
        const update = Object.assign({}, cardInfo.activationPatch || {});
        if (cardInfo.type === "times") {
          if (Number(card.USER_CARD_QUOTA) < Number(cardInfo.needTimes)) return onError("会员卡次数不足");
          update.USER_CARD_QUOTA = db.command.inc(-Number(cardInfo.needTimes));
          if (Number(card.USER_CARD_QUOTA) === Number(cardInfo.needTimes)) update.USER_CARD_STATUS = 9;
        }
        await tx.collection("ax_user_card").doc(cardInfo.cardId).update({ data: update });
      }
      const created = await tx.collection(JoinModel.CL).add({ data });
      if (cardInfo) {
        await tx.collection("ax_user_card_log").add({ data: { _pid: data._pid, CARD_LOG_ID: "L" + JoinModel.makeID(), CARD_LOG_USER_ID: cardInfo.userId, CARD_LOG_USER_CARD_ID: cardInfo.cardId, CARD_LOG_JOIN_ID: created._id, CARD_LOG_MEET_ID: data.JOIN_MEET_ID, CARD_LOG_MEET_TITLE: data.JOIN_MEET_TITLE, CARD_LOG_MEET_DAY: data.JOIN_MEET_DAY, CARD_LOG_TIME_START: data.JOIN_MEET_TIME_START, CARD_LOG_TIME_END: data.JOIN_MEET_TIME_END, CARD_LOG_TIMES: cardInfo.type === "times" ? cardInfo.needTimes : 0, CARD_LOG_ACTION: "deduct", CARD_LOG_STATUS: 1, CARD_LOG_ADD_TIME: now, CARD_LOG_EDIT_TIME: now } });
      }
      return created._id;
    });
  }

  async createJoin({ data, timeSet, pid, onError }) {
    const db = cloudBase.getCloud().database();
    const now = timeUtil.time();
    data._pid = String(pid || "ONE");
    data.JOIN_ID = JoinModel.makeID();
    data.JOIN_ADD_TIME = now;
    data.JOIN_EDIT_TIME = now;
    data = JoinModel.clearCreateData(data);
    return db.runTransaction(async (tx) => {
      const where = { _pid: data._pid, JOIN_MEET_ID: data.JOIN_MEET_ID, JOIN_MEET_TIME_MARK: data.JOIN_MEET_TIME_MARK, JOIN_STATUS: JoinModel.STATUS.SUCC };
      const duplicate = await tx.collection(JoinModel.CL).where({ ...where, JOIN_USER_ID: data.JOIN_USER_ID }).count();
      if (duplicate.total) return onError("您本时段已经预约，无须重复预约");
      if (timeSet.isLimit) {
        const occupied = await tx.collection(JoinModel.CL).where(where).count();
        if (occupied.total >= Number(timeSet.limit)) return onError("该时段预约人员已满，请选择其他");
      }
      return (await tx.collection(JoinModel.CL).add({ data }))._id;
    });
  }
}
module.exports = BookingTransactionService;
