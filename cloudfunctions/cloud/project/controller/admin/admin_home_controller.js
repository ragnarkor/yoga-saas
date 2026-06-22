/**
 * Notes: 首页内容后台管理控制器
 */

const BaseAdminController = require("./base_admin_controller.js");
const AdminHomeService = require("../../service/admin/admin_home_service.js");

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
}

module.exports = AdminHomeController;
