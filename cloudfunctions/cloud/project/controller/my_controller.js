/**
 * Notes: 用户中心模块控制器
 * Date: 2021-03-15 19:20:00 
 */

const BaseController = require('./base_controller.js');
const StreakService = require('../service/streak_service.js');

class MyController extends BaseController {
  /** 我的成就 */
  async getAchievement() {
    let service = new StreakService();
    return await service.getAchievement(this._userId);
  }
}

module.exports = MyController;