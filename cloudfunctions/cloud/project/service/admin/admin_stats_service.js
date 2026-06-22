/**
 * Notes: 教练端数据统计
 */

const BaseAdminService = require("./base_admin_service.js");
const timeUtil = require("../../../framework/utils/time_util.js");
const util = require("../../../framework/utils/util.js");
const JoinModel = require("../../model/join_model.js");
const MeetModel = require("../../model/meet_model.js");
const UserCardModel = require("../../model/user_card_model.js");
const CardTplModel = require("../../model/card_tpl_model.js");
const UserModel = require("../../model/user_model.js");
const DayModel = require("../../model/day_model.js");
const AdminModel = require("../../model/admin_model.js");
const dbUtil = require("../../../framework/database/db_util.js");

const CARD_COLLECTIONS = ["ax_card_tpl", "ax_user_card"];

class AdminStatsService extends BaseAdminService {
  async _ensureCardCollections() {
    for (let cl of CARD_COLLECTIONS) {
      if (!(await dbUtil.isExistCollection(cl))) {
        await dbUtil.createCollection(cl);
      }
    }
  }

  async _safeGetAll(model, where, fields, orderBy, size = 5000) {
    try {
      return await model.getAll(where, fields, orderBy, size);
    } catch (err) {
      if (
        err &&
        err.message &&
        err.message.indexOf("collection not exists") >= 0
      ) {
        if (model.CL === UserCardModel.CL || model.CL === CardTplModel.CL) {
          await this._ensureCardCollections();
          return await model.getAll(where, fields, orderBy, size);
        }
      }
      console.error("[AdminStatsService]", model.CL, err.message);
      return [];
    }
  }

  _activeCardWhere(extra = {}) {
    return {
      USER_CARD_STATUS: UserCardModel.STATUS.NORMAL,
      ...extra,
    };
  }

  /** 会员卡分析 */
  async getCardAnalysis() {
    await this._ensureCardCollections();
    let cards = await this._safeGetAll(
      UserCardModel,
      this._activeCardWhere(),
      "USER_CARD_NAME,USER_CARD_TYPE,USER_CARD_QUOTA,USER_CARD_QUOTA_INIT",
      { USER_CARD_ADD_TIME: "desc" },
      10000,
    );

    let typeBuckets = {
      all: { count: 0, quota: 0 },
      times: { count: 0, quota: 0 },
      period: { count: 0, quota: 0 },
      stored: { count: 0, amount: 0 },
      package: { count: 0, quota: 0 },
    };
    let detailMap = {};

    for (let c of cards || []) {
      typeBuckets.all.count++;
      let type = c.USER_CARD_TYPE || CardTplModel.TYPE.TIMES;
      if (type === CardTplModel.TYPE.PERIOD) {
        typeBuckets.period.count++;
      } else {
        typeBuckets.times.count++;
        typeBuckets.times.quota += Number(c.USER_CARD_QUOTA) || 0;
        typeBuckets.all.quota += Number(c.USER_CARD_QUOTA) || 0;
      }

      let name = c.USER_CARD_NAME || "未命名卡";
      if (!detailMap[name]) {
        detailMap[name] = { name, count: 0, quota: 0, type };
      }
      detailMap[name].count++;
      if (type !== CardTplModel.TYPE.PERIOD) {
        detailMap[name].quota += Number(c.USER_CARD_QUOTA) || 0;
      }
    }

    let summary = [
      {
        key: "all",
        label: "全部卡",
        count: typeBuckets.all.count,
        amountText: typeBuckets.all.quota ? typeBuckets.all.quota + "次" : "--",
      },
      {
        key: "times",
        label: "次数卡",
        count: typeBuckets.times.count,
        amountText: typeBuckets.times.quota + "次",
      },
      {
        key: "period",
        label: "期限卡",
        count: typeBuckets.period.count,
        amountText: "--",
      },
      {
        key: "stored",
        label: "储值卡",
        count: typeBuckets.stored.count,
        amountText: "0元",
      },
      {
        key: "package",
        label: "套餐卡",
        count: typeBuckets.package.count,
        amountText: "0次",
      },
    ];

    let detail = Object.values(detailMap)
      .sort((a, b) => b.count - a.count)
      .map((item) => ({
        name: item.name,
        count: item.count,
        amountText:
          item.type === CardTplModel.TYPE.PERIOD
            ? "--"
            : item.quota + "次",
      }));

    return { summary, detail };
  }

