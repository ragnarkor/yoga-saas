/**
 * Notes: 会员端会员卡
 */

const BaseService = require("./base_service.js");
const UserCardModel = require("../model/user_card_model.js");
const UserCardLogModel = require("../model/user_card_log_model.js");
const CardTplModel = require("../model/card_tpl_model.js");
const MeetModel = require("../model/meet_model.js");
const JoinModel = require("../model/join_model.js");
const AdminModel = require("../model/admin_model.js");
const TeacherModel = require("../model/teacher_model.js");
const dbUtil = require("../../framework/database/db_util.js");
const timeUtil = require("../../framework/utils/time_util.js");

const CARD_COLLECTIONS = ["ax_user_card", "ax_user_card_log"];

class UserCardService extends BaseService {
  async _ensureCardCollections() {
    for (let cl of CARD_COLLECTIONS) {
      if (!(await dbUtil.isExistCollection(cl))) {
        await dbUtil.createCollection(cl);
      }
    }
  }

  _isExpired(card, now) {
    const end = Number(card.USER_CARD_END_TIME) || 0;
    return end > 0 && end <= now;
  }

  _mapCardItem(card, now, tplColor) {
    const type = card.USER_CARD_TYPE || CardTplModel.TYPE.TIMES;
    const expired = this._isExpired(card, now);
    let status = card.USER_CARD_STATUS;
    if (status === UserCardModel.STATUS.NORMAL && expired) {
      status = UserCardModel.STATUS.USED;
    }
    if (
      type === CardTplModel.TYPE.TIMES &&
      status === UserCardModel.STATUS.NORMAL &&
      Number(card.USER_CARD_QUOTA) <= 0
    ) {
      status = UserCardModel.STATUS.USED;
    }

    let statusLabel = "正常";
    if (status === UserCardModel.STATUS.STOP) statusLabel = "停卡";
    else if (status === UserCardModel.STATUS.USED || expired)
      statusLabel = "失效";
    else if (type === CardTplModel.TYPE.TIMES) statusLabel = "正常";

    const endTs = Number(card.USER_CARD_END_TIME) || 0;
    const startTs = Number(card.USER_CARD_START_TIME) || 0;
    let endTimeDesc = "长期有效";
    if (endTs > 0) {
      endTimeDesc = timeUtil.timestamp2Time(endTs, "Y-M-D");
    }
    let startTimeDesc = "";
    if (startTs > 0) {
      startTimeDesc = timeUtil.timestamp2Time(startTs, "Y-M-D");
    }

    return {
      id: card._id,
      cardNo: card.USER_CARD_ID || card._id,
      name: card.USER_CARD_NAME || "会员卡",
      type,
      typeLabel: CardTplModel.TYPE_DESC[type] || "次数卡",
      quota: Number(card.USER_CARD_QUOTA) || 0,
      quotaInit: Number(card.USER_CARD_QUOTA_INIT) || 0,
      balanceText:
        type === CardTplModel.TYPE.PERIOD
          ? "期限内畅练"
          : `${Number(card.USER_CARD_QUOTA) || 0}次`,
      endTime: endTs,
      endTimeDesc,
      startTime: startTs,
      startTimeDesc,
      coachName: card.USER_CARD_COACH_NAME || "",
      memo: card.USER_CARD_MEMO || "",
      price: Number(card.USER_CARD_PRICE) || 0,
      status,
      statusLabel,
      isActive: status === UserCardModel.STATUS.NORMAL && !expired,
      color: tplColor || "#F5A623",
    };
  }

  _mapUsageLog(log) {
    const day = log.CARD_LOG_MEET_DAY || "";
    const weekDesc = day ? timeUtil.week(day) : "";
    const dayDesc = day ? `${day} (${weekDesc})` : "";
    const start = log.CARD_LOG_TIME_START || "";
    const end = log.CARD_LOG_TIME_END || "";
    const times = Number(log.CARD_LOG_TIMES) || 0;
    const isRefund = log.CARD_LOG_STATUS === UserCardLogModel.STATUS.REFUNDED;
    const coachName = log.CARD_LOG_COACH_NAME || "教练";
    let deductText = times > 0 ? `消卡${times}次` : "期限内";
    return {
      id: log._id,
      meetTitle: log.CARD_LOG_MEET_TITLE || "课程",
      meetTypeName: log.CARD_LOG_MEET_TYPE_NAME || "精品课",
      coachName,
      deductText: `${coachName}/${deductText}`,
      dayDesc,
      timeRange: start && end ? `${start}-${end}` : "",
      scheduleText:
        dayDesc && start && end ? `${dayDesc} ${start}-${end}` : dayDesc,
      times,
      statusLabel: isRefund ? "已退还" : "扣卡成功",
      isRefund,
      addTime: log.CARD_LOG_ADD_TIME || 0,
    };
  }

