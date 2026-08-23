/**
 * Notes: 会员卡模板与用户持卡
 */

const BaseAdminService = require("./base_admin_service.js");
const util = require("../../../framework/utils/util.js");
const timeUtil = require("../../../framework/utils/time_util.js");
const dbUtil = require("../../../framework/database/db_util.js");
const CardTplModel = require("../../model/card_tpl_model.js");
const UserCardModel = require("../../model/user_card_model.js");
const UserModel = require("../../model/user_model.js");
const AdminModel = require("../../model/admin_model.js");
const SetupModel = require("../../model/setup_model.js");
const CardOrderModel = require("../../model/card_order_model.js");
const UserCardService = require("../user_card_service.js");
const cardScopeUtil = require("../../utils/card_scope_util.js");
const cardCoverUtil = require("../../utils/card_cover_util.js");

const DEFAULT_TPL_COLORS = ["#F5A623", "#4A90A4", "#E57373", "#81C784"];
const CARD_COLLECTIONS = ["ax_card_tpl", "ax_user_card", "ax_user_card_log", "ax_card_order"];

class AdminCardService extends BaseAdminService {
  async _ensureCardCollections() {
    for (let cl of CARD_COLLECTIONS) {
      if (!(await dbUtil.isExistCollection(cl))) {
        await dbUtil.createCollection(cl);
      }
    }
  }

  async _safeGetAll(model, where, fields, orderBy, size = 100) {
    try {
      return await model.getAll(where, fields, orderBy, size);
    } catch (err) {
      if (
        err &&
        err.message &&
        err.message.indexOf("collection not exists") >= 0
      ) {
        await this._ensureCardCollections();
        return await model.getAll(where, fields, orderBy, size);
      }
      console.error("[AdminCardService]", model.CL, err.message);
      return [];
    }
  }

  async _safeCount(model, where) {
    try {
      return await model.count(where);
    } catch (err) {
      if (
        err &&
        err.message &&
        err.message.indexOf("collection not exists") >= 0
      ) {
        await this._ensureCardCollections();
        return await model.count(where);
      }
      return 0;
    }
  }
  _typeDesc(type) {
    return CardTplModel.TYPE_DESC[type] || "次数卡";
  }

  _formatTpl(item, nameMap = {}, meetNameMap = {}) {
    const scope = cardScopeUtil.normalizeScope(item.CARD_TPL_SCOPE);
    const coverId = cardCoverUtil.normalizeCover(item.CARD_TPL_COVER);
    return {
      ...item,
      CARD_TPL_COVER: coverId,
      coverId,
      typeDesc: this._typeDesc(item.CARD_TPL_TYPE),
      metaText: this._buildTplMeta(item),
      scope,
      scopeDesc: cardScopeUtil.buildScopeDesc(scope, nameMap, meetNameMap),
    };
  }

  /** 课程 ID → 课程名 映射（mode=meets 文案用） */
  async _getMeetNameMap() {
    try {
      const MeetModel = require("../../model/meet_model.js");
      const list = await MeetModel.getAll({}, "_id,MEET_ID,MEET_TITLE", {}, 500);
      const map = {};
      for (const m of list || []) {
        const title = m.MEET_TITLE || "";
        if (m._id) map[String(m._id)] = title;
        if (m.MEET_ID) map[String(m.MEET_ID)] = title;
      }
      return map;
    } catch (err) {
      console.error("[AdminCardService] meet map:", err.message);
      return {};
    }
  }

  async _getMeetCategoryNameMap() {
    try {
      const AdminTenantService = require("./admin_tenant_service.js");
      const store = await new AdminTenantService().getStore(this.getProjectId());
      const map = {};
      for (const c of (store && store.categories) || []) {
        if (c && c.id != null) map[String(c.id)] = c.name || String(c.id);
      }
      return map;
    } catch (err) {
      console.error("[AdminCardService] category map:", err.message);
      return {};
    }
  }

  _buildTplMeta(item) {
    const parts = [];
    if (item.CARD_TPL_DAYS) parts.push(item.CARD_TPL_DAYS + "天");
    if (item.CARD_TPL_TYPE === CardTplModel.TYPE.TIMES && item.CARD_TPL_QUOTA) {
      parts.push("额度：" + item.CARD_TPL_QUOTA + "次");
    }
    if (item.CARD_TPL_PRICE != null) {
      parts.push("售价：" + item.CARD_TPL_PRICE + "元");
    }
    return parts.join("  ");
  }

  async getCardTplList() {
    await this._ensureCardCollections();
    let list = await this._safeGetAll(
      CardTplModel,
      {},
      "*",
      { CARD_TPL_ORDER: "asc", CARD_TPL_ADD_TIME: "desc" },
      200,
    );
    const hasMeetsScope = (list || []).some((it) => {
      const s = cardScopeUtil.normalizeScope(it.CARD_TPL_SCOPE);
      return s.mode === "meets";
    });
    const [nameMap, meetNameMap] = await Promise.all([
      this._getMeetCategoryNameMap(),
      hasMeetsScope ? this._getMeetNameMap() : Promise.resolve({}),
    ]);
    return (list || []).map((item) => this._formatTpl(item, nameMap, meetNameMap));
  }

  async getCardTplDetail(id) {
    await this._ensureCardCollections();
    let item = await CardTplModel.getOne({ CARD_TPL_ID: id }, "*");
    if (!item) this.AppError("会员卡不存在");
    const scope = cardScopeUtil.normalizeScope(item.CARD_TPL_SCOPE);
    const [nameMap, meetNameMap] = await Promise.all([
      this._getMeetCategoryNameMap(),
      scope.mode === "meets" ? this._getMeetNameMap() : Promise.resolve({}),
    ]);
    return this._formatTpl(item, nameMap, meetNameMap);
  }

