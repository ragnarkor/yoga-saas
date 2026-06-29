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
const UserCardService = require("../user_card_service.js");
const cardScopeUtil = require("../../utils/card_scope_util.js");

const DEFAULT_TPL_COLORS = ["#F5A623", "#4A90A4", "#E57373", "#81C784"];
const CARD_COLLECTIONS = ["ax_card_tpl", "ax_user_card", "ax_user_card_log"];

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

  _formatTpl(item, nameMap = {}) {
    const scope = cardScopeUtil.normalizeScope(item.CARD_TPL_SCOPE);
    return {
      ...item,
      typeDesc: this._typeDesc(item.CARD_TPL_TYPE),
      metaText: this._buildTplMeta(item),
      scope,
      scopeDesc: cardScopeUtil.buildScopeDesc(scope, nameMap),
    };
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
    const nameMap = await this._getMeetCategoryNameMap();
    return (list || []).map((item) => this._formatTpl(item, nameMap));
  }

  async getCardTplDetail(id) {
    await this._ensureCardCollections();
    let item = await CardTplModel.getOne({ CARD_TPL_ID: id }, "*");
    if (!item) this.AppError("会员卡不存在");
    const nameMap = await this._getMeetCategoryNameMap();
    return this._formatTpl(item, nameMap);
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

    let data = {
      CARD_TPL_NAME: name,
      CARD_TPL_TYPE: type,
      CARD_TPL_DAYS: days,
      CARD_TPL_PRICE: price,
      CARD_TPL_QUOTA: quota,
      CARD_TPL_COLOR: color,
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
    if (tplIds.length) {
      let tpls = await CardTplModel.getAll(
        { CARD_TPL_ID: ["in", tplIds] },
        "CARD_TPL_ID,CARD_TPL_COLOR",
        {},
        tplIds.length,
      );
      for (let t of tpls || []) {
        colorMap[t.CARD_TPL_ID] = t.CARD_TPL_COLOR || "#F5A623";
      }
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
            );
            let addTime = Number(c.USER_CARD_ADD_TIME) || 0;
            return {
              id: item.id,
              name: item.name,
              typeLabel: item.typeLabel,
              price: item.price,
              color: item.color,
              balanceText: item.balanceText,
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

        return {
          userId: uid,
          USER_NAME: u.USER_NAME || "未命名会员",
          USER_MOBILE: u.USER_MOBILE || "",
          USER_PIC: u.USER_PIC || "",
          newCardCount: mappedCards.length,
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

    let month = timeUtil.time("Y-M");
    return {
      month,
      monthText: month.replace("-", "年") + "月",
      totalMembers,
      totalCards,
      list: pageList,
      total: totalMembers,
      page,
      size,
      count: pageList.length,
    };
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
    let days = Number(tpl.CARD_TPL_DAYS) || 365;
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
      endTime = now + days * 86400;
    }

    let scope = cardScopeUtil.normalizeScope(tpl.CARD_TPL_SCOPE);

    let data = {
      USER_CARD_USER_ID: userId,
      USER_CARD_TPL_ID: tpl.CARD_TPL_ID,
      USER_CARD_NAME: name,
      USER_CARD_TYPE: type,
      USER_CARD_DAYS: days,
      USER_CARD_PRICE: price,
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

    const cardService = new UserCardService();
    const now = timeUtil.time();
    const nameMap = await cardService._getCategoryNameMap();
    const list = (cards || []).map((c) =>
      cardService._mapCardItem(c, now, colorMap[c.USER_CARD_TPL_ID], nameMap),
    );

    return {
      userId,
      userName: user.USER_NAME || "",
      list,
      total: list.length,
    };
  }

  /** 教练代约：某会员在某课程下可用的会员卡（含适用范围过滤） */
  async getUserJoinCardOptions(userId, meetId) {
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
    const list = await cardService._listUsableCards(userId, needTimes, meet);
    return { needTimes, list };
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
      (c) => c.USER_CARD_END_TIME <= now + 86400 * 7,
    ).length;
    let lowTimes = await this._safeCount(UserCardModel, {
      USER_CARD_STATUS: UserCardModel.STATUS.NORMAL,
      USER_CARD_TYPE: CardTplModel.TYPE.TIMES,
      USER_CARD_QUOTA: ["<=", 3],
    });
    return {
      totalCardTpls,
      newCardTpls,
      totalCards,
      newCards,
      expiringSoon,
      lowTimes,
    };
  }
}

module.exports = AdminCardService;
