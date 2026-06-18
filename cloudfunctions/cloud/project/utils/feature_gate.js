// [AI_START TIMESTAMP=2025-01-25 12:00:00]
/**
 * Notes: 功能开关校验中间件
 * Ver : CCMiniCloud Framework 2.0.1
 * Description: 根据 ax_setup.SETUP_FEATURES 校验某功能是否开启
 */

const SetupModel = require("../model/setup_model.js");
const AppError = require("../../framework/core/app_error.js");
const appCode = require("../../framework/core/app_code.js");

class FeatureGate {
  /**
   * 检查某功能是否开启，未开启则抛异常
   * @param {string} featureName - 功能名称 (booking/payment/teacherManage/checkin/news/selfCheckin)
   */
  static async check(featureName) {
    let setup = await SetupModel.getOne({}, "SETUP_FEATURES");
    let features = (setup && setup.SETUP_FEATURES) || {};

    if (!features[featureName]) {
      throw new AppError("该功能未开启：" + featureName, appCode.LOGIC);
    }
  }

  /**
   * 检查某功能是否开启（不抛异常，返回布尔值）
   * @param {string} featureName
   * @returns {Promise<boolean>}
   */
  static async isEnabled(featureName) {
    let setup = await SetupModel.getOne({}, "SETUP_FEATURES");
    let features = (setup && setup.SETUP_FEATURES) || {};
    return !!features[featureName];
  }

  /**
   * 获取当前租户的所有功能开关配置
   * @returns {Promise<object>}
   */
  static async getAllFeatures() {
    let setup = await SetupModel.getOne({}, "SETUP_FEATURES");
    return (setup && setup.SETUP_FEATURES) || {};
  }
}

module.exports = FeatureGate;
// [AI_END LINES=48 TIMESTAMP=2025-01-25 12:00:00]
