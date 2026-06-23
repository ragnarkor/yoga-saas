/**
 * Notes: 首页老师与管理员微信绑定的关联逻辑
 */

const TeacherModel = require("../model/teacher_model.js");
const AdminModel = require("../model/admin_model.js");

class TeacherAdminHelper {
  static isAdminBound(admin) {
    if (!admin) return false;
    const openid = admin.ADMIN_MINI_OPENID
      ? String(admin.ADMIN_MINI_OPENID).trim()
      : "";
    return !!openid;
  }

  /** 微信绑定成功后：馆主/教练自动创建/恢复首页展示资料 */
  async ensureTeacherOnBind(admin) {
    if (!admin) return null;
    if (
      admin.ADMIN_TYPE !== AdminModel.TYPE.TEACHER &&
      admin.ADMIN_TYPE !== AdminModel.TYPE.OWNER
    ) {
      return null;
    }
    if (!TeacherAdminHelper.isAdminBound(admin)) return null;

    let existing = await TeacherModel.getOne(
      { TEACHER_ADMIN_ID: admin._id },
      "*",
      {},
      false,
    );

    if (existing) {
      await TeacherModel.edit(
        { _id: existing._id },
        {
          TEACHER_NAME: admin.ADMIN_NAME,
          TEACHER_HOME: 1,
          TEACHER_STATUS: 1,
        },
        false,
      );
      return existing._id;
    }

    let pid = admin._pid || global.PID || "";
    if (!pid) return null;

    let count = await TeacherModel.count({}, false);
    return await TeacherModel.insert(
      {
        _pid: pid,
        TEACHER_ADMIN_ID: admin._id,
        TEACHER_NAME: admin.ADMIN_NAME,
        TEACHER_SPECIALTY: "",
        TEACHER_DESC: "",
        TEACHER_PIC: [],
        TEACHER_HOME: 1,
        TEACHER_ORDER: count + 1,
        TEACHER_STATUS: 1,
      },
      false,
    );
  }

  /** 解绑微信：下架首页展示 */
  async hideTeacherOnUnbind(admin) {
    if (!admin || !admin._id) return;
    let teacher = await TeacherModel.getOne(
      { TEACHER_ADMIN_ID: admin._id },
      "_id",
      {},
      false,
    );
    if (!teacher) return;
    await TeacherModel.edit(
      { _id: teacher._id },
      { TEACHER_HOME: 0, TEACHER_STATUS: 0 },
      false,
    );
  }

  /** 删除空壳 admin 时清理关联 teacher */
  async deleteTeacherByAdmin(admin) {
    if (!admin || !admin._id) return;
    let teacher = await TeacherModel.getOne(
      { TEACHER_ADMIN_ID: admin._id },
      "_id",
      {},
      false,
    );
    if (!teacher) return;
    await TeacherModel.del({ _id: teacher._id });
  }

  /** 会员端首页：已绑定微信的馆主/教练（自动补齐 teacher 资料） */
  async listBoundStaffForHome() {
    let admins = await AdminModel.getAll(
      {
        ADMIN_STATUS: 1,
        ADMIN_TYPE: ["in", [AdminModel.TYPE.OWNER, AdminModel.TYPE.TEACHER]],
      },
      "ADMIN_ID,ADMIN_NAME,ADMIN_TYPE,ADMIN_MINI_OPENID,ADMIN_BIND_TIME,_id,_pid",
      { ADMIN_TYPE: "asc", ADMIN_BIND_TIME: "desc" },
      50,
      false,
    );

    admins = (admins || []).filter((a) =>
      TeacherAdminHelper.isAdminBound(a),
    );

    let list = [];
    for (let admin of admins) {
      await this.ensureTeacherOnBind(admin);
      let teacher = await TeacherModel.getOne(
        { TEACHER_ADMIN_ID: admin._id },
        "*",
        {},
        false,
      );
      if (teacher) list.push(teacher);
    }
    return list;
  }

  /** @deprecated 兼容旧查询 */
  async filterVisibleTeachers(teachers) {
    if (!teachers || !teachers.length) return [];

    let adminIds = teachers.map((t) => t.TEACHER_ADMIN_ID).filter(Boolean);
    if (!adminIds.length) return [];

    let admins = await AdminModel.getAll(
      { _id: ["in", adminIds], ADMIN_STATUS: 1 },
      "ADMIN_MINI_OPENID,_id",
      {},
      100,
      false,
    );

    let boundMap = {};
    for (let a of admins || []) {
      if (TeacherAdminHelper.isAdminBound(a)) boundMap[a._id] = true;
    }

    return teachers.filter(
      (t) =>
        t.TEACHER_ADMIN_ID &&
        boundMap[t.TEACHER_ADMIN_ID] &&
        t.TEACHER_HOME === 1 &&
        t.TEACHER_STATUS === 1,
    );
  }

  async isTeacherVisibleOnHome(teacher) {
    if (!teacher || !teacher.TEACHER_ADMIN_ID) return false;

    let admin = await AdminModel.getOne(
      { _id: teacher.TEACHER_ADMIN_ID, ADMIN_STATUS: 1 },
      "ADMIN_MINI_OPENID",
      {},
      false,
    );
    return TeacherAdminHelper.isAdminBound(admin);
  }
}

module.exports = new TeacherAdminHelper();
