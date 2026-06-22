/**
 * Notes: 管理员微信绑定与静默登录
 */

const BaseAdminService = require("./base_admin_service.js");
const dataUtil = require("../../../framework/utils/data_util.js");
const timeUtil = require("../../../framework/utils/time_util.js");
const util = require("../../../framework/utils/util.js");
const appCode = require("../../../framework/core/app_code.js");

const AdminModel = require("../../model/admin_model.js");
const TenantModel = require("../../model/tenant_model.js");
const CacheModel = require("../../model/cache_model.js");
const MeetModel = require("../../model/meet_model.js");
const JoinModel = require("../../model/join_model.js");
const UserModel = require("../../model/user_model.js");
const NewsModel = require("../../model/news_model.js");
const LogModel = require("../../model/log_model.js");

const BIND_CODE_TTL = 86400; // 24h
const BIND_CACHE_PREFIX = "admin_bind_";

class AdminWxService extends BaseAdminService {
  _bindCacheKey(code) {
    return BIND_CACHE_PREFIX + code;
  }

  _formatSession(admin, token, pid) {
    return {
      token,
      name: admin.ADMIN_NAME,
      type: admin.ADMIN_TYPE,
      phone: admin.ADMIN_PHONE,
      pid: pid || admin._pid || "",
      last: !admin.ADMIN_LOGIN_TIME
        ? "首次登录"
        : timeUtil.timestamp2Time(admin.ADMIN_LOGIN_TIME),
      cnt: admin.ADMIN_LOGIN_CNT || 0,
      bound: !!admin.ADMIN_MINI_OPENID,
    };
  }

  async _issueToken(admin) {
    let token = dataUtil.genRandomString(32);
    let now = timeUtil.time();
    let data = {
      ADMIN_TOKEN: token,
      ADMIN_TOKEN_TIME: now,
      ADMIN_LOGIN_TIME: now,
      ADMIN_LOGIN_CNT: (admin.ADMIN_LOGIN_CNT || 0) + 1,
    };
    await AdminModel.edit({ _id: admin._id }, data, false);
    admin.ADMIN_LOGIN_CNT = data.ADMIN_LOGIN_CNT;
    admin.ADMIN_LOGIN_TIME = now;
    return token;
  }

  /** 密码登录（超管/备用）；owner/teacher 成功时可写入 openid */
  async adminLogin(phone, pwd, openId) {
    let where = {
      ADMIN_PHONE: phone,
      ADMIN_STATUS: 1,
    };
    let admin = await AdminModel.getOne(where, "*", {}, false);
    if (!admin || admin.ADMIN_PWD != pwd) this.AppError("账号或密码错误");

    if (
      openId &&
      admin.ADMIN_TYPE !== AdminModel.TYPE.SUPER &&
      !admin.ADMIN_MINI_OPENID
    ) {
      await AdminModel.edit(
        { _id: admin._id },
        {
          ADMIN_MINI_OPENID: openId,
          ADMIN_BIND_TIME: timeUtil.time(),
        },
        false,
      );
      admin.ADMIN_MINI_OPENID = openId;
    }

    let token = await this._issueToken(admin);
    await this.insertLog("登录了系统", admin, LogModel.TYPE.SYS);

    let pid =
      admin.ADMIN_TYPE === AdminModel.TYPE.SUPER ? "" : admin._pid || "";
    return this._formatSession(admin, token, pid);
  }

  /** 微信 openid + 当前馆 PID 静默会话 */
  async wxSession(openId, pid) {
    if (!openId || !pid) return { bound: false };

    let admin = await AdminModel.getOne(
      {
        _pid: pid,
        ADMIN_MINI_OPENID: openId,
        ADMIN_STATUS: 1,
        ADMIN_TYPE: ["in", [AdminModel.TYPE.OWNER, AdminModel.TYPE.TEACHER]],
      },
      "*",
      {},
      false,
    );

    if (!admin) return { bound: false, pid };

    let token = await this._issueToken(admin);
    return this._formatSession(admin, token, pid);
  }

