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
const tenantExpireUtil = require("../../utils/tenant_expire_util.js");
const bufferUtil = require("../../utils/schedule_buffer_util.js");

const DEFAULT_MEET_TYPE =
  "1=特色课程|leftbig3,2=精品课|leftbig2,3=私教定制|leftbig2,4=核心床|leftbig3";

const MS_PER_DAY = 86400 * 1000;

class AdminTenantService extends BaseAdminService {
  _defaultMeetType() {
    return DEFAULT_MEET_TYPE;
  }

  _msDaysAgo(days, now) {
    const ts = now != null ? now : timeUtil.time();
    return ts - days * MS_PER_DAY;
  }

  _joinActivityTime(join) {
    return Number(join.JOIN_START_TIME || join.JOIN_ADD_TIME) || 0;
  }

  _parseTimeHm(value, fallback, label) {
    const raw = String(value != null ? value : fallback || "").trim();
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(raw)) {
      this.AppError(label + "格式应为 HH:mm");
    }
    return raw;
  }

  _normalizePrivateSchedule(input, prev) {
    const base = prev || {};
    const merged = Object.assign({}, base, input || {});
    const openTime = this._parseTimeHm(
      merged.openTime,
      base.openTime || "07:00",
      "营业开始时间",
    );
    const closeTime = this._parseTimeHm(
      merged.closeTime,
      base.closeTime || "22:00",
      "营业结束时间",
    );
    if (bufferUtil.timeToMinutes(openTime) >= bufferUtil.timeToMinutes(closeTime)) {
      this.AppError("营业结束时间须晚于开始时间");
    }
    return {
      openTime,
      closeTime,
      advanceHours: Math.max(
        0,
        Number(
          merged.advanceHours != null ? merged.advanceHours : base.advanceHours,
        ) || 0,
      ),
      maxBookDays: Math.max(
        1,
        Number(
          merged.maxBookDays != null ? merged.maxBookDays : base.maxBookDays,
        ) || 14,
      ),
      slotStepMinutes: Math.max(
        5,
        Number(
          merged.slotStepMinutes != null
            ? merged.slotStepMinutes
            : base.slotStepMinutes,
        ) || 15,
      ),
      defaultBufferBefore:
        merged.defaultBufferBefore != null
          ? Math.max(0, Number(merged.defaultBufferBefore) || 0)
          : base.defaultBufferBefore,
      defaultBufferAfter:
        merged.defaultBufferAfter != null
          ? Math.max(0, Number(merged.defaultBufferAfter) || 0)
          : base.defaultBufferAfter,
    };
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
      const segments = rest.split("|").map((s) => s.trim()).filter(Boolean);
      const name = segments[0] || "";
      const isPrivate = segments.includes("private");
      if (id && name) list.push({ id, name, isPrivate });
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
        const flags = ["leftbig3"];
        if (c.isPrivate === true) flags.push("private");
        return `${id}=${name}|${flags.join("|")}`;
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
      privateSchedule: (setup && setup.SETUP_FEATURES && setup.SETUP_FEATURES.privateSchedule) || null,
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
    privateSchedule,
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

    if (privateSchedule !== undefined && privateSchedule !== null) {
      let existingSetup = await tenantSetupHelper.getSetupForPid(
        pid,
        "SETUP_FEATURES",
      );
      let features = (existingSetup && existingSetup.SETUP_FEATURES) || {};
      setupData.SETUP_FEATURES = {
        ...features,
        privateSchedule: this._normalizePrivateSchedule(
          privateSchedule,
          features.privateSchedule || {},
        ),
      };
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
  async insertTenant(name, desc, template, operator, expireDay) {
    name = String(name || "").trim();
    if (!name) this.AppError("请填写瑜伽馆名称");
    if (name.length > 30) this.AppError("名称不超过30字");

    let expireTime = 0;
    if (expireDay && String(expireDay).trim() && expireDay !== "long") {
      expireTime = tenantExpireUtil.expireDayToTime(expireDay);
      if (!expireTime) this.AppError("到期日期无效");
    }

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
      TENANT_EXPIRE_TIME: expireTime,
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
      `新建瑜伽馆「${name}」${expireTime ? `，有效期至 ${tenantExpireUtil.expireTimeToDay(expireTime)}` : "，长期有效"}`,
      operator,
      require("../../model/log_model.js").TYPE.SYS,
    );

    return { pid, tenantName: name };
  }

  /** 超管：平台概览 */
  async getPlatformOverview() {
    const now = timeUtil.time();
    let tenantList = await TenantModel.getAll(
      {},
      "_pid,TENANT_ID,TENANT_NAME,TENANT_DESC,TENANT_TEMPLATE,TENANT_STATUS,TENANT_EXPIRE_TIME",
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

    const enriched = (tenantList || []).map((item) =>
      this._enrichPlatformTenant(item, now),
    );

    return {
      tenantList: enriched,
      tenantCount: enriched.length,
      tenantOpenCount: enriched.filter((item) => item.TENANT_STATUS === TenantModel.STATUS.OPEN).length,
      adminCount: adminCount || 0,
    };
  }

  _enrichPlatformTenant(tenant, now) {
    const item = tenantExpireUtil.enrichTenantExpire(tenant, now);
    const closed = tenant.TENANT_STATUS === TenantModel.STATUS.CLOSE;
    let statusDesc = closed ? "已停用" : "运营中";
    if (!closed && item.isExpired) statusDesc = "已到期";
    else if (!closed && item.isExpiringSoon) statusDesc = "即将到期";
    return {
      ...item,
      isClosed: closed,
      statusDesc,
    };
  }

  /** 超管：租户有效期详情 */
  async getTenantExpireDetail(pid) {
    pid = String(pid || "").trim();
    if (!pid) this.AppError("请选择瑜伽馆");
    let tenant = await TenantModel.getOne(
      { _pid: pid },
      "_pid,TENANT_ID,TENANT_NAME,TENANT_EXPIRE_TIME,TENANT_STATUS",
      {},
      false,
    );
    if (!tenant) this.AppError("瑜伽馆不存在");
    return this._enrichPlatformTenant(
      tenantExpireUtil.enrichTenantExpire(tenant),
    );
  }

  /** 超管：启用/停用租户 */
  async saveTenantStatus(pid, status, operator) {
    pid = String(pid || "").trim();
    if (!pid) this.AppError("请选择瑜伽馆");

    let tenant = await TenantModel.getOne(
      { _pid: pid },
      "TENANT_NAME,TENANT_STATUS",
      {},
      false,
    );
    if (!tenant) this.AppError("瑜伽馆不存在");

    const nextStatus =
      Number(status) === TenantModel.STATUS.CLOSE
        ? TenantModel.STATUS.CLOSE
        : TenantModel.STATUS.OPEN;

    await TenantModel.edit(
      { _pid: pid },
      {
        TENANT_STATUS: nextStatus,
        TENANT_EDIT_TIME: timeUtil.time(),
      },
      false,
    );

    const action = nextStatus === TenantModel.STATUS.CLOSE ? "停用" : "启用";
    await this.insertLog(
      `${action}瑜伽馆「${tenant.TENANT_NAME}」`,
      operator,
      require("../../model/log_model.js").TYPE.SYS,
    );

    let updated = await TenantModel.getOne(
      { _pid: pid },
      "_pid,TENANT_ID,TENANT_NAME,TENANT_EXPIRE_TIME,TENANT_STATUS",
      {},
      false,
    );
    return this._enrichPlatformTenant(updated);
  }

  /** 超管：删除瑜伽馆 */
  async delTenant(pid, confirmName, operator) {
    pid = String(pid || "").trim();
    confirmName = String(confirmName || "").trim();
    if (!pid) this.AppError("请选择瑜伽馆");
    if (!confirmName) this.AppError("请输入馆名确认");

    let tenant = await TenantModel.getOne(
      { _pid: pid },
      "TENANT_NAME,TENANT_LOGO",
      {},
      false,
    );
    if (!tenant) this.AppError("瑜伽馆不存在");
    if (tenant.TENANT_NAME !== confirmName) {
      this.AppError("馆名不一致，请重新输入");
    }

    let admins = await AdminModel.getAll(
      {
        _pid: pid,
        ADMIN_TYPE: ["in", [AdminModel.TYPE.OWNER, AdminModel.TYPE.TEACHER]],
      },
      "ADMIN_ID",
      {},
      500,
      false,
    );
    for (let admin of admins || []) {
      if (admin && admin.ADMIN_ID) {
        await AdminModel.del({ ADMIN_ID: admin.ADMIN_ID }, false);
      }
    }

    let setup = await tenantSetupHelper.getSetupForPid(pid, "_pid,SETUP_ABOUT_PIC,SETUP_SERVICE_PIC,SETUP_OFFICE_PIC");
    if (setup) {
      let files = []
        .concat(setup.SETUP_ABOUT_PIC || [])
        .concat(setup.SETUP_SERVICE_PIC || [])
        .concat(setup.SETUP_OFFICE_PIC || [])
        .filter(Boolean);
      if (tenant.TENANT_LOGO) files.push(tenant.TENANT_LOGO);
      if (files.length) await cloudUtil.deleteFiles(files);
      await SetupModel.del({ _pid: pid }, false);
    } else if (tenant.TENANT_LOGO) {
      await cloudUtil.deleteFiles([tenant.TENANT_LOGO]);
    }

    await TenantModel.del({ _pid: pid }, false);

    await this.insertLog(
      `删除瑜伽馆「${tenant.TENANT_NAME}」`,
      operator,
      require("../../model/log_model.js").TYPE.SYS,
    );

    return { pid, tenantName: tenant.TENANT_NAME };
  }

  /** 超管：保存租户有效期 */
  async saveTenantExpire(pid, expireDay, operator) {
    pid = String(pid || "").trim();
    if (!pid) this.AppError("请选择瑜伽馆");

    let tenant = await TenantModel.getOne(
      { _pid: pid },
      "TENANT_NAME",
      {},
      false,
    );
    if (!tenant) this.AppError("瑜伽馆不存在");

    let expireTime = 0;
    if (expireDay && String(expireDay).trim() && expireDay !== "long") {
      expireTime = tenantExpireUtil.expireDayToTime(expireDay);
      if (!expireTime) this.AppError("到期日期无效");
    }

    await TenantModel.edit(
      { _pid: pid },
      {
        TENANT_EXPIRE_TIME: expireTime,
        TENANT_EDIT_TIME: timeUtil.time(),
      },
      false,
    );

    const desc = tenantExpireUtil.formatExpireDesc(expireTime);
    await this.insertLog(
      `设置瑜伽馆「${tenant.TENANT_NAME}」有效期：${desc}`,
      operator,
      require("../../model/log_model.js").TYPE.SYS,
    );

    return tenantExpireUtil.enrichTenantExpire({
      _pid: pid,
      TENANT_NAME: tenant.TENANT_NAME,
      TENANT_EXPIRE_TIME: expireTime,
    });
  }

  /** 客户 Tab 会员统计 */
  async getMemberStats(pid) {
    if (!pid) this.AppError("请先选择瑜伽馆");
    global.PID = pid;

    const now = timeUtil.time();
    const monthStart = timeUtil.time2Timestamp(
      timeUtil.time("Y-M") + "-01 00:00:00",
    );
    const day30 = this._msDaysAgo(30, now);
    const day90 = this._msDaysAgo(90, now);

    const totalMembers = await UserModel.count({});
    const monthNew = await UserModel.count({
      USER_ADD_TIME: [">=", monthStart],
    });

    let activeRows = await JoinModel.getAll(
      { JOIN_STATUS: JoinModel.STATUS.SUCC },
      "JOIN_USER_ID,JOIN_START_TIME,JOIN_ADD_TIME",
      {},
      5000,
    );
    let activeIds = new Set();
    for (let row of activeRows || []) {
      if (this._joinActivityTime(row) >= day30 && row.JOIN_USER_ID) {
        activeIds.add(row.JOIN_USER_ID);
      }
    }
    const inactive30 = Math.max(0, totalMembers - activeIds.size);

    let allJoins = await JoinModel.getAll(
      { JOIN_STATUS: JoinModel.STATUS.SUCC },
      "JOIN_USER_ID,JOIN_START_TIME,JOIN_ADD_TIME",
      {},
      10000,
    );
    let lastJoinByUser = {};
    for (let j of allJoins || []) {
      const activityTime = this._joinActivityTime(j);
      if (
        !lastJoinByUser[j.JOIN_USER_ID] ||
        activityTime > lastJoinByUser[j.JOIN_USER_ID]
      ) {
        lastJoinByUser[j.JOIN_USER_ID] = activityTime;
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
      totalCards: cardStats.cardHolderCount ?? 0,
      newCard: cardStats.newCards ?? 0,
      monthBirthday: 0,
      monthNew,
      inactive30,
      churn,
      lowTimes: cardStats.lowTimes || 0,
      lowBalance: 0,
      expiringSoon: cardStats.expiringSoon || 0,
    };
  }

  /** 需关注 / 概况会员明细（与 getMemberStats 统计口径一致） */
  async getAttentionMembers({ type, search, page = 1, size = 100 } = {}) {
    type = (type || "").trim();
    const TYPE_META = {
      inactive30: { title: "30天未上课", empty: "暂无30天未上课会员" },
      churn: { title: "流失会员", empty: "暂无流失会员" },
      expiringSoon: { title: "即将到期", empty: "暂无即将到期会员" },
      lowTimes: { title: "次数不足", empty: "暂无次数不足会员" },
      lowBalance: { title: "储蓄不足", empty: "暂无储蓄不足会员" },
      monthNew: { title: "本月新增会员", empty: "本月暂无新增会员" },
      monthBirthday: { title: "本月生日", empty: "本月暂无生日会员" },
    };
    if (!TYPE_META[type]) this.AppError("无效的关注类型");

    const now = timeUtil.time();
    const day30 = this._msDaysAgo(30, now);
    const day90 = this._msDaysAgo(90, now);
    const monthStart = timeUtil.time2Timestamp(
      timeUtil.time("Y-M") + "-01 00:00:00",
    );

    let where = { and: { _pid: this.getProjectId() } };
    let allUsers = await UserModel.getAll(
      where,
      "USER_MINI_OPENID,USER_NAME,USER_MOBILE,USER_PIC,USER_ADD_TIME",
      { USER_ADD_TIME: "desc" },
      2000,
    );

    let hintsByUser = {};
    let targetIds = null;

    if (type === "monthNew") {
      targetIds = new Set(
        (allUsers || [])
          .filter((u) => Number(u.USER_ADD_TIME) >= monthStart)
          .map((u) => u.USER_MINI_OPENID)
          .filter(Boolean),
      );
      for (let uid of targetIds) {
        hintsByUser[uid] = "本月新注册";
      }
    } else if (type === "monthBirthday" || type === "lowBalance") {
      targetIds = new Set();
    } else if (type === "inactive30") {
      let activeRows = await JoinModel.getAll(
        { JOIN_STATUS: JoinModel.STATUS.SUCC },
        "JOIN_USER_ID,JOIN_START_TIME,JOIN_ADD_TIME",
        {},
        5000,
      );
      let activeIds = new Set();
      for (let row of activeRows || []) {
        if (this._joinActivityTime(row) >= day30 && row.JOIN_USER_ID) {
          activeIds.add(row.JOIN_USER_ID);
        }
      }
      targetIds = new Set(
        (allUsers || [])
          .map((u) => u.USER_MINI_OPENID)
          .filter((uid) => uid && !activeIds.has(uid)),
      );
      for (let uid of targetIds) hintsByUser[uid] = "近30天未上课";
    } else if (type === "churn") {
      let allJoins = await JoinModel.getAll(
        { JOIN_STATUS: JoinModel.STATUS.SUCC },
        "JOIN_USER_ID,JOIN_START_TIME,JOIN_ADD_TIME",
        {},
        10000,
      );
      let lastJoinByUser = {};
      for (let j of allJoins || []) {
        const activityTime = this._joinActivityTime(j);
        if (
          !lastJoinByUser[j.JOIN_USER_ID] ||
          activityTime > lastJoinByUser[j.JOIN_USER_ID]
        ) {
          lastJoinByUser[j.JOIN_USER_ID] = activityTime;
        }
      }
      targetIds = new Set();
      for (let uid in lastJoinByUser) {
        if (lastJoinByUser[uid] < day90) {
          targetIds.add(uid);
          hintsByUser[uid] =
            "最近上课 " +
            timeUtil.timestamp2Time(lastJoinByUser[uid], "Y-M-D");
        }
      }
    } else {
      const UserCardModel = require("../../model/user_card_model.js");
      const CardTplModel = require("../../model/card_tpl_model.js");
      const AdminCardService = require("./admin_card_service.js");
      const cardSvc = new AdminCardService();
      await cardSvc._ensureCardCollections();

      if (type === "expiringSoon") {
        let rows = await cardSvc._safeGetAll(
          UserCardModel,
          {
            USER_CARD_STATUS: UserCardModel.STATUS.NORMAL,
            USER_CARD_END_TIME: [">", now],
          },
          "USER_CARD_USER_ID,USER_CARD_NAME,USER_CARD_END_TIME",
          {},
          5000,
        );
        targetIds = new Set();
        for (let c of rows || []) {
          if (c.USER_CARD_END_TIME <= now + 86400 * 7 * 1000) {
            let uid = c.USER_CARD_USER_ID;
            if (!uid) continue;
            targetIds.add(uid);
            hintsByUser[uid] =
              (c.USER_CARD_NAME || "会员卡") +
              " " +
              timeUtil.timestamp2Time(c.USER_CARD_END_TIME, "Y-M-D") +
              " 到期";
          }
        }
      } else if (type === "lowTimes") {
        let rows = await cardSvc._safeGetAll(
          UserCardModel,
          {
            USER_CARD_STATUS: UserCardModel.STATUS.NORMAL,
            USER_CARD_TYPE: CardTplModel.TYPE.TIMES,
            USER_CARD_QUOTA: ["<=", 3],
          },
          "USER_CARD_USER_ID,USER_CARD_NAME,USER_CARD_QUOTA",
          {},
          5000,
        );
        targetIds = new Set();
        for (let c of rows || []) {
          let uid = c.USER_CARD_USER_ID;
          if (!uid) continue;
          targetIds.add(uid);
          hintsByUser[uid] =
            (c.USER_CARD_NAME || "次卡") +
            " 剩余" +
            (Number(c.USER_CARD_QUOTA) || 0) +
            "次";
        }
      }
    }

    let list = (allUsers || []).filter((u) =>
      targetIds.has(u.USER_MINI_OPENID),
    );

    if (search) {
      let kw = String(search).trim().toLowerCase();
      list = list.filter(
        (u) =>
          (u.USER_NAME || "").toLowerCase().includes(kw) ||
          (u.USER_MOBILE || "").includes(kw) ||
          (hintsByUser[u.USER_MINI_OPENID] || "").toLowerCase().includes(kw),
      );
    }

    let enriched = list.map((u) => ({
      userId: u.USER_MINI_OPENID,
      USER_NAME: u.USER_NAME || "未命名会员",
      USER_MOBILE: u.USER_MOBILE || "",
      USER_PIC: u.USER_PIC || "",
      attentionHint: hintsByUser[u.USER_MINI_OPENID] || TYPE_META[type].title,
    }));

    let total = enriched.length;
    let start = (page - 1) * size;
    let pageList = enriched.slice(start, start + size);

    return {
      type,
      title: TYPE_META[type].title,
      emptyText: TYPE_META[type].empty,
      total,
      list: pageList,
      page,
      size,
      count: pageList.length,
    };
  }
}

module.exports = AdminTenantService;
