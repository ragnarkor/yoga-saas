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
const tenantSetupHelper = require("../tenant_setup_helper.js");
const timeUtil = require("../../../framework/utils/time_util.js");

class AdminSetupService extends BaseAdminService {
  /** 关于我们 */
  async setupAbout({ about, aboutPic }) {
    let where = {};
    let setup = await SetupModel.getOne(where, "SETUP_ABOUT_PIC");
    let oldPics = (setup && setup.SETUP_ABOUT_PIC) || [];
    aboutPic = await cloudUtil.handlerCloudFiles(oldPics, aboutPic || []);
    await SetupModel.edit(where, {
      SETUP_ABOUT: about,
      SETUP_ABOUT_PIC: aboutPic,
    });
  }

  /** 联系我们设置 */
  async setupContact({ address, phone, officePic, servicePic }) {
    let where = {};
    let setup = await SetupModel.getOne(
      where,
      "SETUP_OFFICE_PIC,SETUP_SERVICE_PIC",
    );
    let oldOffice = (setup && setup.SETUP_OFFICE_PIC) || [];
    let oldService = (setup && setup.SETUP_SERVICE_PIC) || [];
    officePic = await cloudUtil.handlerCloudFiles(oldOffice, officePic || []);
    servicePic = await cloudUtil.handlerCloudFiles(oldService, servicePic || []);
    await SetupModel.edit(where, {
      SETUP_ADDRESS: address || "",
      SETUP_PHONE: phone || "",
      SETUP_OFFICE_PIC: officePic,
      SETUP_SERVICE_PIC: servicePic,
    });
  }

  /** 小程序码 */
  async genMiniQr() {
    let cloud = cloudBase.getCloud();

    let page = "pages/default/index/default_index";
    console.log(page);

    let result = await cloud.openapi.wxacode.getUnlimited({
      scene: "qr",
      width: 280,
      check_path: false,
      env_version: "release",
      page,
    });

    let upload = await cloud.uploadFile({
      cloudPath: config.SETUP_PATH + "qr.png",
      fileContent: result.buffer,
    });

    if (!upload || !upload.fileID) return;

    return upload.fileID;
  }

  _defaultFeatures() {
    return {
      booking: true,
      payment: false,
      teacherManage: true,
      checkin: true,
      news: true,
      selfCheckin: true,
    };
  }

  /** 功能开关设置 */
  async setupFeature(features) {
    let where = {};
    let data = { SETUP_FEATURES: features };
    await SetupModel.edit(where, data);
  }

  async setupFeatureForPid(pid, features) {
    pid = String(pid || "").trim();
    if (!pid) this.AppError("请选择瑜伽馆");

    let setup = await tenantSetupHelper.getSetupForPid(pid, "_pid");
    if (!setup) {
      const prevPid = global.PID;
      global.PID = pid;
      try {
        await SetupModel.insert({
          SETUP_ABOUT: "",
          SETUP_FEATURES: Object.assign({}, this._defaultFeatures(), features || {}),
          SETUP_ADD_TIME: timeUtil.time(),
          SETUP_EDIT_TIME: timeUtil.time(),
        });
      } finally {
        global.PID = prevPid;
      }
      return;
    }

    await SetupModel.edit(
      { _pid: pid },
      {
        SETUP_FEATURES: features,
        SETUP_EDIT_TIME: timeUtil.time(),
      },
      false,
    );
  }

  /** 获取功能开关配置 */
  async getFeature() {
    let setup = await SetupModel.getOne({}, "SETUP_FEATURES");
    return this.getFeatureForPid(global.PID || "", setup);
  }

  async getFeatureForPid(pid, cachedSetup) {
    pid = String(pid || "").trim();
    let setup = cachedSetup;
    if (!setup && pid) {
      setup = await tenantSetupHelper.getSetupForPid(pid, "SETUP_FEATURES");
    } else if (!setup) {
      setup = await SetupModel.getOne({}, "SETUP_FEATURES");
    }
    return Object.assign(
      {},
      this._defaultFeatures(),
      (setup && setup.SETUP_FEATURES) || {},
    );
  }
}

module.exports = AdminSetupService;