  /** 当前 openid 已绑定的馆列表（教练版切换用） */
  async wxTenantList(openId) {
    if (!openId) return { list: [] };

    let admins = await AdminModel.getAll(
      {
        ADMIN_MINI_OPENID: openId,
        ADMIN_STATUS: 1,
        ADMIN_TYPE: ["in", [AdminModel.TYPE.OWNER, AdminModel.TYPE.TEACHER]],
      },
      "ADMIN_ID,ADMIN_NAME,ADMIN_TYPE,_pid",
      { ADMIN_BIND_TIME: "desc" },
      100,
      false,
    );

    if (!admins || !admins.length) return { list: [] };

    let pidList = admins.map((a) => a._pid).filter(Boolean);
    let tenants = await TenantModel.getAll(
      {
        _pid: ["in", pidList],
        TENANT_STATUS: TenantModel.STATUS.OPEN,
      },
      "_pid,TENANT_ID,TENANT_NAME,TENANT_LOGO,TENANT_TEMPLATE",
      { TENANT_ADD_TIME: "asc" },
      100,
      false,
    );

    let tenantMap = {};
    for (let t of tenants) tenantMap[t._pid] = t;

    let list = [];
    for (let a of admins) {
      let t = tenantMap[a._pid];
      if (!t) continue;
      list.push({
        ...t,
        adminType: a.ADMIN_TYPE,
        adminName: a.ADMIN_NAME,
        roleLabel: a.ADMIN_TYPE === AdminModel.TYPE.OWNER ? "馆主" : "教练",
      });
    }

    return { list };
  }

  /** 生成一次性绑定码 */
  async genBindCode(adminId, operator) {
    let admin = await AdminModel.getOne({ _id: adminId }, "*", {}, false);
    if (!admin) this.AppError("管理员不存在");
    if (admin.ADMIN_TYPE === AdminModel.TYPE.SUPER)
      this.AppError("超级管理员请使用密码登录，不支持微信绑定");

    this._assertCanManageAdmin(operator, admin);

    let code = dataUtil.genRandomString(32);
    let timeout = new Date().getTime() + BIND_CODE_TTL * 1000;
    await CacheModel.insertOrUpdate(
      { CACHE_KEY: this._bindCacheKey(code) },
      {
        CACHE_VALUE: {
          val: {
            adminId: admin._id,
            pid: admin._pid,
            adminName: admin.ADMIN_NAME,
            adminType: admin.ADMIN_TYPE,
          },
        },
        CACHE_TIMEOUT: timeout,
      },
      false,
    );

    return {
      code,
      expireHours: BIND_CODE_TTL / 3600,
      adminName: admin.ADMIN_NAME,
      adminType: admin.ADMIN_TYPE,
      pid: admin._pid,
      bindPath: `/pages/admin/bind/admin_bind?code=${code}`,
    };
  }

  _assertCanManageAdmin(operator, target) {
    if (!operator) this.AppError("无权限", appCode.ADMIN_ERROR);
    if (operator.ADMIN_TYPE === AdminModel.TYPE.SUPER) return;

    if (operator.ADMIN_TYPE !== AdminModel.TYPE.OWNER)
      this.AppError("仅馆长或超管可生成绑定码", appCode.ADMIN_ERROR);

    if (operator._pid !== target._pid)
      this.AppError("只能为本馆管理员生成绑定码", appCode.ADMIN_ERROR);

    if (target.ADMIN_TYPE !== AdminModel.TYPE.TEACHER)
      this.AppError("馆长请使用超管生成的绑定码绑定微信", appCode.ADMIN_ERROR);
  }

