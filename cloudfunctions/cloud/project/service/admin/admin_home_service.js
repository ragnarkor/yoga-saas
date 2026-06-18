/**
 * Notes: 后台HOME/登录模块
 * Date: 2021-03-15 07:48:00
 */

const BaseAdminService = require("./base_admin_service.js");

const dataUtil = require("../../../framework/utils/data_util.js");
const cacheUtil = require("../../../framework/utils/cache_util.js");

const cloudBase = require("../../../framework/cloud/cloud_base.js");
const timeUtil = require("../../../framework/utils/time_util.js");
const config = require("../../../config/config.js");
const AdminModel = require("../../model/admin_model.js");
const LogModel = require("../../model/log_model.js");

const UserModel = require("../../model/user_model.js");
const MeetModel = require("../../model/meet_model.js");
const NewsModel = require("../../model/news_model.js");
const JoinModel = require("../../model/join_model.js");
// [AI_START TIMESTAMP=2025-01-25 12:00:00]
const SetupModel = require("../../model/setup_model.js");
// [AI_END LINES=1 TIMESTAMP=2025-01-25 12:00:00]

class AdminHomeService extends BaseAdminService {
  /**
   * 首页数据归集
   */
  async adminHome() {
    let where = {};

    let userCnt = await UserModel.count(where);
    let meetCnt = await MeetModel.count(where);
    let newsCnt = await NewsModel.count(where);
    let joinCnt = await JoinModel.count(where);
    // [AI_START TIMESTAMP=2025-01-25 12:00:00]
    let features = {};
    try {
      let setup = await SetupModel.getOne({}, "SETUP_FEATURES");
      if (setup && setup.SETUP_FEATURES) features = setup.SETUP_FEATURES;
    } catch (e) {}
    // [AI_END LINES=5 TIMESTAMP=2025-01-25 12:00:00]
    return {
      userCnt,
      meetCnt,
      newsCnt,
      joinCnt,
      features,
    };
  }

  /** 清除缓存 */
  async clearCache() {
    await cacheUtil.clear();
  }

  /**
   * 管理员登录（多租户模式下按手机号+密码查库）
   * @param {*} phone
   * @param {*} password
   */
  async adminLogin(phone, password) {
    // 通过手机号+密码查询本馆管理员（_pid自动注入）
    let where = {
      ADMIN_PHONE: phone,
      ADMIN_PWD: password,
      ADMIN_STATUS: 1,
    };
    let fields =
      "ADMIN_ID,ADMIN_NAME,ADMIN_TYPE,ADMIN_LOGIN_TIME,ADMIN_LOGIN_CNT";
    let admin = await AdminModel.getOne(where, fields);
    if (!admin) this.AppError("管理员账号或密码不正确");

    let cnt = admin.ADMIN_LOGIN_CNT;

    // 生成token
    let token = dataUtil.genRandomString(32);
    let tokenTime = timeUtil.time();
    let data = {
      ADMIN_TOKEN: token,
      ADMIN_TOKEN_TIME: tokenTime,
      ADMIN_LOGIN_TIME: timeUtil.time(),
      ADMIN_LOGIN_CNT: cnt + 1,
    };
    await AdminModel.edit(where, data);

    // ADMIN_TYPE 已改为 string 类型（owner/teacher）
    let type = admin.ADMIN_TYPE;
    let last = !admin.ADMIN_LOGIN_TIME
      ? "尚未登录"
      : timeUtil.timestamp2Time(admin.ADMIN_LOGIN_TIME);

    // 写日志
    this.insertLog("登录了系统", admin, LogModel.TYPE.SYS);

    return {
      token,
      name: admin.ADMIN_NAME,
      type,
      last,
      cnt,
    };
  }
}

module.exports = AdminHomeService;
