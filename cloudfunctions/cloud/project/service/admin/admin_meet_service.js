/**
 * Notes: 预约后台管理
 * Ver : CCMiniCloud Framework 2.0.1 ALL RIGHTS RESERVED BY www.code3721.com
 * Date: 2021-12-08 07:48:00
 */

const BaseAdminService = require("./base_admin_service.js");
const MeetService = require("../meet_service.js");
const UserCardService = require("../user_card_service.js");
const dataUtil = require("../../../framework/utils/data_util.js");
const timeUtil = require("../../../framework/utils/time_util.js");
const util = require("../../../framework/utils/util.js");
const cloudUtil = require("../../../framework/cloud/cloud_util.js");
const cloudBase = require("../../../framework/cloud/cloud_base.js");

const MeetModel = require("../../model/meet_model.js");
const TeacherModel = require("../../model/teacher_model.js");
const AdminModel = require("../../model/admin_model.js");
const JoinModel = require("../../model/join_model.js");
const DayModel = require("../../model/day_model.js");
const UserModel = require("../../model/user_model.js");
const bufferUtil = require("../../utils/schedule_buffer_util.js");
const privateMeetUtil = require("../../utils/private_meet_util.js");
const config = require("../../../config/config.js");

class AdminMeetService extends BaseAdminService {
  /** 预约数据列表 */
  async getDayList(meetId, start, end) {
    let where = {
      DAY_MEET_ID: meetId,
      day: ["between", start, end],
    };
    let orderBy = {
      day: "asc",
    };
    return await DayModel.getAllBig(where, "day,times,dayDesc", orderBy);
  }

  // 按项目统计人数
  async statJoinCntByMeet(meetId) {
    let today = timeUtil.time("Y-M-D");
    let where = {
      day: [">=", today],
      DAY_MEET_ID: meetId,
    };

    let meetService = new MeetService();
    let list = await DayModel.getAllBig(where, "DAY_MEET_ID,times", {}, 1000);
    for (let k in list) {
      let meetId = list[k].DAY_MEET_ID;
      let times = list[k].times;

      for (let j in times) {
        let timeMark = times[j].mark;
        meetService.statJoinCnt(meetId, timeMark);
      }
    }
  }

  _getMeetDaysFromDaysSet(daysSet, nowDay) {
    let days = [];
    for (let k in daysSet) {
      if (daysSet[k].day >= nowDay) days.push(daysSet[k].day);
    }
    return days.sort();
  }

  _normTimes(times, day) {
    let ret = [];
    for (let k in times) {
      let t = dataUtil.deepClone(times[k]);
      if (!t.stat) {
        t.stat = { succCnt: 0, cancelCnt: 0, adminCancelCnt: 0 };
      }
      if (!t.mark || t.mark == "mark-no") {
        t.mark =
          "T" +
          day.replace(/-/g, "") +
          dataUtil.genRandomAlpha(10).toUpperCase();
      }
      t.status = t.status ? 1 : 0;
      t.isLimit = t.isLimit ? 1 : 0;
      if (t.slotType === "private") {
        t.isLimit = 1;
        t.limit = 1;
      } else if (!t.limit) {
        t.limit = 50;
      }
      if (t.bufferBefore != null && t.bufferBefore !== "") {
        t.bufferBefore = Math.max(0, Number(t.bufferBefore) || 0);
      }
      if (t.bufferAfter != null && t.bufferAfter !== "") {
        t.bufferAfter = Math.max(0, Number(t.bufferAfter) || 0);
      }
      if (t.start && t.end && (t.bufferBefore != null || t.bufferAfter != null)) {
        const kind = t.slotType === "private" ? "private" : "group";
        const buf = bufferUtil.resolveBufferForSlot(t, kind, {});
        const block = bufferUtil.computeBlock(
          t.start,
          t.end,
          buf.bufferBefore,
          buf.bufferAfter,
        );
        t.blockStart = block.blockStart;
        t.blockEnd = block.blockEnd;
      }
      ret.push(t);
    }
    return ret;
  }

  _mergeTimesStat(oldTimes, newTimes) {
    for (let k in newTimes) {
      for (let j in oldTimes) {
        if (newTimes[k].mark == oldTimes[j].mark) {
          newTimes[k].stat = oldTimes[j].stat || newTimes[k].stat;
          break;
        }
      }
    }
    return newTimes;
  }