  /** 消费绑定码，写入 openid */
  async wxBind(code, openId) {
    if (!code || !openId) this.AppError("参数错误");

    let cache = await CacheModel.getOne(
      { CACHE_KEY: this._bindCacheKey(code) },
      "CACHE_VALUE,CACHE_TIMEOUT",
      {},
      false,
    );
    if (!cache || !cache.CACHE_VALUE || !cache.CACHE_VALUE.val)
      this.AppError("绑定码无效或已过期");
    if (cache.CACHE_TIMEOUT < new Date().getTime())
      this.AppError("绑定码已过期，请重新生成");

    let meta = cache.CACHE_VALUE.val;
    let admin = await AdminModel.getOne({ _id: meta.adminId }, "*", {}, false);
    if (!admin) this.AppError("管理员不存在");
    if (admin.ADMIN_TYPE === AdminModel.TYPE.SUPER)
      this.AppError("超级管理员不支持微信绑定");

    let boundList = await AdminModel.getAll(
      {
        _pid: admin._pid,
        ADMIN_MINI_OPENID: openId,
        ADMIN_STATUS: 1,
      },
      "_id,ADMIN_NAME",
      {},
      10,
      false,
    );
    if (boundList && boundList.some((x) => x._id !== admin._id))
      this.AppError("该微信已绑定本馆其他管理员，请先解绑后再试");

    await AdminModel.edit(
      { _id: admin._id },
      {
        ADMIN_MINI_OPENID: openId,
        ADMIN_BIND_TIME: timeUtil.time(),
      },
      false,
    );

    await CacheModel.del({ CACHE_KEY: this._bindCacheKey(code) }, false);

    admin.ADMIN_MINI_OPENID = openId;
    let token = await this._issueToken(admin);
    await this.insertLog("绑定了微信并登录", admin, LogModel.TYPE.SYS);

    let tenant = await TenantModel.getOne(
      { _pid: admin._pid },
      "_pid,TENANT_NAME,TENANT_TEMPLATE",
      {},
      false,
    );

    return {
      ...this._formatSession(admin, token, admin._pid),
      tenantPid: admin._pid,
      tenant,
    };
  }

  _assertCanUnbindAdmin(operator, target, openId) {
    if (!target || !target.ADMIN_MINI_OPENID)
      this.AppError("该账号未绑定微信");

    if (target.ADMIN_TYPE === AdminModel.TYPE.SUPER)
      this.AppError("超级管理员不支持微信解绑");

    if (openId && target.ADMIN_MINI_OPENID === openId) return;

    if (!operator) this.AppError("无权限", appCode.ADMIN_ERROR);

    if (operator.ADMIN_TYPE === AdminModel.TYPE.SUPER) return;

    if (
      operator.ADMIN_TYPE === AdminModel.TYPE.OWNER &&
      operator._pid === target._pid
    ) {
      if (target.ADMIN_TYPE === AdminModel.TYPE.TEACHER) return;
      if (operator._id && operator._id === target._id) return;
      if (operator.ADMIN_ID && operator.ADMIN_ID === target.ADMIN_ID) return;
    }

    this.AppError("无权限解绑该账号", appCode.ADMIN_ERROR);
  }

  /** 解除微信绑定（本人或超管/馆长代解绑） */
  async wxUnbind(openId, pid, operator, adminId) {
    let admin;
    if (adminId) {
      admin = await AdminModel.getOne({ _id: adminId }, "*", {}, false);
    } else {
      if (!pid) this.AppError("请先选择瑜伽馆");
      admin = await AdminModel.getOne(
        {
          _pid: pid,
          ADMIN_MINI_OPENID: openId,
          ADMIN_STATUS: 1,
        },
        "*",
        {},
        false,
      );
    }
    if (!admin) this.AppError("未找到微信绑定记录");

    this._assertCanUnbindAdmin(operator, admin, openId);

    await AdminModel.edit(
      { _id: admin._id },
      {
        ADMIN_MINI_OPENID: "",
        ADMIN_BIND_TIME: 0,
        ADMIN_TOKEN: "",
        ADMIN_TOKEN_TIME: 0,
      },
      false,
    );

    await this.insertLog("解除了微信绑定", admin, LogModel.TYPE.SYS);

    return {
      adminName: admin.ADMIN_NAME,
      pid: admin._pid,
    };
  }

