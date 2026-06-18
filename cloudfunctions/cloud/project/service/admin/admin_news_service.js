/**
 * Notes: 资讯后台管理
 * Ver : CCMiniCloud Framework 2.0.1 ALL RIGHTS RESERVED BY cclinux@qq.com
 * Date: 2021-07-11 07:48:00
 */

const BaseAdminService = require("./base_admin_service.js");

const dataUtil = require("../../../framework/utils/data_util.js");
const util = require("../../../framework/utils/util.js");
const cloudUtil = require("../../../framework/cloud/cloud_util.js");

const NewsModel = require("../../model/news_model.js");

class AdminNewsService extends BaseAdminService {
  /**添加资讯 */
  async insertNews(
    adminId,
    {
      title,
      cateId,
      cateName,
      order,
      type = 0,
      desc = "",
      url = "",
    },
  ) {
    let data = {};
    data.NEWS_TITLE = title;
    data.NEWS_DESC = desc;
    data.NEWS_CATE_ID = cateId;
    data.NEWS_CATE_NAME = cateName;
    data.NEWS_ORDER = order;
    data.NEWS_TYPE = type;
    data.NEWS_URL = url;
    data.NEWS_ADMIN_ID = adminId;
    data.NEWS_CONTENT = [];
    data.NEWS_PIC = [];
    data.NEWS_STATUS = 1;

    let id = await NewsModel.insert(data);
    return { id };
  }

  /**删除资讯数据 */
  async delNews(id) {
    let where = { _id: id };
    let news = await NewsModel.getOne(where, "NEWS_PIC");
    if (!news) return;

    if (news.NEWS_PIC && news.NEWS_PIC.length > 0) {
      await cloudUtil.deleteFiles(news.NEWS_PIC);
    }
    await NewsModel.del(where);
  }

  /**获取资讯信息 */
  async getNewsDetail(id) {
    let fields = "*";

    let where = {
      _id: id,
    };
    let news = await NewsModel.getOne(where, fields);
    if (!news) return null;

    return news;
  }

  /**
   * 更新富文本详细的内容及图片信息
   * @returns 返回 urls数组 [url1, url2, url3, ...]
   */
  async updateNewsContent({ newsId, content }) {
    let where = { _id: newsId };
    let news = await NewsModel.getOne(where, "NEWS_CONTENT");
    if (!news) this.AppError("资讯不存在");

    content = await cloudUtil.handlerCloudFilesByRichEditor(
      news.NEWS_CONTENT || [],
      content || [],
    );
    await NewsModel.edit(where, { NEWS_CONTENT: content });

    let imgList = [];
    for (let k in content) {
      if (content[k].type == "img" && content[k].val) imgList.push(content[k].val);
    }
    let urls = await cloudUtil.getTempFileURL(imgList);
    return { urls };
  }

  /**
   * 更新资讯图片信息
   * @returns 返回 urls数组 [url1, url2, url3, ...]
   */
  async updateNewsPic({ newsId, imgList }) {
    let where = { _id: newsId };
    let news = await NewsModel.getOne(where, "NEWS_PIC");
    if (!news) this.AppError("资讯不存在");

    imgList = await cloudUtil.handlerCloudFiles(news.NEWS_PIC || [], imgList || []);
    await NewsModel.edit(where, { NEWS_PIC: imgList });

    let urls = await cloudUtil.getTempFileURL(imgList);
    return { urls };
  }

  /**更新资讯数据 */
  async editNews({
    id,
    title,
    cateId,
    cateName,
    order,
    type = 0,
    desc = "",
    url = "",
  }) {
    let where = { _id: id };
    let data = {
      NEWS_TITLE: title,
      NEWS_CATE_ID: cateId,
      NEWS_CATE_NAME: cateName,
      NEWS_ORDER: order,
      NEWS_TYPE: type,
      NEWS_DESC: desc,
      NEWS_URL: url,
    };
    await NewsModel.edit(where, data);
  }

  /**取得资讯分页列表 */
  async getNewsList({
    search,
    sortType,
    sortVal,
    orderBy,
    whereEx,
    page,
    size,
    isTotal = true,
    oldTotal,
  }) {
    orderBy = orderBy || {
      NEWS_ORDER: "asc",
      NEWS_ADD_TIME: "desc",
    };
    let fields =
      "NEWS_TYPE,NEWS_URL,NEWS_TITLE,NEWS_DESC,NEWS_CATE_ID,NEWS_EDIT_TIME,NEWS_ADD_TIME,NEWS_ORDER,NEWS_STATUS,NEWS_CATE_NAME,NEWS_HOME";

    let where = {};

    if (util.isDefined(search) && search) {
      where.or = [{ NEWS_TITLE: ["like", search] }];
    } else if (sortType && util.isDefined(sortVal)) {
      switch (sortType) {
        case "cateId":
          where.NEWS_CATE_ID = sortVal;
          break;
        case "status":
          where.NEWS_STATUS = Number(sortVal);
          break;
        case "home":
          where.NEWS_HOME = Number(sortVal);
          break;
        case "sort":
          if (sortVal == "view") {
            orderBy = {
              NEWS_VIEW_CNT: "desc",
              NEWS_ADD_TIME: "desc",
            };
          }
          if (sortVal == "new") {
            orderBy = {
              NEWS_ADD_TIME: "desc",
            };
          }
          break;
      }
    }

    return await NewsModel.getList(
      where,
      fields,
      orderBy,
      page,
      size,
      isTotal,
      oldTotal,
    );
  }

  /**修改资讯状态 */
  async statusNews(id, status) {
    await NewsModel.edit({ _id: id }, { NEWS_STATUS: status });
  }

  /**资讯置顶排序设定 */
  async sortNews(id, sort) {
    await NewsModel.edit({ _id: id }, { NEWS_ORDER: sort });
  }
}

module.exports = AdminNewsService;
