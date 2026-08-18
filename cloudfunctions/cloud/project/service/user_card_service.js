/**
 * Notes: 会员端会员卡
 */

const BaseService = require("./base_service.js");
const UserCardModel = require("../model/user_card_model.js");
const UserCardLogModel = require("../model/user_card_log_model.js");
const CardTplModel = require("../model/card_tpl_model.js");
const MeetModel = require("../model/meet_model.js");
const JoinModel = require("../model/join_model.js");
const DayModel = require("../model/day_model.js");
const AdminModel = require("../model/admin_model.js");
const TeacherModel = require("../model/teacher_model.js");
const dbUtil = require("../../framework/database/db_util.js");
const timeUtil = require("../../framework/utils/time_util.js");
const cardScopeUtil = require("../utils/card_scope_util.js");
const cardCoverUtil = require("../utils/card_cover_util.js");
const cardStateUtil = require("../utils/card_state_util.js");
const CardLogService = require("./card_log_service.js");

const CARD_COLLECTIONS = ["ax_user_card", "ax_user_card_log"];
const MS_PER_DAY = 86400 * 1000;

class UserCardService extends BaseService {
  /** 只读准备扣卡信息，实际写入由预约事务服务完成。 */
  async prepareJoinCard(userId, meetId, timeMark, cardId) {
    const meet = await MeetModel.getOne({ _id: meetId }, "MEET_TITLE,MEET_TYPE_NAME,MEET_STYLE_SET,MEET_DAYS_SET");
    if (!meet) this.AppError("课程不存在");
    const needTimes = this._getMeetCardTimes(meet);
    const card = await this._resolveCardForJoin(userId, needTimes, cardId, meet, this._meetDayFromTimeMark(timeMark));
    if (!card) this.AppError("会员卡划扣失败，请联系馆方");
    const tplMaps = card.USER_CARD_TPL_ID ? await this._loadTplVisualMaps([card.USER_CARD_TPL_ID]) : {};
    const type = this._resolveCardType(card, tplMaps.typeMap || {});
    const activation = card.USER_CARD_ACTIVATE || UserCardModel.ACTIVATE.IMMEDIATE;
    const activationPatch = this._isPendingActivation(card) && (activation === UserCardModel.ACTIVATE.FIRST_BOOK || activation === UserCardModel.ACTIVATE.FIRST_USE_LIMIT) ? this._buildActivatePatch(card, timeUtil.time(), tplMaps.daysMap || {}) : null;
    return { cardId: card._id, userId, needTimes, type, activationPatch };
  }
  async _ensureCardCollections() {
    for (let cl of CARD_COLLECTIONS) {
      if (!(await dbUtil.isExistCollection(cl))) {
        await dbUtil.createCollection(cl);
      }
    }
  }

  _isExpired(card, now) {
    return cardStateUtil.isExpired(card, now);
  }

  _isPendingActivation(card) {
    return cardStateUtil.isPendingActivation(card);
  }

  _canUsePendingForJoin(card) {
    const activate = card.USER_CARD_ACTIVATE || UserCardModel.ACTIVATE.IMMEDIATE;
    return cardStateUtil.canUsePendingForJoin(card, activate, [
      UserCardModel.ACTIVATE.FIRST_BOOK,
      UserCardModel.ACTIVATE.FIRST_CLASS,
      UserCardModel.ACTIVATE.FIRST_USE_LIMIT,
    ]);
  }

  _resolveCardType(card, tplTypeMap = {}) {
    return cardStateUtil.resolveCardType(card, tplTypeMap, {
      times: CardTplModel.TYPE.TIMES,
      period: CardTplModel.TYPE.PERIOD,
    });
  }

  _meetDayFromTimeMark(timeMark) {
    return cardStateUtil.meetDayFromTimeMark(timeMark);
  }

  _cardDayFromTs(ts) {
    const n = Number(ts) || 0;
    if (n <= 0) return "";
    return timeUtil.timestamp2Time(n, "Y-M-D");
  }

  _resolveCardDays(card, tplDaysMap = {}) {
    const cardDays = Number(card.USER_CARD_DAYS) || 0;
    if (cardDays > 0) return cardDays;
    const tplId = card.USER_CARD_TPL_ID;
    const tplDays = tplId ? Number(tplDaysMap[tplId]) || 0 : 0;
    return tplDays > 0 ? tplDays : 0;
  }

  _cardValidForMeetDay(card, meetDay, now, tplDaysMap = {}) {
    return cardStateUtil.isValidForMeetDay(card, meetDay, now, {
      canUsePending: (item) => this._canUsePendingForJoin(item),
      resolveDays: (item) => this._resolveCardDays(item, tplDaysMap),
      timestampToDay: (value) => this._cardDayFromTs(value),
      firstBook: UserCardModel.ACTIVATE.FIRST_BOOK,
      firstUse: UserCardModel.ACTIVATE.FIRST_USE_LIMIT,
    });
  }

  async _selfHealPeriodCardRecord(card, tplTypeMap = {}) {
    const type = this._resolveCardType(card, tplTypeMap);
    if (type !== CardTplModel.TYPE.PERIOD) return;

    const patch = {};
    if (card.USER_CARD_TYPE !== CardTplModel.TYPE.PERIOD) {
      patch.USER_CARD_TYPE = CardTplModel.TYPE.PERIOD;
    }
    if (
      card.USER_CARD_STATUS === UserCardModel.STATUS.USED &&
      !this._isPendingActivation(card) &&
      !this._isExpired(card, timeUtil.time())
    ) {
      patch.USER_CARD_STATUS = UserCardModel.STATUS.NORMAL;
    }
    if (!Object.keys(patch).length) return;

    patch.USER_CARD_EDIT_TIME = timeUtil.time();
    await UserCardModel.edit({ _id: card._id }, patch);
    Object.assign(card, patch);
  }

