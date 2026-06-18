/**
 * Notes: 业务基类
 * Date: 2021-03-15 04:00:00
 */

const AppError = require("../../framework/core/app_error.js");
const appCode = require("../../framework/core/app_code.js");
const timeUtil = require("../../framework/utils/time_util.js");
const dbUtil = require("../../framework/database/db_util.js");
const SetupModel = require("../model/setup_model.js");
const AdminModel = require("../model/admin_model.js");
const NewsModel = require("../model/news_model.js");
const MeetModel = require("../model/meet_model.js");
const DayModel = require("../model/day_model.js");
// [AI_START TIMESTAMP=2025-01-25 14:45:00]
const TenantModel = require("../model/tenant_model.js");
const UserModel = require("../model/user_model.js");
// [AI_END LINES=2 TIMESTAMP=2025-01-25 14:45:00]
const config = require("../../config/config.js");

class BaseService {
  constructor() {
    // 当前时间戳
    this._timestamp = timeUtil.time();
  }

  /**
   * 抛出异常
   * @param {*} msg
   * @param {*} code
   */
  AppError(msg, code = appCode.LOGIC) {
    throw new AppError(msg, code);
  }

  getProjectId() {
    if (global.PID) return global.PID;
    else return "unknow";
  }

  async initSetup() {
    if (await dbUtil.isExistCollection("ax_setup")) {
      let setupCnt = await SetupModel.count({});
      if (setupCnt > 0) return;
    }

    console.log("### initSetup...");

    let arr = config.COLLECTION_NAME.split("|");
    for (let k in arr) {
      if (!(await dbUtil.isExistCollection(arr[k]))) {
        await dbUtil.createCollection(arr[k]);
      }
    }

    // [AI_START TIMESTAMP=2025-01-25 14:30:00]
    let ownerId, teacherId1, teacherId2;

    if (await dbUtil.isExistCollection("ax_admin")) {
      let adminCnt = await AdminModel.count({});
      if (adminCnt == 0) {
        let ownerData = {};
        ownerData.ADMIN_NAME = "馆长";
        ownerData.ADMIN_PHONE = "13900000000";
        ownerData.ADMIN_PWD = "123456";
        ownerData.ADMIN_TYPE = AdminModel.TYPE.OWNER;
        ownerId = await AdminModel.insert(ownerData);

        let teacherData1 = {};
        teacherData1.ADMIN_NAME = "教练小王";
        teacherData1.ADMIN_PHONE = "13900000001";
        teacherData1.ADMIN_PWD = "123456";
        teacherData1.ADMIN_TYPE = AdminModel.TYPE.TEACHER;
        teacherId1 = await AdminModel.insert(teacherData1);

        let teacherData2 = {};
        teacherData2.ADMIN_NAME = "教练小李";
        teacherData2.ADMIN_PHONE = "13900000002";
        teacherData2.ADMIN_PWD = "123456";
        teacherData2.ADMIN_TYPE = AdminModel.TYPE.TEACHER;
        teacherId2 = await AdminModel.insert(teacherData2);
      }
    }
    // [AI_END LINES=27 TIMESTAMP=2025-01-25 14:30:00]

    if (await dbUtil.isExistCollection("ax_news")) {
      let newsCnt = await NewsModel.count({});
      if (newsCnt == 0) {
        // 插入
        let newsArr = config.NEWS_CATE.split(",");
        for (let j in newsArr) {
          let title = newsArr[j].split("=")[1];
          let cateId = newsArr[j].split("=")[0];

          let data = {};
          data.NEWS_TITLE = title + "标题1";
          data.NEWS_DESC = title + "简介1";
          data.NEWS_CATE_ID = cateId;
          data.NEWS_CATE_NAME = title;
          // [AI_START TIMESTAMP=2025-01-25 14:30:00]
          data.NEWS_ADMIN_ID = ownerId || "1";
          // [AI_END LINES=1 TIMESTAMP=2025-01-25 14:30:00]
          data.NEWS_CONTENT = [
            {
              type: "text",
              val: title + "内容1",
            },
          ];
          data.NEWS_PIC = ["../../../../images/default_cover_pic.gif"];

          await NewsModel.insert(data);
        }
      }
    }

    if (await dbUtil.isExistCollection("ax_meet")) {
      let meetCnt = await MeetModel.count({});
      if (meetCnt == 0) {
        // 插入
        let meetArr = config.MEET_TYPE.split(",");
        for (let j in meetArr) {
          let title = meetArr[j].split("=")[1];
          let typeId = meetArr[j].split("=")[0];

          // [AI_START TIMESTAMP=2025-01-25 14:30:00]
          let data = {};
          data.MEET_TITLE = title;
          data.MEET_STYLE_SET = {
            desc: title + " - 欢迎预约体验",
            pic: "../../../../images/default_cover_pic.gif",
          };
          data.MEET_TYPE_ID = typeId;
          data.MEET_TYPE_NAME = title;
          data.MEET_ADMIN_ID =
            typeId == "1" ? teacherId1 || "1" : ownerId || "1";
          data.MEET_CONTENT = [
            {
              type: "text",
              val: title + "，欢迎预约体验！",
            },
          ];
          // [AI_END LINES=15 TIMESTAMP=2025-01-25 14:30:00]
          // [AI_START TIMESTAMP=2025-01-25 14:30:00]
          let now = new Date();
          let weekDesc = [
            "周日",
            "周一",
            "周二",
            "周三",
            "周四",
            "周五",
            "周六",
          ];
          let daysArr = [];
          for (let d = 0; d < 5; d++) {
            let date = new Date(now);
            date.setDate(date.getDate() + d);
            let y = date.getFullYear();
            let m = String(date.getMonth() + 1).padStart(2, "0");
            let dd = String(date.getDate()).padStart(2, "0");
            daysArr.push(y + "-" + m + "-" + dd);
          }
          data.MEET_DAYS = daysArr;
          // [AI_END LINES=14 TIMESTAMP=2025-01-25 14:30:00]
          data.MEET_FORM_SET = [
            {
              type: "line",
              title: "姓名",
              desc: "请填写您的姓名",
              must: true,
              len: 50,
              onlySet: {
                mode: "all",
                cnt: -1,
              },
              selectOptions: ["", ""],
              mobileTruth: true,
              checkBoxLimit: 2,
            },
            {
              type: "line",
              title: "手机",
              desc: "请填写您的手机号码",
              must: true,
              len: 50,
              onlySet: {
                mode: "all",
                cnt: -1,
              },
              selectOptions: ["", ""],
              mobileTruth: true,
              checkBoxLimit: 2,
            },
          ];

          // [AI_START TIMESTAMP=2025-01-25 14:30:00]
          let meetId = await MeetModel.insert(data);

          let slots = [
            { mark: "0900", start: "09:00", end: "10:00" },
            { mark: "1030", start: "10:30", end: "11:30" },
            { mark: "1400", start: "14:00", end: "15:00" },
            { mark: "1900", start: "19:00", end: "20:00" },
          ];

          for (let d = 0; d < daysArr.length; d++) {
            let date = new Date(now);
            date.setDate(date.getDate() + d);
            let dayStr = daysArr[d];
            let times = [];
            for (let s in slots) {
              times.push({
                mark: "T" + dayStr.replace(/-/g, "") + slots[s].mark,
                start: slots[s].start,
                end: slots[s].end,
                isLimit: 1,
                limit: 15,
                status: 1,
                stat: { succCnt: 0, cancelCnt: 0, adminCancelCnt: 0 },
              });
            }
            let dayData = {};
            dayData.DAY_MEET_ID = meetId;
            dayData.day = dayStr;
            dayData.dayDesc = weekDesc[date.getDay()];
            dayData.times = times;
            await DayModel.insert(dayData);
          }
          // [AI_END LINES=29 TIMESTAMP=2025-01-25 14:30:00]
        }
      }
    }

    if (await dbUtil.isExistCollection("ax_setup")) {
      let setupCnt = await SetupModel.count({});
      if (setupCnt == 0) {
        let data = {};
        data.SETUP_ABOUT = "关于我们";
        data.SETUP_FEATURES = {
          booking: true,
          payment: false,
          teacherManage: false,
          checkin: true,
          news: true,
          selfCheckin: true,
        };
        await SetupModel.insert(data);
      }
    }

    // [AI_START TIMESTAMP=2025-01-25 14:45:00]
    if (await dbUtil.isExistCollection("ax_tenant")) {
      let tenantCnt = await TenantModel.count({});
      if (tenantCnt == 0) {
        let tenantData = {};
        tenantData.TENANT_NAME = "静心瑜伽馆";
        tenantData.TENANT_DESC = "专业瑜伽课程预约平台";
        tenantData.TENANT_STATUS = TenantModel.STATUS.OPEN;
        await TenantModel.insert(tenantData);
      }
    }
    // [AI_END LINES=11 TIMESTAMP=2025-01-25 14:45:00]
  }

