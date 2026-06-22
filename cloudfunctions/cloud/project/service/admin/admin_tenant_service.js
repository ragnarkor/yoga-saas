/**
 * Notes: 租户门店设置（课程分类等）
 */

const BaseAdminService = require("./base_admin_service.js");
const TenantModel = require("../../model/tenant_model.js");
const UserModel = require("../../model/user_model.js");
const JoinModel = require("../../model/join_model.js");
const AdminModel = require("../../model/admin_model.js");
const timeUtil = require("../../../framework/utils/time_util.js");

const DEFAULT_MEET_TYPE =
  "1=特色课程|leftbig3,2=精品课|leftbig2,3=私教定制|leftbig2,4=核心床|leftbig3";

class AdminTenantService extends BaseAdminService {
  _defaultMeetType() {
    return DEFAULT_MEET_TYPE;
  }

  _parseCategories(meetTypeStr) {
    if (!meetTypeStr) return [];
    const parts = meetTypeStr.split(",");
    const list = [];
    for (let part of parts) {
      const seg = part.trim();
      if (!seg) continue;
      const eq = seg.indexOf("=");
      if (eq <= 0) continue;
      const id = seg.slice(0, eq).trim();
      const rest = seg.slice(eq + 1).trim();
      const name = rest.split("|")[0].trim();
      if (id && name) list.push({ id, name });
    }
    return list;
  }

  _buildMeetTypeStr(categories) {
    if (!Array.isArray(categories) || !categories.length) {
      return this._defaultMeetType();
    }
    return categories
      .map((c, idx) => {
        const id = String(c.id || idx + 1);
        const name = (c.name || "").trim();
        if (!name) return "";
        return `${id}=${name}|leftbig3`;
      })
      .filter(Boolean)
      .join(",");
  }

  async getStore(pid) {
    if (!pid) this.AppError("请先选择瑜伽馆");

    let tenant = await TenantModel.getOne({ _pid: pid }, "*", {}, false);
    if (!tenant) this.AppError("瑜伽馆不存在");

    let meetTypeStr = tenant.TENANT_MEET_TYPE || this._defaultMeetType();
    return {
      tenant: {
        _pid: tenant._pid,
        TENANT_NAME: tenant.TENANT_NAME,
        TENANT_DESC: tenant.TENANT_DESC || "",
        TENANT_LOGO: tenant.TENANT_LOGO || "",
        TENANT_TEMPLATE: tenant.TENANT_TEMPLATE || "default",
        TENANT_MEET_TYPE: meetTypeStr,
        TENANT_MEET_NAME: tenant.TENANT_MEET_NAME || "约课",
        TENANT_THEME_COLOR: tenant.TENANT_THEME_COLOR || "",
      },
      categories: this._parseCategories(meetTypeStr),
    };
  }

  async saveMeetCategories(pid, categories, operatorType, themeColor, tenantDesc) {
    if (!pid) this.AppError("请先选择瑜伽馆");
    if (
      operatorType !== AdminModel.TYPE.SUPER &&
      operatorType !== AdminModel.TYPE.OWNER
    ) {
      this.AppError("仅馆主可修改门店配置");
    }

    let meetTypeStr = this._buildMeetTypeStr(categories);
    if (!meetTypeStr) this.AppError("请至少保留一个课程分类");

    let editData = {
      TENANT_MEET_TYPE: meetTypeStr,
      TENANT_EDIT_TIME: timeUtil.time(),
    };
    if (themeColor !== undefined && themeColor !== null) {
      let color = String(themeColor || "").trim();
      if (color && !/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(color)) {
        this.AppError("主题色格式不正确，请使用如 #5B8A72");
      }
      editData.TENANT_THEME_COLOR = color;
    }
    if (tenantDesc !== undefined && tenantDesc !== null) {
      editData.TENANT_DESC = String(tenantDesc || "").trim().slice(0, 200);
    }

    await TenantModel.edit({ _pid: pid }, editData, false);

    return {
      TENANT_MEET_TYPE: meetTypeStr,
      TENANT_THEME_COLOR:
        themeColor !== undefined && themeColor !== null
          ? String(themeColor || "").trim()
          : undefined,
      categories: this._parseCategories(meetTypeStr),
    };
  }

  /** 客户 Tab 会员统计 */
  async getMemberStats(pid) {
    if (!pid) this.AppError("请先选择瑜伽馆");
    global.PID = pid;

    const now = timeUtil.time();
    const monthStart = timeUtil.time2Timestamp(
      timeUtil.time("Y-M") + "-01 00:00:00",
    );
    const day30 = now - 86400 * 30;
    const day90 = now - 86400 * 90;

    const total = await UserModel.count({});
    const monthNew = await UserModel.count({
      USER_ADD_TIME: [">=", monthStart],
    });

    let activeRows = await JoinModel.getAll(
      {
        JOIN_STATUS: JoinModel.STATUS.SUCC,
        JOIN_ADD_TIME: [">=", day30],
      },
      "JOIN_USER_ID",
      {},
      5000,
    );
    let activeIds = new Set(
      (activeRows || []).map((r) => r.JOIN_USER_ID).filter(Boolean),
    );
    const inactive30 = Math.max(0, total - activeIds.size);

    let allJoins = await JoinModel.getAll(
      { JOIN_STATUS: JoinModel.STATUS.SUCC },
      "JOIN_USER_ID,JOIN_ADD_TIME",
      {},
      10000,
    );
    let lastJoinByUser = {};
    for (let j of allJoins || []) {
      if (
        !lastJoinByUser[j.JOIN_USER_ID] ||
        j.JOIN_ADD_TIME > lastJoinByUser[j.JOIN_USER_ID]
      ) {
        lastJoinByUser[j.JOIN_USER_ID] = j.JOIN_ADD_TIME;
      }
    }
    let churn = 0;
    for (let uid in lastJoinByUser) {
      if (lastJoinByUser[uid] < day90) churn++;
    }

    let cardStats = { newCards: 0, lowTimes: 0, expiringSoon: 0 };
    try {
      const AdminCardService = require("./admin_card_service.js");
      const cardSvc = new AdminCardService();
      cardStats = await cardSvc.getCardStats();
    } catch (e) {
      /* 集合未初始化时忽略 */
    }

    return {
      total,
      newCard: cardStats.newCards || monthNew,
      monthBirthday: 0,
      monthNew,
      inactive30,
      churn,
      lowTimes: cardStats.lowTimes || 0,
      lowBalance: 0,
      expiringSoon: cardStats.expiringSoon || 0,
    };
  }
}

module.exports = AdminTenantService;
