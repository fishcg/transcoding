'use strict'

const socketClient = require('socket.io-client');
const R = require('ramda');
const TaskList = require('../component/TaskList');
const logger = require("../lib/Logger");
const { sendQQMessage } = require('../lib/Utils');

/**
 * 与服务器建立长连接
 *
 * @param {String} IP 服务器 IP
 * @param {Number} port 服务器端口
 * @param {Function} callback 连接成功后的回调函数
 * @param {Object} options 额外设置，如设置命名空间等，详情参见 socket.io connect
 */
function connect(IP, port, callback) {
  let url = `http://${IP}:${port}`;
  let socket = socketClient.connect(url, { 'reconnect': true });
  // 客户端连接成功后执行的动作
  socket.on('connect_success', data => {
    callback(data);
  });
  socket.on('disconnect', (reason) => {
      // 目前断开后可自动重连
      // socket.open();
      // 记录到日志
      logger.warn(`[${socket.id}] disconnect from transcoding server, reason: ${reason}`);
      // 发送到 QQ 消息通知
      sendQQMessage(`转码客户端断开 socket 连接, 原因: ${reason}`)
  });
  // 将音频压缩信息报告服务器
  socket.on('send_compress_info', (requestID, cb) => {
    let soundCompressInfo = {};
    R.forEachObjIndexed((task, sound_id) => {
      let progress = task.getProgress();
      soundCompressInfo[sound_id] = progress;
    }, TaskList.tasks);
    let params = {
      requestID: requestID,
      data: { socket_id: socket.id, sounds: soundCompressInfo }
    };
    // 发送通知
    socket.emit('save_compress_info', params, () => {
      // 服务端保存数据后执行服务端的回调函数
      cb();
    });
  })
}

exports.connect = connect;