  // [AI_START TIMESTAMP=2025-01-25 14:30:00]
  async seedDemo() {
    let result = { accounts: [], courses: 0, days: 0 };

    let accounts = [
      {
        name: "馆长",
        phone: "13900000000",
        pwd: "123456",
        type: AdminModel.TYPE.OWNER,
      },
      {
        name: "教练小王",
        phone: "13900000001",
        pwd: "123456",
        type: AdminModel.TYPE.TEACHER,
      },
      {
        name: "教练小李",
        phone: "13900000002",
        pwd: "123456",
        type: AdminModel.TYPE.TEACHER,
      },
    ];

    for (let i in accounts) {
      let exist = await AdminModel.getOne(
        { ADMIN_PHONE: accounts[i].phone },
        "_id",
      );
      if (!exist) {
        let data = {};
        data.ADMIN_NAME = accounts[i].name;
        data.ADMIN_PHONE = accounts[i].phone;
        data.ADMIN_PWD = accounts[i].pwd;
        data.ADMIN_TYPE = accounts[i].type;
        await AdminModel.insert(data);
      }
      result.accounts.push({
        name: accounts[i].name,
        phone: accounts[i].phone,
        pwd: accounts[i].pwd,
      });
    }

    // [AI_START TIMESTAMP=2025-01-25 14:45:00]
    let tenantCnt = await TenantModel.count({});
    if (tenantCnt == 0) {
      let tenantData = {};
      tenantData.TENANT_NAME = "静心瑜伽馆";
      tenantData.TENANT_DESC = "专业瑜伽课程预约平台";
      tenantData.TENANT_STATUS = TenantModel.STATUS.OPEN;
      await TenantModel.insert(tenantData);
      result.tenant = "静心瑜伽馆";
    }

    let userCnt = await UserModel.count({});
    if (userCnt == 0) {
      let userData = {};
      userData.USER_MINI_OPENID = "test_user_001";
      userData.USER_NAME = "测试用户";
      userData.USER_STATUS = 1;
      await UserModel.insert(userData);
      result.user = "测试用户";
    }
    // [AI_END LINES=18 TIMESTAMP=2025-01-25 14:45:00]

    let now = new Date();
    let weekDesc = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
    let meets = await MeetModel.getAll({}, "_id,MEET_TITLE");

    for (let k in meets) {
      let dayCnt = await DayModel.count({ DAY_MEET_ID: meets[k]._id });
      if (dayCnt > 0) continue;

      for (let d = 0; d < 5; d++) {
        let date = new Date(now);
        date.setDate(date.getDate() + d);
        let y = date.getFullYear();
        let m = String(date.getMonth() + 1).padStart(2, "0");
        let dd = String(date.getDate()).padStart(2, "0");
        let dayStr = y + "-" + m + "-" + dd;

        let slots = [
          { mark: "0900", start: "09:00", end: "10:00" },
          { mark: "1030", start: "10:30", end: "11:30" },
          { mark: "1400", start: "14:00", end: "15:00" },
          { mark: "1900", start: "19:00", end: "20:00" },
        ];
        let times = [];
        for (let s in slots) {
          times.push({
            mark: "T" + dayStr.replace(/-/g, "") + slots[s].mark,
            start: slots[s].start,
            end: slots[s].end,
            isLimit: 1,
            limit: 15,
            status: 1,
            stat: { succCnt: 0, cancelCnt: 0, adminCancelCnt: 0 },
          });
        }

        let dayData = {};
        dayData.DAY_MEET_ID = meets[k]._id;
        dayData.day = dayStr;
        dayData.dayDesc = weekDesc[date.getDay()];
        dayData.times = times;
        await DayModel.insert(dayData);
        result.days++;
      }
      result.courses++;
    }

    return result;
  }
  // [AI_END LINES=73 TIMESTAMP=2025-01-25 14:30:00]
}

module.exports = BaseService;
