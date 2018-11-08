'use strict'

const socketIo = require('socket.io');
const { findIndexByAttr } = require('../lib/Utils');
const db = require('../lib/NedbConnection');
const { promisify } = require('util');
// 已连接客户端
const socketClients = [];

/**
 * 启动 Socket 服务，监听端口
 *
 * @param {Koa} app
 * @param port Socket 服务监听的端口号
 */
socketClients.__proto__.start = function(app, port) {
  let io = socketIo(app.listen(port));
  this.io = io;
  // 客户端连接到服务端时执行的动作
  io.on('connection', (socket) => {
    this.socket = socket;
    // 有新的客户端连接时，将其加入正在连接客户端数组
    socketClients.push(socket);

    // 通知客户端连接成功
    socket.emit('connect_success', socket.id, (data) => {
        console.log(data);
    });
    /*socket.to(socket.id).emit('connect_success', socket.id, (data) => {
        console.log(data); // data will be 'woot'
    });*/
      socket.on('error', (error) => {
          console.log(error)
      });
      socket.on('connect_error', (error) => {
          console.log(error)
      });
    // 客户端下线处理，下线后将其移出正在连接客户端数组
    socket.on('disconnect', () => {
      console.log('下线了')
      let index = findIndexByAttr('id', socket.id, socketClients);
      if (index !== -1) {
        // 若存在于在线列表，将其从在线列表中移除
        socketClients.splice(index, 1);
      }
    })
    // 保存客户端发送的压缩信息
    socket.on('save_compress_info', async (params, cb) => {
      await db.updateASync({ request_id: params.requestID, doc_type: db.doc_types.GET_COMPRESS },
        { $push: { info: params.data } });
      cb()
    })
  })
}

/**
 * 通知客户端发送其正在压缩的音频状态
 *
 * @param {String} requestID
 * @throws Error 没有客户端连接时抛出异常
 */
socketClients.__proto__.getCompressInfo = function(requestID, cb) {
  if (socketClients.length === 0) throw new Error('没有正在执行压缩任务的服务');
  console.log('通知客户端发送其正在压缩的音频状态')
  this.forEach(function (client) {
      client.emit('send_compress_info', requestID, async (data) => {
          console.log('压缩信息已发送完毕')
          // 查询已存数据的条数，若全部客户端压缩信息已存入，则执行回调
          console.log('开始查询条数')
          let compressData = await db.findOneASync({ request_id: requestID, doc_type: db.doc_types.GET_COMPRESS });
          if (compressData && compressData.info.length === socketClients.length) {
              console.log('条数满足')
              cb();
          }
      });
  })
}

socketClients.__proto__.getCompressInfoSync = promisify(socketClients.getCompressInfo)

module.exports = socketClients;
