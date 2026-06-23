/**
 * Notes: 会员卡管理控制器
 */

const BaseAdminController = require("./base_admin_controller.js");
const AdminCardService = require("../../service/admin/admin_card_service.js");

class AdminCardController extends BaseAdminController {
  async getCardTplList() {
    await this.isAdmin();
    let service = new AdminCardService();
    return { list: await service.getCardTplList() };
  }

  async getCardTplDetail() {
    await this.isAdmin();
    let rules = { id: "required|id" };
    let input = this.validateData(rules);
    let service = new AdminCardService();
    return await service.getCardTplDetail(input.id);
  }

  async saveCardTpl() {
    await this.isAdmin();
    let rules = {
      id: "id",
      name: "string",
      type: "string",
      days: "int",
      price: "int",
      quota: "int",
      color: "string",
      order: "int",
    };
    let input = this.validateData(rules);
    let service = new AdminCardService();
    return await service.saveCardTpl(input, this._adminType);
  }

  async delCardTpl() {
    await this.isAdmin();
    let rules = { id: "required|id" };
    let input = this.validateData(rules);
    let service = new AdminCardService();
    await service.delCardTpl(input.id, this._adminType);
  }

  async getCoachMemberList() {
    await this.isAdmin();
    let rules = {
      search: "string|false|max:30|name=搜索条件",
      cardFilter: "string|false|default=all|name=持卡筛选",
      page: "required|int|default=1",
      size: "int|default=100",
    };
    let input = this.validateData(rules);
    let service = new AdminCardService();
    return await service.getMemberList(input);
  }

  async issueUserCard() {
    await this.isAdmin();
    let rules = {
      userId: "required|string",
      tplId: "string",
      name: "string",
      type: "string",
      days: "int",
      price: "int",
      quota: "int",
      activate: "string",
      coachId: "string",
      coachName: "string",
      memo: "string|max:50",
    };
    let input = this.validateData(rules);
    let service = new AdminCardService();
    return await service.issueUserCard(input);
  }

  async getUserCardList() {
    await this.isAdmin();
    let rules = { userId: "required|string" };
    let input = this.validateData(rules);
    let service = new AdminCardService();
    return await service.getUserCardList(input.userId);
  }

  async getUserCardDetail() {
    await this.isAdmin();
    let rules = { cardId: "required|string" };
    let input = this.validateData(rules);
    let service = new AdminCardService();
    return await service.getUserCardDetail(input.cardId);
  }

  async adjustUserCard() {
    await this.isAdmin();
    let rules = {
      cardId: "required|string",
      action: "required|string",
      times: "int",
      memo: "required|string|max:50",
      operatorName: "string",
    };
    let input = this.validateData(rules);
    let service = new AdminCardService();
    return await service.adjustUserCard(input);
  }
}

module.exports = AdminCardController;
