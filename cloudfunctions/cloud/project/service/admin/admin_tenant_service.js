/**
 * Notes: 租户门店设置（课程分类等）
 */

const BaseAdminService = require("./base_admin_service.js");
const TenantModel = require("../../model/tenant_model.js");
const SetupModel = require("../../model/setup_model.js");
const UserModel = require("../../model/user_model.js");
const JoinModel = require("../../model/join_model.js");
const AdminModel = require("../../model/admin_model.js");
const cloudUtil = require("../../../framework/cloud/cloud_util.js");
const timeUtil = require("../../../framework/utils/time_util.js");
const tenantSetupHelper = require("../tenant_setup_helper.js");

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

    let setup = await tenantSetupHelper.getSetupForPid(pid);

    let meetTypeStr =
      (setup && setup.SETUP_MEET_TYPE) ||
      tenant.TENANT_MEET_TYPE ||
      this._defaultMeetType();
    let mergedTenant = tenantSetupHelper.mergeTenantWithSetup(
      {
        _pid: tenant._pid,
        TENANT_NAME: tenant.TENANT_NAME,
        TENANT_DESC: tenant.TENANT_DESC || "",
        TENANT_LOGO: tenant.TENANT_LOGO || "",
        TENANT_TEMPLATE: tenant.TENANT_TEMPLATE || "default",
        TENANT_MEET_TYPE: meetTypeStr,
        TENANT_MEET_NAME: tenant.TENANT_MEET_NAME || "约课",
        TENANT_THEME_COLOR:
          (setup && setup.SETUP_THEME_COLOR) ||
          tenant.TENANT_THEME_COLOR ||
          "",
      },
      setup,
    );
    return {
      tenant: mergedTenant,
      categories: this._parseCategories(meetTypeStr),
      about: (setup && setup.SETUP_ABOUT) || "",
      aboutPics: (setup && setup.SETUP_ABOUT_PIC) || [],
      contact: {
        phone: (setup && setup.SETUP_PHONE) || "",
        address: (setup && setup.SETUP_ADDRESS) || "",
        latitude: (setup && setup.SETUP_LATITUDE) || "",
        longitude: (setup && setup.SETUP_LONGITUDE) || "",
      },
    };
  }

  async saveMeetCategories(
    pid,
    categories,
    operatorType,
    themeColor,
    tenantDesc,
    tenantName,
    tenantLogo,
    about,
    aboutPic,
    contactPhone,
    contactAddress,
    contactLatitude,
    contactLongitude,
  ) {
    if (!pid) this.AppError("请先选择瑜伽馆");
    if (
      operatorType !== AdminModel.TYPE.SUPER &&
      operatorType !== AdminModel.TYPE.OWNER
    ) {
      this.AppError("仅馆主可修改门店配置");
    }

    let meetTypeStr = this._buildMeetTypeStr(categories);
    if (!meetTypeStr) this.AppError("请至少保留一个课程分类");

    let savedAbout;
    let savedAboutPics;
    let savedThemeColor;
    let savedMeetType = meetTypeStr;

    let editData = {
      TENANT_EDIT_TIME: timeUtil.time(),
    };
    let setupData = {
      SETUP_MEET_TYPE: meetTypeStr,
    };
    if (themeColor !== undefined && themeColor !== null) {
      let color = String(themeColor || "").trim();
      if (color && !/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(color)) {
        this.AppError("主题色格式不正确，请使用如 #5B8A72");
      }
      setupData.SETUP_THEME_COLOR = color;
      savedThemeColor = color;
    }
    if (tenantDesc !== undefined && tenantDesc !== null) {
      editData.TENANT_DESC = String(tenantDesc || "").trim().slice(0, 200);
    }
    if (tenantName !== undefined && tenantName !== null) {
      let name = String(tenantName || "").trim();
      if (!name) this.AppError("请填写门店名称");
      if (name.length > 30) this.AppError("门店名称不超过30字");
      editData.TENANT_NAME = name;
    }
    if (tenantLogo !== undefined && tenantLogo !== null) {
      let tenant = await TenantModel.getOne({ _pid: pid }, "TENANT_LOGO", {}, false);
      let oldLogo = (tenant && tenant.TENANT_LOGO) || "";
      let nextLogo = await cloudUtil.handlerCloudFiles(
        oldLogo ? [oldLogo] : [],
        tenantLogo ? [tenantLogo] : [],
      );
      editData.TENANT_LOGO = nextLogo.length ? nextLogo[0] : "";
    }
    if (about !== undefined || aboutPic !== undefined) {
      let setup = await tenantSetupHelper.getSetupForPid(pid, "SETUP_ABOUT_PIC");
      let oldPics = (setup && setup.SETUP_ABOUT_PIC) || [];
      if (about !== undefined && about !== null) {
        setupData.SETUP_ABOUT = String(about || "").trim().slice(0, 50000);
      }
      if (aboutPic !== undefined && aboutPic !== null) {
        setupData.SETUP_ABOUT_PIC = await cloudUtil.handlerCloudFiles(
          oldPics,
          aboutPic || [],
        );
      }
      savedAboutPics = setupData.SETUP_ABOUT_PIC;
      savedAbout = setupData.SETUP_ABOUT;
    }
    if (contactPhone !== undefined && contactPhone !== null) {
      setupData.SETUP_PHONE = String(contactPhone || "").trim().slice(0, 30);
    }
    if (contactAddress !== undefined && contactAddress !== null) {
      setupData.SETUP_ADDRESS = String(contactAddress || "").trim().slice(0, 200);
    }
    if (contactLatitude !== undefined && contactLatitude !== null) {
      let lat = contactLatitude === "" ? "" : Number(contactLatitude);
      if (lat !== "" && (Number.isNaN(lat) || lat < -90 || lat > 90)) {
        this.AppError("纬度格式不正确");
      }
      setupData.SETUP_LATITUDE = lat === "" ? "" : lat;
    }
    if (contactLongitude !== undefined && contactLongitude !== null) {
      let lng = contactLongitude === "" ? "" : Number(contactLongitude);
      if (lng !== "" && (Number.isNaN(lng) || lng < -180 || lng > 180)) {
        this.AppError("经度格式不正确");
      }
      setupData.SETUP_LONGITUDE = lng === "" ? "" : lng;
    }

    await this._saveSetupForPid(pid, setupData);

    await TenantModel.edit({ _pid: pid }, editData, false);

    let savedTenant = await TenantModel.getOne({ _pid: pid }, "*", {}, false);
    let savedSetup = await tenantSetupHelper.getSetupForPid(pid);
    let mergedTenant = tenantSetupHelper.mergeTenantWithSetup(
      savedTenant,
      savedSetup,
    );
    return {
      TENANT_MEET_TYPE: mergedTenant.TENANT_MEET_TYPE || savedMeetType,
      TENANT_THEME_COLOR:
        savedThemeColor !== undefined
          ? savedThemeColor
          : mergedTenant.TENANT_THEME_COLOR,
      TENANT_NAME: savedTenant ? savedTenant.TENANT_NAME : editData.TENANT_NAME,
      TENANT_DESC: savedTenant ? savedTenant.TENANT_DESC : editData.TENANT_DESC,
      TENANT_LOGO: savedTenant ? savedTenant.TENANT_LOGO : editData.TENANT_LOGO,
      categories: this._parseCategories(savedMeetType),
      about:
        savedAbout !== undefined
          ? savedAbout
          : about !== undefined && about !== null
            ? String(about || "").trim().slice(0, 50000)
            : undefined,
      aboutPics:
        savedAboutPics !== undefined
          ? savedAboutPics
          : aboutPic !== undefined && aboutPic !== null
            ? aboutPic
            : undefined,
      contact: {
        phone: (savedSetup && savedSetup.SETUP_PHONE) || "",
        address: (savedSetup && savedSetup.SETUP_ADDRESS) || "",
        latitude: (savedSetup && savedSetup.SETUP_LATITUDE) || "",
        longitude: (savedSetup && savedSetup.SETUP_LONGITUDE) || "",
      },
    };
  }

  async _saveSetupForPid(pid, setupData) {
    if (!setupData || !Object.keys(setupData).length) return;

    let setup = await tenantSetupHelper.getSetupForPid(pid, "_pid");
    if (setup) {
      await SetupModel.edit({ _pid: pid }, setupData, false);
      return;
    }

    const prevPid = global.PID;
    global.PID = pid;
    try {
      await SetupModel.insert(
        Object.assign(
          {
            SETUP_ABOUT: "",
            SETUP_FEATURES: {
              booking: true,
              payment: false,
              teacherManage: true,
              checkin: true,
              news: true,
              selfCheckin: true,
            },
          },
          setupData,
        ),
      );
    } finally {
      global.PID = prevPid;
    }
  }

  /** 超管：新建瑜伽馆 */
  async insertTenant(name, desc, template, operator) {
    name = String(name || "").trim();
    if (!name) this.AppError("请填写瑜伽馆名称");
    if (name.length > 30) this.AppError("名称不超过30字");

    let pid = TenantModel.makeID();
    let data = {
      _pid: pid,
      TENANT_ID: pid,
      TENANT_NAME: name,
      TENANT_DESC: String(desc || "").trim().slice(0, 200),
      TENANT_TEMPLATE: template || "default",
      TENANT_STATUS: TenantModel.STATUS.OPEN,
      TENANT_MEET_TYPE: this._defaultMeetType(),
      TENANT_MEET_NAME: "约课",
      TENANT_THEME_COLOR: "#5B8A72",
    };

    await TenantModel.insert(data, false);

    const prevPid = global.PID;
    global.PID = pid;
    try {
      await SetupModel.insert({
        SETUP_ABOUT: "",
        SETUP_THEME_COLOR: "#5B8A72",
        SETUP_MEET_TYPE: this._defaultMeetType(),
        SETUP_FEATURES: {
          booking: true,
          payment: false,
          teacherManage: true,
          checkin: true,
          news: true,
          selfCheckin: true,
        },
      });
    } finally {
      global.PID = prevPid;
    }

    await this.insertLog(
      `新建瑜伽馆「${name}」`,
      operator,
      require("../../model/log_model.js").TYPE.SYS,
    );

    return { pid, tenantName: name };
  }

  /** 超管：平台概览 */
  async getPlatformOverview() {
    let tenantList = await TenantModel.getAll(
      { TENANT_STATUS: TenantModel.STATUS.OPEN },
      "_pid,TENANT_ID,TENANT_NAME,TENANT_DESC,TENANT_TEMPLATE",
      { TENANT_ADD_TIME: "desc" },
      200,
      false,
    );

    let adminCount = await AdminModel.count(
      {
        ADMIN_TYPE: ["in", [AdminModel.TYPE.OWNER, AdminModel.TYPE.TEACHER]],
        ADMIN_STATUS: 1,
      },
      false,
    );

    return {
      tenantList: tenantList || [],
      tenantCount: (tenantList || []).length,
      adminCount: adminCount || 0,
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

    const totalMembers = await UserModel.count({});
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
    const inactive30 = Math.max(0, totalMembers - activeIds.size);

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

    let cardStats = {
      totalCardTpls: 0,
      newCardTpls: 0,
      totalCards: 0,
      newCards: 0,
      lowTimes: 0,
      expiringSoon: 0,
    };
    try {
      const AdminCardService = require("./admin_card_service.js");
      const cardSvc = new AdminCardService();
      cardStats = await cardSvc.getCardStats();
    } catch (e) {
      /* 集合未初始化时忽略 */
    }

    return {
      totalMembers,
      totalCards: cardStats.totalCardTpls || 0,
      newCard: cardStats.newCardTpls ?? 0,
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
