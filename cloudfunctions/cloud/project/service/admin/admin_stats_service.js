/**
 * Notes: 教练端数据统计
 */

const BaseAdminService = require("./base_admin_service.js");
const timeUtil = require("../../../framework/utils/time_util.js");
const util = require("../../../framework/utils/util.js");
const dataUtil = require("../../../framework/utils/data_util.js");
const tenantSetupHelper = require("../tenant_setup_helper.js");
const JoinModel = require("../../model/join_model.js");
const MeetModel = require("../../model/meet_model.js");
const UserCardModel = require("../../model/user_card_model.js");
const UserCardLogModel = require("../../model/user_card_log_model.js");
const CardTplModel = require("../../model/card_tpl_model.js");
const UserModel = require("../../model/user_model.js");
const DayModel = require("../../model/day_model.js");
const AdminModel = require("../../model/admin_model.js");
const dbUtil = require("../../../framework/database/db_util.js");

const CARD_COLLECTIONS = ["ax_card_tpl", "ax_user_card", "ax_user_card_log"];

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

  _resolveCoachFromMeet(meet, adminMap) {
    let style =
      meet && meet.MEET_STYLE_SET && typeof meet.MEET_STYLE_SET === "object"
        ? meet.MEET_STYLE_SET
        : {};
    let coachId = (style.teacherId || meet.MEET_ADMIN_ID || "").trim();
    let admin = coachId ? adminMap[coachId] : null;
    let coachName =
      (style.teacherName || "").trim() ||
      (admin && admin.ADMIN_NAME) ||
      "未指定教练";
    return {
      coachId: coachId || "unknown",
      coachName,
      avatar: "",
    };
  }

  _parseMeetCategoryNames(meetTypeStr) {
    let opts = dataUtil.getSelectOptions(meetTypeStr || "");
    let names = [];
    for (let o of opts || []) {
      let label = (o.label || o.val || "").trim();
      if (!label) continue;
      if (label.includes("|")) label = label.split("|")[0];
      if (!names.includes(label)) names.push(label);
    }
    return names;
  }

  /** 上课统计（按签到、课程分类、教练） */
  async getClassStats({ startDay, endDay, coachId } = {}) {
    await this._ensureCardCollections();
    let today = timeUtil.time("Y-M-D");
    if (!startDay) startDay = timeUtil.time("Y-M") + "-01";
    if (!endDay) endDay = today;
    if (startDay > endDay) {
      let tmp = startDay;
      startDay = endDay;
      endDay = tmp;
    }
    coachId = (coachId || "").trim();

    let setup = await tenantSetupHelper.getSetupForPid(
      global.PID,
      "SETUP_MEET_TYPE",
    );
    let categoryNames = this._parseMeetCategoryNames(
      (setup && setup.SETUP_MEET_TYPE) || "",
    );
    let categoryMap = {};
    for (let name of categoryNames) {
      categoryMap[name] = {
        typeName: name,
        classCnt: 0,
        consumeTimes: 0,
        consumeAmount: 0,
      };
    }

    let joins = await JoinModel.getAll(
      {
        JOIN_STATUS: JoinModel.STATUS.SUCC,
        JOIN_IS_CHECKIN: 1,
        JOIN_MEET_DAY: ["between", startDay, endDay],
      },
      "JOIN_MEET_ID,JOIN_MEET_TITLE,JOIN_MEET_DAY",
      { JOIN_MEET_DAY: "asc", JOIN_ADD_TIME: "asc" },
      10000,
    );

    let meetIds = [
      ...new Set((joins || []).map((j) => j.JOIN_MEET_ID).filter(Boolean)),
    ];
    let meetMap = {};
    if (meetIds.length) {
      let meets = await MeetModel.getAll(
        { _id: ["in", meetIds] },
        "MEET_TITLE,MEET_TYPE_ID,MEET_TYPE_NAME,MEET_ADMIN_ID,MEET_STYLE_SET",
        {},
        meetIds.length,
      );
      for (let m of meets || []) {
        meetMap[m._id] = m;
      }
    }

    let admins = await AdminModel.getAll(
      { ADMIN_STATUS: 1 },
      "ADMIN_ID,ADMIN_NAME,ADMIN_TYPE",
      {},
      500,
    );
    let adminMap = {};
    for (let a of admins || []) {
      adminMap[a.ADMIN_ID] = a;
    }

    let coachOptions = (admins || [])
      .filter((a) =>
        [AdminModel.TYPE.OWNER, AdminModel.TYPE.TEACHER].includes(
          a.ADMIN_TYPE,
        ),
      )
      .map((a) => ({
        coachId: a.ADMIN_ID,
        coachName: a.ADMIN_NAME || "教练",
      }))
      .sort((a, b) => a.coachName.localeCompare(b.coachName, "zh-CN"));

    let joinIds = (joins || []).map((j) => j._id);
    let logByJoinId = {};
    if (joinIds.length) {
      let logs = [];
      try {
        logs = await UserCardLogModel.getAll(
          {
            CARD_LOG_JOIN_ID: ["in", joinIds],
            CARD_LOG_STATUS: UserCardLogModel.STATUS.VALID,
          },
          "CARD_LOG_JOIN_ID,CARD_LOG_TIMES,CARD_LOG_ACTION,CARD_LOG_ID",
          {},
          joinIds.length,
        );
      } catch (e) {
        logs = [];
      }
      for (let log of logs || []) {
        if (!this._isIncomeLog(log)) continue;
        logByJoinId[log.CARD_LOG_JOIN_ID] = log;
      }
    }

    let incomeEntries = await this.buildIncomeEntries();
    let amountByLogId = {};
    for (let entry of incomeEntries) {
      amountByLogId[entry.logId] = entry.amount;
    }

    let coachMap = {};

    for (let join of joins || []) {
      let meet = meetMap[join.JOIN_MEET_ID] || {};
      let coachInfo = this._resolveCoachFromMeet(meet, adminMap);
      if (coachId && coachInfo.coachId !== coachId) continue;

      let typeName = (meet.MEET_TYPE_NAME || "未分类").trim();
      if (typeName.includes("|")) typeName = typeName.split("|")[0];
      if (!categoryMap[typeName]) {
        categoryMap[typeName] = {
          typeName,
          classCnt: 0,
          consumeTimes: 0,
          consumeAmount: 0,
        };
      }

      categoryMap[typeName].classCnt++;

      let log = logByJoinId[join._id];
      let times = log ? Number(log.CARD_LOG_TIMES) || 0 : 0;
      let consumeTimes = times > 0 ? times : log ? 1 : 0;
      let consumeAmount =
        log && amountByLogId[log._id] != null ? amountByLogId[log._id] : 0;

      categoryMap[typeName].consumeTimes += consumeTimes;
      categoryMap[typeName].consumeAmount = this._roundMoney(
        categoryMap[typeName].consumeAmount + consumeAmount,
      );

      let cKey = coachInfo.coachId;
      if (!coachMap[cKey]) {
        coachMap[cKey] = {
          coachId: coachInfo.coachId,
          coachName: coachInfo.coachName,
          avatar: coachInfo.avatar,
          totalClasses: 0,
          courseMap: {},
        };
      }
      coachMap[cKey].totalClasses++;

      let courseKey = join.JOIN_MEET_ID || join.JOIN_MEET_TITLE;
      if (!coachMap[cKey].courseMap[courseKey]) {
        coachMap[cKey].courseMap[courseKey] = {
          meetId: join.JOIN_MEET_ID || "",
          title: meet.MEET_TITLE || join.JOIN_MEET_TITLE || "课程",
          typeName,
          classCnt: 0,
        };
      }
      coachMap[cKey].courseMap[courseKey].classCnt++;
    }

    let categorySummary = Object.values(categoryMap).map((item) => ({
      typeName: item.typeName,
      classCnt: item.classCnt,
      consumeTimes: item.consumeTimes,
      consumeAmount: item.consumeAmount,
      consumeAmountText: this._formatMoney(item.consumeAmount),
    }));

    let coaches = Object.values(coachMap)
      .map((item) => ({
        coachId: item.coachId,
        coachName: item.coachName,
        avatar: item.avatar,
        totalClasses: item.totalClasses,
        courses: Object.values(item.courseMap)
          .sort((a, b) => b.classCnt - a.classCnt)
          .map((c) => ({
            meetId: c.meetId,
            title: c.title,
            typeName: c.typeName,
            classCnt: c.classCnt,
          })),
      }))
      .sort((a, b) => b.totalClasses - a.totalClasses);

    return {
      startDay,
      endDay,
      dateRangeText: startDay + "至" + endDay,
      coachId,
      coachOptions,
      categorySummary,
      coaches,
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

  _roundMoney(value) {
    return Math.round(Number(value) * 100) / 100;
  }

  _formatMoney(value) {
    let n = this._roundMoney(value);
    return Number.isInteger(n) ? String(n) : n.toFixed(2);
  }

  _isIncomeLog(log) {
    if (!log) return false;
    if (log.CARD_LOG_STATUS !== UserCardLogModel.STATUS.VALID) return false;
    let action = log.CARD_LOG_ACTION || UserCardLogModel.ACTION.DEDUCT;
    return (
      action === UserCardLogModel.ACTION.DEDUCT ||
      action === UserCardLogModel.ACTION.MANUAL_DEDUCT
    );
  }

  _logSortKey(log) {
    let day = log.CARD_LOG_MEET_DAY || "1970-01-01";
    let ts = Number(log.CARD_LOG_ADD_TIME) || 0;
    return day + "#" + String(ts).padStart(12, "0");
  }

  _calcTimesIncome(card, times) {
    let price = Number(card.USER_CARD_PRICE) || 0;
    let init =
      Number(card.USER_CARD_QUOTA_INIT) ||
      Number(card.USER_CARD_QUOTA) ||
      1;
    let t = Number(times) || 0;
    if (t <= 0 || price <= 0) return 0;
    return this._roundMoney((price / Math.max(init, 1)) * t);
  }

  _inIncomeRange(meetDay, range) {
    if (range === "all") return true;
    let day = (meetDay || "").trim();
    if (!day) return false;
    let today = timeUtil.time("Y-M-D");
    if (range === "today") return day === today;
    if (range === "month") return day.indexOf(timeUtil.time("Y-M")) === 0;
    return true;
  }

  _buildPeriodFirstLogMap(logs, cardMap) {
    let byCard = {};
    for (let log of logs || []) {
      let cardId = log.CARD_LOG_USER_CARD_ID;
      if (!cardId) continue;
      let card = cardMap[cardId];
      if (!card || card.USER_CARD_TYPE !== CardTplModel.TYPE.PERIOD) continue;
      let action = log.CARD_LOG_ACTION || UserCardLogModel.ACTION.DEDUCT;
      if (
        action !== UserCardLogModel.ACTION.DEDUCT &&
        action !== UserCardLogModel.ACTION.MANUAL_DEDUCT
      ) {
        continue;
      }
      if (!byCard[cardId]) byCard[cardId] = [];
      byCard[cardId].push(log);
    }

    let firstMap = {};
    for (let cardId of Object.keys(byCard)) {
      let sorted = byCard[cardId].sort((a, b) => {
        if (this._logSortKey(a) === this._logSortKey(b)) return 0;
        return this._logSortKey(a) > this._logSortKey(b) ? 1 : -1;
      });
      for (let log of sorted) {
        if (log.CARD_LOG_STATUS !== UserCardLogModel.STATUS.VALID) continue;
        firstMap[log._id] = true;
        break;
      }
    }
    return firstMap;
  }

  _buildIncomeTrend(filteredEntries, range) {
    let trendMap = {};
    if (range === "today") {
      return { trend: [], trendUnit: "day" };
    }

    if (range === "month") {
      let monthPrefix = timeUtil.time("Y-M");
      let today = timeUtil.time("Y-M-D");
      let cursorTs = timeUtil.time2Timestamp(monthPrefix + "-01 00:00:00");
      let endTs = timeUtil.time2Timestamp(today + " 23:59:59");
      while (cursorTs <= endTs) {
        let day = timeUtil.timestamp2Time(cursorTs, "Y-M-D");
        trendMap[day] = 0;
        cursorTs += 86400000;
      }
      for (let item of filteredEntries) {
        if (item.date && trendMap[item.date] != null) {
          trendMap[item.date] += item.amount;
        }
      }
      let trend = Object.keys(trendMap)
        .sort()
        .map((day) => ({
          label: day.slice(5),
          day,
          amount: this._roundMoney(trendMap[day]),
        }));
      return { trend, trendUnit: "day" };
    }

    let now = new Date();
    for (let i = 11; i >= 0; i--) {
      let d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      let month =
        d.getFullYear() +
        "-" +
        String(d.getMonth() + 1).padStart(2, "0");
      trendMap[month] = 0;
    }
    for (let item of filteredEntries) {
      if (!item.date) continue;
      let month = item.date.slice(0, 7);
      if (trendMap[month] != null) {
        trendMap[month] += item.amount;
      }
    }
    let trend = Object.keys(trendMap)
      .sort()
      .map((month) => ({
        label: month,
        day: month,
        amount: this._roundMoney(trendMap[month]),
      }));
    return { trend, trendUnit: "month" };
  }

  _inDateRange(meetDay, startDay, endDay) {
    let day = (meetDay || "").trim();
    if (!day) return false;
    if (startDay && day < startDay) return false;
    if (endDay && day > endDay) return false;
    return true;
  }

  /** 构建全部耗卡收入明细（供统计与导出复用） */
  async buildIncomeEntries() {
    await this._ensureCardCollections();

    let logs = [];
    try {
      logs = await UserCardLogModel.getAll(
        {},
        "CARD_LOG_USER_ID,CARD_LOG_USER_CARD_ID,CARD_LOG_MEET_TITLE,CARD_LOG_MEET_DAY,CARD_LOG_TIMES,CARD_LOG_ACTION,CARD_LOG_STATUS,CARD_LOG_ADD_TIME,CARD_LOG_COACH_NAME",
        { CARD_LOG_ADD_TIME: "desc" },
        10000,
      );
    } catch (err) {
      if (
        err &&
        err.message &&
        err.message.indexOf("collection not exists") >= 0
      ) {
        await this._ensureCardCollections();
      } else {
        console.error("[buildIncomeEntries]", err.message);
      }
      logs = [];
    }

    let incomeLogs = (logs || []).filter((log) => this._isIncomeLog(log));
    let cardIds = [
      ...new Set(
        incomeLogs.map((log) => log.CARD_LOG_USER_CARD_ID).filter(Boolean),
      ),
    ];
    let cardMap = {};
    if (cardIds.length) {
      let cards = await this._safeGetAll(
        UserCardModel,
        { _id: ["in", cardIds] },
        "USER_CARD_NAME,USER_CARD_TYPE,USER_CARD_PRICE,USER_CARD_QUOTA,USER_CARD_QUOTA_INIT",
        {},
        cardIds.length,
      );
      for (let c of cards || []) {
        cardMap[c._id] = c;
      }
    }

    let periodFirstMap = this._buildPeriodFirstLogMap(logs || [], cardMap);
    let userIds = [
      ...new Set(incomeLogs.map((log) => log.CARD_LOG_USER_ID).filter(Boolean)),
    ];
    let userMap = {};
    if (userIds.length) {
      let users = await UserModel.getAll(
        { USER_MINI_OPENID: ["in", userIds] },
        "USER_MINI_OPENID,USER_NAME",
        {},
        userIds.length,
      );
      for (let u of users || []) {
        userMap[u.USER_MINI_OPENID] = u;
      }
    }

    let entries = [];
    for (let log of incomeLogs) {
      let card = cardMap[log.CARD_LOG_USER_CARD_ID];
      if (!card) continue;

      let type = card.USER_CARD_TYPE || CardTplModel.TYPE.TIMES;
      let amount = 0;
      let incomeKind = "times";
      let times = Number(log.CARD_LOG_TIMES) || 0;
      let subtitle = "";

      if (type === CardTplModel.TYPE.PERIOD) {
        if (!periodFirstMap[log._id]) continue;
        amount = Number(card.USER_CARD_PRICE) || 0;
        incomeKind = "period_first";
        subtitle = "首次上课";
      } else {
        if (times <= 0) continue;
        amount = this._calcTimesIncome(card, times);
        incomeKind = "times";
        subtitle =
          log.CARD_LOG_ACTION === UserCardLogModel.ACTION.MANUAL_DEDUCT
            ? "手动扣" + times + "次"
            : "扣" + times + "次";
      }

      if (amount <= 0) continue;

      let u = userMap[log.CARD_LOG_USER_ID] || {};
      entries.push({
        logId: log._id,
        date: log.CARD_LOG_MEET_DAY || "",
        addTime: Number(log.CARD_LOG_ADD_TIME) || 0,
        userName: (u.USER_NAME || "").trim() || "会员",
        cardName: card.USER_CARD_NAME || "会员卡",
        cardType: type,
        cardTypeLabel:
          type === CardTplModel.TYPE.PERIOD ? "期限卡" : "次数卡",
        meetTitle: log.CARD_LOG_MEET_TITLE || "",
        coachName: log.CARD_LOG_COACH_NAME || "",
        times,
        amount: this._roundMoney(amount),
        amountText: this._formatMoney(amount),
        incomeKind,
        subtitle,
      });
    }

    entries.sort((a, b) => {
      if (a.date !== b.date) return a.date > b.date ? -1 : 1;
      return b.addTime - a.addTime;
    });
    return entries;
  }

  _inIssueRange(addTime, range) {
    if (range === "all") return true;
    let ts = Number(addTime) || 0;
    if (!ts) return false;
    let day = timeUtil.timestamp2Time(ts, "Y-M-D");
    return this._inIncomeRange(day, range);
  }

  /** 按发卡时间统计售卡金额 */
  async buildSaleSummary(range) {
    await this._ensureCardCollections();
    range = ["today", "month", "all"].includes(range) ? range : "month";

    let cards = await this._safeGetAll(
      UserCardModel,
      {},
      "USER_CARD_PRICE,USER_CARD_TYPE,USER_CARD_ADD_TIME",
      { USER_CARD_ADD_TIME: "desc" },
      10000,
    );

    let saleAmount = 0;
    let saleCardCount = 0;
    let saleTimesAmount = 0;
    let salePeriodAmount = 0;
    let saleTimesCount = 0;
    let salePeriodCount = 0;

    for (let c of cards || []) {
      if (!this._inIssueRange(c.USER_CARD_ADD_TIME, range)) continue;
      let price = Number(c.USER_CARD_PRICE) || 0;
      let type = c.USER_CARD_TYPE || CardTplModel.TYPE.TIMES;
      saleAmount += price;
      saleCardCount++;
      if (type === CardTplModel.TYPE.PERIOD) {
        salePeriodAmount += price;
        salePeriodCount++;
      } else {
        saleTimesAmount += price;
        saleTimesCount++;
      }
    }

    return {
      saleAmount: this._roundMoney(saleAmount),
      saleAmountText: this._formatMoney(saleAmount),
      saleCardCount,
      saleTimesAmount: this._roundMoney(saleTimesAmount),
      saleTimesAmountText: this._formatMoney(saleTimesAmount),
      salePeriodAmount: this._roundMoney(salePeriodAmount),
      salePeriodAmountText: this._formatMoney(salePeriodAmount),
      saleTimesCount,
      salePeriodCount,
    };
  }

  /** 耗卡收入（次卡按扣次，期限卡首次上课记整卡价） */
  async getFundDetails({ range = "month", page = 1, size = 20 } = {}) {
    range = ["today", "month", "all"].includes(range) ? range : "month";
    page = Math.max(Number(page) || 1, 1);
    size = Math.min(Math.max(Number(size) || 20, 5), 50);

    let [entries, saleSummary] = await Promise.all([
      this.buildIncomeEntries(),
      this.buildSaleSummary(range),
    ]);
    let filtered = entries.filter((item) =>
      this._inIncomeRange(item.date, range),
    );

    let totalAmount = 0;
    let timesAmount = 0;
    let periodAmount = 0;
    for (let item of filtered) {
      totalAmount += item.amount;
      if (item.incomeKind === "period_first") periodAmount += item.amount;
      else timesAmount += item.amount;
    }
    totalAmount = this._roundMoney(totalAmount);
    timesAmount = this._roundMoney(timesAmount);
    periodAmount = this._roundMoney(periodAmount);

    let trendPack = this._buildIncomeTrend(filtered, range);
    let maxTrend = 0;
    for (let t of trendPack.trend) {
      if (t.amount > maxTrend) maxTrend = t.amount;
    }
    let trend = (trendPack.trend || []).map((item) => ({
      ...item,
      amountText: this._formatMoney(item.amount),
      barPct: maxTrend > 0 ? Math.round((item.amount / maxTrend) * 100) : 0,
    }));

    let total = filtered.length;
    let start = (page - 1) * size;
    let list = filtered.slice(start, start + size);

    return {
      range,
      totalAmount,
      totalAmountText: this._formatMoney(totalAmount),
      timesAmount,
      timesAmountText: this._formatMoney(timesAmount),
      periodAmount,
      periodAmountText: this._formatMoney(periodAmount),
      ...saleSummary,
      trend,
      trendUnit: trendPack.trendUnit,
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
