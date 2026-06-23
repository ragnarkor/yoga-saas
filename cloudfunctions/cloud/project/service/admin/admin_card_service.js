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

  _formatTpl(item) {
    return {
      ...item,
      typeDesc: this._typeDesc(item.CARD_TPL_TYPE),
      metaText: this._buildTplMeta(item),
    };
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
    return (list || []).map((item) => this._formatTpl(item));
  }

  async getCardTplDetail(id) {
    await this._ensureCardCollections();
    let item = await CardTplModel.getOne({ CARD_TPL_ID: id }, "*");
    if (!item) this.AppError("会员卡不存在");
    return this._formatTpl(item);
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

    let data = {
      CARD_TPL_NAME: name,
      CARD_TPL_TYPE: type,
      CARD_TPL_DAYS: days,
      CARD_TPL_PRICE: price,
      CARD_TPL_QUOTA: quota,
      CARD_TPL_COLOR: color,
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

    let name = (input.name || (tpl && tpl.CARD_TPL_NAME) || "").trim();
    if (!name) this.AppError("请填写卡名称");

    let type =
      input.type === CardTplModel.TYPE.PERIOD
        ? CardTplModel.TYPE.PERIOD
        : CardTplModel.TYPE.TIMES;
    if (tpl) type = tpl.CARD_TPL_TYPE;

    let days = Number(input.days != null ? input.days : tpl && tpl.CARD_TPL_DAYS) || 365;
    let price =
      Number(input.price != null ? input.price : tpl && tpl.CARD_TPL_PRICE) || 0;
    let quota =
      type === CardTplModel.TYPE.PERIOD
        ? 0
        : Number(input.quota != null ? input.quota : tpl && tpl.CARD_TPL_QUOTA) || 1;

    let now = timeUtil.time();
    let endTime = now + days * 86400;

    let data = {
      USER_CARD_USER_ID: userId,
      USER_CARD_TPL_ID: tpl ? tpl.CARD_TPL_ID : input.tplId || "",
      USER_CARD_NAME: name,
      USER_CARD_TYPE: type,
      USER_CARD_DAYS: days,
      USER_CARD_PRICE: price,
      USER_CARD_QUOTA: quota,
      USER_CARD_QUOTA_INIT: quota,
      USER_CARD_ACTIVATE: input.activate || "immediate",
      USER_CARD_COACH_ID: input.coachId || "",
      USER_CARD_COACH_NAME: input.coachName || "",
      USER_CARD_MEMO: (input.memo || "").trim().slice(0, 50),
      USER_CARD_STATUS: UserCardModel.STATUS.NORMAL,
      USER_CARD_START_TIME: now,
      USER_CARD_END_TIME: endTime,
    };

    let id = await UserCardModel.insert(data);
    return { id, userName: user.USER_NAME || "" };
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
      USER_CARD_STATUS: UserCardModel.STATUS.NORMAL,
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