  async _getCardTplColor(tplId) {
    if (!tplId) return "#F5A623";
    let tpl = await CardTplModel.getOne({ CARD_TPL_ID: tplId }, "CARD_TPL_COLOR");
    return (tpl && tpl.CARD_TPL_COLOR) || "#F5A623";
  }

  /** 我的会员卡列表 */
  async getMyCardList(userId, { activeOnly = true } = {}) {
    if (!userId) this.AppError("请先登录");
    await this._ensureCardCollections();

    let list = await UserCardModel.getAll(
      { USER_CARD_USER_ID: userId },
      "*",
      { USER_CARD_ADD_TIME: "desc" },
      100,
    );

    const tplIds = [
      ...new Set((list || []).map((c) => c.USER_CARD_TPL_ID).filter(Boolean)),
    ];
    let colorMap = {};
    if (tplIds.length) {
      let tpls = await CardTplModel.getAll(
        { CARD_TPL_ID: ["in", tplIds] },
        "CARD_TPL_ID,CARD_TPL_COLOR",
        {},
        100,
      );
      for (let t of tpls || []) {
        colorMap[t.CARD_TPL_ID] = t.CARD_TPL_COLOR || "#F5A623";
      }
    }

    const now = timeUtil.time();
    let mapped = (list || []).map((c) =>
      this._mapCardItem(c, now, colorMap[c.USER_CARD_TPL_ID]),
    );
    if (activeOnly) {
      mapped = mapped.filter((c) => c.isActive);
    }
    return { list: mapped, total: mapped.length };
  }

  /** 会员卡详情 + 上课记录 */
  async getMyCardDetail(userId, cardId) {
    if (!userId) this.AppError("请先登录");
    if (!cardId) this.AppError("参数错误");
    await this._ensureCardCollections();

    let card = await UserCardModel.getOne({
      _id: cardId,
      USER_CARD_USER_ID: userId,
    });
    if (!card) this.AppError("会员卡不存在");

    const color = await this._getCardTplColor(card.USER_CARD_TPL_ID);
    const now = timeUtil.time();
    const detail = this._mapCardItem(card, now, color);

    let logs = await UserCardLogModel.getAll(
      {
        CARD_LOG_USER_ID: userId,
        CARD_LOG_USER_CARD_ID: cardId,
        CARD_LOG_ACTION: UserCardLogModel.ACTION.DEDUCT,
      },
      "*",
      { CARD_LOG_ADD_TIME: "desc" },
      100,
    );

    const usageList = (logs || []).map((log) => this._mapUsageLog(log));
    return {
      card: detail,
      usageList,
      usageTotal: usageList.length,
    };
  }

  /** 是否有可用次数/期限卡 */
  async getMyCardSummary(userId) {
    const { list } = await this.getMyCardList(userId, { activeOnly: true });
    let timesTotal = 0;
    let hasPeriod = false;
    for (let c of list) {
      if (c.type === CardTplModel.TYPE.PERIOD) hasPeriod = true;
      else timesTotal += c.quota;
    }
    return {
      hasCard: list.length > 0,
      canBook: hasPeriod || timesTotal > 0,
      timesTotal,
      hasPeriod,
      count: list.length,
    };
  }

  _getMeetCardTimes(meet) {
    const style = (meet && meet.MEET_STYLE_SET) || {};
    const times = Number(style.cardTimes);
    return times > 0 ? times : 1;
  }

  async _resolveCoachName(meet, timeMark) {
    if (!meet || !timeMark) return "";
    const style = meet.MEET_STYLE_SET || {};
    let day =
      timeMark.substr(1, 4) +
      "-" +
      timeMark.substr(5, 2) +
      "-" +
      timeMark.substr(7, 2);
    let timeNode = null;
    for (let k in meet.MEET_DAYS_SET || []) {
      let daySet = meet.MEET_DAYS_SET[k];
      if (daySet.day !== day) continue;
      for (let j in daySet.times || []) {
        if (daySet.times[j].mark === timeMark) {
          timeNode = daySet.times[j];
          break;
        }
      }
    }
    if (timeNode && timeNode.teacherName) return timeNode.teacherName;
    if (style.teacherName) return style.teacherName;
    if (meet.MEET_ADMIN_ID) {
      let admin = await AdminModel.getOne({ _id: meet.MEET_ADMIN_ID }, "ADMIN_NAME");
      if (admin && admin.ADMIN_NAME) return admin.ADMIN_NAME;
    }
    let teacherId = (timeNode && timeNode.teacherId) || style.teacherId || "";
    if (teacherId) {
      let teacher = await TeacherModel.getOne({ _id: teacherId }, "TEACHER_NAME");
      if (teacher && teacher.TEACHER_NAME) return teacher.TEACHER_NAME;
    }
    return "";
  }

