'use strict'

const socketClient = require('socket.io-client');
const R = require('ramda');
const TaskList = require('../component/TaskList');

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
  socket.on('connect_success', (data, fn) => {
    fn('fuck');
    console.log('cacaca')
    callback(data);
  })
    socket.on('disconnect', (timeout) => {
        console.log(timeout)
    });
  // 将音频压缩信息报告服务器
  socket.on('send_compress_info', (requestID, cb) => {
    console.log('我收到了 将音频压缩信息报告服务器 的通知')
    let soundCompressInfo = {};
    R.forEachObjIndexed((task, sound_id) => {
      // let progress = task.getProgress();
      soundCompressInfo[sound_id] = 0.66;
    }, TaskList.tasks);
    let params = {
      requestID: requestID,
      data: { socket_id: socket.id, sounds: soundCompressInfo }
    };
    // 发送通知
    socket.emit('save_compress_info', params, (data) => {
      cb('客户端压缩信息已保存')
    });
  })
}

exports.connect = connect;
