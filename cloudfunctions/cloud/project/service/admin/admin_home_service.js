/**
 * Notes: 首页内容后台管理
 */

const BaseAdminService = require("./base_admin_service.js");
const cloudUtil = require("../../../framework/cloud/cloud_util.js");
const util = require("../../../framework/utils/util.js");
const BannerModel = require("../../model/banner_model.js");
const AnnouncementModel = require("../../model/announcement_model.js");
const TeacherModel = require("../../model/teacher_model.js");
const AdminModel = require("../../model/admin_model.js");
const PhotoModel = require("../../model/photo_model.js");
const teacherAdminHelper = require("../teacher_admin_helper.js");

class AdminHomeService extends BaseAdminService {
  async getBannerList() {
    return await BannerModel.getAll(
      { BANNER_STATUS: 1 },
      "*",
      { BANNER_ORDER: "asc", BANNER_ADD_TIME: "desc" },
      100,
    );
  }

  async insertBanner(data) {
    data.BANNER_STATUS = 1;
    return await BannerModel.insert(data);
  }

  async editBanner(id, data) {
    await BannerModel.edit({ _id: id }, data);
  }

  async delBanner(id) {
    let item = await BannerModel.getOne({ _id: id }, "BANNER_PIC,BANNER_VIDEO");
    if (!item) return;
    let files = [];
    if (item.BANNER_PIC) files.push(item.BANNER_PIC);
    if (item.BANNER_VIDEO) files.push(item.BANNER_VIDEO);
    if (files.length) await cloudUtil.deleteFiles(files);
    await BannerModel.del({ _id: id });
  }

  async getAnnounceList() {
    return await AnnouncementModel.getAll(
      {},
      "*",
      { ANNOUNCE_ORDER: "asc", ANNOUNCE_ADD_TIME: "desc" },
      100,
    );
  }

  async insertAnnounce(data) {
    data.ANNOUNCE_STATUS = 1;
    data.ANNOUNCE_CONTENT = data.ANNOUNCE_CONTENT || [];
    return await AnnouncementModel.insert(data);
  }

  async editAnnounce(id, data) {
    await AnnouncementModel.edit({ _id: id }, data);
  }

  async delAnnounce(id) {
    await AnnouncementModel.del({ _id: id });
  }

  async getTeacherList() {
    const teacherAdminHelper = require("../teacher_admin_helper.js");
    return await teacherAdminHelper.listBoundStaffForHome();
  }

  async insertTeacher(data) {
    this.AppError("请先在员工管理中添加并邀请绑定，绑定成功后会自动创建老师展示资料");
  }

  async editTeacher(id, data) {
    await TeacherModel.edit({ _id: id }, data);
  }

  async delTeacher(id) {
    let item = await TeacherModel.getOne({ _id: id }, "TEACHER_AVATAR,TEACHER_PIC");
    if (!item) return;
    let files = [];
    if (item.TEACHER_AVATAR) files.push(item.TEACHER_AVATAR);
    if (item.TEACHER_PIC && item.TEACHER_PIC.length) files = files.concat(item.TEACHER_PIC);
    if (files.length) await cloudUtil.deleteFiles(files);
    await TeacherModel.del({ _id: id });
  }

  async getPhotoList() {
    return await PhotoModel.getAll(
      {},
      "*",
      { PHOTO_ORDER: "asc", PHOTO_ADD_TIME: "desc" },
      100,
    );
  }

  async insertPhoto(data) {
    data.PHOTO_STATUS = 1;
    return await PhotoModel.insert(data);
  }

  async editPhoto(id, data) {
    await PhotoModel.edit({ _id: id }, data);
  }

  async delPhoto(id) {
    let item = await PhotoModel.getOne({ _id: id }, "PHOTO_PIC");
    if (!item) return;
    if (item.PHOTO_PIC) await cloudUtil.deleteFiles([item.PHOTO_PIC]);
    await PhotoModel.del({ _id: id });
  }

  /** 当前登录馆主/教练：读取会员端主页展示资料 */
  async getMyTeacherProfile(admin) {
    if (!admin) this.AppError("无权限");
    if (
      admin.ADMIN_TYPE !== AdminModel.TYPE.TEACHER &&
      admin.ADMIN_TYPE !== AdminModel.TYPE.OWNER
    ) {
      this.AppError("仅馆主/教练可编辑主页资料");
    }
    if (!teacherAdminHelper.constructor.isAdminBound(admin)) {
      this.AppError("请先完成微信绑定后再编辑主页资料");
    }
    await teacherAdminHelper.ensureTeacherOnBind(admin);
    let teacher = await TeacherModel.getOne(
      { TEACHER_ADMIN_ID: admin._id },
      "*",
      {},
      false,
    );
    if (!teacher) this.AppError("未找到展示资料，请重新绑定后再试");
    return {
      id: teacher._id,
      name: teacher.TEACHER_NAME || admin.ADMIN_NAME || "",
      avatar: teacher.TEACHER_AVATAR || "",
      specialty: teacher.TEACHER_SPECIALTY || "",
      desc: teacher.TEACHER_DESC || "",
      pics: teacher.TEACHER_PIC || [],
    };
  }

  /** 当前登录馆主/教练：保存会员端主页展示资料 */
  async saveMyTeacherProfile(admin, data) {
    if (!admin) this.AppError("无权限");
    if (
      admin.ADMIN_TYPE !== AdminModel.TYPE.TEACHER &&
      admin.ADMIN_TYPE !== AdminModel.TYPE.OWNER
    ) {
      this.AppError("仅馆主/教练可编辑主页资料");
    }
    if (!teacherAdminHelper.constructor.isAdminBound(admin)) {
      this.AppError("请先完成微信绑定后再编辑主页资料");
    }
    await teacherAdminHelper.ensureTeacherOnBind(admin);
    let teacher = await TeacherModel.getOne(
      { TEACHER_ADMIN_ID: admin._id },
      "_id",
      {},
      false,
    );
    if (!teacher) this.AppError("未找到展示资料");

    let payload = {};
    if (util.isDefined(data.avatar)) payload.TEACHER_AVATAR = data.avatar || "";
    if (util.isDefined(data.specialty))
      payload.TEACHER_SPECIALTY = String(data.specialty || "").trim();
    if (util.isDefined(data.desc))
      payload.TEACHER_DESC = String(data.desc || "").trim();
    if (util.isDefined(data.pics)) payload.TEACHER_PIC = data.pics || [];

    if (Object.keys(payload).length) {
      await TeacherModel.edit({ _id: teacher._id }, payload, false);
    }
    return { id: teacher._id };
  }
}

module.exports = AdminHomeService;