  async saveCardTpl(input, operatorType) {
    await this._ensureCardCollections();
    if (
      operatorType !== AdminModel.TYPE.SUPER &&
      operatorType !== AdminModel.TYPE.OWNER
    ) {
      this.AppError("仅馆主可管理会员卡");
    }

    let name = (input.name || "").trim();
    if (!name) this.AppError("请填写卡名称");

    let type = input.type === CardTplModel.TYPE.PERIOD ? "period" : "times";
    let days = Number(input.days) || 365;
    let price = Number(input.price) || 0;
    let quota = type === "period" ? 0 : Number(input.quota) || 1;
    let color =
      input.color && /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(input.color)
        ? input.color
        : DEFAULT_TPL_COLORS[0];
    let scope = cardScopeUtil.normalizeScope(input.scope);
    if (scope.mode === "categories" && !scope.categoryIds.length) {
      this.AppError("请选择适用课程分类");
    }
    if (scope.mode === "meets" && !scope.meetIds.length) {
      this.AppError("请选择适用课程");
    }
    let cover = cardCoverUtil.normalizeCover(input.cover);

    let data = {
      CARD_TPL_NAME: name,
      CARD_TPL_TYPE: type,
      CARD_TPL_DAYS: days,
      CARD_TPL_PRICE: price,
      CARD_TPL_QUOTA: quota,
      CARD_TPL_COLOR: color,
      CARD_TPL_COVER: cover,
      CARD_TPL_SCOPE: scope,
      CARD_TPL_EDIT_TIME: timeUtil.time(),
    };

    if (input.id) {
      let old = await CardTplModel.getOne({ CARD_TPL_ID: input.id }, "_id");
      if (!old) this.AppError("会员卡不存在");
      await CardTplModel.edit({ CARD_TPL_ID: input.id }, data);
      return { id: input.id };
    }

    data.CARD_TPL_STATUS = 1;
    data.CARD_TPL_ORDER = Number(input.order) || 9999;
    let id = await CardTplModel.insert(data);
    return { id };
  }

  async delCardTpl(id, operatorType) {
    await this._ensureCardCollections();
    if (
      operatorType !== AdminModel.TYPE.SUPER &&
      operatorType !== AdminModel.TYPE.OWNER
    ) {
      this.AppError("仅馆主可管理会员卡");
    }
    await CardTplModel.del({ CARD_TPL_ID: id });
  }

  async _buildMemberCardGroupList(cards, { search, page = 1, size = 50 } = {}) {
    let groupMap = {};
    for (let c of cards || []) {
      let uid = (c.USER_CARD_USER_ID || "").trim();
      if (!uid) continue;
      if (!groupMap[uid]) {
        groupMap[uid] = { userId: uid, cards: [], latestAddTime: 0 };
      }
      groupMap[uid].cards.push(c);
      let addTime = Number(c.USER_CARD_ADD_TIME) || 0;
      if (addTime > groupMap[uid].latestAddTime) {
        groupMap[uid].latestAddTime = addTime;
      }
    }

    let userIds = Object.keys(groupMap);
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

    const cardService = new UserCardService();
    const nameMap = await cardService._getCategoryNameMap();
    const now = timeUtil.time();
    const tplIds = [
      ...new Set((cards || []).map((c) => c.USER_CARD_TPL_ID).filter(Boolean)),
    ];
    let colorMap = {};
    let typeMap = {};
    let daysMap = {};
    if (tplIds.length) {
      const maps = await cardService._loadTplVisualMaps(tplIds);
      colorMap = maps.colorMap;
      typeMap = maps.typeMap;
      daysMap = maps.daysMap;
    }

    let list = userIds
      .map((uid) => {
        let g = groupMap[uid];
        let u = userMap[uid] || {};
        let mappedCards = g.cards
          .map((c) => {
            let item = cardService._mapCardItem(
              c,
              now,
              colorMap[c.USER_CARD_TPL_ID],
              nameMap,
              "",
              typeMap,
              daysMap,
            );
            let addTime = Number(c.USER_CARD_ADD_TIME) || 0;
            return {
              id: item.id,
              name: item.name,
              typeLabel: item.typeLabel,
              price: item.price,
              color: item.color,
              balanceText: item.balanceText,
              statusLabel: item.statusLabel,
              addTime,
              addTimeDesc: timeUtil.timestamp2Time(addTime, "M-D"),
            };
          })
          .sort((a, b) => b.addTime - a.addTime);

        let names = mappedCards.map((c) => c.name);
        let uniqueNames = [...new Set(names)];
        let cardSummary =
          uniqueNames.length <= 2
            ? uniqueNames.join("、")
            : uniqueNames.slice(0, 2).join("、") +
              "等" +
              mappedCards.length +
              "张";

        let cardCount = mappedCards.length;
        return {
          userId: uid,
          USER_NAME: u.USER_NAME || "未命名会员",
          USER_MOBILE: u.USER_MOBILE || "",
          USER_PIC: u.USER_PIC || "",
          cardCount,
          newCardCount: cardCount,
          latestAddTime: g.latestAddTime,
          addTimeDesc: timeUtil.timestamp2Time(g.latestAddTime, "Y-M-D"),
          cardSummary,
          cards: mappedCards,
        };
      })
      .sort((a, b) => b.latestAddTime - a.latestAddTime);

    if (util.isDefined(search) && search) {
      let kw = String(search).trim().toLowerCase();
      list = list.filter(
        (item) =>
          (item.USER_NAME || "").toLowerCase().includes(kw) ||
          (item.USER_MOBILE || "").includes(kw) ||
          (item.cardSummary || "").toLowerCase().includes(kw),
      );
    }

    let totalMembers = list.length;
    let totalCards = (cards || []).length;
    let start = (page - 1) * size;
    let pageList = list.slice(start, start + size);

    return {
      totalMembers,
      totalCards,
      list: pageList,
      total: totalMembers,
      page,
      size,
      count: pageList.length,
    };
  }

