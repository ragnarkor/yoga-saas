/**
 * Notes: 功能开关校验
 */

const SetupModel = require("../model/setup_model.js");
const AppError = require("../../framework/core/app_error.js");
const appCode = require("../../framework/core/app_code.js");

const DEFAULT_FEATURES = {
  booking: true,
  payment: false,
  teacherManage: true,
  checkin: true,
  news: true,
  selfCheckin: true,
};

class FeatureGate {
  static async check(featureName) {
    let setup = await SetupModel.getOne({}, "SETUP_FEATURES");
    let features = Object.assign(
      {},
      DEFAULT_FEATURES,
      (setup && setup.SETUP_FEATURES) || {},
    );

    if (features[featureName] === false) {
      throw new AppError("该功能未开启：" + featureName, appCode.LOGIC);
    }
  }

  static async isEnabled(featureName) {
    let setup = await SetupModel.getOne({}, "SETUP_FEATURES");
    let features = Object.assign(
      {},
      DEFAULT_FEATURES,
      (setup && setup.SETUP_FEATURES) || {},
    );
    return features[featureName] !== false;
  }

  static async getAllFeatures() {
    let setup = await SetupModel.getOne({}, "SETUP_FEATURES");
    return Object.assign(
      {},
      DEFAULT_FEATURES,
      (setup && setup.SETUP_FEATURES) || {},
    );
  }
}

module.exports = FeatureGate;