  _checkRemovedTimes(oldTimes, newTimes) {
    for (let j in oldTimes) {
      let oldMark = oldTimes[j].mark;
      let found = false;
      for (let k in newTimes) {
        if (newTimes[k].mark == oldMark) {
          found = true;
          break;
        }
      }
      if (
        !found &&
        oldTimes[j].stat &&
        oldTimes[j].stat.succCnt
      ) {
        this.AppError(
          "时段" +
            oldTimes[j].start +
            "-" +
            oldTimes[j].end +
            "已有预约，不能删除",
        );
      }
    }
  }

  async _getTimeStat(meetId, timeMark) {
    let meetService = new MeetService();
    let day = meetService.getDayByTimeMark(timeMark);
    let dayRec = await DayModel.getOne(
      { DAY_MEET_ID: meetId, day },
      "times",
    );
    if (!dayRec || !dayRec.times) return null;
    for (let j in dayRec.times) {
      if (dayRec.times[j].mark == timeMark) return dayRec.times[j].stat;
    }
    return null;
  }

  /** 自助签到码 */
  async genSelfCheckinQr(page, timeMark) {
    let cloud = cloudBase.getCloud();

    let result = await cloud.openapi.wxacode.getUnlimited({
      scene: timeMark,
      width: 280,
      check_path: false,
      env_version: "release",
      page,
    });

    let upload = await cloud.uploadFile({
      cloudPath: config.MEET_TIMEMARK_QR_PATH + timeMark + ".png",
      fileContent: result.buffer,
    });

    if (!upload || !upload.fileID) this.AppError("签到码生成失败");

    return await cloudUtil.getTempFileURLOne(upload.fileID);
  }

  /** 管理员按钮核销 */
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

  /** 本节批量签到/取消签到 */
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
      "_id,JOIN_USER_ID",
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

  /** 管理员扫码核销 */
  async scanJoin(meetId, code) {
    let where = {
      JOIN_MEET_ID: meetId,
      JOIN_CODE: code,
      JOIN_STATUS: JoinModel.STATUS.SUCC,
      JOIN_IS_CHECKIN: 0,
    };
    let join = await JoinModel.getOne(where);
    if (!join) this.AppError("未找到可核销的预约记录");

    await JoinModel.edit(where, { JOIN_IS_CHECKIN: 1 });
    if (join._id) {
      let cardService = new UserCardService();
      await cardService.tryActivateForJoinCheckin(join._id, join.JOIN_USER_ID);
    }
  }

  checkHasJoinCnt(times) {
    if (!times) return false;
    for (let k in times) {
      if (times[k].stat && times[k].stat.succCnt) return true;
    }
    return false;
  }

  getCanModifyDaysSet(daysSet) {
    let now = timeUtil.time("Y-M-D");

    for (let k in daysSet) {
      if (daysSet[k].day < now) continue;
      daysSet[k].hasJoin = this.checkHasJoinCnt(daysSet[k].times);
    }

    return daysSet;
  }

  /** 取消某个时间段的所有预约记录 */
  async cancelJoinByTimeMark(admin, meetId, timeMark, reason) {
    let where = {
      JOIN_MEET_ID: meetId,
      JOIN_MEET_TIME_MARK: timeMark,
      JOIN_STATUS: JoinModel.STATUS.SUCC,
    };
    let joins = await JoinModel.getAll(where, "_id", {}, 500);
    let data = {
      JOIN_STATUS: JoinModel.STATUS.ADMIN_CANCEL,
      JOIN_REASON: reason || "",
      JOIN_IS_CHECKIN: 0,
      JOIN_EDIT_ADMIN_ID: admin.ADMIN_ID,
      JOIN_EDIT_ADMIN_NAME: admin.ADMIN_NAME,
      JOIN_EDIT_ADMIN_TIME: timeUtil.time(),
      JOIN_EDIT_ADMIN_STATUS: JoinModel.STATUS.ADMIN_CANCEL,
    };
    await JoinModel.edit(where, data);

    let cardService = new UserCardService();
    for (let k in joins || []) {
      await cardService.refundForJoinCancel(joins[k]._id);
    }

    let meetService = new MeetService();
    await meetService.statJoinCnt(meetId, timeMark);
    await this._setScheduleSlotStatus(meetId, timeMark, 0);
  }

