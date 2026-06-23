/**
 * Notes: 管理员控制模块
 */

const BaseAdminController = require("./base_admin_controller.js");
const LogModel = require("../../model/log_model.js");
const AdminMgrService = require("../../service/admin/admin_mgr_service.js");
const timeUtil = require("../../../framework/utils/time_util.js");
const util = require("../../../framework/utils/util.js");

class AdminMgrController extends BaseAdminController {
  async getLogList() {
    await this.isAdmin();

    let rules = {
      search: "string|min:1|max:30|name=搜索条件",
      sortType: "string|name=搜索类型",
      sortVal: "name=搜索类型值",
      orderBy: "object|name=排序",
      whereEx: "object|name=附加查询条件",
      page: "must|int|default=1",
      size: "int",
      isTotal: "bool",
      oldTotal: "int",
    };

    let input = this.validateData(rules);

    let service = new AdminMgrService();
    let result = await service.getLogList(input);

    let list = result.list;
    for (let k in list) {
      list[k].LOG_TYPE_DESC = LogModel.getDesc("TYPE", list[k].LOG_TYPE);
      list[k].LOG_ADD_TIME = timeUtil.timestamp2Time(list[k].LOG_ADD_TIME);
    }
    result.list = list;

    return result;
  }

  /** 超管：馆管理员列表 */
  async getAdminList() {
    await this.isSuperAdmin();
    let rules = {
      pid: "must|string|name=瑜伽馆ID",
    };
    let input = this.validateData(rules);
    let service = new AdminMgrService();
    return await service.getAdminList(input.pid);
  }

  /** 超管：新建管理员 */
  async insertAdmin() {
    await this.isSuperAdmin();
    let rules = {
      pid: "must|string|name=瑜伽馆",
      name: "must|string|min:1|max:20|name=姓名",
      phone: "must|string|min:5|max:30|name=手机号",
      pwd: "must|string|min:5|max:30|name=密码",
      adminType: "must|string|name=角色",
    };
    let input = this.validateData(rules);
    let service = new AdminMgrService();
    return await service.insertAdmin(
      input.pid,
      input.name,
      input.phone,
      input.pwd,
      input.adminType,
      this._admin,
    );
  }
}

module.exports = AdminMgrController;