  /** 上课统计 */
  async getClassStats({ days = 30 } = {}) {
    days = Math.min(Math.max(Number(days) || 30, 7), 90);
    let today = timeUtil.time("Y-M-D");
    let startDay = timeUtil.time("Y-M-D", -86400 * (days - 1));
    let todayStart = timeUtil.time2Timestamp(today + " 00:00:00");
    let todayEnd = timeUtil.time2Timestamp(today + " 23:59:59");
    let monthStart = timeUtil.time2Timestamp(
      timeUtil.time("Y-M") + "-01 00:00:00",
    );

    let [
      totalJoin,
      totalCheckin,
      cancelCnt,
      todayJoin,
      monthJoin,
      monthCheckin,
      rangeJoins,
    ] = await Promise.all([
      JoinModel.count({ JOIN_STATUS: JoinModel.STATUS.SUCC }),
      JoinModel.count({
        JOIN_STATUS: JoinModel.STATUS.SUCC,
        JOIN_IS_CHECKIN: 1,
      }),
      JoinModel.count({
        JOIN_STATUS: ["in", [JoinModel.STATUS.CANCEL, JoinModel.STATUS.ADMIN_CANCEL]],
      }),
      JoinModel.count({
        JOIN_STATUS: JoinModel.STATUS.SUCC,
        JOIN_ADD_TIME: ["between", todayStart, todayEnd],
      }),
      JoinModel.count({
        JOIN_STATUS: JoinModel.STATUS.SUCC,
        JOIN_ADD_TIME: [">=", monthStart],
      }),
      JoinModel.count({
        JOIN_STATUS: JoinModel.STATUS.SUCC,
        JOIN_IS_CHECKIN: 1,
        JOIN_ADD_TIME: [">=", monthStart],
      }),
      JoinModel.getAll(
        {
          JOIN_MEET_DAY: ["between", startDay, today],
          JOIN_STATUS: JoinModel.STATUS.SUCC,
        },
        "JOIN_MEET_DAY,JOIN_IS_CHECKIN",
        { JOIN_MEET_DAY: "asc" },
        10000,
      ),
    ]);

    let dayMap = {};
    for (let j of rangeJoins || []) {
      let d = j.JOIN_MEET_DAY;
      if (!dayMap[d]) dayMap[d] = { day: d, joinCnt: 0, checkinCnt: 0 };
      dayMap[d].joinCnt++;
      if (j.JOIN_IS_CHECKIN === 1) dayMap[d].checkinCnt++;
    }
    let dailyTrend = Object.values(dayMap).sort((a, b) =>
      a.day > b.day ? 1 : -1,
    );

    return {
      totalJoin,
      totalCheckin,
      cancelCnt,
      todayJoin,
      monthJoin,
      monthCheckin,
      checkinRate:
        totalJoin > 0
          ? Math.round((totalCheckin / totalJoin) * 1000) / 10
          : 0,
      dailyTrend,
    };
  }

