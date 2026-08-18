/**
 * Notes: 设置控制模块
 * Ver : CCMiniCloud Framework 2.0.1 ALL RIGHTS RESERVED BY cclinux@qq.com
 * Date: 2021-07-11 10:20:00
 */

const BaseAdminController = require("./base_admin_controller.js");
const AdminSetupService = require("../../service/admin/admin_setup_service.js");
const AdminModel = require("../../model/admin_model.js");
const homeCacheUtil = require("../../utils/home_cache_util.js");
const DbIndexService = require("../../service/db_index_service.js");

const contentCheck = require("../../../framework/validate/content_check.js");

class AdminSetupController extends BaseAdminController {
  /**  关于我们 */
  async setupAbout() {
    await this.isAdmin();

    // 数据校验
    let rules = {
      about: "must|string|min:10|max:50000|name=关于我们",
      aboutPic: "array|name=介绍图片",
    };

    // 取得数据
    let input = this.validateData(rules);
    let service = new AdminSetupService();
    await service.setupAbout(input);
    await homeCacheUtil.invalidateHomeCache(global.PID);
  }

  /**  联系我们 */
  async setupContact() {
    await this.isAdmin();

    // 数据校验
    let rules = {
      phone: "string|name=电话",
      address: "string|name=地址",
      servicePic: "array|name=客服二维码图片",
      officePic: "array|name=官微二维码图片",
    };

    // 取得数据
    let input = this.validateData(rules);
    let service = new AdminSetupService();
    await service.setupContact(input);
    await homeCacheUtil.invalidateHomeCache(global.PID);
  }

  async genMiniQr() {
    await this.isAdmin();
    let service = new AdminSetupService();
    return await service.genMiniQr();
  }

  // [AI_START TIMESTAMP=2025-01-25 12:00:00]
  /** 功能开关设置（仅馆长） */
  async setupFeature() {
    await this.isSuperAdmin();

    let rules = {
      features: "must|object|name=功能开关配置",
      pid: "string|false|name=租户ID",
    };

    let input = this.validateData(rules);
    let service = new AdminSetupService();
    let pid = String(input.pid || global.PID || "").trim();
    if (!pid) this.AppError("请选择瑜伽馆");
    await service.setupFeatureForPid(pid, input.features);
    await homeCacheUtil.invalidateHomeCache(pid);
  }

  /** 获取功能开关配置 */
  async getFeature() {
    await this.isAdmin();

    let rules = {
      pid: "string|false|name=租户ID",
    };
    let input = this.validateData(rules);
    let pid = String(input.pid || global.PID || "").trim();
    if (input.pid && this._adminType !== AdminModel.TYPE.SUPER) {
      this.AppError("无权限查看其他瑜伽馆配置");
    }

    let service = new AdminSetupService();
    let features = await service.getFeatureForPid(pid);
    return { features, pid: pid || "" };
  }

  async ensureDbIndexes() {
    await this.isSuperAdmin();
    return await new DbIndexService().ensureIndexes();
  }
  // [AI_END LINES=17 TIMESTAMP=2025-01-25 12:00:00]
}

module.exports = AdminSetupController;
