const fs = require('fs-extra');
const Win = require('./win');

const isWin = process.platform === 'win32';
const HOSTS_FILE_PATH = isWin ? 'C:/Windows/System32/drivers/etc/hosts' : '/etc/hosts';
const ENDLINE = isWin ? '\r\n' : '\n';

/** Normalize and turn line into token strings
 * @param {string} line a line in hosts file
 * @returns {[string]}
 */
function lineToTokens(line) {
  return line.replace(/#.*/, '').trim().split(/\s+/);
}

class SimpleHosts {
  /** @param {string} path The hosts file path */
  constructor(path = HOSTS_FILE_PATH) {
    this.hostsFilePath = path;
    this.backupChmod = {};
    this.winUtils = new Win();
  }

  read() {
    const data = fs.readFileSync(this.hostsFilePath, { encoding: 'utf8' });
    return data;
  }

  write(content) {
    return this.doByChmod(() => {
      return fs.writeFileSync(this.hostsFilePath, content, { encoding: 'utf8' });
    });
  }

  async doByChmod(callback) {
    try {
      if(isWin) {
        const permCache = this.winUtils.getPerm(this.hostsFilePath, this.winUtils.userName);
        let data;
        if(permCache !== 'F') {
          await this.winUtils.cacls(this.hostsFilePath, 'g', 'f');
          data = callback();
          await this.winUtils.cacls(this.hostsFilePath,  permCache ? 'p' : 'r', permCache);
        } else {
          data = callback();
        }
        return data;
      } else {
        this.changeChmod();
        const data = callback();
        this.rollbackChmod();
        return data;
      }
    } catch(err) {
      console.error(err);
    }
    
  }

  changeChmod() {
    const { execSync } = require('child_process');
    try {
      // 1、读取操作权限
      const lsInfo = execSync(`ls -l ${this.hostsFilePath}`);
      const chmod = lsInfo.toString().split(/\s+/)[0];
      // 2、备份读写操作权限
      this.backupChmod.read = chmod.substr(7, 1) !== '-';
      this.backupChmod.write = chmod.substr(8, 1) !== '-';
      // 3、加上读写操作
      execSync(`sudo chmod o+rw ${this.hostsFilePath}`); // 加上读写操作
    } catch (e) {}
  }
  rollbackChmod() {
    const { execSync } = require('child_process');
    if (this.backupChmod.read === false || this.backupChmod.write === false)
      execSync(
        `sudo chmod o-${this.backupChmod.read ? '' : 'r'}${this.backupChmod.write ? '' : 'w'} ${this.hostsFilePath}`
      );
  }

  /** Get the IP address by an input hostname
   * @param {string} hostname
   * @returns {string} IP address or empty string if not found
   */
  getIp(hostname) {
    let ip = '';
    this.read()
      .split(/\r?\n/)
      .some((line) => {
        let tokens = lineToTokens(line);
        if (
          tokens.some((token, index) => {
            return index > 0 && token === hostname;
          })
        ) {
          ip = tokens[0];
          return true;
        }
      });
    return ip;
  }

  /** Get hostnames by input ip address
   * @param {string} ip
   * @returns {[string]} List of hostnames
   */
  getHosts(ip) {
    let hosts = [];
    this.read()
      .split(/\r?\n/)
      .forEach((line) => {
        let tokens = lineToTokens(line);
        if (tokens.length > 1 && tokens[0] === ip) {
          hosts.push(...tokens.slice(1));
        }
      });
    return hosts;
  }

  /** Set a record in hosts file
   * @param {string} ip
   * @param {string} hostname
   */
  set(ip, hostname) {
    if (this.getIp(hostname) !== ip) {
      let lines = this.read().split(/\r?\n/);
      let modifiedIndex = -1;
      let newContent = '';
      let deletedIndex = -1;
      lines.some((line, index) => {
        let tokens = lineToTokens(line);
        if (tokens.length == 2 && tokens[1] === hostname) {
          deletedIndex = index;
          return true;
        } else if (tokens.length > 2) {
          for (let i = 1; i < tokens.length; ++i) {
            if (tokens[i] === hostname) {
              modifiedIndex = index;
              tokens.splice(i, 1);
              newContent = tokens.join('\t');
              return true;
            }
          }
        }
        return false;
      });

      if (deletedIndex >= 0) lines.splice(deletedIndex, 1);
      else if (modifiedIndex >= 0) lines[modifiedIndex] = newContent;

      if(ip) lines.push(`${ip}\t${hostname}`);
      this.write(lines.join(ENDLINE));
    }
  }
}

module.exports = SimpleHosts;