  /** 更新排课时段 status（1=正常 0=已取消） */
  async _setScheduleSlotStatus(meetId, timeMark, status) {
    const meetService = new MeetService();
    const day = meetService.getDayByTimeMark(timeMark);
    const markStr = String(timeMark || "");
    const dayRec = await DayModel.getOne(
      { DAY_MEET_ID: meetId, day },
      "times,_id",
    );
    if (!dayRec || !dayRec.times) return;

    let times = dayRec.times || [];
    let hit = false;
    for (let j in times) {
      if (String(times[j].mark) !== markStr) continue;
      times[j] = { ...times[j], status: Number(status) };
      hit = true;
      break;
    }
    if (!hit) return;

    await DayModel.edit(dayRec._id, { times });
    await this._syncMeetDaysAfterChange(meetId);
  }

  /** 恢复已取消的排课时段（status 0 → 1） */
  async restoreScheduleSlot(meetId, timeMark) {
    if (!meetId || !timeMark) this.AppError("参数错误");
    await this._setScheduleSlotStatus(meetId, timeMark, 1);
  }

  /**添加 */
  async insertMeet(
    adminId,
    { title, order, typeId, typeName, daysSet, isShowLimit, formSet },
  ) {
    let nowDay = timeUtil.time("Y-M-D");
    let meetDays = this._getMeetDaysFromDaysSet(daysSet, nowDay);

    let data = {
      MEET_TITLE: title,
      MEET_ORDER: order,
      MEET_TYPE_ID: typeId,
      MEET_TYPE_NAME: typeName,
      MEET_IS_SHOW_LIMIT: isShowLimit,
      MEET_FORM_SET: formSet,
      MEET_ADMIN_ID: adminId,
      MEET_DAYS: meetDays,
      MEET_CONTENT: [],
      MEET_STYLE_SET: {},
      MEET_STATUS: MeetModel.STATUS.COMM,
    };

    let meetId = await MeetModel.insert(data);
    await this._editDays(meetId, nowDay, daysSet);
    return { id: meetId };
  }

  /**删除数据 */
  async delMeet(id) {
    await JoinModel.del({ JOIN_MEET_ID: id });
    await DayModel.del({ DAY_MEET_ID: id });
    await MeetModel.del({ _id: id });
  }

  /**获取信息 */
  async getMeetDetail(id, fromDay) {
    let fields = "*";

    let where = {
      _id: id,
    };
    let meet = await MeetModel.getOne(where, fields);
    if (!meet) return null;

    let meetService = new MeetService();
    const today = timeUtil.time("Y-M-D");
    let startDay = today;
    if (fromDay && fromDay < today) {
      startDay = fromDay;
    }
    meet.MEET_DAYS_SET = await meetService.getDaysSet(id, startDay);

    return meet;
  }

  async updateMeetContent({ meetId, content }) {
    let where = { _id: meetId };
    let meet = await MeetModel.getOne(where, "MEET_CONTENT");
    if (!meet) this.AppError("预约项目不存在");

    content = await cloudUtil.handlerCloudFilesByRichEditor(
      meet.MEET_CONTENT || [],
      content || [],
    );
    await MeetModel.edit(where, { MEET_CONTENT: content });

    let imgList = [];
    for (let k in content) {
      if (content[k].type == "img" && content[k].val) imgList.push(content[k].val);
    }
    let urls = await cloudUtil.getTempFileURL(imgList);
    return { urls };
  }

  async updateMeetStyleSet({ meetId, styleSet }) {
    let where = { _id: meetId };
    let meet = await MeetModel.getOne(where, "MEET_STYLE_SET");
    if (!meet) this.AppError("预约项目不存在");

    let oldStyle = meet.MEET_STYLE_SET || {};
    let oldPic = oldStyle.pic || "";
    let newPic = (styleSet && styleSet.pic) || "";
    if (oldPic && oldPic != newPic) {
      await cloudUtil.deleteFiles([oldPic]);
    }

    let oldCarousel = oldStyle.carousel || [];
    let newCarousel = (styleSet && styleSet.carousel) || [];
    if (!Array.isArray(oldCarousel)) oldCarousel = oldCarousel ? [oldCarousel] : [];
    if (!Array.isArray(newCarousel)) newCarousel = newCarousel ? [newCarousel] : [];
    let toDelete = oldCarousel.filter((p) => p && !newCarousel.includes(p));
    if (toDelete.length) {
      await cloudUtil.deleteFiles(toDelete);
    }

    await MeetModel.edit(where, { MEET_STYLE_SET: styleSet });

    if (styleSet && styleSet.teacherId) {
      let teacher = await TeacherModel.getOne(
        { _id: styleSet.teacherId },
        "TEACHER_ADMIN_ID,TEACHER_NAME",
        {},
        false,
      );
      if (teacher && teacher.TEACHER_ADMIN_ID) {
        await MeetModel.edit(
          where,
          { MEET_ADMIN_ID: teacher.TEACHER_ADMIN_ID },
          false,
        );
      }
    }

    let urls = [];
    if (newPic) {
      urls = await cloudUtil.getTempFileURL([newPic]);
    }
    return { urls };
  }