  /** 预约可选会员卡列表 */
  async getJoinCardOptions(userId, meetId) {
    if (!userId) this.AppError("请先登录");

    let meet = await MeetModel.getOne({ _id: meetId }, "MEET_STYLE_SET");
    if (!meet) this.AppError("课程不存在");

    const needTimes = this._getMeetCardTimes(meet);
    const list = await this._listUsableCards(userId, needTimes);
    if (!list.length) {
      this.AppError("暂无可用会员卡，请联系馆方发卡后再预约");
    }
    return { needTimes, list };
  }

  async _listUsableCards(userId, needTimes) {
    await this._ensureCardCollections();
    const now = timeUtil.time();
    let cards = await UserCardModel.getAll(
      {
        USER_CARD_USER_ID: userId,
        USER_CARD_STATUS: UserCardModel.STATUS.NORMAL,
      },
      "*",
      { USER_CARD_END_TIME: "desc", USER_CARD_ADD_TIME: "desc" },
      50,
    );

    const tplIds = [
      ...new Set((cards || []).map((c) => c.USER_CARD_TPL_ID).filter(Boolean)),
    ];
    let colorMap = {};
    if (tplIds.length) {
      let tpls = await CardTplModel.getAll(
        { CARD_TPL_ID: ["in", tplIds] },
        "CARD_TPL_ID,CARD_TPL_COLOR",
        {},
        100,
      );
      for (let t of tpls || []) {
        colorMap[t.CARD_TPL_ID] = t.CARD_TPL_COLOR || "#F5A623";
      }
    }

    let list = [];
    for (let k in cards || []) {
      let card = cards[k];
      if (this._isExpired(card, now)) continue;

      const type = card.USER_CARD_TYPE || CardTplModel.TYPE.TIMES;
      const quota = Number(card.USER_CARD_QUOTA) || 0;
      if (type === CardTplModel.TYPE.TIMES && quota < needTimes) continue;

      const afterQuota =
        type === CardTplModel.TYPE.PERIOD ? quota : Math.max(0, quota - needTimes);
      list.push({
        id: card._id,
        name: card.USER_CARD_NAME || "会员卡",
        type,
        typeLabel: CardTplModel.TYPE_DESC[type] || "次数卡",
        quota,
        needTimes: type === CardTplModel.TYPE.PERIOD ? 0 : needTimes,
        afterQuota,
        balanceText:
          type === CardTplModel.TYPE.PERIOD
            ? "期限内畅练"
            : `剩余 ${quota} 次`,
        deductHint:
          type === CardTplModel.TYPE.PERIOD
            ? "本课不扣次"
            : `本次扣 ${needTimes} 次，剩余 ${afterQuota} 次`,
        color: colorMap[card.USER_CARD_TPL_ID] || "#F5A623",
      });
    }
    return list;
  }

  async _resolveCardForJoin(userId, needTimes, cardId) {
    if (cardId) {
      return await this._getCardIfUsable(userId, cardId, needTimes);
    }
    return await this._pickCardForJoin(userId, needTimes);
  }

  async _getCardIfUsable(userId, cardId, needTimes) {
    await this._ensureCardCollections();
    let card = await UserCardModel.getOne({
      _id: cardId,
      USER_CARD_USER_ID: userId,
      USER_CARD_STATUS: UserCardModel.STATUS.NORMAL,
    });
    if (!card) this.AppError("会员卡不可用");

    const now = timeUtil.time();
    if (this._isExpired(card, now)) this.AppError("会员卡已过期");

    if (card.USER_CARD_TYPE === CardTplModel.TYPE.PERIOD) return card;

    if (Number(card.USER_CARD_QUOTA) >= needTimes) return card;

    this.AppError("该会员卡剩余次数不足");
  }

  /** 预约前校验会员卡 */
  async checkCardForJoin(userId, meetId, cardId) {
    if (!userId) this.AppError("请先登录");

    let meet = await MeetModel.getOne({ _id: meetId }, "MEET_STYLE_SET");
    if (!meet) this.AppError("课程不存在");

    const needTimes = this._getMeetCardTimes(meet);
    const card = await this._resolveCardForJoin(userId, needTimes, cardId);
    if (!card) {
      this.AppError("暂无可用会员卡，请联系馆方发卡后再预约");
    }
    return { cardId: card._id, needTimes, cardName: card.USER_CARD_NAME };
  }

