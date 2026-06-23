/**
 * 私教预约控制器
 */

const BaseAdminController = require("./base_admin_controller.js");
const AdminPrivateService = require("../../service/admin/admin_private_service.js");

class AdminPrivateController extends BaseAdminController {
  async getMeta() {
    await this.isAdmin();
    let service = new AdminPrivateService();
    return await service.getMeta();
  }

  async listSessions() {
    await this.isAdmin();
    let rules = {
      startDay: "must|date|name=开始日期",
      endDay: "must|date|name=结束日期",
      teacherId: "string|name=教练ID",
    };
    let input = this.validateData(rules);
    let service = new AdminPrivateService();
    return await service.listSessions(input);
  }

  async checkSlot() {
    await this.isAdmin();
    let rules = {
      teacherId: "must|string|name=教练",
      day: "must|date|name=日期",
      start: "must|string|name=开始时间",
      end: "must|string|name=结束时间",
      bufferPreset: "string|name=缓冲预设",
      bufferBefore: "int|name=课前缓冲",
      bufferAfter: "int|name=课后缓冲",
      excludeMark: "string|name=排除时段",
    };
    let input = this.validateData(rules);
    let service = new AdminPrivateService();
    return await service.checkSlot(input);
  }

  async bookSession() {
    await this.isAdmin();
    let rules = {
      meetId: "must|id|name=课程",
      userId: "must|string|name=会员",
      day: "must|date|name=日期",
      start: "must|string|name=开始时间",
      end: "string|name=结束时间",
      teacherId: "must|string|name=教练",
      teacherName: "string|name=教练姓名",
      cardId: "string|name=会员卡",
      bufferPreset: "string|name=缓冲预设",
      bufferBefore: "int|name=课前缓冲",
      bufferAfter: "int|name=课后缓冲",
      force: "bool|name=强制预约",
      memo: "string|max:50|name=备注",
    };
    let input = this.validateData(rules);
    let service = new AdminPrivateService();
    return await service.bookSession(this._admin, input);
  }
}

module.exports = AdminPrivateController;
