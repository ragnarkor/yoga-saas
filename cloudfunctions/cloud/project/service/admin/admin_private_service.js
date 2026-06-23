/**
 * 私教预约（灵活时间 + 动态 Buffer）
 */

const BaseAdminService = require("./base_admin_service.js");
const AdminMeetService = require("./admin_meet_service.js");
const MeetService = require("../meet_service.js");
const UserCardService = require("../user_card_service.js");
const AdminTenantService = require("./admin_tenant_service.js");
const dataUtil = require("../../../framework/utils/data_util.js");
const timeUtil = require("../../../framework/utils/time_util.js");

const MeetModel = require("../../model/meet_model.js");
const DayModel = require("../../model/day_model.js");
const UserModel = require("../../model/user_model.js");
const JoinModel = require("../../model/join_model.js");

const bufferUtil = require("../../utils/schedule_buffer_util.js");
const privateMeetUtil = require("../../utils/private_meet_util.js");

class AdminPrivateService extends BaseAdminService {
  async _getPrivateContext() {
    const tenantService = new AdminTenantService();
    const store = await tenantService.getStore(this.getProjectId());
    const categories = store.categories || [];
    const bufferConfig = store.privateSchedule || {};
    const privateCategoryIds = privateMeetUtil.getPrivateCategoryIds(categories);
    return { categories, bufferConfig, privateCategoryIds };
  }

  async getMeta() {
    const ctx = await this._getPrivateContext();
    const where = { MEET_STATUS: MeetModel.STATUS.COMM };
    if (ctx.privateCategoryIds.length > 0) {
      where.MEET_TYPE_ID = ["in", ctx.privateCategoryIds];
    }
    const meets = await this._safeGetAll(
      MeetModel,
      where,
      "MEET_TITLE,MEET_TYPE_ID,MEET_TYPE_NAME,MEET_STYLE_SET,MEET_ORDER",
      { MEET_ORDER: "asc", MEET_ADD_TIME: "desc" },
      200,
    );

    let list = [];
    for (let k in meets) {
      const m = meets[k];
      if (!privateMeetUtil.isPrivateMeet(m, ctx.privateCategoryIds)) continue;
      const style = m.MEET_STYLE_SET || {};
      list.push({
        _id: m._id,
        title: m.MEET_TITLE,
        typeId: m.MEET_TYPE_ID,
        typeName: m.MEET_TYPE_NAME,
        duration: Number(style.duration) || 60,
        cardTimes: Number(style.cardTimes) > 0 ? Number(style.cardTimes) : 1,
        teacherId: style.teacherId || "",
        teacherName: style.teacherName || "",
      });
    }

    return {
      bufferConfig: bufferUtil.mergeConfig(ctx.bufferConfig),
      bufferPresets: [
        { key: "default", label: "默认", before: bufferUtil.mergeConfig(ctx.bufferConfig).private.bufferBefore, after: bufferUtil.mergeConfig(ctx.bufferConfig).private.bufferAfter },
        { key: "compact", label: "紧凑", before: bufferUtil.mergeConfig(ctx.bufferConfig).compact.bufferBefore, after: bufferUtil.mergeConfig(ctx.bufferConfig).compact.bufferAfter },
        { key: "none", label: "无缓冲", before: 0, after: 0 },
        { key: "custom", label: "自定义", before: null, after: null },
      ],
      privateCategoryIds: ctx.privateCategoryIds,
      courses: list,
    };
  }

  async listSessions({ startDay, endDay, teacherId }) {
    const ctx = await this._getPrivateContext();
    if (!ctx.privateCategoryIds.length) {
      return { list: [], startDay, endDay };
    }

    const meets = await MeetModel.getAll(
      {
        MEET_STATUS: MeetModel.STATUS.COMM,
        MEET_TYPE_ID: ["in", ctx.privateCategoryIds],
      },
      "MEET_TITLE,MEET_TYPE_ID,MEET_TYPE_NAME,MEET_STYLE_SET",
      { MEET_ORDER: "asc" },
      200,
    );

    const meetMap = {};
    const meetIds = [];
    for (let k in meets) {
      meetMap[meets[k]._id] = meets[k];
      meetIds.push(meets[k]._id);
    }
    if (!meetIds.length) return { list: [], startDay, endDay };

    const dayRecords = await DayModel.getAllBig(
      {
        DAY_MEET_ID: ["in", meetIds],
        day: ["between", startDay, endDay],
      },
      "day,times,DAY_MEET_ID",
      { day: "asc" },
      2000,
    );

    const list = [];
    for (let k in dayRecords) {
      const rec = dayRecords[k];
      const meet = meetMap[rec.DAY_MEET_ID];
      if (!meet) continue;
      const style = meet.MEET_STYLE_SET || {};
      const times = rec.times || [];
      for (let j in times) {
        const t = times[j];
        if (!t || t.status === 0) continue;
        const slotTeacherId = t.teacherId || style.teacherId || "";
        if (teacherId && String(slotTeacherId) !== String(teacherId)) continue;

        const booked = (t.stat && t.stat.succCnt) || 0;
        const buf = bufferUtil.resolveBufferForSlot(
          t,
          t.slotType === "private" ? "private" : "private",
          ctx.bufferConfig,
        );
        list.push({
          meetId: rec.DAY_MEET_ID,
          mark: t.mark,
          day: rec.day,
          start: t.start,
          end: t.end,
          title: meet.MEET_TITLE,
          typeName: meet.MEET_TYPE_NAME,
          teacherId: slotTeacherId,
          teacherName: t.teacherName || style.teacherName || "",
          booked,
          limit: t.limit || 1,
          bufferBefore: buf.bufferBefore,
          bufferAfter: buf.bufferAfter,
          blockStart: t.blockStart || bufferUtil.computeBlock(t.start, t.end, buf.bufferBefore, buf.bufferAfter).blockStart,
          blockEnd: t.blockEnd || bufferUtil.computeBlock(t.start, t.end, buf.bufferBefore, buf.bufferAfter).blockEnd,
          slotType: t.slotType || "private",
        });
      }
    }

    list.sort((a, b) => {
      if (a.day !== b.day) return a.day < b.day ? -1 : 1;
      return (a.start || "").localeCompare(b.start || "");
    });

    return { list, startDay, endDay };
  }