  async _pickCardForJoin(userId, needTimes) {
    const now = timeUtil.time();
    let list = await UserCardModel.getAll(
      {
        USER_CARD_USER_ID: userId,
        USER_CARD_STATUS: UserCardModel.STATUS.NORMAL,
      },
      "*",
      { USER_CARD_END_TIME: "desc", USER_CARD_ADD_TIME: "desc" },
      50,
    );

    for (let k in list) {
      let card = list[k];
      if (this._isExpired(card, now)) continue;

      if (card.USER_CARD_TYPE === CardTplModel.TYPE.PERIOD) {
        return card;
      }
      if (
        card.USER_CARD_TYPE === CardTplModel.TYPE.TIMES &&
        Number(card.USER_CARD_QUOTA) >= needTimes
      ) {
        return card;
      }
    }
    return null;
  }

  async _insertDeductLog({
    userId,
    cardId,
    joinId,
    meet,
    join,
    needTimes,
    coachName,
  }) {
    await this._ensureCardCollections();
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

  /** 预约成功后扣次 */
  async consumeForJoin(userId, meetId, joinId, cardId) {
    await this._ensureCardCollections();
    let meet = await MeetModel.getOne(
      { _id: meetId },
      "MEET_TITLE,MEET_TYPE_NAME,MEET_STYLE_SET,MEET_DAYS_SET,MEET_ADMIN_ID",
    );
    if (!meet) return;

    let join = await JoinModel.getOne({ _id: joinId });
    if (!join) return;

    const needTimes = this._getMeetCardTimes(meet);
    const card = await this._resolveCardForJoin(userId, needTimes, cardId);
    if (!card) return;

    const coachName = await this._resolveCoachName(meet, join.JOIN_MEET_TIME_MARK);

    if (card.USER_CARD_TYPE === CardTplModel.TYPE.PERIOD) {
      await this._insertDeductLog({
        userId,
        cardId: card._id,
        joinId,
        meet,
        join,
        needTimes: 0,
        coachName,
      });
      return { cardId: card._id, deducted: 0 };
    }

    const left = Number(card.USER_CARD_QUOTA) || 0;
    const next = Math.max(0, left - needTimes);
    const patch = {
      USER_CARD_QUOTA: next,
      USER_CARD_EDIT_TIME: timeUtil.time(),
    };
    if (next <= 0) {
      patch.USER_CARD_STATUS = UserCardModel.STATUS.USED;
    }
    await UserCardModel.edit({ _id: card._id }, patch);

    await this._insertDeductLog({
      userId,
      cardId: card._id,
      joinId,
      meet,
      join,
      needTimes,
      coachName,
    });

    return { cardId: card._id, deducted: needTimes, joinId };
  }

  /** 取消预约退还次数 */
  async refundForJoinCancel(joinId) {
    if (!joinId) return { refunded: 0 };
    await this._ensureCardCollections();

    let log = await UserCardLogModel.getOne({
      CARD_LOG_JOIN_ID: joinId,
      CARD_LOG_ACTION: UserCardLogModel.ACTION.DEDUCT,
      CARD_LOG_STATUS: UserCardLogModel.STATUS.VALID,
    });
    if (!log) return { refunded: 0 };

    const times = Number(log.CARD_LOG_TIMES) || 0;
    const cardId = log.CARD_LOG_USER_CARD_ID;
    const now = timeUtil.time();

    if (times > 0 && cardId) {
      let card = await UserCardModel.getOne({ _id: cardId });
      if (card) {
        const next = (Number(card.USER_CARD_QUOTA) || 0) + times;
        const patch = {
          USER_CARD_QUOTA: next,
          USER_CARD_EDIT_TIME: now,
        };
        if (card.USER_CARD_STATUS === UserCardModel.STATUS.USED && next > 0) {
          patch.USER_CARD_STATUS = UserCardModel.STATUS.NORMAL;
        }
        await UserCardModel.edit({ _id: cardId }, patch);
      }
    }

    await UserCardLogModel.edit(
      { _id: log._id },
      {
        CARD_LOG_STATUS: UserCardLogModel.STATUS.REFUNDED,
        CARD_LOG_EDIT_TIME: now,
      },
    );

    return { refunded: times, cardId };
  }
}

module.exports = UserCardService;
