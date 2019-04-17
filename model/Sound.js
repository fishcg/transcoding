"use strict";
const path = require("path");
const R = require("ramda");
const { getDB } = require("../lib/DBConnection");
const { TEMP_PATH } = require("../config/system");
const { getFileName, mkdirSync, unlinkAsync } = require("../lib/MyFile");
const logger = require("../lib/Logger");
const oss = require("../component/OSS");
const ffmpeg = require("../component/FFmpeg");
const task_list = require("../component/TaskList");
const { transcodingRecipient } = require('../config/backend');
const Email = require("../component/Email");
const { sendQQMessage } = require('../lib/Utils');

class Sound {    
    constructor({id, user_id, duration, soundurl, checked}) {
        this.id = id;
        this.user_id = user_id;
        this.duration = duration;
        this.sound_url = soundurl;
        this.checked = checked;

        this.file_name = getFileName(soundurl);
        this.local_path = path.join(TEMP_PATH, this.file_name);

        let dir = path.dirname(soundurl);
        this.relative_remote_path = path.join(dir, getFileName(soundurl, false) + ".mp3");
    }

    async download() {
        let remote_path = `sound/${this.sound_url}`;
        let dir = path.dirname(this.local_path);
        await mkdirSync(dir);
        let result = await oss.get(remote_path, this.local_path);
        return this.local_path;
    }

    async updateStatus(conditions) {
        if (!conditions.length) return;
        let conn = await getDB();
        // 若音频为待转码或转码失败状态，则更改状态为待审核
        let checked = (-1 === this.checked || -3 === this.checked) ? 0 : this.checked;
        if (!checked) {
            let user_sql = `SELECT confirm FROM mowangskuser where id = ${this.user_id}`;
            let user = await conn.findOne(user_sql);
            if (user.confirm & 16) {
                // 若为自动过审用户，则 confirm 字段值比特位第 5 位为 1
                // 参考文档：https://github.com/MiaoSiLa/missevan-doc/blob/master/product/%E7%94%A8%E6%88%B7_confirm_%E5%AD%97%E6%AE%B5%E5%80%BC%E7%BA%A6%E5%AE%9A.md
                checked = 1;
                let soundnum_sql = `UPDATE mowangskuser SET soundnumchecked = soundnumchecked +1 WHERE id = ${this.user_id}`;
                await conn.execute(soundnum_sql);
            }
        }
        let set = R.join(",", R.map((condition) => `\`${condition.key}\` = "${condition.value}"`, conditions));
        let update_sql = `UPDATE m_sound SET ${set}, \`checked\` = ${checked}, \`duration\` = ${this.duration} WHERE id = ${this.id}`;
        await conn.execute(update_sql);
    }

    async compressSound() {
        let local_paths = [];
        try {
            let local_path = await this.download();
            local_paths.push(local_path);
            let info = await ffmpeg.getSoundInfo(local_path);
            this.duration = parseInt(info.duration * 1000);
            if (!info.bit_rate) throw new Error(`sound ${this.id} is not a good sound`);
            let bit_rate = Math.round(info.bit_rate / 1000, 0);
            let task = task_list.newTask(this.id, bit_rate, this.relative_remote_path);
        
            for (let sub_task of task.sub_tasks) {
                let output_file = await ffmpeg.toMP3(local_path, sub_task.rate);
                local_paths.push(output_file);
                sub_task.updateStatus(0.7);
                await oss.put(sub_task.remote_path, output_file);
                sub_task.done();
            }
            let conditions = R.map((sub_task) => 
                ({ key: sub_task.filed, value: sub_task.remote_path }), task.sub_tasks);
            await this.updateStatus(conditions);
            logger.info(`sound ${this.id} compressed successed`);
        } catch(e) {
            let error_info = `the error sound_id is ${this.id}。reason is ${e.stack || e}`
            logger.error(error_info);
            let conn = await getDB();
            let update_sql = `UPDATE m_sound SET \`checked\` = -3 WHERE id = ${this.id}`;
            await conn.execute(update_sql);
            // 转码失败时发送邮件通知管理员
            let email = new Email(transcodingRecipient)
            let subject = '音频转码失败'
            let content = `<b style="color: #6c9e71">[时间]</b></br>${new Date()}</br>
                 <b style="color: #9e534b">[错误信息]</b></br>${error_info}</br>`
            await email.send(subject, content)
            // 发送到 QQ 消息通知
            sendQQMessage(`音频转码失败, ${error_info}`)
        } finally {
            for (let path of local_paths) {
                await unlinkAsync(path);
            }
        }
    }
}

module.exports = Sound;