  async _loadTplVisualMaps(tplIds) {
    const colorMap = {};
    const coverMap = {};
    const typeMap = {};
    const daysMap = {};
    if (!tplIds.length) return { colorMap, coverMap, typeMap, daysMap };

    let tpls = await CardTplModel.getAll(
      { CARD_TPL_ID: ["in", tplIds] },
      "CARD_TPL_ID,CARD_TPL_TYPE,CARD_TPL_DAYS,CARD_TPL_COLOR,CARD_TPL_COVER",
      {},
      100,
    );
    for (let t of tpls || []) {
      colorMap[t.CARD_TPL_ID] = t.CARD_TPL_COLOR || "#F5A623";
      coverMap[t.CARD_TPL_ID] = cardCoverUtil.normalizeCover(t.CARD_TPL_COVER);
      typeMap[t.CARD_TPL_ID] = t.CARD_TPL_TYPE || CardTplModel.TYPE.TIMES;
      daysMap[t.CARD_TPL_ID] = Number(t.CARD_TPL_DAYS) || 0;
    }
    return { colorMap, coverMap, typeMap, daysMap };
  }

  _buildActivatePatch(card, now, tplDaysMap = {}) {
    const days = this._resolveCardDays(card, tplDaysMap);
    if (days <= 0) {
      return {
        USER_CARD_START_TIME: now,
        USER_CARD_EDIT_TIME: now,
      };
    }
    return {
      USER_CARD_START_TIME: now,
      USER_CARD_END_TIME: now + days * MS_PER_DAY,
      USER_CARD_DAYS: days,
      USER_CARD_EDIT_TIME: now,
    };
  }

  async _tryActivateCard(card, trigger, tplDaysMap = {}) {
    if (!card || !this._isPendingActivation(card)) return false;
    const activate = card.USER_CARD_ACTIVATE || UserCardModel.ACTIVATE.IMMEDIATE;
    let shouldActivate = false;
    if (trigger === "book") {
      shouldActivate =
        activate === UserCardModel.ACTIVATE.FIRST_BOOK ||
        activate === UserCardModel.ACTIVATE.FIRST_USE_LIMIT;
    } else if (trigger === "checkin") {
      shouldActivate =
        activate === UserCardModel.ACTIVATE.FIRST_CLASS ||
        activate === UserCardModel.ACTIVATE.FIRST_USE_LIMIT;
    }
    if (!shouldActivate) return false;
    await UserCardModel.edit(
      { _id: card._id },
      this._buildActivatePatch(card, timeUtil.time(), tplDaysMap),
    );
    return true;
  }

  async tryActivateForJoinBook(cardId) {
    if (!cardId) return;
    await this._ensureCardCollections();
    let card = await UserCardModel.getOne({ _id: cardId });
    await this._tryActivateCard(card, "book");
  }

  async tryActivateForJoinCheckin(joinId, userId) {
    if (!joinId || !userId) return;
    await this._ensureCardCollections();
    let log = await UserCardLogModel.getOne({
      CARD_LOG_JOIN_ID: joinId,
      CARD_LOG_USER_ID: userId,
      CARD_LOG_ACTION: UserCardLogModel.ACTION.DEDUCT,
    });
    if (!log || !log.CARD_LOG_USER_CARD_ID) return;
    let card = await UserCardModel.getOne({
      _id: log.CARD_LOG_USER_CARD_ID,
      USER_CARD_USER_ID: userId,
    });
    await this._tryActivateCard(card, "checkin");
  }

  async _getCategoryNameMap() {
    try {
      const AdminTenantService = require("./admin/admin_tenant_service.js");
      const store = await new AdminTenantService().getStore(this.getProjectId());
      const map = {};
      for (const c of (store && store.categories) || []) {
        if (c && c.id != null) map[String(c.id)] = c.name || String(c.id);
      }
      return map;
    } catch (err) {
      console.error("[UserCardService] category map:", err.message);
      return {};
    }
  }

