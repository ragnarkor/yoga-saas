/**
 * Notes: 全局或者主页模块控制器
 */

const BaseController = require("./base_controller.js");
const HomeService = require("../service/home_service.js");

class HomeController extends BaseController {
  async getSetupAll() {
    let rules = {};
    this.validateData(rules);

    let service = new HomeService();
    let result = await service.getSetup(
      "SETUP_ABOUT,SETUP_ABOUT_PIC,SETUP_ADDRESS,SETUP_OFFICE_PIC,SETUP_PHONE,SETUP_SERVICE_PIC,SETUP_FEATURES,SETUP_LATITUDE,SETUP_LONGITUDE",
    );
    return result;
  }

  async getHomeIndex() {
    let rules = {};
    this.validateData(rules);
    let service = new HomeService();
    return await service.getHomeIndex();
  }

  async searchHome() {
    let rules = {
      keyword: "must|string|min:1|max:30|name=搜索关键词",
    };
    let input = this.validateData(rules);
    let service = new HomeService();
    return await service.searchHome(input.keyword);
  }

  async getTeacherDetail() {
    let rules = { id: "must|id" };
    let input = this.validateData(rules);
    let service = new HomeService();
    return await service.getTeacherDetail(input.id);
  }

  async getTeacherHome() {
    let rules = {
      id: "must|id",
      typeId: "string|default=0|name=分类",
    };
    let input = this.validateData(rules);
    let service = new HomeService();
    let result = await service.getTeacherHome(input.id, input.typeId);
    if (!result) this.AppError("老师不存在或未绑定微信");
    return result;
  }

  async getAnnounceDetail() {
    let rules = { id: "must|id" };
    let input = this.validateData(rules);
    let service = new HomeService();
    return await service.getAnnounceDetail(input.id);
  }
}

module.exports = HomeController;