  async _loadTeacherBlocksForDay(teacherId, day, excludeMark, tenantConfig, privateCategoryIds) {
    if (!teacherId || !day) return [];
    const dayRecords = await DayModel.getAllBig(
      { day },
      "DAY_MEET_ID,day,times",
      {},
      500,
    );
    if (!dayRecords.length) return [];

    const meetIds = [];
    for (let k in dayRecords) {
      if (dayRecords[k].DAY_MEET_ID) meetIds.push(dayRecords[k].DAY_MEET_ID);
    }
    const uniqMeetIds = [...new Set(meetIds)];
    let meetMap = {};
    if (uniqMeetIds.length) {
      const meets = await MeetModel.getAll(
        { _id: ["in", uniqMeetIds] },
        "MEET_TITLE,MEET_TYPE_ID,MEET_TYPE_NAME,MEET_STYLE_SET",
        {},
        uniqMeetIds.length,
      );
      for (let m of meets || []) {
        meetMap[m._id] = m;
      }
    }

    const blocks = [];
    const exclude = String(excludeMark || "");
    for (let k in dayRecords) {
      const rec = dayRecords[k];
      const meet = meetMap[rec.DAY_MEET_ID] || {};
      const style = meet.MEET_STYLE_SET || {};
      const isPrivate = privateMeetUtil.isPrivateMeet(meet, privateCategoryIds || []);
      for (let j in rec.times || []) {
        const t = rec.times[j];
        if (!t || t.status === 0) continue;
        if (exclude && String(t.mark) === exclude) continue;
        const slotTeacherId = t.teacherId || style.teacherId || "";
        if (String(slotTeacherId) !== String(teacherId)) continue;
        const kind = t.slotType === "private" || isPrivate ? "private" : "group";
        const block = bufferUtil.buildBlockFromSlot(t, kind, tenantConfig);
        if (block) {
          block.title = meet.MEET_TITLE || "";
          block.meetId = rec.DAY_MEET_ID;
          blocks.push(block);
        }
      }
    }
    return blocks;
  }

  async checkSlot(input) {
    const ctx = await this._getPrivateContext();
    const {
      teacherId,
      day,
      start,
      end,
      bufferPreset,
      bufferBefore,
      bufferAfter,
      excludeMark,
    } = input;

    if (!teacherId || !day || !start || !end) {
      this.AppError("请填写教练、日期与时段");
    }

    const buf = bufferUtil.resolveBufferFromPreset(
      bufferPreset || "default",
      bufferBefore,
      bufferAfter,
      ctx.bufferConfig,
    );
    const candidate = bufferUtil.computeBlock(
      start,
      end,
      buf.bufferBefore,
      buf.bufferAfter,
    );

    const existing = await this._loadTeacherBlocksForDay(
      teacherId,
      day,
      excludeMark,
      ctx.bufferConfig,
      ctx.privateCategoryIds,
    );
    const conflicts = [];
    for (let b of existing) {
      if (bufferUtil.blocksOverlap(candidate, b)) {
        conflicts.push({
          mark: b.mark,
          title: b.title,
          time: bufferUtil.formatBlockLabel(b),
          block: b.blockStart + "-" + b.blockEnd,
        });
      }
    }

    return {
      ok: conflicts.length === 0,
      conflicts,
      buffer: buf,
      blockStart: candidate.blockStart,
      blockEnd: candidate.blockEnd,
    };
  }