  async _getScheduleConflictContext() {
    const AdminTenantService = require("./admin_tenant_service.js");
    const store = await new AdminTenantService().getStore(this.getProjectId());
    const categories = store.categories || [];
    return {
      bufferConfig: store.privateSchedule || {},
      privateCategoryIds: privateMeetUtil.getPrivateCategoryIds(categories),
    };
  }

  _buildSlotBlock(meet, slot, tenantConfig, privateCategoryIds) {
    if (!slot || slot.status === 0 || !slot.start || !slot.end) return null;
    const style = meet.MEET_STYLE_SET || {};
    const teacherId = slot.teacherId || style.teacherId || "";
    if (!teacherId) return null;
    const isPrivate =
      slot.slotType === "private" ||
      privateMeetUtil.isPrivateMeet(meet, privateCategoryIds);
    const kind = isPrivate ? "private" : "group";
    const buf = bufferUtil.resolveBufferForSlot(slot, kind, tenantConfig);
    const block = bufferUtil.computeBlock(
      slot.start,
      slot.end,
      buf.bufferBefore,
      buf.bufferAfter,
    );
    return {
      ...block,
      teacherId: String(teacherId),
      mark: slot.mark || "",
      title: meet.MEET_TITLE || "",
    };
  }

  async _validateDayTeacherTimes(meet, meetId, day, times, tenantConfig, privateCategoryIds) {
    const AdminPrivateService = require("./admin_private_service.js");
    const privateService = new AdminPrivateService();
    const active = (times || []).filter(
      (t) => t && t.status !== 0 && t.start && t.end,
    );
    const batchBlocks = [];

    for (const slot of active) {
      const candidate = this._buildSlotBlock(
        meet,
        slot,
        tenantConfig,
        privateCategoryIds,
      );
      if (!candidate) continue;

      const existing = await privateService._loadTeacherBlocksForDay(
        candidate.teacherId,
        day,
        "",
        tenantConfig,
        privateCategoryIds,
      );
      const external = existing.filter(
        (b) => String(b.meetId) !== String(meetId),
      );

      for (const b of external) {
        if (bufferUtil.blocksOverlap(candidate, b)) {
          this.AppError(
            "与教练已有排课冲突：「" +
              (b.title || "课程") +
              "」" +
              bufferUtil.formatBlockLabel(b) +
              "（占用 " +
              b.blockStart +
              "-" +
              b.blockEnd +
              "）",
          );
        }
      }

      for (const b of batchBlocks) {
        if (b.teacherId !== candidate.teacherId) continue;
        if (String(b.mark) === String(candidate.mark)) continue;
        if (bufferUtil.blocksOverlap(candidate, b)) {
          this.AppError(
            "时段 " +
              slot.start +
              "-" +
              slot.end +
              " 与同日其他时段冲突（占用 " +
              candidate.blockStart +
              "-" +
              candidate.blockEnd +
              "）",
          );
        }
      }

      batchBlocks.push(candidate);
    }
  }

