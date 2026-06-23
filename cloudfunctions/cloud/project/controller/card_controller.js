/**
 * Notes: 会员端会员卡控制器
 */

const BaseController = require("./base_controller.js");
const UserCardService = require("../service/user_card_service.js");

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
}

module.exports = CardController;
