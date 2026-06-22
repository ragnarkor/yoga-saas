/**
 * Notes: 会员邀请（教练端生成码，用户扫码加入瑜伽馆）
 */

const BaseAdminService = require("./admin/base_admin_service.js");
const cloudBase = require("../../framework/cloud/cloud_base.js");
const cloudUtil = require("../../framework/cloud/cloud_util.js");
const dataUtil = require("../../framework/utils/data_util.js");
const timeUtil = require("../../framework/utils/time_util.js");

const CacheModel = require("../model/cache_model.js");
const TenantModel = require("../model/tenant_model.js");
const UserModel = require("../model/user_model.js");
const config = require("../../config/config.js");

const INVITE_PREFIX = "member_invite_";
const INVITE_PID_PREFIX = "member_invite_pid_";
const INVITE_TTL = 86400 * 365;

class MemberInviteService extends BaseAdminService {
  _inviteKey(code) {
    return INVITE_PREFIX + code;
  }

  _pidKey(pid) {
    return INVITE_PID_PREFIX + pid;
  }

  async _getOrCreateCode(pid) {
    let pidCache = await CacheModel.getOne(
      { CACHE_KEY: this._pidKey(pid) },
      "*",
      {},
      false,
    );
    if (pidCache?.CACHE_VALUE?.val?.code) {
      return pidCache.CACHE_VALUE.val.code;
    }

    let code = dataUtil.genRandomString(16);
    let timeout = new Date().getTime() + INVITE_TTL * 1000;
    let val = { pid, code };

    await CacheModel.insertOrUpdate(
      { CACHE_KEY: this._pidKey(pid) },
      { CACHE_VALUE: { val }, CACHE_TIMEOUT: timeout },
      false,
    );
    await CacheModel.insertOrUpdate(
      { CACHE_KEY: this._inviteKey(code) },
      { CACHE_VALUE: { val: { pid } }, CACHE_TIMEOUT: timeout },
      false,
    );

    return code;
  }

  async resolveInviteCode(code) {
    if (!code) return null;

    let cache = await CacheModel.getOne(
      { CACHE_KEY: this._inviteKey(code) },
      "*",
      {},
      false,
    );
    if (!cache?.CACHE_VALUE?.val?.pid) return null;
    if (cache.CACHE_TIMEOUT && cache.CACHE_TIMEOUT < Date.now()) return null;

    return cache.CACHE_VALUE.val.pid;
  }

  /** 生成/获取该馆的会员邀请小程序码 */
  async genInviteQr(pid) {
    let tenant = await TenantModel.getOne({ _pid: pid }, "*", {}, false);
    if (!tenant) this.AppError("瑜伽馆不存在");
    if (tenant.TENANT_STATUS !== TenantModel.STATUS.OPEN) {
      this.AppError("该瑜伽馆暂未开放");
    }

    let code = await this._getOrCreateCode(pid);
    let scene = "i" + code;
    if (scene.length > 32) this.AppError("邀请码异常，请重试");

    let cloud = cloudBase.getCloud();
    let page = "pages/public/member_invite/member_invite";
    let envVersion = config.TEST_MODE ? "trial" : "release";

    let result = await cloud.openapi.wxacode.getUnlimited({
      scene,
      width: 430,
      check_path: false,
      env_version: envVersion,
      page,
    });

    let cloudPath = (config.MEMBER_INVITE_QR_PATH || "invite/member/") + pid + ".png";
    let upload = await cloud.uploadFile({
      cloudPath,
      fileContent: result.buffer,
    });
    if (!upload?.fileID) this.AppError("邀请码生成失败");

    let qrUrl = await cloudUtil.getTempFileURLOne(upload.fileID);

    return {
      qrUrl,
      fileID: upload.fileID,
      code,
      tenantName: tenant.TENANT_NAME,
      sharePath: `/pages/public/member_invite/member_invite?code=${code}`,
    };
  }

  /** 用户扫码/点击邀请链接，加入瑜伽馆 */
  async joinTenant(userId, code) {
    let pid = await this.resolveInviteCode(code);
    if (!pid) this.AppError("邀请链接无效或已过期");

    let tenant = await TenantModel.getOne({ _pid: pid }, "*", {}, false);
    if (!tenant || tenant.TENANT_STATUS !== TenantModel.STATUS.OPEN) {
      this.AppError("该瑜伽馆暂未开放");
    }

    global.PID = pid;

    let where = { USER_MINI_OPENID: userId };
    let exists = await UserModel.count(where, true);
    let isNew = exists === 0;

    if (isNew) {
      let globalUser = await UserModel.getOne(
        where,
        "USER_NAME,USER_MOBILE,USER_PIC,USER_CITY,USER_WORK,USER_TRADE",
        {},
        false,
      );
      let data = {
        USER_MINI_OPENID: userId,
        USER_STATUS: UserModel.STATUS.COMM,
        USER_LOGIN_TIME: timeUtil.time(),
        USER_LOGIN_CNT: 1,
      };
      if (globalUser) {
        if (globalUser.USER_NAME) data.USER_NAME = globalUser.USER_NAME;
        if (globalUser.USER_MOBILE) data.USER_MOBILE = globalUser.USER_MOBILE;
        if (globalUser.USER_PIC) data.USER_PIC = globalUser.USER_PIC;
        if (globalUser.USER_CITY) data.USER_CITY = globalUser.USER_CITY;
        if (globalUser.USER_WORK) data.USER_WORK = globalUser.USER_WORK;
        if (globalUser.USER_TRADE) data.USER_TRADE = globalUser.USER_TRADE;
      }
      await UserModel.insert(data, true);
    } else {
      let user = await UserModel.getOne(where, "USER_LOGIN_CNT", {}, true);
      await UserModel.edit(
        where,
        {
          USER_LOGIN_TIME: timeUtil.time(),
          USER_LOGIN_CNT: (user?.USER_LOGIN_CNT || 0) + 1,
        },
        true,
      );
    }

    return {
      isNew,
      tenant: {
        _pid: tenant._pid,
        TENANT_NAME: tenant.TENANT_NAME,
        TENANT_LOGO: tenant.TENANT_LOGO,
        TENANT_TEMPLATE: tenant.TENANT_TEMPLATE || "default",
      },
    };
  }
}

module.exports = MemberInviteService;