  /** 更新日期设置 */
  async _editDays(meetId, nowDay, daysSetData) {
    let whereOld = {
      DAY_MEET_ID: meetId,
      day: [">=", nowDay],
    };
    let oldList = await DayModel.getAllBig(
      whereOld,
      "day,times,dayDesc",
      { day: "asc" },
      1000,
    );

    let newDayMap = {};
    for (let k in daysSetData) {
      if (daysSetData[k].day < nowDay) continue;
      newDayMap[daysSetData[k].day] = daysSetData[k];
    }

    const meet = await MeetModel.getOne(
      { _id: meetId },
      "MEET_TITLE,MEET_TYPE_ID,MEET_STYLE_SET",
    );
    if (!meet) this.AppError("课程不存在");
    const conflictCtx = await this._getScheduleConflictContext();

    for (let dayStr in newDayMap) {
      let dayNode = newDayMap[dayStr];
      let times = this._normTimes(dayNode.times || [], dayStr);

      await this._validateDayTeacherTimes(
        meet,
        meetId,
        dayStr,
        times,
        conflictCtx.bufferConfig,
        conflictCtx.privateCategoryIds,
      );

      let oldDay = null;
      for (let j in oldList) {
        if (oldList[j].day == dayStr) {
          oldDay = oldList[j];
          break;
        }
      }

      if (oldDay) {
        this._checkRemovedTimes(oldDay.times || [], times);
        times = this._mergeTimesStat(oldDay.times || [], times);
        await DayModel.edit(
          { DAY_MEET_ID: meetId, day: dayStr },
          {
            times,
            dayDesc: dayNode.dayDesc || oldDay.dayDesc,
          },
        );
      } else {
        let dayData = {
          DAY_MEET_ID: meetId,
          day: dayStr,
          dayDesc: dayNode.dayDesc || dayStr,
          times,
        };
        await DayModel.insert(dayData);
      }
    }

    for (let k in oldList) {
      let dayStr = oldList[k].day;
      if (newDayMap[dayStr]) continue;
      if (this.checkHasJoinCnt(oldList[k].times)) {
        this.AppError("日期" + dayStr + "有预约记录，不能删除");
      }
      await DayModel.del({ DAY_MEET_ID: meetId, day: dayStr });
    }
  }

  /**更新数据 */
  async editMeet({
    id,
    title,
    typeId,
    typeName,
    order,
    daysSet,
    isShowLimit,
    formSet,
  }) {
    let nowDay = timeUtil.time("Y-M-D");
    let meetDays = this._getMeetDaysFromDaysSet(daysSet, nowDay);

    let data = {
      MEET_TITLE: title,
      MEET_TYPE_ID: typeId,
      MEET_TYPE_NAME: typeName,
      MEET_ORDER: order,
      MEET_IS_SHOW_LIMIT: isShowLimit,
      MEET_FORM_SET: formSet,
      MEET_DAYS: meetDays,
    };
    await MeetModel.edit({ _id: id }, data);
    await this._editDays(id, nowDay, daysSet);
  }

  /**预约名单分页列表 */
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

  /** 预约名单补充会员卡、会员资料 */
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

  /**预约项目分页列表 */
  async getMeetList(
    {
      search,
      sortType,
      sortVal,
      orderBy,
      whereEx,
      page,
      size,
      isTotal = true,
      oldTotal,
    },
    adminId,
    adminType,
  ) {
    orderBy = orderBy || {
      MEET_ORDER: "asc",
      MEET_ADD_TIME: "desc",
    };
    let fields =
      "MEET_TYPE_ID,MEET_TYPE_NAME,MEET_TITLE,MEET_STATUS,MEET_DAYS,MEET_STYLE_SET,MEET_ADD_TIME,MEET_EDIT_TIME,MEET_ORDER";

    let where = {};
    if (adminType === AdminModel.TYPE.TEACHER) {
      where.MEET_ADMIN_ID = adminId;
    }
    if (util.isDefined(search) && search) {
      where.MEET_TITLE = {
        $regex: ".*" + search,
        $options: "i",
      };
    } else if (sortType && util.isDefined(sortVal)) {
      switch (sortType) {
        case "status":
          where.MEET_STATUS = Number(sortVal);
          break;
        case "typeId":
          where.MEET_TYPE_ID = sortVal;
          break;
        case "sort":
          if (sortVal == "view") {
            orderBy = {
              MEET_VIEW_CNT: "desc",
              MEET_ADD_TIME: "desc",
            };
          }
          break;
      }
    }

    return await MeetModel.getList(
      where,
      fields,
      orderBy,
      page,
      size,
      isTotal,
      oldTotal,
    );
  }

  /** 删除 */
  async delJoin(joinId) {
    let join = await JoinModel.getOne({ _id: joinId });
    if (!join) this.AppError("预约记录不存在");

    let meetId = join.JOIN_MEET_ID;
    let timeMark = join.JOIN_MEET_TIME_MARK;
    await JoinModel.del({ _id: joinId });

    let meetService = new MeetService();
    await meetService.statJoinCnt(meetId, timeMark);
    return await this._getTimeStat(meetId, timeMark);
  }

