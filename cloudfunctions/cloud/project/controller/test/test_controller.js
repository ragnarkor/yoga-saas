/**
 * Notes: 测试模块控制器
 * Date: 2021-03-15 19:20:00
 */

const BaseController = require("../base_controller.js");
const config = require("../../../config/config.js");
// [AI_START TIMESTAMP=2025-01-25 14:30:00]
const BaseService = require("../../service/base_service.js");
// [AI_END LINES=1 TIMESTAMP=2025-01-25 14:30:00]
// [AI_START TIMESTAMP=2025-01-25 15:30:00]
class TestController extends BaseController {
  // [AI_END LINES=1 TIMESTAMP=2025-01-25 15:30:00]
  async test() {
    console.log("1111");

    let userId = "userid3243l4l3j24324324";

    console.log(__filename);
  }

  // [AI_START TIMESTAMP=2025-01-25 14:30:00]
  async seed() {
    let baseService = new BaseService();
    let result = await baseService.seedDemo();
    return result;
  }
  // [AI_END LINES=5 TIMESTAMP=2025-01-25 14:30:00]
}

module.exports = TestController;