  async _buildJoinForms(userId, meet) {
    const user = await UserModel.getOne(
      { USER_MINI_OPENID: userId },
      "USER_NAME,USER_MOBILE",
    );
    const formSet = meet.MEET_FORM_SET || [];
    if (formSet.length) {
      return formSet.map((f) => {
        const item = dataUtil.deepClone(f);
        if (item.mark === "name" || item.title === "姓名") {
          item.val = (user && user.USER_NAME) || "";
        }
        if (item.type === "mobile" || item.title === "手机") {
          item.val = (user && user.USER_MOBILE) || "";
        }
        return item;
      });
    }
    return [
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

  async _appendPrivateSlot(meetId, day, slot, dayDesc) {
    const adminMeet = new AdminMeetService();
    let dayRec = await DayModel.getOne({ DAY_MEET_ID: meetId, day }, "times,dayDesc");
    let times = dayRec ? dayRec.times || [] : [];
    times = times.slice();
    times.push(slot);
    times = adminMeet._normTimes(times, day);

    if (dayRec) {
      await DayModel.edit(
        { DAY_MEET_ID: meetId, day },
        { times, dayDesc: dayDesc || dayRec.dayDesc },
      );
    } else {
      await DayModel.insert({
        DAY_MEET_ID: meetId,
        day,
        dayDesc: dayDesc || day,
        times,
      });
    }
    await adminMeet._syncMeetDaysAfterChange(meetId);
    return slot.mark;
  }

  async bookSession(admin, input) {
    const ctx = await this._getPrivateContext();
    const {
      meetId,
      userId,
      day,
      start,
      end,
      teacherId,
      teacherName,
      cardId,
      bufferPreset,
      bufferBefore,
      bufferAfter,
      force,
      memo,
    } = input;

    if (!meetId || !userId || !day || !start) {
      this.AppError("请完善私教预约信息");
    }
    if (!teacherId) this.AppError("请选择授课教练");

    const meet = await MeetModel.getOne({ _id: meetId });
    if (!meet) this.AppError("课程不存在");
    if (!privateMeetUtil.isPrivateMeet(meet, ctx.privateCategoryIds)) {
      this.AppError("该课程不是私教分类");
    }

    const style = meet.MEET_STYLE_SET || {};
    const duration = Number(style.duration) || 60;
    const endTime =
      end || bufferUtil.addMinutes(start, duration);

    const dupJoin = await JoinModel.getOne(
      {
        JOIN_USER_ID: userId,
        JOIN_MEET_ID: meetId,
        JOIN_MEET_DAY: day,
        JOIN_MEET_TIME_START: start,
        JOIN_STATUS: JoinModel.STATUS.SUCC,
      },
      "_id,JOIN_MEET_TIME_MARK,JOIN_MEET_TIME_END",
    );
    if (dupJoin) {
      return {
        meetId,
        mark: dupJoin.JOIN_MEET_TIME_MARK,
        joinId: dupJoin._id,
        day,
        start,
        end: dupJoin.JOIN_MEET_TIME_END || endTime,
        duplicated: true,
      };
    }

    const check = await this.checkSlot({
      teacherId,
      day,
      start,
      end: endTime,
      bufferPreset,
      bufferBefore,
      bufferAfter,
    });

    if (!check.ok && !force) {
      const hit = check.conflicts[0];
      const msg = hit
        ? `与「${hit.title} ${hit.time}」冲突（占用 ${hit.block}）`
        : "该时段与教练其他课程冲突";
      this.AppError(msg);
    }

    const buf = check.buffer;
    const block = bufferUtil.computeBlock(
      start,
      endTime,
      buf.bufferBefore,
      buf.bufferAfter,
    );

    const mark =
      "T" +
      day.replace(/-/g, "") +
      dataUtil.genRandomAlpha(10).toUpperCase();

    const slot = {
      mark,
      start,
      end: endTime,
      status: 1,
      isLimit: 1,
      limit: 1,
      teacherId: teacherId || "",
      teacherName: teacherName || "",
      slotType: "private",
      bufferBefore: buf.bufferBefore,
      bufferAfter: buf.bufferAfter,
      bufferPreset: bufferPreset || "default",
      blockStart: block.blockStart,
      blockEnd: block.blockEnd,
      stat: { succCnt: 0, cancelCnt: 0, adminCancelCnt: 0 },
    };

    const weekday = timeUtil.week(day);
    const dayDesc = timeUtil.fmtDateCHN(day) + " (" + weekday + ")";

    await this._appendPrivateSlot(meetId, day, slot, dayDesc);

    const forms = await this._buildJoinForms(userId, meet);
    if (memo) {
      forms.push({ mark: "memo", title: "备注", type: "text", val: String(memo).slice(0, 50) });
    }

    const meetService = new MeetService();
    const isAdminBook = !!(admin && admin._id);
    if (!cardId && !isAdminBook) {
      this.AppError("请选择会员卡");
    }
    if (cardId) {
      const cardService = new UserCardService();
      await cardService.checkCardForJoin(userId, meetId, cardId);
    }

    const joinResult = await meetService.join(
      userId,
      meetId,
      mark,
      forms,
      cardId || "",
      { skipEndCheck: true, isAdmin: !!(admin && admin._id) },
    );

    return {
      meetId,
      mark,
      joinId: joinResult.joinId,
      day,
      start,
      end: endTime,
      blockStart: block.blockStart,
      blockEnd: block.blockEnd,
      cardWarning: joinResult.cardWarning || "",
      conflictWarning: !check.ok && force ? check.conflicts : [],
    };
  }
}

module.exports = AdminPrivateService;
