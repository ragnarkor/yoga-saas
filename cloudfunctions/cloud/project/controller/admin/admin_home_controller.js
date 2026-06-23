/**
 * Notes: 首页内容后台管理控制器
 */

const BaseAdminController = require("./base_admin_controller.js");
const AdminHomeService = require("../../service/admin/admin_home_service.js");
const AdminWxService = require("../../service/admin/admin_wx_service.js");
const AdminModel = require("../../model/admin_model.js");

class AdminHomeController extends BaseAdminController {
  async getBannerList() {
    await this.isAdmin();
    let service = new AdminHomeService();
    return { list: await service.getBannerList() };
  }

  async insertBanner() {
    await this.isAdmin();
    let rules = {
      title: "string",
      type: "string|default=image",
      pic: "string",
      video: "string",
      linkType: "string|default=none",
      linkId: "string",
      order: "int|default=9999",
    };
    let input = this.validateData(rules);
    let service = new AdminHomeService();
    let id = await service.insertBanner({
      BANNER_TITLE: input.title,
      BANNER_TYPE: input.type,
      BANNER_PIC: input.pic,
      BANNER_VIDEO: input.video,
      BANNER_LINK_TYPE: input.linkType,
      BANNER_LINK_ID: input.linkId,
      BANNER_ORDER: input.order,
    });
    return { id };
  }

  async delBanner() {
    await this.isAdmin();
    let rules = { id: "must|id" };
    let input = this.validateData(rules);
    let service = new AdminHomeService();
    await service.delBanner(input.id);
  }

  async getAnnounceList() {
    await this.isAdmin();
    let service = new AdminHomeService();
    return { list: await service.getAnnounceList() };
  }

  async insertAnnounce() {
    await this.isAdmin();
    let rules = {
      title: "must|string",
      desc: "string",
      order: "int|default=9999",
    };
    let input = this.validateData(rules);
    let service = new AdminHomeService();
    let id = await service.insertAnnounce({
      ANNOUNCE_TITLE: input.title,
      ANNOUNCE_DESC: input.desc,
      ANNOUNCE_ORDER: input.order,
      ANNOUNCE_CONTENT: [{ type: "text", val: input.desc || input.title }],
    });
    return { id };
  }

  async delAnnounce() {
    await this.isAdmin();
    let rules = { id: "must|id" };
    let input = this.validateData(rules);
    let service = new AdminHomeService();
    await service.delAnnounce(input.id);
  }

  async getTeacherList() {
    await this.isAdmin();
    let service = new AdminHomeService();
    return { list: await service.getTeacherList() };
  }

  async insertTeacher() {
    await this.isAdmin();
    let rules = {
      name: "must|string",
      avatar: "string",
      specialty: "string",
      desc: "string",
      pics: "array",
      home: "int|default=1",
      order: "int|default=9999",
    };
    let input = this.validateData(rules);
    let service = new AdminHomeService();
    let id = await service.insertTeacher({
      TEACHER_NAME: input.name,
      TEACHER_AVATAR: input.avatar,
      TEACHER_SPECIALTY: input.specialty,
      TEACHER_DESC: input.desc,
      TEACHER_PIC: input.pics || [],
      TEACHER_HOME: input.home,
      TEACHER_ORDER: input.order,
    });
    return { id };
  }

  async delTeacher() {
    await this.isAdmin();
    let rules = { id: "must|id" };
    let input = this.validateData(rules);
    let service = new AdminHomeService();
    await service.delTeacher(input.id);
  }

  async getPhotoList() {
    await this.isAdmin();
    let service = new AdminHomeService();
    return { list: await service.getPhotoList() };
  }

  async insertPhoto() {
    await this.isAdmin();
    let rules = {
      title: "string",
      desc: "string",
      pic: "must|string",
      linkType: "string|default=none",
      linkId: "string",
      order: "int|default=9999",
    };
    let input = this.validateData(rules);
    let service = new AdminHomeService();
    let id = await service.insertPhoto({
      PHOTO_TITLE: input.title,
      PHOTO_DESC: input.desc,
      PHOTO_PIC: input.pic,
      PHOTO_LINK_TYPE: input.linkType,
      PHOTO_LINK_ID: input.linkId,
      PHOTO_ORDER: input.order,
    });
    return { id };
  }

  async delPhoto() {
    await this.isAdmin();
    let rules = { id: "must|id" };
    let input = this.validateData(rules);
    let service = new AdminHomeService();
    await service.delPhoto(input.id);
  }

