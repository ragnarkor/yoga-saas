const JoinModel = require("../../model/join_model.js");
const UserCardService = require("../user_card_service.js");
class CheckinService {
  async checkinJoin(joinId, flag) {
    let where = { _id: joinId };
    let join = await JoinModel.getOne(where);
    if (!join) this.AppError("预约记录不存在");
    if (join.JOIN_STATUS != JoinModel.STATUS.SUCC)
      this.AppError("只有预约成功状态可以签到核销");

    await JoinModel.edit(where, { JOIN_IS_CHECKIN: Number(flag) });
    if (Number(flag) === 1 && join._id) {
      let cardService = new UserCardService();
      await cardService.tryActivateForJoinCheckin(join._id, join.JOIN_USER_ID);
    }
  }

  async checkinJoinBatch(meetId, timeMark, flag) {
    flag = Number(flag);
    let where = {
      JOIN_MEET_ID: meetId,
      JOIN_MEET_TIME_MARK: timeMark,
      JOIN_STATUS: JoinModel.STATUS.SUCC,
      JOIN_IS_CHECKIN: flag === 1 ? 0 : 1,
    };
    let joins = await JoinModel.getAll(
      where,
      "_id,JOIN_USER_ID,JOIN_MEET_DAY",
      { JOIN_ADD_TIME: "asc" },
      200,
    );
    if (!joins.length) return { count: 0 };

    let cardService = new UserCardService();
    for (let k in joins) {
      let join = joins[k];
      await JoinModel.edit({ _id: join._id }, { JOIN_IS_CHECKIN: flag });
      if (flag === 1) {
        await cardService.tryActivateForJoinCheckin(join._id, join.JOIN_USER_ID);
      }
    }
    return { count: joins.length };
  }

}
module.exports = CheckinService;