  async getMonthNewCardMembers({
    search,
    page = 1,
    size = 50,
  } = {}) {
    await this._ensureCardCollections();
    let monthStart = timeUtil.time2Timestamp(
      timeUtil.time("Y-M") + "-01 00:00:00",
    );

    let cards = await this._safeGetAll(
      UserCardModel,
      { USER_CARD_ADD_TIME: [">=", monthStart] },
      "*",
      { USER_CARD_ADD_TIME: "desc" },
      5000,
    );

    let month = timeUtil.time("Y-M");
    return {
      month,
      monthText: month.replace("-", "年") + "月",
      ...(await this._buildMemberCardGroupList(cards || [], {
        search,
        page,
        size,
      })),
    };
  }

  async getCardHolderMembers({
    search,
    page = 1,
    size = 50,
  } = {}) {
    await this._ensureCardCollections();
    let cards = await this._safeGetAll(
      UserCardModel,
      { USER_CARD_STATUS: UserCardModel.STATUS.NORMAL },
      "*",
      { USER_CARD_ADD_TIME: "desc" },
      10000,
    );
    return this._buildMemberCardGroupList(cards || [], { search, page, size });
  }

  async getMemberList({
    search,
    cardFilter = "all",
    page = 1,
    size = 20,
  }) {
    await this._ensureCardCollections();

    let where = {};
    where.and = { _pid: this.getProjectId() };

    if (util.isDefined(search) && search) {
      where.or = [
        { USER_NAME: ["like", search] },
        { USER_MOBILE: ["like", search] },
      ];
    }

    let allUsers = await UserModel.getAll(
      where,
      "*",
      { USER_ADD_TIME: "desc" },
      2000,
    );
    let list = allUsers || [];
    let userIds = list.map((u) => u.USER_MINI_OPENID).filter(Boolean);

    let cardMap = {};
    if (userIds.length) {
      let cards = await this._safeGetAll(
        UserCardModel,
        { USER_CARD_USER_ID: ["in", userIds] },
        "*",
        { USER_CARD_ADD_TIME: "desc" },
        10000,
      );
      for (let c of cards || []) {
        if (!cardMap[c.USER_CARD_USER_ID]) cardMap[c.USER_CARD_USER_ID] = [];
        cardMap[c.USER_CARD_USER_ID].push(c);
      }
    }

    let enriched = list.map((u) => {
      let uid = u.USER_MINI_OPENID;
      let userCards = cardMap[uid] || [];
      let activeCards = userCards.filter(
        (c) => c.USER_CARD_STATUS === UserCardModel.STATUS.NORMAL,
      );
      let stoppedCards = userCards.filter(
        (c) => c.USER_CARD_STATUS === UserCardModel.STATUS.STOP,
      );
      let cardTag = "none";
      if (activeCards.length) cardTag = "has";
      else if (stoppedCards.length) cardTag = "stop";
      return {
        ...u,
        cardTag,
        activeCardCount: activeCards.length,
        cardSummary:
          activeCards.length > 0
            ? activeCards[0].USER_CARD_NAME
            : stoppedCards.length
              ? "已停卡"
              : "",
      };
    });

    if (cardFilter === "has") {
      enriched = enriched.filter((u) => u.cardTag === "has");
    } else if (cardFilter === "none") {
      enriched = enriched.filter((u) => u.cardTag === "none");
    } else if (cardFilter === "stop") {
      enriched = enriched.filter((u) => u.cardTag === "stop");
    }

    let total = enriched.length;
    let start = (page - 1) * size;
    let pageList = enriched.slice(start, start + size);

    return {
      list: pageList,
      total,
      page,
      size,
      count: pageList.length,
    };
  }