  /**修改报名状态 */
  async statusJoin(admin, joinId, status, reason = "") {
    let join = await JoinModel.getOne({ _id: joinId });
    if (!join) this.AppError("预约记录不存在");

    let data = {
      JOIN_REASON: reason || "",
      JOIN_IS_CHECKIN: 0,
      JOIN_EDIT_ADMIN_ID: admin.ADMIN_ID,
      JOIN_EDIT_ADMIN_NAME: admin.ADMIN_NAME,
      JOIN_EDIT_ADMIN_TIME: timeUtil.time(),
      JOIN_EDIT_ADMIN_STATUS: status,
    };

    if (status == 99) {
      data.JOIN_STATUS = JoinModel.STATUS.ADMIN_CANCEL;
    } else if (status == 10) {
      data.JOIN_STATUS = JoinModel.STATUS.CANCEL;
    } else {
      data.JOIN_STATUS = JoinModel.STATUS.SUCC;
      data.JOIN_REASON = "";
    }

    await JoinModel.edit({ _id: joinId }, data);

    if (
      join.JOIN_STATUS === JoinModel.STATUS.SUCC &&
      (status == 10 || status == 99)
    ) {
      let cardService = new UserCardService();
      await cardService.refundForJoinCancel(joinId);
    }

    let meetService = new MeetService();
    await meetService.statJoinCnt(join.JOIN_MEET_ID, join.JOIN_MEET_TIME_MARK);
    return await this._getTimeStat(join.JOIN_MEET_ID, join.JOIN_MEET_TIME_MARK);
  }

  /**修改项目状态 */
  async statusMeet(id, status) {
    await MeetModel.edit({ _id: id }, { MEET_STATUS: status });
  }

  /**置顶排序设定 */
  async sortMeet(id, sort) {
    await MeetModel.edit({ _id: id }, { MEET_ORDER: sort });
  }

  /** 读取课程配置色（与小程序端 schedule_slot_helper 一致） */
  _resolveCourseColor(styleSet, typeId, index = 0) {
    const palette = [
      "#e57373",
      "#f48fb1",
      "#64b5f6",
      "#81c784",
      "#ffb74d",
      "#ba68c8",
      "#4db6ac",
      "#ffd54f",
    ];
    const typeColors = { 1: "#64b5f6", 2: "#81c784", 3: "#f48fb1" };
    const raw = styleSet || {};
    if (raw.color) return raw.color;
    const tid = String(typeId || "");
    if (typeColors[tid]) return typeColors[tid];
    return palette[index % palette.length];
  }

