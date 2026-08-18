const util=require("../../../framework/utils/util.js");
const JoinModel=require("../../model/join_model.js");
const UserCardLogModel=require("../../model/user_card_log_model.js");
const UserCardModel=require("../../model/user_card_model.js");
const UserModel=require("../../model/user_model.js");
class JoinRosterService {
  async getJoinList({
    search,
    sortType,
    sortVal,
    orderBy,
    meetId,
    mark,
    page,
    size,
    isTotal = true,
    oldTotal,
  }) {
    orderBy = orderBy || {
      JOIN_EDIT_TIME: "desc",
    };
    let fields =
      "JOIN_IS_CHECKIN,JOIN_CODE,JOIN_ID,JOIN_REASON,JOIN_USER_ID,JOIN_MEET_ID,JOIN_MEET_TITLE,JOIN_MEET_DAY,JOIN_MEET_TIME_START,JOIN_MEET_TIME_END,JOIN_MEET_TIME_MARK,JOIN_FORMS,JOIN_STATUS,JOIN_EDIT_TIME";

    let where = {
      JOIN_MEET_ID: meetId,
      JOIN_MEET_TIME_MARK: mark,
    };
    if (util.isDefined(search) && search) {
      where["JOIN_FORMS.val"] = {
        $regex: ".*" + search,
        $options: "i",
      };
    } else if (sortType && util.isDefined(sortVal)) {
      switch (sortType) {
        case "status":
          sortVal = Number(sortVal);
          if (sortVal == 1099) where.JOIN_STATUS = ["in", [10, 99]];
          else where.JOIN_STATUS = Number(sortVal);
          break;
        case "checkin":
          where.JOIN_STATUS = JoinModel.STATUS.SUCC;
          if (sortVal == 1) {
            where.JOIN_IS_CHECKIN = 1;
          } else {
            where.JOIN_IS_CHECKIN = 0;
          }
          break;
      }
    }

    return await JoinModel.getList(
      where,
      fields,
      orderBy,
      page,
      size,
      isTotal,
      oldTotal,
    ).then(async (result) => {
      if (result && result.list && result.list.length) {
        await this._enrichJoinListMeta(result.list);
      }
      return result;
    });
  }

  async _enrichJoinListMeta(list) {
    const UserCardLogModel = require("../../model/user_card_log_model.js");
    const UserCardModel = require("../../model/user_card_model.js");
    const UserModel = require("../../model/user_model.js");

    const joinIds = [];
    const userIds = [];
    for (const item of list) {
      if (item._id) joinIds.push(item._id);
      if (item.JOIN_USER_ID) userIds.push(item.JOIN_USER_ID);
    }

    const joinCardMap = {};
    if (joinIds.length) {
      const logs = await UserCardLogModel.getAll(
        {
          CARD_LOG_JOIN_ID: ["in", joinIds],
          CARD_LOG_STATUS: UserCardLogModel.STATUS.VALID,
        },
        "CARD_LOG_JOIN_ID,CARD_LOG_USER_CARD_ID,CARD_LOG_TIMES,CARD_LOG_ACTION",
        {},
        joinIds.length * 2,
      );
      const cardIds = [];
      for (const log of logs || []) {
        if (log.CARD_LOG_ACTION !== UserCardLogModel.ACTION.DEDUCT) continue;
        if (joinCardMap[log.CARD_LOG_JOIN_ID]) continue;
        joinCardMap[log.CARD_LOG_JOIN_ID] = {
          cardId: log.CARD_LOG_USER_CARD_ID,
          times: log.CARD_LOG_TIMES,
        };
        if (log.CARD_LOG_USER_CARD_ID) cardIds.push(log.CARD_LOG_USER_CARD_ID);
      }
      let cardNameMap = {};
      if (cardIds.length) {
        const cards = await UserCardModel.getAll(
          { _id: ["in", cardIds] },
          "USER_CARD_NAME",
          {},
          cardIds.length,
        );
        for (const c of cards || []) {
          cardNameMap[c._id] = c.USER_CARD_NAME || "";
        }
      }
      for (const item of list) {
        const hit = joinCardMap[item._id];
        if (hit) {
          item.cardName = cardNameMap[hit.cardId] || "";
          item.cardTimes = hit.times || 1;
        }
      }
    }

    if (userIds.length) {
      const uniqIds = [...new Set(userIds)];
      const users = await UserModel.getAll(
        { USER_MINI_OPENID: ["in", uniqIds] },
        "USER_MINI_OPENID,USER_NAME,USER_MOBILE,USER_PIC",
        {},
        uniqIds.length,
      );
      const userMap = {};
      for (const u of users || []) {
        userMap[u.USER_MINI_OPENID] = u;
      }
      for (const item of list) {
        const u = userMap[item.JOIN_USER_ID];
        if (!u) continue;
        if (u.USER_NAME) item.memberName = u.USER_NAME;
        if (u.USER_MOBILE) item.memberMobile = u.USER_MOBILE;
        if (u.USER_PIC) item.memberPic = u.USER_PIC;
      }
    }
  }


}
module.exports=JoinRosterService;