  /** 密码登录（超管/备用） */
  async adminLogin() {
    let rules = {
      phone: "must|string|min:5|max:30|name=手机号",
      pwd: "must|string|min:5|max:30|name=密码",
    };
    let input = this.validateData(rules);
    let service = new AdminWxService();
    return await service.adminLogin(input.phone, input.pwd, this._userId);
  }

  /** 后台首页统计 */
  async adminHome() {
    await this.isAdmin();
    let service = new AdminWxService();
    let pid = global.PID || "";
    if (this._adminType === AdminModel.TYPE.SUPER && !pid) {
      return await service.adminHome(this._adminType, "");
    }
    return await service.adminHome(this._adminType, pid);
  }

  /** 微信静默会话（馆长/教练） */
  async wxSession() {
    let service = new AdminWxService();
    let pid = global.PID || this.getParameter("pid") || "";
    return await service.wxSession(this._userId, pid);
  }

  /** 绑定码消费 */
  async wxBind() {
    let rules = {
      code: "must|string|min:10|max:64|name=绑定码",
    };
    let input = this.validateData(rules);
    let service = new AdminWxService();
    return await service.wxBind(input.code, this._userId);
  }

  /** 已绑定馆列表 */
  async wxTenantList() {
    let service = new AdminWxService();
    return await service.wxTenantList(this._userId);
  }

  /** 解除微信绑定 */
  async wxUnbind() {
    let rules = {
      adminId: "id|name=管理员ID",
    };
    let input = this.validateData(rules);
    let service = new AdminWxService();
    let operator = null;
    if (input.adminId) {
      await this.isAdmin();
      operator = await AdminModel.getOne(
        { ADMIN_ID: this._adminId },
        "*",
        {},
        false,
      );
    }
    return await service.wxUnbind(
      this._userId,
      global.PID || "",
      operator,
      input.adminId || "",
    );
  }

  /** 生成绑定码 */
  async genBindCode() {
    await this.isAdmin();
    let rules = { adminId: "must|id|name=管理员ID" };
    let input = this.validateData(rules);
    let operator = await AdminModel.getOne(
      { ADMIN_ID: this._adminId },
      "*",
      {},
      false,
    );
    let service = new AdminWxService();
    return await service.genBindCode(input.adminId, operator);
  }

  /** 可绑定管理员列表 */
  async listBindableAdmins() {
    await this.isAdmin();
    let pid = global.PID || this.getParameter("pid") || "";
    let operator = await AdminModel.getOne(
      { ADMIN_ID: this._adminId },
      "*",
      {},
      false,
    );
    if (!operator && this._token) {
      operator = await AdminModel.getOne(
        {
          ADMIN_TOKEN: this._token,
          ADMIN_STATUS: 1,
        },
        "*",
        {},
        false,
      );
    }
    let service = new AdminWxService();
    return await service.listBindableAdmins(pid, operator, this._adminType);
  }

  /** 超管：全平台员工列表 */
  async listPlatformStaff() {
    await this.isSuperAdmin();
    let operator = await AdminModel.getOne(
      { ADMIN_ID: this._adminId },
      "*",
      {},
      false,
    );
    let service = new AdminWxService();
    return await service.listPlatformStaff(operator);
  }

  /** 生成会员邀请小程序码（教练/馆长） */
  async genMemberInviteQr() {
    await this.isAdmin();
    let pid = global.PID || this.getParameter("pid") || "";
    if (!pid) this.AppError("请先选择瑜伽馆");
    const MemberInviteService = require("../../service/member_invite_service.js");
    let service = new MemberInviteService();
    return await service.genInviteQr(pid);
  }

  /** 馆主/教练：读取自己的会员端主页资料 */
  async getMyTeacherProfile() {
    await this.isAdmin();
    let operator = await AdminModel.getOne(
      { ADMIN_ID: this._adminId },
      "*",
      {},
      false,
    );
    let service = new AdminHomeService();
    return await service.getMyTeacherProfile(operator);
  }

  /** 馆主/教练：保存自己的会员端主页资料 */
  async saveMyTeacherProfile() {
    await this.isAdmin();
    let rules = {
      avatar: "string",
      specialty: "string|max:200",
      desc: "string|max:2000",
      pics: "array",
    };
    let input = this.validateData(rules);
    let operator = await AdminModel.getOne(
      { ADMIN_ID: this._adminId },
      "*",
      {},
      false,
    );
    let service = new AdminHomeService();
    return await service.saveMyTeacherProfile(operator, input);
  }
}

module.exports = AdminHomeController;