  async issueUserCard(input) {
    await this._ensureCardCollections();
    let userId = (input.userId || "").trim();
    if (!userId) this.AppError("请选择会员");

    let user = await UserModel.getOne({ USER_MINI_OPENID: userId }, "USER_NAME");
    if (!user) this.AppError("会员不存在");

    let tpl = null;
    if (input.tplId) {
      tpl = await CardTplModel.getOne({ CARD_TPL_ID: input.tplId }, "*");
    }
    if (!tpl) this.AppError("请选择会员卡模板");

    let name = (tpl.CARD_TPL_NAME || "").trim();
    if (!name) this.AppError("卡模板名称无效");

    let type = tpl.CARD_TPL_TYPE;
    let days = Number(input.days) || Number(tpl.CARD_TPL_DAYS) || 0;
    if (days <= 0) this.AppError("请先在卡模板中配置有效期天数");
    let price = Number(tpl.CARD_TPL_PRICE) || 0;
    let quota =
      type === CardTplModel.TYPE.PERIOD
        ? 0
        : Number(tpl.CARD_TPL_QUOTA) || 1;

    let activate = (input.activate || UserCardModel.ACTIVATE.IMMEDIATE).trim();
    const validActivate = Object.values(UserCardModel.ACTIVATE);
    if (!validActivate.includes(activate)) {
      activate = UserCardModel.ACTIVATE.IMMEDIATE;
    }

    let now = timeUtil.time();
    let startTime = 0;
    let endTime = 0;
    if (activate === UserCardModel.ACTIVATE.IMMEDIATE) {
      startTime = now;
      endTime = now + days * 86400 * 1000;
    }

    let scope = cardScopeUtil.normalizeScope(tpl.CARD_TPL_SCOPE);

    let data = {
      USER_CARD_USER_ID: userId,
      USER_CARD_TPL_ID: tpl.CARD_TPL_ID,
      USER_CARD_NAME: name,
      USER_CARD_TYPE: type,
      USER_CARD_DAYS: days,
      USER_CARD_PRICE: price,
      USER_CARD_PAID_FEE: Math.max(0, Number(order.ORDER_PAY_FEE) || 0),
      USER_CARD_QUOTA: quota,
      USER_CARD_QUOTA_INIT: quota,
      USER_CARD_ACTIVATE: activate,
      USER_CARD_SCOPE: scope,
      USER_CARD_COACH_ID: input.coachId || "",
      USER_CARD_COACH_NAME: input.coachName || "",
      USER_CARD_MEMO: (input.memo || "").trim().slice(0, 50),
      USER_CARD_STATUS: UserCardModel.STATUS.NORMAL,
      USER_CARD_START_TIME: startTime,
      USER_CARD_END_TIME: endTime,
    };

    let id = await UserCardModel.insert(data);
    return { id, userName: user.USER_NAME || "" };
  }

  async getUserCardList(userId) {
    await this._ensureCardCollections();
    userId = (userId || "").trim();
    if (!userId) this.AppError("请选择会员");

    let user = await UserModel.getOne({ USER_MINI_OPENID: userId }, "USER_NAME");
    if (!user) this.AppError("会员不存在");

    let cards = await this._safeGetAll(
      UserCardModel,
      { USER_CARD_USER_ID: userId },
      "*",
      { USER_CARD_ADD_TIME: "desc" },
      100,
    );

    const tplIds = [
      ...new Set((cards || []).map((c) => c.USER_CARD_TPL_ID).filter(Boolean)),
    ];
    let colorMap = {};
    let coverMap = {};
    let typeMap = {};
    let daysMap = {};
    if (tplIds.length) {
      const maps = await new UserCardService()._loadTplVisualMaps(tplIds);
      colorMap = maps.colorMap;
      coverMap = maps.coverMap;
      typeMap = maps.typeMap;
      daysMap = maps.daysMap;
    }

    const cardService = new UserCardService();
    const now = timeUtil.time();
    const nameMap = await cardService._getCategoryNameMap();
    for (let c of cards || []) {
      await cardService._selfHealPeriodCardRecord(c, typeMap);
    }
    const list = (cards || []).map((c) =>
      cardService._mapCardItem(
        c,
        now,
        colorMap[c.USER_CARD_TPL_ID],
        nameMap,
        coverMap[c.USER_CARD_TPL_ID],
        typeMap,
        daysMap,
      ),
    );

    return {
      userId,
      userName: user.USER_NAME || "",
      list,
      total: list.length,
    };
  }

  /** 教练代约：某会员在某课程下可用的会员卡（含适用范围过滤） */
  async getUserJoinCardOptions(userId, meetId, timeMark = "") {
    await this._ensureCardCollections();
    userId = (userId || "").trim();
    meetId = (meetId || "").trim();
    if (!userId) this.AppError("请选择会员");
    if (!meetId) this.AppError("请先选择课程");

    const MeetModel = require("../../model/meet_model.js");
    const meet = await MeetModel.getOne(
      { _id: meetId },
      "MEET_STYLE_SET,MEET_TYPE_ID,MEET_TYPE_NAME",
    );
    if (!meet) this.AppError("课程不存在");

    const cardService = new UserCardService();
    const needTimes = cardService._getMeetCardTimes(meet);
    const meetDay = cardService._meetDayFromTimeMark(timeMark);
    const list = await cardService._listUsableCards(
      userId,
      needTimes,
      meet,
      meetDay,
    );
    return { needTimes, list, meetDay };
  }

  async getUserCardDetail(cardId) {
    const cardService = new UserCardService();
    return await cardService.getCoachUserCardDetail(cardId);
  }

  async adjustUserCard(input) {
    const cardService = new UserCardService();
    return await cardService.adjustCardManual(input);
  }

  /** 删除会员持卡（误发/测试卡等，保留流水记录） */
  async deleteUserCard(cardId) {
    await this._ensureCardCollections();
    cardId = (cardId || "").trim();
    if (!cardId) this.AppError("请选择会员卡");

    const card = await UserCardModel.getOne({ _id: cardId }, "_id");
    if (!card) this.AppError("会员卡不存在");

    await UserCardModel.del({ _id: cardId });
    return { cardId };
  }