  /** 教练端周课表 */
  async getScheduleWeek(
    { startDay, endDay, typeId, includeInactive, excludePrivate, onlyMine },
    adminId,
    adminType,
    admin,
  ) {
    let privateCategoryIds = [];
    if (excludePrivate) {
      const AdminTenantService = require("./admin_tenant_service.js");
      const store = await new AdminTenantService().getStore(this.getProjectId());
      privateCategoryIds = privateMeetUtil.getPrivateCategoryIds(
        (store && store.categories) || [],
      );
    }

    // 「我的课」过滤仅对教练生效；馆主/超管查看当前馆全量排课
    const applyOnlyMine =
      !!onlyMine && adminType === AdminModel.TYPE.TEACHER;

    let meetWhere = { MEET_STATUS: MeetModel.STATUS.COMM };
    if (adminType === AdminModel.TYPE.TEACHER && !onlyMine) {
      meetWhere.MEET_ADMIN_ID = adminId;
    }

    const adminMongoId = (admin && admin._id) || "";
    let myTeacherId = "";
    if (applyOnlyMine && adminMongoId) {
      let teacher = await TeacherModel.getOne(
        { TEACHER_ADMIN_ID: adminMongoId },
        "_id",
        {},
        false,
      );
      myTeacherId = teacher ? teacher._id : "";
    }

    let meets = await MeetModel.getAll(
      meetWhere,
      "MEET_TITLE,MEET_TYPE_ID,MEET_TYPE_NAME,MEET_STYLE_SET,MEET_ADMIN_ID",
      { MEET_ORDER: "asc", MEET_ADD_TIME: "desc" },
    );

    let meetMap = {};
    for (let k in meets) {
      meetMap[meets[k]._id] = { meet: meets[k], index: Number(k) };
    }

    let dayWhere = {
      day: ["between", startDay, endDay],
    };
    let dayRecords = await DayModel.getAllBig(
      dayWhere,
      "day,times,DAY_MEET_ID",
      { day: "asc" },
      2000,
    );

    let slots = [];
    let timeSet = new Set();

    for (let k in dayRecords) {
      let meetEntry = meetMap[dayRecords[k].DAY_MEET_ID];
      let meet = meetEntry ? meetEntry.meet : null;
      if (!meet) continue;
      if (excludePrivate && privateMeetUtil.isPrivateMeet(meet, privateCategoryIds)) continue;
      if (typeId && typeId !== "0" && meet.MEET_TYPE_ID != typeId) continue;

      let style = meet.MEET_STYLE_SET || {};
      let times = dayRecords[k].times || [];
      for (let j in times) {
        let t = times[j];
        if (t.status != 1 && !includeInactive) continue;

        const slotTeacherId = t.teacherId || style.teacherId || "";
        if (applyOnlyMine) {
          const teacherMatch =
            myTeacherId && String(slotTeacherId) === String(myTeacherId);
          const meetOwnedByAdmin =
            adminType === AdminModel.TYPE.OWNER &&
            String(meet.MEET_ADMIN_ID || "") === String(adminId);
          let visible = !!teacherMatch;
          if (!visible && meetOwnedByAdmin && !myTeacherId) {
            // 馆长未关联老师资料：可查看自己创建课程下的时段
            visible = true;
          }
          if (!visible) continue;
        }

        if (t.status == 1) timeSet.add(t.start);
        const isPrivate =
          t.slotType === "private" || privateMeetUtil.isPrivateMeet(meet, privateCategoryIds);
        slots.push({
          day: dayRecords[k].day,
          start: t.start,
          end: t.end,
          mark: t.mark,
          meetId: dayRecords[k].DAY_MEET_ID,
          title: meet.MEET_TITLE,
          typeName: meet.MEET_TYPE_NAME,
          typeId: meet.MEET_TYPE_ID,
          teacherName: t.teacherName || style.teacherName || "",
          teacherId: slotTeacherId,
          isPrivate,
          slotType: t.slotType || (isPrivate ? "private" : "group"),
          color: this._resolveCourseColor(
            style,
            meet.MEET_TYPE_ID,
            meetEntry ? meetEntry.index : 0,
          ),
          duration: style.duration || 60,
          difficulty: Number(style.difficulty || style.level || 3),
          stat: t.stat || { succCnt: 0, cancelCnt: 0, adminCancelCnt: 0 },
          limit: t.limit || 0,
          isLimit: !!t.isLimit,
          slotStatus: t.status,
        });
      }
    }

    let timeRows = Array.from(timeSet).sort();

    return { slots, timeRows, startDay, endDay };
  }

  /** 同步 meet 上的可用日期列表（今天及以后） */
  async _syncMeetDaysAfterChange(meetId) {
    const nowDay = timeUtil.time("Y-M-D");
    let dayRecords = await DayModel.getAllBig(
      { DAY_MEET_ID: meetId, day: [">=", nowDay] },
      "day",
      { day: "asc" },
      1000,
    );
    let days = [];
    for (let k in dayRecords) {
      days.push(dayRecords[k].day);
    }
    await MeetModel.edit({ _id: meetId }, { MEET_DAYS: days });
  }

  /** 在时段列表中定位 mark（兼容 seed 格式 T+日期+HHmm） */
  _findScheduleTimeIndex(times, markStr, day) {
    if (!times || !times.length) return -1;
    const mark = String(markStr || "");
    for (let j = 0; j < times.length; j++) {
      if (String(times[j].mark) === mark) return j;
    }
    const dayKey = (day || "").replace(/-/g, "");
    const legacyMark = mark.startsWith("T") ? mark : "T" + dayKey + mark;
    for (let j = 0; j < times.length; j++) {
      if (String(times[j].mark) === legacyMark) return j;
    }
    if (mark.startsWith("T" + dayKey) && mark.length > 1 + dayKey.length) {
      const timePart = mark.slice(1 + dayKey.length);
      if (/^\d{4}$/.test(timePart)) {
        const start = timePart.slice(0, 2) + ":" + timePart.slice(2);
        for (let j = 0; j < times.length; j++) {
          if (times[j].start === start) return j;
        }
      }
    }
    return -1;
  }

