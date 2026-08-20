const BaseModel = require("./base_model.js");

class CardTplModel extends BaseModel {}

CardTplModel.CL = "ax_card_tpl";

CardTplModel.DB_STRUCTURE = {
  _pid: "string|true",
  CARD_TPL_ID: "string|true",
  CARD_TPL_NAME: "string|true|comment=卡名称",
  CARD_TPL_TYPE: "string|true|default=times|comment=times=次数卡 period=期限卡",
  CARD_TPL_DAYS: "int|true|default=365|comment=有效天数",
  CARD_TPL_PRICE: "int|true|default=0|comment=售价(元)",
  CARD_TPL_QUOTA: "int|true|default=1|comment=额度(次)",
  CARD_TPL_COLOR: "string|false|default=#F5A623|comment=卡片预览色",
  CARD_TPL_COVER:
    "string|false|default=|comment=卡面预设ID，空=纯色 sage_wave等",
  CARD_TPL_SCOPE:
    "object|false|default={}|comment=适用课程范围 mode=all|categories categoryIds=[]",
  CARD_TPL_ORDER: "int|true|default=9999",
  CARD_TPL_STATUS: "int|true|default=1|comment=1=在售 0=停售",
  CARD_TPL_SALE_STATUS:
    "int|false|default=0|comment=1=允许会员提交购卡申请 0=不展示",
  CARD_TPL_SALE_PRICE_FEE:
    "int|false|default=0|comment=会员申请展示价(分)，0=使用模板原价",
  CARD_TPL_SALE_DESC: "string|false|comment=会员购卡说明",
  CARD_TPL_ADD_TIME: "int|true",
  CARD_TPL_EDIT_TIME: "int|true",
  CARD_TPL_ADD_IP: "string|false",
  CARD_TPL_EDIT_IP: "string|false",
};

CardTplModel.FIELD_PREFIX = "CARD_TPL_";

CardTplModel.TYPE = {
  TIMES: "times",
  PERIOD: "period",
};

CardTplModel.TYPE_DESC = {
  times: "次数卡",
  period: "期限卡",
};

module.exports = CardTplModel;