  _mapCardItem(
    card,
    now,
    tplColor,
    nameMap = {},
    tplCoverId = "",
    tplTypeMap = {},
    tplDaysMap = {},
  ) {
    const type = this._resolveCardType(card, tplTypeMap);
    const expired = this._isExpired(card, now);
    const pending = this._isPendingActivation(card);
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

    if (
      type === CardTplModel.TYPE.PERIOD &&
      status === UserCardModel.STATUS.USED &&
      !pending &&
      !expired
    ) {
      status = UserCardModel.STATUS.NORMAL;
    }

    let statusLabel = "正常";
    if (pending) statusLabel = "待激活";
    else if (status === UserCardModel.STATUS.STOP) statusLabel = "停卡";
    else if (status === UserCardModel.STATUS.USED || expired)
      statusLabel = "失效";
    else if (type === CardTplModel.TYPE.TIMES) statusLabel = "正常";

    const endTs = Number(card.USER_CARD_END_TIME) || 0;
    const startTs = Number(card.USER_CARD_START_TIME) || 0;
    const validDays = this._resolveCardDays(card, tplDaysMap);
    let endTimeDesc = pending
      ? `${UserCardModel.ACTIVATE_DESC[card.USER_CARD_ACTIVATE] || "待激活"}${
          validDays > 0 ? ` · ${validDays}天` : ""
        }`
      : "长期有效";
    if (!pending && endTs > 0) {
      endTimeDesc =
        validDays > 0
          ? `${timeUtil.timestamp2Time(endTs, "Y-M-D")}（${validDays}天）`
          : timeUtil.timestamp2Time(endTs, "Y-M-D");
    }
    let startTimeDesc = "";
    if (startTs > 0) {
      startTimeDesc = timeUtil.timestamp2Time(startTs, "Y-M-D");
    }

    const activate = card.USER_CARD_ACTIVATE || UserCardModel.ACTIVATE.IMMEDIATE;
    const quota = Number(card.USER_CARD_QUOTA) || 0;
    const scope = cardScopeUtil.getCardScope(card);
    const scopeDesc = cardScopeUtil.buildScopeDesc(scope, nameMap);

    return {
      id: card._id,
      cardNo: card.USER_CARD_ID || card._id,
      name: card.USER_CARD_NAME || "会员卡",
      type,
      typeLabel: CardTplModel.TYPE_DESC[type] || "次数卡",
      quota,
      quotaInit: Number(card.USER_CARD_QUOTA_INIT) || 0,
      balanceText:
        type === CardTplModel.TYPE.PERIOD
          ? validDays > 0
            ? `期限内畅练 · ${validDays}天`
            : "期限内畅练"
          : `${quota}次`,
      validDays,
      endTime: endTs,
      endTimeDesc,
      startTime: startTs,
      startTimeDesc,
      coachName: card.USER_CARD_COACH_NAME || "",
      memo: card.USER_CARD_MEMO || "",
      price: Number(card.USER_CARD_PRICE) || 0,
      activate,
      activateLabel: UserCardModel.ACTIVATE_DESC[activate] || "立即激活",
      scope,
      scopeDesc,
      status,
      statusLabel,
      isActive:
        status === UserCardModel.STATUS.NORMAL &&
        !expired &&
        !pending &&
        (type === CardTplModel.TYPE.PERIOD || quota > 0),
      canBook:
        status === UserCardModel.STATUS.NORMAL &&
        !expired &&
        (pending ? this._canUsePendingForJoin(card) : true) &&
        (type === CardTplModel.TYPE.PERIOD || quota > 0),
      isPending: pending,
      color: tplColor || "#F5A623",
      coverId: cardCoverUtil.normalizeCover(tplCoverId),
    };
  }

  _usageLogSortKey(log) {
    const day = log.CARD_LOG_MEET_DAY || "1970-01-01";
    const start = log.CARD_LOG_TIME_START || "00:00";
    const addTs = Number(log.CARD_LOG_ADD_TIME) || 0;
    return `${day}#${start}#${String(addTs).padStart(12, "0")}`;
  }

  _formatUsageDeductLine(coachName, deductDesc) {
    const coach = (coachName || "").trim();
    return coach ? `${coach} · ${deductDesc}` : deductDesc;
  }

  async _buildUsageList(logs, cardType = "") {
    const sorted = [...(logs || [])].sort((a, b) =>
      this._usageLogSortKey(b).localeCompare(this._usageLogSortKey(a)),
    );

    const joinIds = [
      ...new Set(
        sorted.map((log) => log.CARD_LOG_JOIN_ID).filter(Boolean),
      ),
    ];
    const joinMap = {};
    if (joinIds.length) {
      const joins = await JoinModel.getAll(
        { _id: ["in", joinIds] },
        "JOIN_IS_CHECKIN,JOIN_STATUS,JOIN_MEET_ID,JOIN_MEET_TIME_MARK,JOIN_MEET_DAY",
        {},
        joinIds.length,
      );
      for (let join of joins || []) {
        joinMap[join._id] = join;
      }
    }

    const coachOverrides = {};
    for (let log of sorted) {
      const join = joinMap[log.CARD_LOG_JOIN_ID];
      const meetId =
        (join && join.JOIN_MEET_ID) || log.CARD_LOG_MEET_ID || "";
      const timeMark = join && join.JOIN_MEET_TIME_MARK;
      const meetDay =
        (join && join.JOIN_MEET_DAY) || log.CARD_LOG_MEET_DAY || "";
      if (!meetId || !timeMark) continue;
      const name = await this._resolveCoachNameFromSchedule(
        meetId,
        timeMark,
        meetDay,
      );
      if (name) coachOverrides[log._id] = name;
    }

    const usageList = sorted.map((log) =>
      this._mapUsageLog(
        log,
        cardType,
        joinMap[log.CARD_LOG_JOIN_ID],
        coachOverrides[log._id] || "",
      ),
    );
    return { usageList, usageTotal: usageList.length };
  }

