/**
 * Notes: 管理员管理（平台级）
 */

const BaseAdminService = require("./base_admin_service.js");
const AdminModel = require("../../model/admin_model.js");
const TenantModel = require("../../model/tenant_model.js");
const LogModel = require("../../model/log_model.js");
const util = require("../../../framework/utils/util.js");
const dataUtil = require("../../../framework/utils/data_util.js");
const MeetModel = require("../../model/meet_model.js");
const teacherAdminHelper = require("../teacher_admin_helper.js");

class AdminMgrService extends BaseAdminService {
  /** 取得日志分页列表 */
  async getLogList({
    search,
    sortType,
    sortVal,
    orderBy,
    whereEx,
    page,
    size,
    oldTotal = 0,
  }) {
    orderBy = orderBy || { LOG_ADD_TIME: "desc" };
    let fields = "*";
    let where = {};

    if (util.isDefined(search) && search) {
      where.or = [
        { LOG_CONTENT: ["like", search] },
        { LOG_ADMIN_NAME: ["like", search] },
        { LOG_ADD_IP: ["like", search] },
      ];
    } else if (sortType && util.isDefined(sortVal)) {
      switch (sortType) {
        case "type":
          where.LOG_TYPE = Number(sortVal);
          break;
      }
    }
    return await LogModel.getList(
      where,
      fields,
      orderBy,
      page,
      size,
      true,
      oldTotal,
    );
  }

  /** 超管：某馆管理员列表 */
  async getAdminList(pid) {
    if (!pid) this.AppError("请选择瑜伽馆");

    let tenant = await TenantModel.getOne({ _pid: pid }, "TENANT_NAME", {}, false);
    if (!tenant) this.AppError("瑜伽馆不存在");

    let list = await AdminModel.getAll(
      {
        _pid: pid,
        ADMIN_TYPE: ["in", [AdminModel.TYPE.OWNER, AdminModel.TYPE.TEACHER]],
      },
      "ADMIN_ID,ADMIN_NAME,ADMIN_PHONE,ADMIN_TYPE,ADMIN_STATUS,ADMIN_MINI_OPENID",
      { ADMIN_ADD_TIME: "desc" },
      100,
      false,
    );

    return {
      tenantName: tenant.TENANT_NAME,
      list: (list || []).map((a) => ({
        ...a,
        roleLabel: a.ADMIN_TYPE === AdminModel.TYPE.OWNER ? "馆长" : "教练",
        bound: !!a.ADMIN_MINI_OPENID,
      })),
    };
  }

  /** 超管：新建馆长/教练 */
  async insertAdmin(pid, name, phone, pwd, adminType, operator) {
    if (!pid) this.AppError("请选择瑜伽馆");

    name = String(name || "").trim();
    phone = String(phone || "").trim();
    pwd = String(pwd || "").trim();
    adminType = adminType || AdminModel.TYPE.TEACHER;

    if (!name) this.AppError("请填写姓名");
    if (phone.length < 5 || phone.length > 30) this.AppError("手机号格式不正确");
    if (!pwd || pwd.length < 5) pwd = dataUtil.genRandomString(16);
    if (pwd.length > 30) this.AppError("密码不能超过30位");
    if (
      adminType !== AdminModel.TYPE.OWNER &&
      adminType !== AdminModel.TYPE.TEACHER
    ) {
      this.AppError("角色类型不正确");
    }

    let tenant = await TenantModel.getOne({ _pid: pid }, "TENANT_NAME", {}, false);
    if (!tenant) this.AppError("瑜伽馆不存在");

    let exists = await AdminModel.getOne(
      { _pid: pid, ADMIN_PHONE: phone },
      "_id",
      {},
      false,
    );
    if (exists) this.AppError("该手机号在本馆已存在");

    if (adminType === AdminModel.TYPE.OWNER) {
      let ownerCnt = await AdminModel.count(
        {
          _pid: pid,
          ADMIN_TYPE: AdminModel.TYPE.OWNER,
          ADMIN_STATUS: 1,
        },
        false,
      );
      if (ownerCnt > 0) this.AppError("该馆已有馆长，请创建教练账号");
    }

    let data = {
      _pid: pid,
      ADMIN_NAME: name,
      ADMIN_PHONE: phone,
      ADMIN_PWD: pwd,
      ADMIN_TYPE: adminType,
      ADMIN_STATUS: 1,
    };

    await AdminModel.insert(data, false);
    await this.insertLog(
      `为「${tenant.TENANT_NAME}」新建${adminType === AdminModel.TYPE.OWNER ? "馆长" : "教练"} ${name}`,
      operator,
      LogModel.TYPE.SYS,
    );

    return { adminName: name, phone, adminType };
  }

  /** 馆主/超管：为本馆添加教练员工（待绑定空壳） */
  async insertStaff(pid, name, phone, pwd, operator) {
    if (!operator) this.AppError("无权限");
    const opType = operator.ADMIN_TYPE;
    if (opType !== AdminModel.TYPE.OWNER && opType !== AdminModel.TYPE.SUPER) {
      this.AppError("仅馆主可添加员工");
    }
    if (opType === AdminModel.TYPE.OWNER && operator._pid !== pid) {
      this.AppError("只能为本馆添加员工");
    }
    return await this.insertAdmin(
      pid,
      name,
      phone,
      pwd,
      AdminModel.TYPE.TEACHER,
      operator,
    );
  }

  /** 删除未绑微信的空壳账号（超管任意；馆主仅本馆教练） */
  async deleteAdmin(adminId, operator) {
    if (!adminId) this.AppError("参数错误");
    if (!operator) this.AppError("无权限");

    let admin = await AdminModel.getOne({ _id: adminId }, "*", {}, false);
    if (!admin) this.AppError("管理员不存在");
    if (admin.ADMIN_TYPE === AdminModel.TYPE.SUPER) {
      this.AppError("不能删除超级管理员");
    }

    const opType = operator.ADMIN_TYPE;
    if (opType === AdminModel.TYPE.OWNER) {
      if (operator._pid !== admin._pid) this.AppError("无权限");
      if (admin.ADMIN_TYPE !== AdminModel.TYPE.TEACHER) {
        this.AppError("馆主仅可删除待绑定的教练账号");
      }
    } else if (opType !== AdminModel.TYPE.SUPER) {
      this.AppError("无权限");
    }
    if (teacherAdminHelper.constructor.isAdminBound(admin)) {
      this.AppError("该账号已绑定微信，请先解绑再删除");
    }

    let meetCnt = await MeetModel.count({ MEET_ADMIN_ID: admin._id }, false);
    if (meetCnt > 0) this.AppError("该账号已有关联课程，无法删除");

    let tenant = await TenantModel.getOne(
      { _pid: admin._pid },
      "TENANT_NAME",
      {},
      false,
    );

    await teacherAdminHelper.deleteTeacherByAdmin(admin);
    await AdminModel.del({ _id: admin._id });

    await this.insertLog(
      `删除了待绑定${admin.ADMIN_TYPE === AdminModel.TYPE.OWNER ? "馆长" : "教练"}账号 ${admin.ADMIN_NAME}`,
      operator,
      LogModel.TYPE.SYS,
    );

    return {
      adminName: admin.ADMIN_NAME,
      tenantName: tenant ? tenant.TENANT_NAME : "",
    };
  }
}

module.exports = AdminMgrService;
