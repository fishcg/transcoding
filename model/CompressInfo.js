'use strict'

const R = require('ramda');
const { asyncSleep } = require('../lib/sync');
const socketIO = require('../lib/SocketServer');
const db = require('../lib/NedbConnection');

/**
 * 封装音频压缩状态相关操作
 */
class CompressInfo {
  /**
   * 获取客户端音频压缩状态
   *
   * @return {Object} 音频压缩状态，如：{ "233": 0.25, "234": 0.58 }
   * @throws Error 查询超过设置的时间时抛出异常
   */
  async getSoundStatus() {
    // 音频压缩状态
    let soundStatus = {};
    // 生成 requestID
    let requestID = Date.now() + Math.random().toString(36).substring(2, 4);
    // 创建一条存储本次请求的压缩信息的数据库记录
    await db.insertASync({ request_id: requestID, doc_type: db.doc_types.GET_COMPRESS, info: [] });
    // 通知“压缩客户端”存入音频压缩状态
    console.log(socketIO.length);
   /* socketIO.getCompressInfo(requestID, () => {
      console.log('回调')
    });*/
    let aa = await socketIO.getCompressInfoSync(requestID)
    console.log(aa)
    let data = await db.findOneASync({ request_id: requestID, doc_type: db.doc_types.GET_COMPRESS });
    R.forEachObjIndexed((client) => {
      R.forEachObjIndexed((status, sound_id) => {
        soundStatus[sound_id] = status;
      }, client.sounds);
    }, data.info);
    // 删除此条已无用的记录
    db.remove({ request_id: requestID, doc_type: db.doc_types.GET_COMPRESS });
    return soundStatus;
  }
}

module.exports = CompressInfo;
