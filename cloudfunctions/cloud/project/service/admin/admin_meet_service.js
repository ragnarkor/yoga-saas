/**
 * Notes: 预约后台管理
 * Ver : CCMiniCloud Framework 2.0.1 ALL RIGHTS RESERVED BY www.code3721.com
 * Date: 2021-12-08 07:48:00
 */

const BaseAdminService = require("./base_admin_service.js");
const MeetService = require("../meet_service.js");
const dataUtil = require("../../../framework/utils/data_util.js");
const timeUtil = require("../../../framework/utils/time_util.js");
const util = require("../../../framework/utils/util.js");
const cloudUtil = require("../../../framework/cloud/cloud_util.js");
const cloudBase = require("../../../framework/cloud/cloud_base.js");

const MeetModel = require("../../model/meet_model.js");
const AdminModel = require("../../model/admin_model.js");
const JoinModel = require("../../model/join_model.js");
const DayModel = require("../../model/day_model.js");
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
      if (!t.limit) t.limit = 50;
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

    let meetService = new MeetService();
    await meetService.statJoinCnt(meetId, timeMark);
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
  async getMeetDetail(id) {
    let fields = "*";

    let where = {
      _id: id,
    };
    let meet = await MeetModel.getOne(where, fields);
    if (!meet) return null;

    let meetService = new MeetService();
    meet.MEET_DAYS_SET = await meetService.getDaysSet(
      id,
      timeUtil.time("Y-M-D"),
    );

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

    let urls = [];
    if (newPic) {
      urls = await cloudUtil.getTempFileURL([newPic]);
    }
    return { urls };
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

    for (let dayStr in newDayMap) {
      let dayNode = newDayMap[dayStr];
      let times = this._normTimes(dayNode.times || [], dayStr);

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
    );
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

  /** 教练端周课表 */
  async getScheduleWeek({ startDay, endDay, typeId }, adminId, adminType) {
    let meetWhere = { MEET_STATUS: MeetModel.STATUS.COMM };
    if (adminType === AdminModel.TYPE.TEACHER) {
      meetWhere.MEET_ADMIN_ID = adminId;
    }

    let meets = await MeetModel.getAll(
      meetWhere,
      "MEET_TITLE,MEET_TYPE_ID,MEET_TYPE_NAME,MEET_STYLE_SET",
      { MEET_ORDER: "asc", MEET_ADD_TIME: "desc" },
    );

    let meetMap = {};
    for (let k in meets) {
      meetMap[meets[k]._id] = meets[k];
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
      let meet = meetMap[dayRecords[k].DAY_MEET_ID];
      if (!meet) continue;
      if (typeId && typeId !== "0" && meet.MEET_TYPE_ID != typeId) continue;

      let style = meet.MEET_STYLE_SET || {};
      let times = dayRecords[k].times || [];
      for (let j in times) {
        let t = times[j];
        if (t.status != 1) continue;
        timeSet.add(t.start);
        slots.push({
          day: dayRecords[k].day,
          start: t.start,
          end: t.end,
          mark: t.mark,
          meetId: dayRecords[k].DAY_MEET_ID,
          title: meet.MEET_TITLE,
          typeName: meet.MEET_TYPE_NAME,
          typeId: meet.MEET_TYPE_ID,
          teacherName: style.teacherName || "",
          color: style.color || "#81c784",
          duration: style.duration || 60,
          difficulty: Number(style.difficulty || style.level || 3),
        });
      }
    }

    let timeRows = Array.from(timeSet).sort();

    return { slots, timeRows, startDay, endDay };
  }
}

module.exports = AdminMeetService;
