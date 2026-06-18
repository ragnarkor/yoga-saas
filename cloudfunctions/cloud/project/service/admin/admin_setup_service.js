/**
 * Notes: 设置管理
 * Ver : CCMiniCloud Framework 2.0.1 ALL RIGHTS RESERVED BY cclinux@qq.com
 * Date: 2021-07-11 07:48:00
 */

const BaseAdminService = require("./base_admin_service.js");
const cloudBase = require("../../../framework/cloud/cloud_base.js");
const cloudUtil = require("../../../framework/cloud/cloud_util.js");
const SetupModel = require("../../model/setup_model.js");
const config = require("../../../config/config.js");

class AdminSetupService extends BaseAdminService {
  /** 关于我们 */
  async setupAbout({ about, aboutPic }) {
    this.AppError("此功能暂不开放，如有需要请加作者微信：cclinux0730");
  }

  /** 联系我们设置 */
  async setupContact({ address, phone, officePic, servicePic }) {
    this.AppError("此功能暂不开放，如有需要请加作者微信：cclinux0730");
  }

  /** 小程序码 */
  async genMiniQr() {
    //生成小程序qr buffer
    let cloud = cloudBase.getCloud();

    let page =
      "projects/" + this.getProjectId() + "/default/index/default_index";
    console.log(page);

    let result = await cloud.openapi.wxacode.getUnlimited({
      scene: "qr",
      width: 280,
      check_path: false,
      env_version: "release", //trial,develop
      page,
    });

    let upload = await cloud.uploadFile({
      cloudPath: config.SETUP_PATH + "qr.png",
      fileContent: result.buffer,
    });

    if (!upload || !upload.fileID) return;

    return upload.fileID;
  }

  // [AI_START TIMESTAMP=2025-01-25 12:00:00]
  /** 功能开关设置 */
  async setupFeature(features) {
    let where = {};
    let data = { SETUP_FEATURES: features };
    await SetupModel.edit(where, data);
  }

  /** 获取功能开关配置 */
  async getFeature() {
    let setup = await SetupModel.getOne({}, "SETUP_FEATURES");
    return (setup && setup.SETUP_FEATURES) || {};
  }
  // [AI_END LINES=12 TIMESTAMP=2025-01-25 12:00:00]
}

module.exports = AdminSetupService;
