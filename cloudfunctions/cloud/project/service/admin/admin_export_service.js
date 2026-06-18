/**
 * Notes: 预约后台管理
 * Ver : CCMiniCloud Framework 2.0.1 ALL RIGHTS RESERVED BY www.code3721.com
 * Date: 2022-12-08 07:48:00
 */

const BaseAdminService = require("./base_admin_service.js");
const timeUtil = require("../../../framework/utils/time_util.js");

const MeetModel = require("../../model/meet_model.js");
const JoinModel = require("../../model/join_model.js");
const UserModel = require("../../model/user_model.js");

const DataService = require("./../data_service");

const EXPORT_JOIN_DATA_KEY = "join_data";
const EXPORT_USER_DATA_KEY = "user_data";

class AdminExportService extends BaseAdminService {
  /**获取报名数据 */
  async getJoinDataURL() {
    let dataService = new DataService();
    return await dataService.getExportDataURL(EXPORT_JOIN_DATA_KEY);
  }

  /**删除报名数据 */
  async deleteJoinDataExcel() {
    let dataService = new DataService();
    return await dataService.deleteDataExcel(EXPORT_JOIN_DATA_KEY);
  }

  _getValByForm(arr, mark, title) {
    for (let k in arr) {
      if (arr[k].mark == mark) return arr[k].val;
      if (arr[k].title == title) return arr[k].val;
    }
    return "";
  }

  /**导出报名数据 */
  async exportJoinDataExcel({ meetId, startDay, endDay, status }) {
    let where = {
      JOIN_MEET_ID: meetId,
      JOIN_MEET_DAY: ["between", startDay, endDay],
    };

    if (status == 1) where.JOIN_STATUS = JoinModel.STATUS.SUCC;
    else if (status == 10) where.JOIN_STATUS = JoinModel.STATUS.CANCEL;
    else if (status == 99) where.JOIN_STATUS = JoinModel.STATUS.ADMIN_CANCEL;

    let orderBy = {
      JOIN_MEET_DAY: "asc",
      JOIN_MEET_TIME_START: "asc",
      JOIN_ADD_TIME: "desc",
    };
    let fields =
      "JOIN_FORMS,JOIN_MEET_DAY,JOIN_MEET_TIME_START,JOIN_MEET_TIME_END,JOIN_STATUS,JOIN_IS_CHECKIN,JOIN_CODE,JOIN_ADD_TIME,JOIN_REASON";

    let list = await JoinModel.getAll(where, fields, orderBy, 5000);

    let data = [];
    data.push([
      "姓名",
      "手机",
      "预约日期",
      "开始时间",
      "结束时间",
      "状态",
      "签到",
      "核验码",
      "预约时间",
      "备注",
    ]);

    for (let k in list) {
      let row = list[k];
      let name = this._getValByForm(row.JOIN_FORMS, "", "姓名");
      let mobile = this._getValByForm(row.JOIN_FORMS, "", "手机");
      let statusDesc = JoinModel.getDesc("STATUS", row.JOIN_STATUS);
      let checkinDesc = row.JOIN_IS_CHECKIN == 1 ? "已签到" : "未签到";
      data.push([
        name,
        mobile,
        row.JOIN_MEET_DAY,
        row.JOIN_MEET_TIME_START,
        row.JOIN_MEET_TIME_END,
        statusDesc,
        checkinDesc,
        row.JOIN_CODE,
        timeUtil.timestamp2Time(row.JOIN_ADD_TIME, "Y-M-D h:m:s"),
        row.JOIN_REASON || "",
      ]);
    }

    let dataService = new DataService();
    return await dataService.exportDataExcel(
      EXPORT_JOIN_DATA_KEY,
      "预约名单",
      list.length,
      data,
    );
  }

  /**获取用户数据 */
  async getUserDataURL() {
    let dataService = new DataService();
    return await dataService.getExportDataURL(EXPORT_USER_DATA_KEY);
  }

  /**删除用户数据 */
  async deleteUserDataExcel() {
    let dataService = new DataService();
    return await dataService.deleteDataExcel(EXPORT_USER_DATA_KEY);
  }

  /**导出用户数据 */
  async exportUserDataExcel(condition) {
    let where = {};
    if (condition) {
      try {
        where = JSON.parse(decodeURIComponent(condition));
      } catch (ex) {
        where = {};
      }
    }

    let orderBy = { USER_ADD_TIME: "desc" };
    let list = await UserModel.getAll(where, "*", orderBy, 5000);

    let data = [];
    data.push([
      "姓名",
      "手机",
      "单位",
      "城市",
      "领域",
      "状态",
      "登录次数",
      "最近登录",
      "注册时间",
    ]);

    for (let k in list) {
      let row = list[k];
      data.push([
        row.USER_NAME || "",
        row.USER_MOBILE || "",
        row.USER_WORK || "",
        row.USER_CITY || "",
        row.USER_TRADE || "",
        UserModel.getDesc("STATUS", row.USER_STATUS),
        row.USER_LOGIN_CNT || 0,
        row.USER_LOGIN_TIME
          ? timeUtil.timestamp2Time(row.USER_LOGIN_TIME, "Y-M-D h:m:s")
          : "",
        timeUtil.timestamp2Time(row.USER_ADD_TIME, "Y-M-D h:m:s"),
      ]);
    }

    let dataService = new DataService();
    return await dataService.exportDataExcel(
      EXPORT_USER_DATA_KEY,
      "客户数据",
      list.length,
      data,
    );
  }
}

module.exports = AdminExportService;
