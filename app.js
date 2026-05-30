// 小程序的全局逻辑入口
App({
  // 全局数据，方便各个页面直接调用
  globalData: {
    openid: null,
    userInfo: null
  },

  onLaunch: function () {
    console.log('App launched');
    
    // 初始化云开发环境
    if (!wx.cloud) {
      console.error('请使用 2.2.3 或以上的基础库以使用云能力');
    } else {
      wx.cloud.init({
        // env 参数决定接下来小程序发起的云开发调用（wx.cloud.xxx）会默认请求到哪个云环境的资源
        // 这里填入你的云开发环境 ID
        env: 'cloud1-d5gsmgy1pa7c85731', 
        traceUser: true,
      });

      // 初始化完成后，立刻执行静默登录
      this.doLogin();
    }
  },

  // 执行静默登录逻辑
  doLogin: function() {
    wx.cloud.callFunction({
      name: 'login',
      success: res => {
        if (res.result && res.result.success) {
          // 1. 把 openid 和用户信息存入全局变量
          this.globalData.openid = res.result.openid;
          this.globalData.userInfo = res.result.user;
          console.log('【静默登录成功】 OpenID:', this.globalData.openid);

          // 2. 将云端的统计数据（如坚持天数、日历打卡记录）同步覆盖到本地缓存
          // 这样即使换了手机，首页和我的页面也能读取到正确的天数
          if (!res.result.isNew) {
            const cloudUser = res.result.user;
            wx.setStorageSync('studyDays', cloudUser.studyDays || 0);
            wx.setStorageSync('lastCheckinDate', cloudUser.lastCheckinDate || '');
            wx.setStorageSync('completedDates', cloudUser.completedDates || []);
          }
        } else {
          console.error('【登录失败】', res.result);
        }
      },
      fail: err => {
        console.error('【调用 login 云函数失败】', err);
      }
    });
  }
});