  _mapUsageLog(log, cardType = "", joinInfo = null, coachNameOverride = "") {
    const day = log.CARD_LOG_MEET_DAY || "";
    const weekDesc = day ? timeUtil.week(day) : "";
    const dayDesc = day ? `${day} (${weekDesc})` : "";
    const start = log.CARD_LOG_TIME_START || "";
    const end = log.CARD_LOG_TIME_END || "";
    const times = Number(log.CARD_LOG_TIMES) || 0;
    const action = log.CARD_LOG_ACTION || UserCardLogModel.ACTION.DEDUCT;
    const isRefund = log.CARD_LOG_STATUS === UserCardLogModel.STATUS.REFUNDED;
    const coachName = (
      coachNameOverride ||
      log.CARD_LOG_COACH_NAME ||
      log.CARD_LOG_OPERATOR_NAME ||
      ""
    ).trim();
    const memo = (log.CARD_LOG_MEMO || "").trim();
    const isPeriod = cardType === CardTplModel.TYPE.PERIOD;

    if (action === UserCardLogModel.ACTION.MANUAL_ADD) {
      return {
        id: log._id,
        meetTitle: log.CARD_LOG_MEET_TITLE || "手动加次",
        meetTypeName: memo || "手动调整",
        coachName,
        deductText: `+${times}次`,
        dayDesc,
        timeRange: "",
        scheduleText: dayDesc,
        times,
        statusLabel: "加次",
        isRefund: false,
        isManual: true,
        addTime: log.CARD_LOG_ADD_TIME || 0,
      };
    }
    if (action === UserCardLogModel.ACTION.MANUAL_DEDUCT) {
      return {
        id: log._id,
        meetTitle: log.CARD_LOG_MEET_TITLE || "手动消次",
        meetTypeName: memo || "手动调整",
        coachName,
        deductText: `-${times}次`,
        dayDesc,
        timeRange: "",
        scheduleText: dayDesc,
        times,
        statusLabel: "消次",
        isRefund: false,
        isManual: true,
        addTime: log.CARD_LOG_ADD_TIME || 0,
      };
    }

    let deductDesc;
    let statusLabel = this._usageStatusLabel(log, joinInfo);
    if (isPeriod) {
      deductDesc = "本课不扣次";
    } else {
      deductDesc = times > 0 ? `消卡${times}次` : "已记录";
    }
    return {
      id: log._id,
      meetTitle: log.CARD_LOG_MEET_TITLE || "课程",
      meetTypeName: log.CARD_LOG_MEET_TYPE_NAME || "精品课",
      coachName,
      deductText: this._formatUsageDeductLine(coachName, deductDesc),
      dayDesc,
      timeRange: start && end ? `${start}-${end}` : "",
      scheduleText:
        dayDesc && start && end ? `${dayDesc} ${start}-${end}` : dayDesc,
      times: isPeriod ? 0 : times,
      statusLabel,
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
    let coverMap = {};
    let typeMap = {};
    let daysMap = {};
    if (tplIds.length) {
      const maps = await this._loadTplVisualMaps(tplIds);
      colorMap = maps.colorMap;
      coverMap = maps.coverMap;
      typeMap = maps.typeMap;
      daysMap = maps.daysMap;
    }

    const now = timeUtil.time();
    const nameMap = await this._getCategoryNameMap();
    for (let c of list || []) {
      await this._selfHealPeriodCardRecord(c, typeMap);
    }
    let mapped = (list || []).map((c) =>
      this._mapCardItem(
        c,
        now,
        colorMap[c.USER_CARD_TPL_ID],
        nameMap,
        coverMap[c.USER_CARD_TPL_ID],
        typeMap,
        daysMap,
      ),
    );
    if (activeOnly) {
      mapped = mapped.filter((c) => {
        if (c.status !== UserCardModel.STATUS.NORMAL) return false;
        if (c.isPending) return true;
        return c.isActive;
      });
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
    let typeMap = {};
    let daysMap = {};
    let coverId = "";
    if (card.USER_CARD_TPL_ID) {
      const maps = await this._loadTplVisualMaps([card.USER_CARD_TPL_ID]);
      typeMap = maps.typeMap;
      daysMap = maps.daysMap;
      coverId = maps.coverMap[card.USER_CARD_TPL_ID] || "";
    }
    await this._selfHealPeriodCardRecord(card, typeMap);
    card = await UserCardModel.getOne({ _id: cardId, USER_CARD_USER_ID: userId });
    const now = timeUtil.time();
    const nameMap = await this._getCategoryNameMap();
    const detail = this._mapCardItem(
      card,
      now,
      color,
      nameMap,
      coverId,
      typeMap,
      daysMap,
    );

    let logs = await UserCardLogModel.getAll(
      {
        CARD_LOG_USER_ID: userId,
        CARD_LOG_USER_CARD_ID: cardId,
        CARD_LOG_ACTION: [
          "in",
          [
            UserCardLogModel.ACTION.DEDUCT,
            UserCardLogModel.ACTION.MANUAL_ADD,
            UserCardLogModel.ACTION.MANUAL_DEDUCT,
          ],
        ],
      },
      "*",
      { CARD_LOG_ADD_TIME: "desc" },
      100,
    );

    const { usageList, usageTotal } = await this._buildUsageList(logs, detail.type);
    return {
      card: detail,
      usageList,
      usageTotal,
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

  _resolveCardScopeSync(card, tplScopeMap) {
    if (card && card.USER_CARD_SCOPE) {
      return cardScopeUtil.normalizeScope(card.USER_CARD_SCOPE);
    }
    const tplId = card && card.USER_CARD_TPL_ID;
    if (tplId && tplScopeMap && tplScopeMap[tplId]) {
      return tplScopeMap[tplId];
    }
    return { mode: "all", categoryIds: [] };
  }

  async _loadTplScopeMap(tplIds) {
    if (!tplIds || !tplIds.length) return {};
    let tpls = await CardTplModel.getAll(
      { CARD_TPL_ID: ["in", tplIds] },
      "CARD_TPL_ID,CARD_TPL_SCOPE",
      {},
      tplIds.length,
    );
    const map = {};
    for (let t of tpls || []) {
      map[t.CARD_TPL_ID] = cardScopeUtil.normalizeScope(t.CARD_TPL_SCOPE);
    }
    return map;
  }

  _cardMatchesMeetScope(scope, meet) {
    return cardScopeUtil.cardMatchesMeet(scope, meet);
  }

  _usageStatusLabel(log, joinInfo = null) {
    const isRefund =
      log.CARD_LOG_STATUS === UserCardLogModel.STATUS.REFUNDED;
    if (isRefund) return "已退还";

    if (joinInfo) {
      if (Number(joinInfo.JOIN_IS_CHECKIN) === 1) return "已上课";
      const joinStatus = Number(joinInfo.JOIN_STATUS);
      if (joinStatus === JoinModel.STATUS.CANCEL) return "已取消";
      if (joinStatus === JoinModel.STATUS.ADMIN_CANCEL) return "已取消";
      return "预约成功";
    }

    return "预约成功";
  }

  async _resolveCoachNameFromSchedule(meetId, timeMark, meetDay = "") {
    if (!meetId || !timeMark) return "";

    const day = (meetDay || this._meetDayFromTimeMark(timeMark) || "").trim();
    if (!day) return "";

    let dayRec = await DayModel.getOne({ DAY_MEET_ID: meetId, day }, "times");
    const times = (dayRec && dayRec.times) || [];
    let timeNode = null;
    for (let slot of times) {
      if (slot && slot.mark === timeMark) {
        timeNode = slot;
        break;
      }
    }
    if (!timeNode) return "";

    const slotName = (timeNode.teacherName || "").trim();
    if (slotName) return slotName;

    const teacherId = (timeNode.teacherId || "").trim();
    if (!teacherId) return "";

    let teacher = await TeacherModel.getOne(
      { _id: teacherId },
      "TEACHER_NAME,TEACHER_ADMIN_ID",
    );
    if (teacher && teacher.TEACHER_NAME) return teacher.TEACHER_NAME;

    if (teacher && teacher.TEACHER_ADMIN_ID) {
      let admin = await AdminModel.getOne(
        { _id: teacher.TEACHER_ADMIN_ID },
        "ADMIN_NAME",
      );
      if (admin && admin.ADMIN_NAME) return admin.ADMIN_NAME;
    }

    return "";
  }

  async _resolveCoachName(meet, timeMark, meetDay = "") {
    const meetId = meet && (meet._id || meet.MEET_ID);
    return this._resolveCoachNameFromSchedule(meetId, timeMark, meetDay);
  }

  /** 预约可选会员卡列表 */
  async getJoinCardOptions(userId, meetId, timeMark = "", meetDay = "") {
    if (!userId) this.AppError("请先登录");

    let meet = await MeetModel.getOne(
      { _id: meetId },
      "MEET_STYLE_SET,MEET_TYPE_ID,MEET_TYPE_NAME",
    );
    if (!meet) this.AppError("课程不存在");

    const needTimes = this._getMeetCardTimes(meet);
    const resolvedMeetDay =
      this._meetDayFromTimeMark(timeMark) || (meetDay || "").trim();
    const list = await this._listUsableCards(
      userId,
      needTimes,
      meet,
      resolvedMeetDay,
    );
    if (!list.length) {
      this.AppError(
        resolvedMeetDay
          ? "暂无覆盖该上课日的会员卡，请换时段或联系馆方"
          : "暂无可用会员卡，请联系馆方发卡后再预约",
      );
    }
    return { needTimes, list, meetDay: resolvedMeetDay };
  }

  async _listUsableCards(userId, needTimes, meet, meetDay = "") {
    await this._ensureCardCollections();
    const now = timeUtil.time();
    let cards = await UserCardModel.getAll(
      {
        USER_CARD_USER_ID: userId,
        USER_CARD_STATUS: [
          "in",
          [UserCardModel.STATUS.NORMAL, UserCardModel.STATUS.USED],
        ],
      },
      "*",
      { USER_CARD_END_TIME: "desc", USER_CARD_ADD_TIME: "desc" },
      50,
    );

    const tplIds = [
      ...new Set((cards || []).map((c) => c.USER_CARD_TPL_ID).filter(Boolean)),
    ];
    let colorMap = {};
    let coverMap = {};
    let scopeMap = {};
    let typeMap = {};
    let daysMap = {};
    if (tplIds.length) {
      const maps = await this._loadTplVisualMaps(tplIds);
      colorMap = maps.colorMap;
      coverMap = maps.coverMap;
      typeMap = maps.typeMap;
      daysMap = maps.daysMap;
      let tpls = await CardTplModel.getAll(
        { CARD_TPL_ID: ["in", tplIds] },
        "CARD_TPL_ID,CARD_TPL_SCOPE",
        {},
        100,
      );
      for (let t of tpls || []) {
        scopeMap[t.CARD_TPL_ID] = cardScopeUtil.normalizeScope(t.CARD_TPL_SCOPE);
      }
    }

    let list = [];
    for (let k in cards || []) {
      let card = cards[k];
      await this._selfHealPeriodCardRecord(card, typeMap);
      if (card.USER_CARD_STATUS !== UserCardModel.STATUS.NORMAL) continue;

      const pending = this._isPendingActivation(card);
      if (!pending && this._isExpired(card, now)) continue;
      if (!this._cardValidForMeetDay(card, meetDay, now, daysMap)) continue;

      const type = this._resolveCardType(card, typeMap);
      const quota = Number(card.USER_CARD_QUOTA) || 0;
      if (type === CardTplModel.TYPE.TIMES && quota < needTimes) continue;
      if (pending && !this._canUsePendingForJoin(card)) continue;
      const scope = this._resolveCardScopeSync(card, scopeMap);
      if (meet && !this._cardMatchesMeetScope(scope, meet)) continue;

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
        coverId: coverMap[card.USER_CARD_TPL_ID] || "",
      });
    }
    return list;
  }

  async _resolveCardForJoin(userId, needTimes, cardId, meet, meetDay = "") {
    if (cardId) {
      return await this._getCardIfUsable(
        userId,
        cardId,
        needTimes,
        meet,
        meetDay,
      );
    }
    return await this._pickCardForJoin(userId, needTimes, meet, meetDay);
  }

  async _getCardIfUsable(userId, cardId, needTimes, meet, meetDay = "") {
    await this._ensureCardCollections();
    let card = await UserCardModel.getOne({
      _id: cardId,
      USER_CARD_USER_ID: userId,
      USER_CARD_STATUS: UserCardModel.STATUS.NORMAL,
    });
    if (!card) this.AppError("会员卡不可用");

    const now = timeUtil.time();
    if (!this._isPendingActivation(card) && this._isExpired(card, now)) {
      this.AppError("会员卡已过期");
    }

    let scopeMap = {};
    let typeMap = {};
    let daysMap = {};
    if (card.USER_CARD_TPL_ID) {
      const maps = await this._loadTplVisualMaps([card.USER_CARD_TPL_ID]);
      typeMap = maps.typeMap;
      daysMap = maps.daysMap;
      if (!card.USER_CARD_SCOPE) {
        scopeMap = await this._loadTplScopeMap([card.USER_CARD_TPL_ID]);
      }
    }
    await this._selfHealPeriodCardRecord(card, typeMap);

    if (!this._cardValidForMeetDay(card, meetDay, now, daysMap)) {
      this.AppError("该会员卡有效期不覆盖所选上课日");
    }
    const scope = this._resolveCardScopeSync(card, scopeMap);
    if (meet && !this._cardMatchesMeetScope(scope, meet)) {
      this.AppError("该会员卡不适用于本课程分类");
    }

    const type = this._resolveCardType(card, typeMap);
    if (type === CardTplModel.TYPE.PERIOD) return card;

    if (Number(card.USER_CARD_QUOTA) >= needTimes) return card;

    this.AppError("该会员卡剩余次数不足");
  }

  /** 预约前校验会员卡 */
  async checkCardForJoin(userId, meetId, cardId, timeMark = "") {
    if (!userId) this.AppError("请先登录");

    let meet = await MeetModel.getOne(
      { _id: meetId },
      "MEET_STYLE_SET,MEET_TYPE_ID,MEET_TYPE_NAME",
    );
    if (!meet) this.AppError("课程不存在");

    const needTimes = this._getMeetCardTimes(meet);
    const meetDay = this._meetDayFromTimeMark(timeMark);
    const card = await this._resolveCardForJoin(
      userId,
      needTimes,
      cardId,
      meet,
      meetDay,
    );
    if (!card) {
      this.AppError("暂无可用会员卡，请联系馆方发卡后再预约");
    }
    return { cardId: card._id, needTimes, cardName: card.USER_CARD_NAME };
  }

  async _pickCardForJoin(userId, needTimes, meet, meetDay = "") {
    const now = timeUtil.time();
    let list = await UserCardModel.getAll(
      {
        USER_CARD_USER_ID: userId,
        USER_CARD_STATUS: [
          "in",
          [UserCardModel.STATUS.NORMAL, UserCardModel.STATUS.USED],
        ],
      },
      "*",
      { USER_CARD_END_TIME: "desc", USER_CARD_ADD_TIME: "desc" },
      50,
    );

    const tplIds = [
      ...new Set((list || []).map((c) => c.USER_CARD_TPL_ID).filter(Boolean)),
    ];
    const scopeMap = tplIds.length ? await this._loadTplScopeMap(tplIds) : {};
    const tplMaps = tplIds.length ? await this._loadTplVisualMaps(tplIds) : {};
    const typeMap = tplMaps.typeMap || {};
    const daysMap = tplMaps.daysMap || {};

    for (let k in list) {
      let card = list[k];
      await this._selfHealPeriodCardRecord(card, typeMap);
      if (card.USER_CARD_STATUS !== UserCardModel.STATUS.NORMAL) continue;

      const pending = this._isPendingActivation(card);
      if (!pending && this._isExpired(card, now)) continue;
      if (!this._cardValidForMeetDay(card, meetDay, now, daysMap)) continue;
      if (pending && !this._canUsePendingForJoin(card)) continue;
      const scope = this._resolveCardScopeSync(card, scopeMap);
      if (meet && !this._cardMatchesMeetScope(scope, meet)) continue;

      const type = this._resolveCardType(card, typeMap);
      if (type === CardTplModel.TYPE.PERIOD) {
        return card;
      }
      if (
        type === CardTplModel.TYPE.TIMES &&
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
    return new CardLogService().insertDeductLog({ userId, cardId, joinId, meet, join, needTimes, coachName });
  }

  /** 预约成功后扣次 */
  async consumeForJoin(userId, meetId, joinId, cardId) {
    await this._ensureCardCollections();
    let meet = await MeetModel.getOne(
      { _id: meetId },
      "MEET_TITLE,MEET_TYPE_NAME,MEET_TYPE_ID,MEET_STYLE_SET,MEET_DAYS_SET,MEET_ADMIN_ID",
    );
    if (!meet) return;

    let join = await JoinModel.getOne({ _id: joinId });
    if (!join) return;

    // 同一个预约只允许一个请求进入扣卡流程，防止网络重试或并发请求重复扣次。
    const claimed = await JoinModel.edit(
      { _id: joinId, JOIN_CARD_CONSUME_STATUS: 0 },
      { JOIN_CARD_CONSUME_STATUS: 1 },
    );
    if (!claimed) {
      return { cardId: "", deducted: 0, joinId, alreadyProcessed: true };
    }

    try {
      const needTimes = this._getMeetCardTimes(meet);
      const meetDay = join.JOIN_MEET_DAY || this._meetDayFromTimeMark(join.JOIN_MEET_TIME_MARK);
      let card = await this._resolveCardForJoin(
        userId,
        needTimes,
        cardId,
        meet,
        meetDay,
      );
      if (!card) {
        if (cardId) this.AppError("会员卡划扣失败，请联系馆方");
        return;
      }

      const tplMaps = card.USER_CARD_TPL_ID
        ? await this._loadTplVisualMaps([card.USER_CARD_TPL_ID])
        : {};
      await this._tryActivateCard(card, "book", tplMaps.daysMap || {});
      card = await UserCardModel.getOne({ _id: card._id });
      if (!card) return;

      const coachName = await this._resolveCoachName(
        meet,
        join.JOIN_MEET_TIME_MARK,
        join.JOIN_MEET_DAY,
      );
      const type = this._resolveCardType(card, tplMaps.typeMap || {});

      if (type === CardTplModel.TYPE.PERIOD) {
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

      // 条件自减保证并发时余额不会被扣成负数或被旧值覆盖。
      const deducted = await UserCardModel.inc(
        {
          _id: card._id,
          USER_CARD_STATUS: UserCardModel.STATUS.NORMAL,
          USER_CARD_QUOTA: [">=", needTimes],
        },
        "USER_CARD_QUOTA",
        -needTimes,
      );
      if (!deducted) this.AppError("会员卡次数不足或状态已变更");

      const updatedCard = await UserCardModel.getOne({ _id: card._id });
      if (updatedCard && Number(updatedCard.USER_CARD_QUOTA) <= 0) {
        await UserCardModel.edit(
          { _id: card._id, USER_CARD_QUOTA: ["<=", 0] },
          { USER_CARD_STATUS: UserCardModel.STATUS.USED },
        );
      }

      try {
        await this._insertDeductLog({
          userId,
          cardId: card._id,
          joinId,
          meet,
          join,
          needTimes,
          coachName,
        });
      } catch (err) {
        await UserCardModel.inc({ _id: card._id }, "USER_CARD_QUOTA", needTimes);
        await UserCardModel.edit(
          { _id: card._id, USER_CARD_QUOTA: [">", 0] },
          { USER_CARD_STATUS: UserCardModel.STATUS.NORMAL },
        );
        throw err;
      }

      return { cardId: card._id, deducted: needTimes, joinId };
    } catch (err) {
      await JoinModel.edit(
        { _id: joinId, JOIN_CARD_CONSUME_STATUS: 1 },
        { JOIN_CARD_CONSUME_STATUS: 0 },
      );
      throw err;
    }
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

    // 先原子认领流水；重复取消请求无法再次进入退款流程。
    const cardLogService = new CardLogService();
    const claimed = await cardLogService.claimRefund(log._id);
    if (!claimed) return { refunded: 0 };

    const times = Number(log.CARD_LOG_TIMES) || 0;
    const cardId = log.CARD_LOG_USER_CARD_ID;
    const now = timeUtil.time();

    try {
      if (times > 0 && cardId) {
        let card = await UserCardModel.getOne({ _id: cardId });
        if (card) {
          await UserCardModel.inc({ _id: cardId }, "USER_CARD_QUOTA", times);
          if (card.USER_CARD_STATUS === UserCardModel.STATUS.USED) {
            await UserCardModel.edit(
              { _id: cardId, USER_CARD_QUOTA: [">", 0] },
              { USER_CARD_STATUS: UserCardModel.STATUS.NORMAL, USER_CARD_EDIT_TIME: now },
            );
          }
        }
      }
    } catch (err) {
      await cardLogService.releaseRefundClaim(log._id);
      throw err;
    }

    return { refunded: times, cardId };
  }

  /** 教练端：会员持卡详情（含流水） */
  async getCoachUserCardDetail(cardId) {
    if (!cardId) this.AppError("参数错误");
    await this._ensureCardCollections();

    let card = await UserCardModel.getOne({ _id: cardId });
    if (!card) this.AppError("会员卡不存在");

    const color = await this._getCardTplColor(card.USER_CARD_TPL_ID);
    const now = timeUtil.time();
    const nameMap = await this._getCategoryNameMap();
    let typeMap = {};
    let daysMap = {};
    let coverId = "";
    if (card.USER_CARD_TPL_ID) {
      const maps = await this._loadTplVisualMaps([card.USER_CARD_TPL_ID]);
      typeMap = maps.typeMap;
      daysMap = maps.daysMap;
      coverId = maps.coverMap[card.USER_CARD_TPL_ID] || "";
    }
    await this._selfHealPeriodCardRecord(card, typeMap);
    card = await UserCardModel.getOne({ _id: cardId });
    const detail = this._mapCardItem(
      card,
      now,
      color,
      nameMap,
      coverId,
      typeMap,
      daysMap,
    );

    let logs = await UserCardLogModel.getAll(
      {
        CARD_LOG_USER_CARD_ID: cardId,
        CARD_LOG_ACTION: [
          "in",
          [
            UserCardLogModel.ACTION.DEDUCT,
            UserCardLogModel.ACTION.MANUAL_ADD,
            UserCardLogModel.ACTION.MANUAL_DEDUCT,
          ],
        ],
      },
      "*",
      { CARD_LOG_ADD_TIME: "desc" },
      100,
    );

    const { usageList, usageTotal } = await this._buildUsageList(logs, detail.type);
    return {
      card: detail,
      usageList,
      usageTotal,
    };
  }

  /** 教练端：手动加次/消次/停卡/恢复 */
  async adjustCardManual(input) {
    await this._ensureCardCollections();
    const cardId = (input.cardId || "").trim();
    const action = (input.action || "").trim();
    const memo = (input.memo || "").trim();
    const operatorName = (input.operatorName || "").trim();

    if (!cardId) this.AppError("请选择会员卡");
    if (!memo) this.AppError("请填写备注");

    let card = await UserCardModel.getOne({ _id: cardId });
    if (!card) this.AppError("会员卡不存在");

    const now = timeUtil.time();
    const day = timeUtil.time("Y-M-D");

    if (action === "stop") {
      await UserCardModel.edit(
        { _id: cardId },
        { USER_CARD_STATUS: UserCardModel.STATUS.STOP, USER_CARD_EDIT_TIME: now },
      );
      return { cardId, action: "stop" };
    }

    if (action === "resume") {
      const quota = Number(card.USER_CARD_QUOTA) || 0;
      let status = UserCardModel.STATUS.NORMAL;
      if (
        card.USER_CARD_TYPE === CardTplModel.TYPE.TIMES &&
        quota <= 0 &&
        !this._isPendingActivation(card)
      ) {
        status = UserCardModel.STATUS.USED;
      }
      await UserCardModel.edit(
        { _id: cardId },
        { USER_CARD_STATUS: status, USER_CARD_EDIT_TIME: now },
      );
      return { cardId, action: "resume" };
    }

    if (card.USER_CARD_TYPE === CardTplModel.TYPE.PERIOD) {
      this.AppError("期限卡请使用停卡/恢复操作");
    }

    const times = Number(input.times) || 0;
    if (times <= 0) this.AppError("请输入有效次数");

    if (action === "add") {
      const next = (Number(card.USER_CARD_QUOTA) || 0) + times;
      const patch = {
        USER_CARD_QUOTA: next,
        USER_CARD_EDIT_TIME: now,
      };
      if (card.USER_CARD_STATUS === UserCardModel.STATUS.USED && next > 0) {
        patch.USER_CARD_STATUS = UserCardModel.STATUS.NORMAL;
      }
      await UserCardModel.edit({ _id: cardId }, patch);
      await UserCardLogModel.insert({
        CARD_LOG_USER_ID: card.USER_CARD_USER_ID,
        CARD_LOG_USER_CARD_ID: cardId,
        CARD_LOG_MEET_TITLE: "手动加次",
        CARD_LOG_MEET_TYPE_NAME: "手动调整",
        CARD_LOG_MEET_DAY: day,
        CARD_LOG_TIMES: times,
        CARD_LOG_ACTION: UserCardLogModel.ACTION.MANUAL_ADD,
        CARD_LOG_STATUS: UserCardLogModel.STATUS.VALID,
        CARD_LOG_MEMO: memo.slice(0, 50),
        CARD_LOG_OPERATOR_NAME: operatorName,
        CARD_LOG_ADD_TIME: now,
        CARD_LOG_EDIT_TIME: now,
      });
      return { cardId, action: "add", times, quota: next };
    }

    if (action === "deduct") {
      const left = Number(card.USER_CARD_QUOTA) || 0;
      if (times > left) this.AppError("剩余次数不足");
      const next = left - times;
      const patch = {
        USER_CARD_QUOTA: next,
        USER_CARD_EDIT_TIME: now,
      };
      if (next <= 0) patch.USER_CARD_STATUS = UserCardModel.STATUS.USED;
      await UserCardModel.edit({ _id: cardId }, patch);
      await UserCardLogModel.insert({
        CARD_LOG_USER_ID: card.USER_CARD_USER_ID,
        CARD_LOG_USER_CARD_ID: cardId,
        CARD_LOG_MEET_TITLE: "手动消次",
        CARD_LOG_MEET_TYPE_NAME: "手动调整",
        CARD_LOG_MEET_DAY: day,
        CARD_LOG_TIMES: times,
        CARD_LOG_ACTION: UserCardLogModel.ACTION.MANUAL_DEDUCT,
        CARD_LOG_STATUS: UserCardLogModel.STATUS.VALID,
        CARD_LOG_MEMO: memo.slice(0, 50),
        CARD_LOG_OPERATOR_NAME: operatorName,
        CARD_LOG_ADD_TIME: now,
        CARD_LOG_EDIT_TIME: now,
      });
      return { cardId, action: "deduct", times, quota: next };
    }

    this.AppError("不支持的操作");
  }
}

module.exports = UserCardService;
