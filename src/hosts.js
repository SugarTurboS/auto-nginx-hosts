const SimpleHosts = require('./simple-host'); // 这个插件提供对host取值、设值方法
const chalk = require('chalk');
module.exports = class AutoHost {
  constructor(hosts) {
    this.backUpHosts = []; // 备份hosts
    if (!hosts) throw new Error('缺少hosts参数');
    this.injectHosts = hosts;
  }
  start() {
    const hosts = new SimpleHosts();
    this.backUpHosts = this.injectHosts.map((host) => {
      const backupHost = {
        domain: host.domain,
        ip: hosts.getIp(host.domain),
      };
      hosts.set(host.ip, host.domain);
      return backupHost;
    });
    console.log(chalk.gray('[info]start hosts success'));
  }
  stop() {
    if (this.backUpHosts && this.backUpHosts.length > 0) {
      const hosts = new SimpleHosts();
      this.backUpHosts.forEach((host) => {
        hosts.set(host.ip, host.domain);
      });
    }
    console.log(chalk.gray('[info]stop hosts success'));
  }
};
