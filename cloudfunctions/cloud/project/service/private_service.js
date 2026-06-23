/**
 * 会员端私教预约
 */

const BaseService = require("./base_service.js");
const AdminPrivateService = require("./admin/admin_private_service.js");
const teacherAdminHelper = require("./teacher_admin_helper.js");
const MeetModel = require("../model/meet_model.js");
const bufferUtil = require("../utils/schedule_buffer_util.js");
const privateMeetUtil = require("../utils/private_meet_util.js");
const timeUtil = require("../../framework/utils/time_util.js");

class PrivateService extends BaseService {
  async _getAdminPrivate() {
    return new AdminPrivateService();
  }

  async getMeta() {
    const pid = this.getProjectId();
    if (!pid || pid === "unknow") {
      this.AppError("请先选择瑜伽馆");
    }
    const adminPrivate = await this._getAdminPrivate();
    const meta = await adminPrivate.getMeta();
    const ctx = await adminPrivate._getPrivateContext();
    const schedule = bufferUtil.resolveScheduleConfig(ctx.bufferConfig || {});

    const teachers = await teacherAdminHelper.listBoundStaffForHome();

    const teacherList = (teachers || []).map((t) => ({
      _id: t._id,
      name: t.TEACHER_NAME || "",
      specialty: t.TEACHER_SPECIALTY || "",
      avatar: t.TEACHER_AVATAR || "",
    }));

    return {
      courses: meta.courses || [],
      schedule,
      teachers: teacherList,
      maxBookDay: this._maxBookDay(schedule.maxBookDays),
    };
  }

  _maxBookDay(maxBookDays) {
    const today = timeUtil.time("Y-M-D");
    const d = new Date(today.replace(/-/g, "/"));
    d.setDate(d.getDate() + Math.max(0, Number(maxBookDays) || 14));
    return (
      d.getFullYear() +
      "-" +
      String(d.getMonth() + 1).padStart(2, "0") +
      "-" +
      String(d.getDate()).padStart(2, "0")
    );
  }

  _validateDayInRange(day, schedule) {
    const today = timeUtil.time("Y-M-D");
    const maxDay = this._maxBookDay(schedule.maxBookDays);
    if (day < today) this.AppError("不能预约过去的日期");
    if (day > maxDay) this.AppError("超出可预约日期范围");
  }

  _computeMinBlockStartMin(day, schedule) {
    const openMin = bufferUtil.timeToMinutes(schedule.openTime);
    const today = timeUtil.time("Y-M-D");
    if (day !== today) return openMin;

    const now = new Date();
    const advanceMs = (Number(schedule.advanceHours) || 0) * 3600 * 1000;
    const earliest = new Date(now.getTime() + advanceMs);
    const hh = String(earliest.getHours()).padStart(2, "0");
    const mm = String(earliest.getMinutes()).padStart(2, "0");
    const minFromNow = bufferUtil.timeToMinutes(`${hh}:${mm}`);
    return Math.max(openMin, minFromNow);
  }

  async getAvailableSlots({ meetId, teacherId, day }) {
    const adminPrivate = await this._getAdminPrivate();
    const ctx = await adminPrivate._getPrivateContext();
    const schedule = bufferUtil.resolveScheduleConfig(ctx.bufferConfig);

    this._validateDayInRange(day, schedule);

    const meet = await MeetModel.getOne({ _id: meetId });
    if (!meet) this.AppError("课程不存在");
    if (!privateMeetUtil.isPrivateMeet(meet, ctx.privateCategoryIds)) {
      this.AppError("该课程不支持私教预约");
    }

    const style = meet.MEET_STYLE_SET || {};
    const duration = Number(style.duration) || 60;
    const buf = bufferUtil.resolveBufferFromPreset(
      "default",
      null,
      null,
      ctx.bufferConfig,
    );

    const existing = await adminPrivate._loadTeacherBlocksForDay(
      teacherId,
      day,
      "",
      ctx.bufferConfig,
      ctx.privateCategoryIds,
    );

    const minBlockStartMin = this._computeMinBlockStartMin(day, schedule);
    const slots = bufferUtil.buildAvailableSlots({
      openStart: schedule.openTime,
      openEnd: schedule.closeTime,
      durationMinutes: duration,
      stepMinutes: schedule.slotStepMinutes,
      bufferBefore: buf.bufferBefore,
      bufferAfter: buf.bufferAfter,
      existingBlocks: existing,
      minBlockStartMin,
    });

    return {
      day,
      meetId,
      teacherId,
      duration,
      schedule,
      slots,
    };
  }

  async bookSession(userId, input) {
    if (!userId) this.AppError("请先登录");

    const { meetId, teacherId, teacherName, day, start, cardId } = input;
    if (!cardId) this.AppError("请选择会员卡");

    const available = await this.getAvailableSlots({ meetId, teacherId, day });
    const hit = (available.slots || []).find((s) => s.start === start);
    if (!hit) {
      this.AppError("该时段已不可用，请重新选择");
    }

    const adminPrivate = await this._getAdminPrivate();
    return await adminPrivate.bookSession(null, {
      meetId,
      userId,
      day,
      start,
      end: hit.end,
      teacherId,
      teacherName: teacherName || "",
      cardId,
      bufferPreset: "default",
      force: false,
    });
  }
}

module.exports = PrivateService;