  async getCardStats() {
    await this._ensureCardCollections();
    let totalCardTpls = await this._safeCount(CardTplModel, {});
    let monthStart = timeUtil.time2Timestamp(
      timeUtil.time("Y-M") + "-01 00:00:00",
    );
    let newCardTpls = await this._safeCount(CardTplModel, {
      CARD_TPL_ADD_TIME: [">=", monthStart],
    });
    let totalCards = await this._safeCount(UserCardModel, {
      USER_CARD_STATUS: UserCardModel.STATUS.NORMAL,
    });
    let newCards = await this._safeCount(UserCardModel, {
      USER_CARD_ADD_TIME: [">=", monthStart],
    });
    let now = timeUtil.time();
    let expiringRows = await this._safeGetAll(
      UserCardModel,
      {
        USER_CARD_STATUS: UserCardModel.STATUS.NORMAL,
        USER_CARD_END_TIME: [">", now],
      },
      "USER_CARD_END_TIME",
      {},
      5000,
    );
    let expiringSoon = (expiringRows || []).filter(
      (c) => c.USER_CARD_END_TIME <= now + 86400 * 7 * 1000,
    ).length;
    let lowTimes = await this._safeCount(UserCardModel, {
      USER_CARD_STATUS: UserCardModel.STATUS.NORMAL,
      USER_CARD_TYPE: CardTplModel.TYPE.TIMES,
      USER_CARD_QUOTA: ["<=", 3],
    });
    let holderRows = await this._safeGetAll(
      UserCardModel,
      { USER_CARD_STATUS: UserCardModel.STATUS.NORMAL },
      "USER_CARD_USER_ID",
      {},
      10000,
    );
    let cardHolderSet = new Set();
    for (let c of holderRows || []) {
      if (c.USER_CARD_USER_ID) cardHolderSet.add(c.USER_CARD_USER_ID);
    }
    let cardHolderCount = cardHolderSet.size;
    return {
      totalCardTpls,
      newCardTpls,
      totalCards,
      newCards,
      cardHolderCount,
      expiringSoon,
      lowTimes,
    };
  }

  async getCardMarketing() {
    await this._ensureCardCollections();
    const setup = await new (require("../home_service.js"))().getSetup(
      "SETUP_CARD_PURCHASE_ENABLED,SETUP_CARD_PURCHASE_GUIDE,SETUP_CARD_PURCHASE_CONTACT",
    );
    const cards = await this.getCardTplList();
    const saleCards = (cards || []).map((card) => ({
      id: card.CARD_TPL_ID,
      name: card.CARD_TPL_NAME || "未命名会员卡",
      typeDesc: card.typeDesc || "会员卡",
      price: Number(card.CARD_TPL_PRICE) || 0,
      saleEnabled: Number(card.CARD_TPL_SALE_STATUS) === 1,
      salePriceFee: Number(card.CARD_TPL_SALE_PRICE_FEE) || 0,
      saleDesc: card.CARD_TPL_SALE_DESC || "",
      color: card.CARD_TPL_COLOR || DEFAULT_TPL_COLORS[0],
    }));
    return {
      enabled: Number(setup && setup.SETUP_CARD_PURCHASE_ENABLED) === 1,
      guide: (setup && setup.SETUP_CARD_PURCHASE_GUIDE) || "",
      contact: (setup && setup.SETUP_CARD_PURCHASE_CONTACT) || "",
      cards: saleCards,
      activeCount: saleCards.filter((item) => item.saleEnabled).length,
    };
  }

  async saveCardMarketing(input, operatorType) {
    if (
      operatorType !== AdminModel.TYPE.SUPER &&
      operatorType !== AdminModel.TYPE.OWNER
    ) {
      this.AppError("仅馆主可修改购卡设置");
    }
    await this._ensureCardCollections();
    await new (require("../home_service.js"))().getSetup("_id");

    const enabled = input.enabled ? 1 : 0;
    const guide = String(input.guide || "").trim().slice(0, 300);
    const contact = String(input.contact || "").trim().slice(0, 100);
    const rawCards = Array.isArray(input.cards) ? input.cards : [];
    const cardMap = new Map(
      (await this.getCardTplList()).map((card) => [String(card.CARD_TPL_ID), card]),
    );

    for (const item of rawCards) {
      const id = String((item && item.id) || "").trim();
      if (!id || !cardMap.has(id)) continue;
      const saleFee = Math.max(0, Math.round(Number(item.salePriceFee) || 0));
      await CardTplModel.edit(
        { CARD_TPL_ID: id },
        {
          CARD_TPL_SALE_STATUS: item.saleEnabled ? 1 : 0,
          CARD_TPL_SALE_PRICE_FEE: saleFee,
          CARD_TPL_SALE_DESC: String(item.saleDesc || "").trim().slice(0, 80),
          CARD_TPL_EDIT_TIME: timeUtil.time(),
        },
      );
    }

    await SetupModel.edit({}, {
      SETUP_CARD_PURCHASE_ENABLED: enabled,
      SETUP_CARD_PURCHASE_GUIDE: guide,
      SETUP_CARD_PURCHASE_CONTACT: contact,
      SETUP_EDIT_TIME: timeUtil.time(),
    });
    return await this.getCardMarketing();
  }

  // ============ 购卡订单：列表 / 确认发卡 / 关闭 ============

  /**
   * 购卡订单列表（教练可看、馆主可处理）
   * @param {*} param0 status 可选筛选；不传默认全部
   */
  async getCardOrderList({ status, page = 1, size = 20, oldTotal = 0 } = {}) {
    await this._ensureCardCollections();
    let where = {};
    if (status !== undefined && status !== "" && status !== null) {
      where.ORDER_STATUS = Number(status);
    }
    let result = await CardOrderModel.getList(
      where,
      "*",
      { ORDER_ADD_TIME: "desc" },
      Number(page) || 1,
      Number(size) || 20,
      true,
      Number(oldTotal) || 0,
    );
    const STATUS_DESC = {
      [CardOrderModel.STATUS.PENDING]: "待确认",
      [CardOrderModel.STATUS.PAID]: "已付待发",
      [CardOrderModel.STATUS.CONFIRMING]: "确认中",
      [CardOrderModel.STATUS.ISSUED]: "已发卡",
      [CardOrderModel.STATUS.REFUNDING]: "退款中",
      [CardOrderModel.STATUS.REFUNDED]: "已退款",
      [CardOrderModel.STATUS.CLOSED]: "已关闭",
    };
    result.list = (result.list || []).map((o) => ({
      ...o,
      statusDesc: STATUS_DESC[o.ORDER_STATUS] || "未知",
      payFeeYuan: ((Number(o.ORDER_PAY_FEE) || 0) / 100).toFixed(2),
      timeDesc: timeUtil.timestamp2Time(o.ORDER_ADD_TIME, "Y-M-D h:m"),
    }));
    return result;
  }

