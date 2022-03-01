const { gray } = require("chalk");
class Win {
    constructor() {
        this.userName = this.getUSerName();
        this.fs = require('fs-extra');
        this.path = require('path');
        this.exePath = this.path.join(__dirname, 'exeCache.json');
        this.exePathCache = this.readJson(this.exePath);
    }
    readJson(exePath) {
        this.fs.ensureFileSync(exePath);
        try{
            return this.fs.readJSONSync(exePath) || {};
        } catch(err) {
            this.fs.writeJsonSync(exePath, {});
            return {}
        }
    }
    writeJson(exePath, json) {
        this.fs.ensureFileSync(exePath);
        this.fs.writeJsonSync(exePath, json || {});
    }
    getUSerName() {
        return this.execSync('echo %USERNAME%').trim();
    }
    getExecDecode() {
        const iconv = require('iconv-lite');
        const encoding = 'cp936';
        const binaryEncoding = 'binary';
        const decode = str => iconv.decode(Buffer.from(str, binaryEncoding), encoding)
        return {
            encoding: binaryEncoding,
            decode
        };
    }
    execSync(dos, conf = {}) {
        const { execSync } = require('child_process');
        const {encoding, decode} = this.getExecDecode();
        try{
          const info = execSync(dos,{ ...conf, encoding });
          return decode(info);
        } catch(e) {
          throw new Error(decode(e.stderr ? e.stderr : e.toString()));
        }
    }
    getPerm(filePath, userName) {
        const info = this.execSync(`Cacls ${filePath}`);
        let lines = info.split('\r\n');
        let perm;
        lines.forEach((line) => {
            let content = line;
            const emptyIndex = line.indexOf(' ');
            if(emptyIndex >= 0) content = line.substr(emptyIndex + 1);
            content = content.trim();
            if(content) {
                const arr = content.split(':');
                const user = arr[0].split('\\')[1];
                const value = arr[1].toLocaleUpperCase().replace(/[^FRWC]/g, '');
                if(user === userName) perm=value;
            }
        });
        return perm;
    }  
    cacls = (filePath, action, perm) => {
        const path = require('path');
        const permPath = path.join(__dirname, 'perm.exe');
        return new Promise((res, rej) => {
            try{
                this.execSync(`set caclsPath=${filePath} && set caclsPerm=${perm ? ':' + perm : ''} && set caclsAction=/${action} && runas /env /savecred /user:Administrator ${permPath}`);
                let num = 0;
                const handle = setInterval(() => {
                    num++;
                    const nowPerm = this.getPerm(filePath, this.userName)
                    const hasPerm = !perm ? !nowPerm: (nowPerm && nowPerm.toLocaleLowerCase() === perm.toLocaleLowerCase())
                    const isEnd = hasPerm || num > 10;
                    if(isEnd) {
                        clearInterval(handle);
                        if(hasPerm) {
                            res();
                        } else {
                            rej('修改权限失败');
                        }
                    }
                }, 200)
           } catch(err) {
                rej(err);
           }
        })
       
    } 
    fmtProcessPaths = (info) => {
        const lines = info.split('\r\n');
        const paths = [];
        lines.forEach((line, index) => {
            if(index > 0) {
                const params = line.split(/\s+/);
                paths.push({
                    name: params[1],
                    path: params[0],
                    pid: params[2]
                })
            }
        })
        return paths;
    }
    getDisks(info) {
        const lines = info.split('\r\n');
        const disks = [];
        lines.forEach((line, index) => {
            if(index > 0) {
                !!line.trim() && disks.push(line.trim());
            }
        })
        return disks;
    }
    getNginxPath(info) {
        const lines = info.trim().split('\r\n');
        let path;
        lines.some(line => {
            const trimLine = line.trim();
            if(trimLine && trimLine.indexOf('Recycle.Bin') < 0) {
                path = trimLine;
                return true;
            }
        })
        return path;
    }
    DirFileNameByDisks(disks, name, index = 0) {
        const disk = disks[index];
        const getFindNameDoc = `dir /a-d /s /b ${disk}\\${name}`;
        if(!disk) return '';
        try{
            const info = this.execSync(getFindNameDoc);
            const path = this.getNginxPath(info);
            return path;
        } catch(e) {
            return this.DirFileNameByDisks(disks, name, index + 1);
        }
        
    }
    FindProcessPath(processName) {
        const findProcessDoc = `wmic process where name="${processName}" get name,executablepath,processid`;
        const info = this.execSync(findProcessDoc).trim();
        const paths = this.fmtProcessPaths(info);
        if(paths && paths.length > 0)  return paths[0].path;
        else return '';
    }
    FindExePath(name) {
        if(this.exePathCache[name] && this.fs.existsSync(this.exePathCache[name])) return this.exePathCache[name];
        const exeName = name + '.exe';
        const findDisk = 'wmic logicaldisk get caption';
        let processPath = this.FindProcessPath(exeName);
        if(!processPath) {
            /* 查找所有的盘符 */
            const info = this.execSync(findDisk);
            const disks = this.getDisks(info);
            console.log(gray(`[info]开始全局查找${exeName}运行路径，可能需要几分钟，请耐心等待...`));
            processPath = this.DirFileNameByDisks(disks, exeName);
        }
        if(processPath) {
            console.log(gray(`[info]已查找到${exeName}运行路径！！！`));
            this.exePathCache[name] = processPath;
            this.writeJson(this.exePath, this.exePathCache);
        }
        if(!processPath) throw new Error('未查找到运行路径！！！请确保已安装' + exeName);
        return processPath;
    }
    stopExe(name) {
        const exeName = name + '.exe';
        const path = this.FindProcessPath(exeName);
        /* 如果找出path，说明程序正在运行 */
        if(path) this.execSync(`wmic process where name="${exeName}" delete`)
    }
    getNginxConf() {
        // const 
    }

}

module.exports = Win;