Page({
  data: {
    historyRecords: []
  },

  onShow: function() {
    this.loadHistory();
  },

  loadHistory: function() {
    const historyRecords = wx.getStorageSync('historyRecords') || [];
    this.setData({ historyRecords });
  },

  // 清空所有记录
  clearAllRecords: function() {
    const that = this;
    wx.showModal({
      title: '清空确认',
      content: '确定要清空所有历史学习记录吗？',
      confirmColor: '#ff4d4f',
      success(res) {
        if (res.confirm) {
          wx.setStorageSync('historyRecords', []);
          that.loadHistory();
        }
      }
    });
  },

  // 删除单条历史记录
  deleteRecord: function(e) {
    const index = e.currentTarget.dataset.index;
    const historyRecords = this.data.historyRecords;
    const recordToDelete = historyRecords[index];
    const that = this;

    wx.showModal({
      title: '删除确认',
      content: '确定要删除这条学习记录吗？',
      confirmColor: '#ff4d4f',
      success(res) {
        if (res.confirm) {
          wx.showLoading({ title: '删除中...', mask: true });

          // 调用云函数同步删除云端数据
          wx.cloud.callFunction({
            name: 'syncPlan',
            data: {
              action: 'delete',
              planId: recordToDelete.id
            }
          }).then(cloudRes => {
            wx.hideLoading();
            if (cloudRes.result && cloudRes.result.success) {
              // 云端删除成功后，清理本地数据
              historyRecords.splice(index, 1);
              wx.setStorageSync('historyRecords', historyRecords);
              
              // 同步删除打卡页里的同源计划
              let checkinPlans = wx.getStorageSync('checkinPlans') || [];
              checkinPlans = checkinPlans.filter(p => p.id !== recordToDelete.id);
              wx.setStorageSync('checkinPlans', checkinPlans);

              that.loadHistory();
              wx.showToast({ title: '删除成功', icon: 'success' });
            } else {
              throw new Error('云端删除失败');
            }
          }).catch(err => {
            wx.hideLoading();
            console.error("删除云端历史记录失败:", err);
            wx.showToast({ title: '删除失败，请重试', icon: 'none' });
          });
        }
      }
    });
  }
});