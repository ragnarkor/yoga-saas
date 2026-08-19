/**
 * Notes: 后台管理模块 基类
 * Date: 2021-03-15 07:48:00
 */

const BaseService = require("../base_service.js");

const cloudBase = require("../../../framework/cloud/cloud_base.js");
const timeUtil = require("../../../framework/utils/time_util.js");
const appCode = require("../../../framework/core/app_code.js");

const config = require("../../../config/config.js");

const AdminModel = require("../../model/admin_model.js");
const LogModel = require("../../model/log_model.js");
const PlatformLogModel = require("../../model/platform_log_model.js");
const MeetModel = require("../../model/meet_model.js");
const UserModel = require("../../model/user_model.js");
const NewsModel = require("../../model/news_model.js");
const tenantAuthorizationUtil = require("../../utils/tenant_authorization_util.js");

class BaseAdminService extends BaseService {
  /** 解析管理员：token 优先，其次 openid+当前馆 PID（馆长/教练） */
  async resolveAdmin(token, openId, pid) {
    let admin = await this._tryTokenAdmin(token);
    if (admin) {
      if (
        tenantAuthorizationUtil.canAccessTenant(
          admin,
          pid,
          AdminModel.TYPE.SUPER,
        )
      )
        return admin;
      this.AppError("无权访问当前瑜伽馆", appCode.ADMIN_ERROR);
    }

    if (openId && pid) {
      admin = await AdminModel.getOne(
        {
          _pid: pid,
          ADMIN_MINI_OPENID: openId,
          ADMIN_STATUS: 1,
          ADMIN_TYPE: ["in", [AdminModel.TYPE.OWNER, AdminModel.TYPE.TEACHER]],
        },
        "ADMIN_ID,ADMIN_PHONE,ADMIN_NAME,ADMIN_TYPE,_pid",
        {},
        false,
      );
      if (admin) return admin;
    }

    this.AppError("管理员不存在", appCode.ADMIN_ERROR);
  }

  async _tryTokenAdmin(token) {
    if (
      config.MASK_IS_OPEN &&
      token == config.MASK_ADMIN_PHONE + config.MASK_ADMIN_TOKEN
    ) {
      let admin = {};
      admin.ADMIN_NAME = "mask-admin";
      admin.ADMIN_ID = "9999";
      admin.ADMIN_PHONE = config.MASK_ADMIN_PHONE;
      admin.ADMIN_LOGIN_CNT = 9999;
      admin.ADMIN_LOGIN_TIME = "";
      admin.ADMIN_TYPE = AdminModel.TYPE.OWNER;
      admin.ADMIN_STATUS = 1;
      return admin;
    }
    if (config.IS_DEMO) {
      let admin = {};
      admin.ADMIN_NAME = "体验用户";
      admin.ADMIN_ID = "1";
      admin.ADMIN_PHONE = "13900000000";
      admin.ADMIN_LOGIN_CNT = 0;
      admin.ADMIN_LOGIN_TIME = "";
      admin.ADMIN_TYPE = AdminModel.TYPE.OWNER;
      admin.ADMIN_STATUS = 1;
      return admin;
    }

    if (!token) return null;

    let where = {
      ADMIN_TOKEN: token,
      ADMIN_TOKEN_TIME: [
        ">",
        timeUtil.time() - config.ADMIN_LOGIN_EXPIRE * 1000,
      ],
      ADMIN_STATUS: 1,
    };
    return await AdminModel.getOne(
      where,
      "ADMIN_ID,ADMIN_PHONE,ADMIN_NAME,ADMIN_TYPE,_pid",
      {},
      false,
    );
  }

  /** 是否管理员（token 全局唯一，不按 PID 过滤） */
  async isAdmin(token, openId, pid) {
    return await this.resolveAdmin(token, openId, pid);
  }

