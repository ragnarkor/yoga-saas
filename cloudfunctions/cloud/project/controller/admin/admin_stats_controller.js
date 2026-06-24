/**
 * Notes: 数据统计控制器
 */

const BaseAdminController = require("./base_admin_controller.js");
const AdminStatsService = require("../../service/admin/admin_stats_service.js");

class AdminStatsController extends BaseAdminController {
  async getCardAnalysis() {
    await this.isAdmin();
    let service = new AdminStatsService();
    return await service.getCardAnalysis();
  }

  async getClassStats() {
    await this.isAdmin();
    let rules = { days: "int|false|default=30" };
    let input = this.validateData(rules);
    let service = new AdminStatsService();
    return await service.getClassStats(input);
  }

  async getBookingRank() {
    await this.isAdmin();
    let rules = { limit: "int|false|default=20" };
    let input = this.validateData(rules);
    let service = new AdminStatsService();
    return await service.getBookingRank(input);
  }

  async getFundDetails() {
    await this.isAdmin();
    let rules = {
      range: "string|false|default=month",
      page: "required|int|default=1",
      size: "int|default=20",
    };
    let input = this.validateData(rules);
    if (!["today", "month", "all"].includes(input.range)) {
      input.range = "month";
    }
    let service = new AdminStatsService();
    return await service.getFundDetails(input);
  }

  async getConsumeStats() {
    await this.isAdmin();
    let service = new AdminStatsService();
    return await service.getConsumeStats();
  }

  async getJoinQuery() {
    await this.isAdmin();
    let rules = {
      search: "string|false|max:30",
      sortType: "string|false",
      dayStart: "date|false",
      dayEnd: "date|false",
      page: "required|int|default=1",
      size: "int|default=20",
    };
    let input = this.validateData(rules);
    let service = new AdminStatsService();
    return await service.getJoinQuery(input);
  }

  async getScheduleQuery() {
    await this.isAdmin();
    let rules = {
      startDay: "date|false",
      endDay: "date|false",
    };
    let input = this.validateData(rules);
    let service = new AdminStatsService();
    return await service.getScheduleQuery(
      input,
      this._adminId,
      this._adminType,
    );
  }
}

module.exports = AdminStatsController;
