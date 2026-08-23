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
      cover: "string|false",
      order: "int",
      scope: "object|false",
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

  async getMonthNewCardMembers() {
    await this.isAdmin();
    let rules = {
      search: "string|false|max:30|name=搜索条件",
      page: "required|int|default=1",
      size: "int|default=100",
    };
    let input = this.validateData(rules);
    let service = new AdminCardService();
    return await service.getMonthNewCardMembers(input);
  }

  async getCardHolderMembers() {
    await this.isAdmin();
    let rules = {
      search: "string|false|max:30|name=搜索条件",
      page: "required|int|default=1",
      size: "int|default=100",
    };
    let input = this.validateData(rules);
    let service = new AdminCardService();
    return await service.getCardHolderMembers(input);
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

  async getUserJoinCardOptions() {
    await this.isAdmin();
    let rules = {
      userId: "required|string",
      meetId: "required|id",
      timeMark: "string",
    };
    let input = this.validateData(rules);
    let service = new AdminCardService();
    return await service.getUserJoinCardOptions(
      input.userId,
      input.meetId,
      input.timeMark || "",
    );
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

  async delUserCard() {
    await this.isAdmin();
    let rules = { cardId: "required|string" };
    let input = this.validateData(rules);
    let service = new AdminCardService();
    await service.deleteUserCard(input.cardId);
    return { ok: true };
  }

  async getCardMarketing() {
    await this.isAdmin();
    return await new AdminCardService().getCardMarketing();
  }

  async saveCardMarketing() {
    await this.isAdmin();
    const input = this.validateData({
      enabled: "bool|false",
      guide: "string|false|max:300",
      contact: "string|false|max:100",
      cards: "array|false",
    });
    return await new AdminCardService().saveCardMarketing(input, this._adminType);
  }

  async getCardOrderList() {
    await this.isAdmin();
    const input = this.validateData({
      status: "int|false",
      page: "int|false|default=1",
      size: "int|false|default=20",
      oldTotal: "int|false|default=0",
    });
    return await new AdminCardService().getCardOrderList(input);
  }

  async confirmCardOrder() {
    await this.isAdmin();
    this._assertOrderOwner();
    const input = this.validateData({ orderId: "required|string" });
    return await new AdminCardService().confirmCardOrder(input.orderId, this._admin);
  }

  async closeCardOrder() {
    await this.isAdmin();
    this._assertOrderOwner();
    const input = this.validateData({
      orderId: "required|string",
      reason: "required|string|max:100",
    });
    return await new AdminCardService().closeCardOrder(
      input.orderId,
      input.reason,
      this._admin,
    );
  }

  _assertOrderOwner() {
    if (this._adminType !== "super" && this._adminType !== "owner") {
      this.AppError("仅馆主可确认或关闭购卡申请");
    }
  }
}

module.exports = AdminCardController;