  /** 教练端：删除单个排课时段（直接改 day 表，避免 meet_edit 漏删） */
  async removeScheduleSlot({ meetId, day, mark }) {
    let meet = await MeetModel.getOne({ _id: meetId }, "_id");
    if (!meet) this.AppError("课程不存在");

    const markStr = String(mark || "");
    let dayList = await DayModel.getAllBig(
      { DAY_MEET_ID: meetId, day },
      "times,day,dayDesc",
      { day: "asc" },
      100,
    );
    if (!dayList.length) this.AppError("排课不存在");

    let targetRec = null;
    let timeIdx = -1;
    for (let k in dayList) {
      const idx = this._findScheduleTimeIndex(dayList[k].times, markStr, day);
      if (idx >= 0) {
        targetRec = dayList[k];
        timeIdx = idx;
        break;
      }
    }
    if (!targetRec || timeIdx < 0) {
      this.AppError("排课时段不存在，请刷新后重试");
    }

    const timeNode = targetRec.times[timeIdx];
    if (timeNode.stat && timeNode.stat.succCnt) {
      this.AppError("该时段已有预约，无法删除");
    }

    let joinCnt = await JoinModel.count({
      JOIN_MEET_ID: meetId,
      JOIN_MEET_TIME_MARK: String(timeNode.mark),
      JOIN_STATUS: JoinModel.STATUS.SUCC,
    });
    if (joinCnt > 0) {
      this.AppError("该时段已有预约，无法删除");
    }

    const times = targetRec.times.filter((t, i) => i !== timeIdx);
    let affected = 0;
    if (times.length === 0) {
      affected = await DayModel.del(targetRec._id);
    } else {
      affected = await DayModel.edit(targetRec._id, { times });
    }
    if (!affected) this.AppError("删除失败，请重试");

    const verify = await DayModel.getOne(targetRec._id, "times");
    if (verify && verify.times && verify.times.length) {
      const stillThere = this._findScheduleTimeIndex(
        verify.times,
        String(timeNode.mark),
        day,
      );
      if (stillThere >= 0) this.AppError("删除失败，请重试");
    }

    await this._syncMeetDaysAfterChange(meetId);
    return { ok: true, mark: String(timeNode.mark) };
  }

  async _buildJoinFormsForUser(userId, meet, memo) {
    const user = await UserModel.getOne(
      { USER_MINI_OPENID: userId },
      "USER_NAME,USER_MOBILE",
    );
    const formSet = meet.MEET_FORM_SET || [];
    let forms;
    if (formSet.length) {
      forms = formSet.map((f) => {
        const item = dataUtil.deepClone(f);
        if (item.mark === "name" || item.title === "姓名") {
          item.val = (user && user.USER_NAME) || "";
        }
        if (item.type === "mobile" || item.title === "手机") {
          item.val = (user && user.USER_MOBILE) || "";
        }
        return item;
      });
    } else {
      forms = [
        {
          mark: "name",
          title: "姓名",
          type: "text",
          val: (user && user.USER_NAME) || "",
        },
        {
          mark: "mobile",
          title: "手机",
          type: "mobile",
          val: (user && user.USER_MOBILE) || "",
        },
      ];
    }
    if (memo) {
      forms.push({
        mark: "memo",
        title: "备注",
        type: "text",
        val: String(memo).slice(0, 50),
      });
    }
    return forms;
  }

  /** 团课代预约（已有排期时段） */
  async bookGroupJoin({ meetId, timeMark, userId, cardId, memo }) {
    if (!meetId || !timeMark || !userId) {
      this.AppError("请完善代约信息");
    }

    const meet = await MeetModel.getOne({ _id: meetId });
    if (!meet) this.AppError("课程不存在");
    const AdminTenantService = require("./admin_tenant_service.js");
    const store = await new AdminTenantService().getStore(this.getProjectId());
    const privateCategoryIds = privateMeetUtil.getPrivateCategoryIds(
      (store && store.categories) || [],
    );
    if (privateMeetUtil.isPrivateMeet(meet, privateCategoryIds)) {
      this.AppError("私教课请使用「私教」代约");
    }

    const user = await UserModel.getOne(
      { USER_MINI_OPENID: userId },
      "USER_NAME",
    );
    if (!user) this.AppError("会员不存在");

    const forms = await this._buildJoinFormsForUser(userId, meet, memo);

    if (cardId) {
      const cardService = new UserCardService();
      await cardService.checkCardForJoin(userId, meetId, cardId);
    }

    const meetService = new MeetService();
    const result = await meetService.join(
      userId,
      meetId,
      timeMark,
      forms,
      cardId || "",
      { skipEndCheck: true, isAdmin: true },
    );

    return {
      meetId,
      timeMark,
      joinId: result.joinId,
      userId,
    };
  }
}

module.exports = AdminMeetService;