  /**
   * 确认收款并发卡（仅馆主）——幂等、防重发
   * 严格顺序见 f7-card-purchase.md §6：先 CAS 抢状态，再按订单幂等发卡。
   */
  async confirmCardOrder(orderId, operator) {
    await this._ensureCardCollections();
    orderId = (orderId || "").trim();
    if (!orderId) this.AppError("订单不存在");

    // 1. 读订单并校验状态（本租户内，_pid 由框架注入）
    let order = await CardOrderModel.getOne({ ORDER_ID: orderId }, "*");
    if (!order) this.AppError("订单不存在");

    // 幂等：已发卡直接返回，不重复处理
    if (order.ORDER_STATUS === CardOrderModel.STATUS.ISSUED) {
      return { ok: true, alreadyIssued: true, userCardId: order.ORDER_USER_CARD_ID };
    }
    if (order.ORDER_STATUS === CardOrderModel.STATUS.CLOSED) {
      this.AppError("该申请已关闭，无法发卡");
    }

    let now = timeUtil.time();

    // 2. 原子抢占 PENDING → CONFIRMING（CAS：edit 返回受影响行数）
    let seized = await CardOrderModel.edit(
      { ORDER_ID: orderId, ORDER_STATUS: CardOrderModel.STATUS.PENDING },
      {
        ORDER_STATUS: CardOrderModel.STATUS.CONFIRMING,
        ORDER_CONFIRMED_BY_ID: (operator && operator._id) || "",
        ORDER_CONFIRMED_BY_NAME: (operator && operator.ADMIN_NAME) || "",
        ORDER_CONFIRMED_TIME: now,
        ORDER_EDIT_TIME: now,
      },
    );
    if (!seized) {
      // 没抢到：要么并发有人在处理（CONFIRMING），要么状态已变
      this.AppError("订单正在处理中，请稍后刷新查看");
    }

    try {
      // 3. 幂等查重：该订单是否已发过卡
      let existed = await UserCardModel.getOne(
        { USER_CARD_ORDER_ID: orderId },
        "_id",
      );
      let userCardId;
      if (existed) {
        // 已有卡（历史残留/重试），只回填不重发
        userCardId = existed._id;
      } else {
        // 4. 按订单快照发卡
        userCardId = await this._createUserCardFromOrder(order, now);
      }

      // 5. CONFIRMING → ISSUED，回填卡 ID
      await CardOrderModel.edit(
        { ORDER_ID: orderId },
        {
          ORDER_STATUS: CardOrderModel.STATUS.ISSUED,
          ORDER_USER_CARD_ID: userCardId,
          ORDER_EDIT_TIME: timeUtil.time(),
        },
      );
      return { ok: true, userCardId };
    } catch (err) {
      // 6. 任一步失败：回滚到 PENDING，记录原因，可重试（绝不误标 ISSUED）
      await CardOrderModel.edit(
        { ORDER_ID: orderId },
        {
          ORDER_STATUS: CardOrderModel.STATUS.PENDING,
          ORDER_CLOSE_REASON: "发卡失败：" + ((err && err.message) || "未知错误"),
          ORDER_EDIT_TIME: timeUtil.time(),
        },
      );
      throw err;
    }
  }

  /**
   * 按订单快照创建一张用户卡，返回卡 _id。
   * 只吃订单快照，不重新读模板原价——保证会员付款那一刻的承诺。
   */
  async _createUserCardFromOrder(order, now) {
    const snap = order.ORDER_TPL_SNAPSHOT || {};
    // 快照结构见 card_purchase_service.getShop()：{id,name,type,days,quota,...}
    let type = snap.type || CardTplModel.TYPE.TIMES;
    let days = Number(snap.days) || 0;
    if (days <= 0) this.AppError("卡有效期无效，请检查套餐配置");
    let quota =
      type === CardTplModel.TYPE.PERIOD ? 0 : Number(snap.quota) || 1;

    // 激活方式：快照带则用，否则立即激活
    let activate = snap.activate || UserCardModel.ACTIVATE.IMMEDIATE;
    const validActivate = Object.values(UserCardModel.ACTIVATE);
    if (!validActivate.includes(activate)) {
      activate = UserCardModel.ACTIVATE.IMMEDIATE;
    }

    let startTime = 0;
    let endTime = 0;
    if (activate === UserCardModel.ACTIVATE.IMMEDIATE) {
      startTime = now;
      endTime = now + days * 86400 * 1000;
    }

    // 适用范围：优先快照 scope，否则全馆
    let scope = cardScopeUtil.normalizeScope(snap.scope || { mode: "all" });

    // 价格：沿用既有「元」口径写 USER_CARD_PRICE，保证与现有收入报表一致。
    // 订单实收（分）另存 USER_CARD_ORDER_ID 关联，未来支付版再切真实成交额字段。
    let price = Math.round((Number(order.ORDER_PAY_FEE) || 0) / 100);

    let data = {
      USER_CARD_USER_ID: order.ORDER_USER_ID,
      USER_CARD_TPL_ID: order.ORDER_TPL_ID,
      USER_CARD_NAME: order.ORDER_TPL_NAME || snap.name || "会员卡",
      USER_CARD_TYPE: type,
      USER_CARD_DAYS: days,
      USER_CARD_PRICE: price,
      USER_CARD_QUOTA: quota,
      USER_CARD_QUOTA_INIT: quota,
      USER_CARD_ACTIVATE: activate,
      USER_CARD_SCOPE: scope,
      USER_CARD_ORDER_ID: order.ORDER_ID,
      USER_CARD_MEMO: "购卡申请确认",
      USER_CARD_STATUS: UserCardModel.STATUS.NORMAL,
      USER_CARD_START_TIME: startTime,
      USER_CARD_END_TIME: endTime,
    };
    return await UserCardModel.insert(data);
  }

