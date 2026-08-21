/**
 * Notes: 会员端会员卡控制器
 */

const BaseController = require("./base_controller.js");
const UserCardService = require("../service/user_card_service.js");
const CardPurchaseService = require("../service/card_purchase_service.js");

class CardController extends BaseController {
  async getMyCardList() {
    let rules = {
      activeOnly: "bool|default=true",
    };
    let input = this.validateData(rules);
    let service = new UserCardService();
    return await service.getMyCardList(this._userId, {
      activeOnly: input.activeOnly !== false,
    });
  }

  async getMyCardSummary() {
    let service = new UserCardService();
    return await service.getMyCardSummary(this._userId);
  }

  async getMyCardDetail() {
    let rules = {
      cardId: "must|string|min:1|max:100|name=会员卡ID",
    };
    let input = this.validateData(rules);
    let service = new UserCardService();
    return await service.getMyCardDetail(this._userId, input.cardId);
  }
  async getCardShop() {
    return await new CardPurchaseService().getShop();
  }
  async getCardGoodsDetail() {
    const input = this.validateData({ tplId: "required|string|name=套餐ID" });
    return await new CardPurchaseService().getDetail(input.tplId);
  }
  async createCardOrder() {
    const input = this.validateData({
      tplId: "required|string",
      remark: "string|false|max:100",
      payType: "string|false|default=offline",
    });
    return await new CardPurchaseService().create(
      this._userId,
      input.tplId,
      input.remark,
      input.payType,
    );
  }
  async getMyCardOrders() {
    return await new CardPurchaseService().myList(this._userId);
  }
  async repayCardOrder() {
    const input = this.validateData({ orderId: "required|string|name=订单ID" });
    return await new CardPurchaseService().repay(this._userId, input.orderId);
  }
}

module.exports = CardController;