  /** 是否超级管理员(super)，平台级跨租户 */
  async isSuperAdmin(token) {
    if (
      config.MASK_IS_OPEN &&
      token == config.MASK_ADMIN_PHONE + config.MASK_ADMIN_TOKEN
    ) {
      let admin = {};
      admin.ADMIN_NAME = "mask-admin";
      admin.ADMIN_ID = "9999";
      admin.ADMIN_PHONE = config.MASK_ADMIN_PHONE;
      admin.ADMIN_LOGIN_CNT = 9999;
      admin.ADMIN_LOGIN_TIME = "";
      admin.ADMIN_TYPE = AdminModel.TYPE.SUPER;
      admin.ADMIN_STATUS = 1;
      return admin;
    }

    let where = {
      ADMIN_TOKEN: token,
      ADMIN_TOKEN_TIME: [
        ">",
        timeUtil.time() - config.ADMIN_LOGIN_EXPIRE * 1000,
      ],
      ADMIN_STATUS: 1,
      ADMIN_TYPE: AdminModel.TYPE.SUPER,
    };
    let admin = await AdminModel.getOne(
      where,
      "ADMIN_ID,ADMIN_PHONE,ADMIN_NAME,ADMIN_TYPE",
      {},
      false,
    );
    if (!admin) this.AppError("超级管理员权限不足", appCode.ADMIN_ERROR);

    return admin;
  }
  // [AI_END LINES=35 TIMESTAMP=2025-01-25 16:30:00]
  /** 写入日志 */
  async insertLog(content, admin, type) {
    if (!admin) return;

    if (
      config.MASK_IS_OPEN &&
      config.MASK_ADMIN_PHONE &&
      admin.ADMIN_PHONE == config.MASK_ADMIN_PHONE
    )
      return;

    let data = {
      LOG_CONTENT: content,

      LOG_ADMIN_ID: admin.ADMIN_ID,
      LOG_ADMIN_NAME: admin.ADMIN_NAME,
      LOG_TYPE: type,
    };
    await LogModel.insert(data);
  }

  /**
   * 写入平台超管审计日志（跨租户操作）
   * 固定落在 PlatformLogModel.PLATFORM_PID，与馆级 ax_log 分离，_pid 不随 global.PID 漂移。
   * @param {string} action     动作码，取 PlatformLogModel.ACTION
   * @param {object} operator   操作人（this._admin）：{ADMIN_ID, ADMIN_NAME, ADMIN_PHONE, ADMIN_TYPE}
   * @param {object} extra      { content, targetPid, targetName, before, after }
   */
  async insertPlatformLog(action, operator, extra = {}) {
    if (!operator) return;

    // 打码账号不落审计（与 insertLog 口径一致）
    if (
      config.MASK_IS_OPEN &&
      config.MASK_ADMIN_PHONE &&
      operator.ADMIN_PHONE == config.MASK_ADMIN_PHONE
    )
      return;

    const desc = PlatformLogModel.ACTION_DESC[action] || action;
    let data = {
      _pid: PlatformLogModel.PLATFORM_PID,

      PLOG_ACTION: action,
      PLOG_CONTENT: extra.content || desc,

      PLOG_ADMIN_ID: operator.ADMIN_ID || "",
      PLOG_ADMIN_NAME: operator.ADMIN_NAME || "",
      PLOG_ADMIN_PHONE: operator.ADMIN_PHONE || "",
      PLOG_ADMIN_TYPE: operator.ADMIN_TYPE || "",

      PLOG_TARGET_PID: extra.targetPid || "",
      PLOG_TARGET_NAME: extra.targetName || "",
      PLOG_BEFORE: extra.before != null ? String(extra.before) : "",
      PLOG_AFTER: extra.after != null ? String(extra.after) : "",
    };

    // mustPID=false：不注入 global.PID，用上面固定的 PLATFORM_PID
    try {
      await PlatformLogModel.insert(data, false);
    } catch (e) {
      // 审计写入失败不应阻断主业务
    }
  }

  /** 日志操作前获取名称 */
  async getNameBeforeLog(type, oid) {
    let name = "";
    switch (type) {
      case "news": {
        let news = await NewsModel.getOne(oid, "NEWS_TITLE");
        name = news.NEWS_TITLE;
        break;
      }
      case "meet": {
        let meet = await MeetModel.getOne(oid, "MEET_TITLE");
        name = meet.MEET_TITLE;
        break;
      }
      case "admin": {
        let admin = await AdminModel.getOne(oid, "ADMIN_NAME");
        name = admin.ADMIN_NAME;
        break;
      }
      case "user": {
        let user = await UserModel.getOne(
          {
            USER_MINI_OPENID: oid,
          },
          "USER_MOBILE",
        );
        name = user.USER_MOBILE;
        break;
      }
    }
    return name;
  }
}

module.exports = BaseAdminService;