  /**
   * 微信支付成功后自动发卡（由支付回调触发，无操作人）。
   * 与人工确认共用发卡核心 _createUserCardFromOrder，幂等三要素同样成立：
   *   订单号唯一 + 状态 CAS + USER_CARD_ORDER_ID 查重。
   * 状态流转：PENDING/PAID → CONFIRMING → ISSUED。
   * 回调可能重放，本方法必须可重复安全调用。
   * @param {*} notify 归一化回调 { transactionId, totalFee, payTime }
   * @returns { ok, userCardId, alreadyIssued? }
   */
  async autoIssueByPay(orderId, notify) {
    await this._ensureCardCollections();
    orderId = (orderId || "").trim();
    if (!orderId) this.AppError("订单不存在");
    notify = notify || {};

    let order = await CardOrderModel.getOne({ ORDER_ID: orderId }, "*");
    if (!order) this.AppError("订单不存在");

    // 幂等：已发卡直接返回（回调重放）
    if (order.ORDER_STATUS === CardOrderModel.STATUS.ISSUED) {
      return { ok: true, alreadyIssued: true, userCardId: order.ORDER_USER_CARD_ID };
    }
    if (order.ORDER_STATUS === CardOrderModel.STATUS.CLOSED) {
      this.AppError("订单已关闭，无法发卡");
    }

    let now = timeUtil.time();

    // 抢占 PENDING 或 PAID → CONFIRMING，并落库支付信息。
    // 用 in 匹配两种可入状态，CAS 保证并发/重放下只有一次抢到。
    let payFields = {
      ORDER_TRANSACTION_ID: notify.transactionId || order.ORDER_TRANSACTION_ID || "",
      ORDER_PAY_TIME: notify.payTime || order.ORDER_PAY_TIME || now,
    };
    let seized = await CardOrderModel.edit(
      {
        ORDER_ID: orderId,
        ORDER_STATUS: ["in", [CardOrderModel.STATUS.PENDING, CardOrderModel.STATUS.PAID]],
      },
      Object.assign(
        {
          ORDER_STATUS: CardOrderModel.STATUS.CONFIRMING,
          ORDER_EDIT_TIME: now,
        },
        payFields,
      ),
    );
    if (!seized) {
      // 没抢到：并发的另一次回调正在处理，或状态已推进。视为成功交由对方完成。
      return { ok: true, inProgress: true };
    }

    try {
      let existed = await UserCardModel.getOne({ USER_CARD_ORDER_ID: orderId }, "_id");
      let userCardId = existed
        ? existed._id
        : await this._createUserCardFromOrder(order, now);

      await CardOrderModel.edit(
        { ORDER_ID: orderId },
        {
          ORDER_STATUS: CardOrderModel.STATUS.ISSUED,
          ORDER_USER_CARD_ID: userCardId,
          ORDER_EDIT_TIME: timeUtil.time(),
        },
      );
      return { ok: true, userCardId };
    } catch (err) {
      // 已收款但发卡失败：回滚到 PAID（钱已到，绝不退回 PENDING 丢失支付事实），
      // 记录原因，馆主可在待办里人工确认补发。
      await CardOrderModel.edit(
        { ORDER_ID: orderId },
        Object.assign(
          {
            ORDER_STATUS: CardOrderModel.STATUS.PAID,
            ORDER_CLOSE_REASON: "支付成功但发卡失败：" + ((err && err.message) || "未知错误"),
            ORDER_EDIT_TIME: timeUtil.time(),
          },
          payFields,
        ),
      );
      throw err;
    }
  }

