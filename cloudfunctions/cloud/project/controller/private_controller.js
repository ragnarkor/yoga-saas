/**
 * 会员端私教预约
 */

const BaseController = require("./base_controller.js");
const PrivateService = require("../service/private_service.js");
const FeatureGate = require("../utils/feature_gate.js");

class PrivateController extends BaseController {
  async getMeta() {
    await FeatureGate.check("booking");
    let service = new PrivateService();
    return await service.getMeta();
  }

  async getAvailableSlots() {
    await FeatureGate.check("booking");
    let rules = {
      meetId: "must|id|name=课程",
      teacherId: "must|string|name=教练",
      day: "must|date|name=日期",
    };
    let input = this.validateData(rules);
    let service = new PrivateService();
    return await service.getAvailableSlots(input);
  }

  async bookSession() {
    await FeatureGate.check("booking");
    let rules = {
      meetId: "must|id|name=课程",
      teacherId: "must|string|name=教练",
      teacherName: "string|name=教练姓名",
      day: "must|date|name=日期",
      start: "must|string|name=开始时间",
      cardId: "must|id|name=会员卡",
    };
    let input = this.validateData(rules);
    let service = new PrivateService();
    return await service.bookSession(this._userId, input);
  }
}

module.exports = PrivateController;
