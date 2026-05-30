// 云函数入口文件
const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV }); // 使用当前云环境
const db = cloud.database();

// 云函数入口函数
exports.main = async (event, context) => {
  // 1. 获取微信上下文，提取用户的 OpenID（绝对安全的唯一标识）
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;

  try {
    // 2. 查询云数据库中是否已有该用户
    const userRecord = await db.collection('users').where({
      _openid: openid
    }).get();

    if (userRecord.data.length === 0) {
      // 3. 如果是新用户，在数据库中帮他初始化一条档案
      const newUser = {
        _openid: openid, // 微信自动约定的字段，标识数据归属
        createdAt: db.serverDate(),
        studyDays: 0,
        lastCheckinDate: '',
        completedDates: []
      };
      
      await db.collection('users').add({
        data: newUser
      });

      return {
        success: true,
        isNew: true,
        openid: openid,
        user: newUser
      };
    } else {
      // 4. 如果是老用户，直接返回他的档案数据
      return {
        success: true,
        isNew: false,
        openid: openid,
        user: userRecord.data[0]
      };
    }
  } catch (error) {
    console.error("登录逻辑异常:", error);
    return {
      success: false,
      error: error.message
    };
  }
}