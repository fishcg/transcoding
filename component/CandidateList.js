const R = require("ramda");
const { getDB } = require("../lib/DBConnection");
const { findIndexByAttr } = require("../lib/Utils");

const candidates = [];

async function getSounds() {
    let conn = await getDB();
    // @WORKAROUND 这边查询代码需要进一步调整
    let sql = `SELECT id, user_id, duration, soundurl, checked FROM m_sound where checked = -1 order by id limit 5`;
    let rows = await conn.find(sql);
    return rows;
}

/**
 * 根据 ID 获取音频相关信息
 *
 * @param {Number} id 音频 ID
 * @return {Object} 音频信息组成的对象
 * @throws Error 连接数据库失败时抛出异常
 */
async function getSound(id) {
  let conn = await getDB();
  let sql = `SELECT id, user_id, duration, soundurl, checked FROM app_missevan.m_sound WHERE id = ${id}`
  let row = await conn.findOne(sql);
  return row;
}

candidates.__proto__.update = async function() {
    let rows = await getSounds();
    let time = Math.floor(Date.now() / 1000);
    for (let row of rows) {
        row.time = time;
        row.run = false;
        addTask(row, false);
    }
    // @TODO 这里需要对任务优先级进行处理
}

candidates.__proto__.getTasks = function(num) {
    let tasks = [];
    for (let sound of this) {
        if (num <= 0) break;
        if (false === sound.run) {
            sound.run = true;
            tasks.push(sound);
            num--;
        }
    }
    return tasks;
}

/**
 * 新增压缩任务
 *
 * @param {Sound} sound 音频对象
 * @param {Boolean} isTop 是否添加到队列头
 */
function addTask(sound, isTop){
    let index = findIndexByAttr('id', sound.id, candidates)
    if (index > 0) {
      if (candidates[index].run || !isTop) {
        // 当音频已压缩或不需要置顶时，不做改动
        return
      }
      sound = candidates[index]
      // 删除原来的元素再进行插入，避免删除前就被取出的情况
      candidates.splice(index, 1)
      candidates.unshift(sound)
    } else {
      // 当音频不在压缩数组队列中时，将其加入队列
      sound.time = Math.floor(Date.now() / 1000)
      sound.run = false
      if (isTop) {
        candidates.unshift(sound)
      } else {
        candidates.push(sound);
      }
    }
}

candidates.__proto__.finishTask = function(id) {
    let index = findIndexByAttr('id', id, this)
    if (-1 === index) return false;
    this.splice(index, 1);
    return true;
}

/**
 * 置顶指定的音频
 *
 * @param {Number} id 音频 ID
 * @return {boolean} 是否置顶成功
 * @throws 音频不存在或已转码时抛出异常
 */
candidates.__proto__.topSound = async function (id) {
    let sound = await getSound(id)
    if (!sound) {
        throw new Error('该音频不存在或已转码')
    }
    // 将音频加入压缩任务队列头
    addTask(sound, true)
}

module.exports = candidates;
// @WORKAROUND 监控代码
/*
setInterval(() => {
    console.log(candidates);
    console.log("\n\n");
}, 5000)
*/