  /**
   * 退款（仅馆主）——微信支付且已发卡的订单可退。
   * 严格顺序（防资损）：先 CAS 抢 ISSUED→REFUNDING，再校验卡未使用，
   * 再调微信退款，成功后停卡并落 REFUNDED；任一步失败回滚到 ISSUED。
   * outRefundNo 由订单号派生（幂等键），重复退不会多退。
   * @returns { ok, refundId, refundFee }
   */
  async refundCardOrder(orderId, reason, operator) {
    await this._ensureCardCollections();
    orderId = (orderId || "").trim();
    reason = (reason || "").trim().slice(0, 100);
    if (!orderId) this.AppError("订单不存在");
    if (!reason) this.AppError("请填写退款原因");

    let order = await CardOrderModel.getOne({ ORDER_ID: orderId }, "*");
    if (!order) this.AppError("订单不存在");

    // 幂等：已退款直接返回
    if (order.ORDER_STATUS === CardOrderModel.STATUS.REFUNDED) {
      return { ok: true, alreadyRefunded: true, refundId: order.ORDER_REFUND_ID };
    }
    // 仅微信支付可原路退款
    if (order.ORDER_PAY_TYPE !== CardOrderModel.PAY_TYPE.WECHAT) {
      this.AppError("非微信支付订单请线下退款，系统不代扣");
    }
    if (order.ORDER_STATUS !== CardOrderModel.STATUS.ISSUED) {
      this.AppError("仅已发卡的订单可退款");
    }

    // 1. 校验卡未被使用（已用过则拒绝，须先人工处理消费争议）
    let card = order.ORDER_USER_CARD_ID
      ? await UserCardModel.getOne({ _id: order.ORDER_USER_CARD_ID }, "*")
      : null;
    if (card && this._isCardUsed(card)) {
      this.AppError("该卡已产生使用记录，不能整单退款，请先线下核算");
    }

    let now = timeUtil.time();

    // 2. CAS 抢占 ISSUED → REFUNDING（防并发/重复退款）
    let seized = await CardOrderModel.edit(
      { ORDER_ID: orderId, ORDER_STATUS: CardOrderModel.STATUS.ISSUED },
      {
        ORDER_STATUS: CardOrderModel.STATUS.REFUNDING,
        ORDER_REFUND_REASON: reason,
        ORDER_REFUND_BY_ID: (operator && operator._id) || "",
        ORDER_REFUND_BY_NAME: (operator && operator.ADMIN_NAME) || "",
        ORDER_EDIT_TIME: now,
      },
    );
    if (!seized) this.AppError("订单正在处理中，请稍后刷新查看");

    try {
      // 3. 发起微信退款（幂等键：退款单号由订单号派生）
      const outRefundNo = "RF" + order.ORDER_ID;
      const CardPayService = require("../card_pay_service.js");
      const refund = await CardPayService.refund(
        order,
        outRefundNo,
        order.ORDER_PAY_FEE,
        reason,
      );

      // 4. 退款成功 → 停卡（保留记录不删，便于追溯），订单落 REFUNDED
      if (card) {
        await UserCardModel.edit(
          { _id: card._id, USER_CARD_STATUS: UserCardModel.STATUS.NORMAL },
          {
            USER_CARD_STATUS: UserCardModel.STATUS.STOP,
            USER_CARD_MEMO: "购卡退款停用：" + reason,
            USER_CARD_EDIT_TIME: timeUtil.time(),
          },
        );
      }

      await CardOrderModel.edit(
        { ORDER_ID: orderId },
        {
          ORDER_STATUS: CardOrderModel.STATUS.REFUNDED,
          ORDER_REFUND_ID: refund.refundId,
          ORDER_REFUND_FEE: refund.refundFee,
          ORDER_REFUND_TIME: timeUtil.time(),
          ORDER_EDIT_TIME: timeUtil.time(),
        },
      );
      return { ok: true, refundId: refund.refundId, refundFee: refund.refundFee };
    } catch (err) {
      // 5. 退款失败：回滚到 ISSUED（钱未退、卡仍有效），记录原因可重试
      await CardOrderModel.edit(
        { ORDER_ID: orderId },
        {
          ORDER_STATUS: CardOrderModel.STATUS.ISSUED,
          ORDER_REFUND_REASON: "退款失败：" + ((err && err.message) || "未知错误"),
          ORDER_EDIT_TIME: timeUtil.time(),
        },
      );
      throw err;
    }
  }

  /**
   * 卡是否已产生使用（判据保守，宁可拦下交人工，不误退已用卡）：
   *   - 次数卡：剩余次数少于初始 = 已消耗过 → 已使用
   *   - 期限卡：已激活起算且超过无条件退款宽限期(24h) → 视为已使用
   * 期限卡刚发卡即激活(immediate)，24h 宽限避免「发出即锁死不能退」。
   */
  _isCardUsed(card) {
    if (!card) return false;
    if (
      card.USER_CARD_TYPE === CardTplModel.TYPE.TIMES &&
      Number(card.USER_CARD_QUOTA) < Number(card.USER_CARD_QUOTA_INIT)
    ) {
      return true;
    }
    if (card.USER_CARD_TYPE === CardTplModel.TYPE.PERIOD) {
      const start = Number(card.USER_CARD_START_TIME) || 0;
      const GRACE_MS = 24 * 60 * 60 * 1000;
      if (start > 0 && timeUtil.time() - start > GRACE_MS) return true;
    }
    return false;
  }

  /** 关闭/拒绝购卡申请（仅馆主，需填原因） */
  async closeCardOrder(orderId, reason, operator) {
    await this._ensureCardCollections();
    orderId = (orderId || "").trim();
    reason = (reason || "").trim().slice(0, 100);
    if (!orderId) this.AppError("订单不存在");
    if (!reason) this.AppError("请填写关闭原因");

    let order = await CardOrderModel.getOne({ ORDER_ID: orderId }, "ORDER_STATUS");
    if (!order) this.AppError("订单不存在");
    if (order.ORDER_STATUS === CardOrderModel.STATUS.ISSUED) {
      this.AppError("订单已发卡，不能关闭");
    }
    // 仅允许从 PENDING 关闭（CONFIRMING 说明正在发卡，不介入）
    let updated = await CardOrderModel.edit(
      { ORDER_ID: orderId, ORDER_STATUS: CardOrderModel.STATUS.PENDING },
      {
        ORDER_STATUS: CardOrderModel.STATUS.CLOSED,
        ORDER_CLOSE_REASON: reason,
        ORDER_CONFIRMED_BY_ID: (operator && operator._id) || "",
        ORDER_CONFIRMED_BY_NAME: (operator && operator.ADMIN_NAME) || "",
        ORDER_EDIT_TIME: timeUtil.time(),
      },
    );
    if (!updated) this.AppError("订单状态已变化，请刷新后重试");
    return { ok: true };
  }
}

module.exports = AdminCardService;