  /** 约课排名（按会员约课次数） */
  async getBookingRank({ limit = 20 } = {}) {
    limit = Math.min(Math.max(Number(limit) || 20, 5), 50);
    let rows = await JoinModel.getAll(
      { JOIN_STATUS: JoinModel.STATUS.SUCC },
      "JOIN_USER_ID,JOIN_IS_CHECKIN",
      {},
      10000,
    );
    let map = {};
    for (let r of rows || []) {
      let uid = r.JOIN_USER_ID;
      if (!uid) continue;
      if (!map[uid]) {
        map[uid] = { userId: uid, count: 0, checkinCnt: 0 };
      }
      map[uid].count++;
      if (r.JOIN_IS_CHECKIN === 1) map[uid].checkinCnt++;
    }

    let userIds = Object.keys(map);
    let userMap = {};
    if (userIds.length) {
      let users = await UserModel.getAll(
        { USER_MINI_OPENID: ["in", userIds] },
        "USER_MINI_OPENID,USER_NAME,USER_MOBILE,USER_PIC",
        {},
        userIds.length,
      );
      for (let u of users || []) {
        userMap[u.USER_MINI_OPENID] = u;
      }
    }

    let list = Object.values(map)
      .map((item) => {
        let u = userMap[item.userId] || {};
        let name = (u.USER_NAME || "").trim() || "会员";
        let mobile = u.USER_MOBILE || "";
        let subtitle = mobile
          ? mobile.replace(/(\d{3})\d{4}(\d{4})/, "$1****$2")
          : "";
        return {
          userId: item.userId,
          title: name,
          subtitle,
          avatar: u.USER_PIC || "",
          count: item.count,
          checkinCnt: item.checkinCnt,
        };
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, limit)
      .map((item, idx) => ({ ...item, rank: idx + 1 }));

    return { list };
  }

  /** 资金明细（发卡金额） */
  async getFundDetails({ page = 1, size = 20 } = {}) {
    await this._ensureCardCollections();
    let all = await this._safeGetAll(
      UserCardModel,
      {},
      "USER_CARD_USER_ID,USER_CARD_NAME,USER_CARD_PRICE,USER_CARD_ADD_TIME",
      { USER_CARD_ADD_TIME: "desc" },
      5000,
    );
    let monthStart = timeUtil.time2Timestamp(
      timeUtil.time("Y-M") + "-01 00:00:00",
    );

    let totalAmount = 0;
    let monthAmount = 0;
    for (let c of all || []) {
      let price = Number(c.USER_CARD_PRICE) || 0;
      totalAmount += price;
      if (c.USER_CARD_ADD_TIME >= monthStart) monthAmount += price;
    }

    let userIds = [
      ...new Set((all || []).map((c) => c.USER_CARD_USER_ID).filter(Boolean)),
    ];
    let userMap = {};
    if (userIds.length) {
      let users = await UserModel.getAll(
        { USER_MINI_OPENID: ["in", userIds] },
        "USER_MINI_OPENID,USER_NAME,USER_MOBILE",
        {},
        userIds.length,
      );
      for (let u of users || []) {
        userMap[u.USER_MINI_OPENID] = u;
      }
    }

    let enriched = (all || []).map((c) => {
      let u = userMap[c.USER_CARD_USER_ID] || {};
      return {
        date: timeUtil.timestamp2Time(c.USER_CARD_ADD_TIME, "Y-M-D"),
        userName: u.USER_NAME || "会员",
        mobile: u.USER_MOBILE || "",
        cardName: c.USER_CARD_NAME || "",
        amount: Number(c.USER_CARD_PRICE) || 0,
      };
    });

    let total = enriched.length;
    let start = (page - 1) * size;
    let list = enriched.slice(start, start + size);

    return {
      totalAmount,
      monthAmount,
      list,
      total,
      page,
      size,
    };
  }

  /** 耗卡统计 */
  async getConsumeStats() {
    await this._ensureCardCollections();
    let cards = await this._safeGetAll(
      UserCardModel,
      {},
      "USER_CARD_NAME,USER_CARD_TYPE,USER_CARD_QUOTA,USER_CARD_QUOTA_INIT,USER_CARD_STATUS",
      { USER_CARD_ADD_TIME: "desc" },
      10000,
    );

    let totalConsumed = 0;
    let totalInit = 0;
    let usedCardCnt = 0;
    let detailMap = {};

    for (let c of cards || []) {
      if (c.USER_CARD_TYPE === CardTplModel.TYPE.PERIOD) continue;
      let init = Number(c.USER_CARD_QUOTA_INIT) || Number(c.USER_CARD_QUOTA) || 0;
      let left = Number(c.USER_CARD_QUOTA) || 0;
      let consumed = Math.max(0, init - left);
      totalInit += init;
      totalConsumed += consumed;
      if (c.USER_CARD_STATUS === UserCardModel.STATUS.USED) usedCardCnt++;

      let name = c.USER_CARD_NAME || "未命名卡";
      if (!detailMap[name]) {
        detailMap[name] = { name, consumed: 0, init: 0, cardCnt: 0 };
      }
      detailMap[name].consumed += consumed;
      detailMap[name].init += init;
      detailMap[name].cardCnt++;
    }

    let detail = Object.values(detailMap)
      .sort((a, b) => b.consumed - a.consumed)
      .map((item) => ({
        name: item.name,
        consumed: item.consumed,
        init: item.init,
        cardCnt: item.cardCnt,
        rate:
          item.init > 0
            ? Math.round((item.consumed / item.init) * 1000) / 10
            : 0,
      }));

    return {
      totalConsumed,
      totalInit,
      usedCardCnt,
      consumeRate:
        totalInit > 0
          ? Math.round((totalConsumed / totalInit) * 1000) / 10
          : 0,
      detail,
    };
  }

  /** 预约查询 */
  async getJoinQuery({
    search,
    sortType,
    dayStart,
    dayEnd,
    page = 1,
    size = 20,
  }) {
    let where = {};
    if (dayStart && dayEnd) {
      where.JOIN_MEET_DAY = ["between", dayStart, dayEnd];
    } else if (dayStart) {
      where.JOIN_MEET_DAY = dayStart;
    }

    if (util.isDefined(search) && search) {
      where.JOIN_MEET_TITLE = {
        $regex: ".*" + search,
        $options: "i",
      };
    } else if (sortType) {
      switch (sortType) {
        case "succ":
          where.JOIN_STATUS = JoinModel.STATUS.SUCC;
          break;
        case "checkin":
          where.JOIN_STATUS = JoinModel.STATUS.SUCC;
          where.JOIN_IS_CHECKIN = 1;
          break;
        case "cancel":
          where.JOIN_STATUS = [
            "in",
            [JoinModel.STATUS.CANCEL, JoinModel.STATUS.ADMIN_CANCEL],
          ];
          break;
      }
    }

    let fields =
      "JOIN_IS_CHECKIN,JOIN_MEET_TITLE,JOIN_MEET_DAY,JOIN_MEET_TIME_START,JOIN_MEET_TIME_END,JOIN_STATUS,JOIN_ADD_TIME";
    let orderBy = {
      JOIN_MEET_DAY: "desc",
      JOIN_MEET_TIME_START: "desc",
      JOIN_ADD_TIME: "desc",
    };

    let result = await JoinModel.getList(
      where,
      fields,
      orderBy,
      page,
      size,
      true,
    );
    let list = result.list || [];
    for (let k in list) {
      let rawDay = list[k].JOIN_MEET_DAY;
      list[k].JOIN_MEET_DAY =
        timeUtil.fmtDateCHN(rawDay) +
        " (" +
        timeUtil.week(rawDay) +
        ")";
      list[k].statusText =
        list[k].JOIN_STATUS === JoinModel.STATUS.SUCC
          ? list[k].JOIN_IS_CHECKIN === 1
            ? "已签到"
            : "已预约"
          : "已取消";
    }
    result.list = list;
    return result;
  }

  /** 排课查询 */
  async getScheduleQuery({ startDay, endDay }, adminId, adminType) {
    if (!startDay) startDay = timeUtil.time("Y-M-D");
    if (!endDay) endDay = timeUtil.time("Y-M-D", 86400 * 6);

    let meetWhere = { MEET_STATUS: MeetModel.STATUS.COMM };
    if (adminType === AdminModel.TYPE.TEACHER) {
      meetWhere.MEET_ADMIN_ID = adminId;
    }

    let meets = await MeetModel.getAll(
      meetWhere,
      "MEET_TITLE,MEET_TYPE_NAME",
      { MEET_ORDER: "asc" },
      500,
    );
    let meetMap = {};
    for (let m of meets || []) {
      meetMap[m._id] = m;
    }

    let dayRecords = await DayModel.getAllBig(
      { day: ["between", startDay, endDay] },
      "day,times,DAY_MEET_ID",
      { day: "asc" },
      2000,
    );

    let list = [];
    for (let rec of dayRecords || []) {
      let meet = meetMap[rec.DAY_MEET_ID];
      if (!meet) continue;
      let times = rec.times || [];
      for (let t of times) {
        if (t.status != 1) continue;
        list.push({
          day: rec.day,
          dayText:
            timeUtil.fmtDateCHN(rec.day) + " (" + timeUtil.week(rec.day) + ")",
          title: meet.MEET_TITLE,
          typeName: meet.MEET_TYPE_NAME || "",
          timeStart: t.start,
          timeEnd: t.end,
        });
      }
    }

    list.sort((a, b) => {
      if (a.day !== b.day) return a.day > b.day ? 1 : -1;
      return a.timeStart > b.timeStart ? 1 : -1;
    });

    return { list, startDay, endDay, total: list.length };
  }
}

module.exports = AdminStatsService;
