const cloudHelper=require('../../../../helper/cloud_helper.js');
Page({data:{loading:true,list:[]},onShow(){this.load()},async load(){try{const r=await cloudHelper.callCloudData('my/card_order_list',{}, {hint:false});this.setData({loading:false,list:r.list||[]})}catch(e){this.setData({loading:false});console.error(e)}}});