  /** 后台首页统计 */
  async adminHome(adminType, pid) {
    if (adminType === AdminModel.TYPE.SUPER && !pid) {
      let tenantList = await TenantModel.getAll(
        { TENANT_STATUS: TenantModel.STATUS.OPEN },
        "_pid,TENANT_ID,TENANT_NAME,TENANT_TEMPLATE",
        { TENANT_ADD_TIME: "asc" },
        100,
        false,
      );
      return { isSuper: true, tenantList: tenantList || [] };
    }

    if (!pid) this.AppError("请先选择瑜伽馆");

    let today = timeUtil.time("Y-M-D");
    let todayStart = timeUtil.time2Timestamp(today + " 00:00:00");
    let todayEnd = timeUtil.time2Timestamp(today + " 23:59:59");
    let monthStart = timeUtil.time2Timestamp(
      timeUtil.time("Y-M") + "-01 00:00:00",
    );

    global.PID = pid;

    let [meetCnt, joinCnt, userCnt, newsCnt, todayJoinCnt, newUserCnt] =
      await Promise.all([
        MeetModel.count({}),
        JoinModel.count({ JOIN_STATUS: JoinModel.STATUS.SUCC }),
        UserModel.count({}),
        adminType === AdminModel.TYPE.TEACHER
          ? Promise.resolve(0)
          : NewsModel.count({}),
        JoinModel.count({
          JOIN_STATUS: JoinModel.STATUS.SUCC,
          JOIN_ADD_TIME: ["between", todayStart, todayEnd],
        }),
        UserModel.count({
          USER_ADD_TIME: [">=", monthStart],
        }),
      ]);

    return {
      isSuper: false,
      meetCnt,
      joinCnt,
      userCnt,
      newsCnt,
      todayJoinCnt,
      newUserCnt,
      newCardCnt: 0,
    };
  }

  /** 列出某馆管理员及微信绑定状态 */
  async listBindableAdmins(pid, operator, adminType) {
    if (!pid) this.AppError("请先选择瑜伽馆");

    const opType = (operator && operator.ADMIN_TYPE) || adminType || "";
    if (
      opType !== AdminModel.TYPE.SUPER &&
      opType !== AdminModel.TYPE.OWNER
    ) {
      this.AppError("无权限", appCode.ADMIN_ERROR);
    }

    let where = {
      _pid: pid,
      ADMIN_STATUS: 1,
      ADMIN_TYPE: ["in", [AdminModel.TYPE.OWNER, AdminModel.TYPE.TEACHER]],
    };

    let list = await AdminModel.getAll(
      where,
      "ADMIN_ID,ADMIN_NAME,ADMIN_PHONE,ADMIN_TYPE,ADMIN_MINI_OPENID,ADMIN_BIND_TIME,_pid",
      { ADMIN_TYPE: "asc", ADMIN_ADD_TIME: "asc" },
      100,
      false,
    );

    return {
      pid,
      list: (list || []).map((item) => {
        const openid = item.ADMIN_MINI_OPENID
          ? String(item.ADMIN_MINI_OPENID).trim()
          : "";
        const bound = !!openid;
        const isOwner = item.ADMIN_TYPE === AdminModel.TYPE.OWNER;
        return {
          id: item._id,
          name: item.ADMIN_NAME,
          phone: item.ADMIN_PHONE,
          type: item.ADMIN_TYPE,
          typeLabel: isOwner ? "馆长" : "教练",
          bound,
          boundOpenid: bound ? openid.slice(-8) : "",
          bindTime: item.ADMIN_BIND_TIME || 0,
          canGenCode:
            opType === AdminModel.TYPE.SUPER ||
            (opType === AdminModel.TYPE.OWNER && !isOwner),
          canUnbind:
            opType === AdminModel.TYPE.SUPER ||
            (opType === AdminModel.TYPE.OWNER &&
              (!isOwner ||
                (operator &&
                  operator.ADMIN_ID &&
                  operator.ADMIN_ID === item.ADMIN_ID))),
        };
      }),
    };
  }
}

module.exports = AdminWxService;
