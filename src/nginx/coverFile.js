const chalk = require('chalk');
const _utils = require('./utils');
const path = require('path');
let hashKey = '_injectHash=';
let hashName;
const backUpKey = 'conf_back';
const baseConfPath = path.join(__dirname, 'nginx.base.conf');

module.exports = function AutoNginx(config = {}) {
  let status = 'stop'; // 状态
  let nginxPath; // 系统nginx配置文件路径
  let backUpDirPath; // 备份文件夹路径
  if (!config.key || !config.path) {
    throw new Error('缺少key或nginxPath参数');
  }
  hashName = hashKey + config.key; // 项目唯一key，根据这个key区分不同项目
  const injectNginxPath = config.path; // 注入配置文件路径
  let injectServer;

  /* 
  获取nginx conf地址 
  通过 `nginx -t` 命令获取配置地址
  */
  const getPaths = () => {
    return _utils.getNginxConfigPath().then((res) => {
      nginxPath = res;
      backUpDirPath = path.join(path.dirname(nginxPath), backUpKey, config.key);
      return nginxPath;
    });
  };

  /* 
  启动nginx 
  1、通过child_process执行`sudo nginx`
  2、如果失败且失败信息显示已经启动，则执行`sudo nginx -s reload`重启nginx
  */
  const startNginx = function () {
    if (status === 'start') return;
    _utils.startNginx();
    status = 'start';
  };
  /* 
  暂停nginx
  通过`sudo nginx -s stop`停止nginx
  */
  const stopNginx = function (conf) {
    const otherServers = getOtherInjectServers(conf);
    // 只有不存在其他注入的servers，才停止nginx
    if (!otherServers || otherServers.length <= 0) {
      if (status === 'stop') return;
      _utils.stopNginx();
      status === 'stop';
    } else {
      console.log(chalk.gray("[info] check others app use nginx , don't stop nginx"));
    }
    return conf;
  };

  /* 
  获取注入的servers
  */
  const getInjectServer = () => {
    return _utils.getInjectServer(injectNginxPath).then((server) => {
      injectServer = server;
    });
  };

  /* 
  加入需要的server
  通过nginx-conf包提供的API创建教学空间需要的NGINX配置，后期考虑通过json生成
  */
  const addServer = function (conf, hash) {
    injectServer._comments.push(`${hashName}${hash}`);
    _utils.setServers(conf, [..._utils.getServers(conf), injectServer]);
  };

  /* 
  判断该server配置是否与注入配置的域名端口号一样
  */
  const isRightServer = function (server) {
    return _utils.isSameRuleServer(server, injectServer);
  };

  /* 
  根据hash组装备份文件的路径
  */
  const assembleBackupUrl = (hash) => {
    const path = require('path');
    return path.join(backUpDirPath, `nginx.conf.${hash}`);
  };

  /* 
  注入需要的nginx config
  */
  const writeConfig = async function (conf) {
    // 1、基础信息配置
    const baseConf = await _utils.createNginx(baseConfPath);
    _utils.mergeConfig(conf, baseConf);

    // 2、备份
    const noInjectServers = getNoInjectServers(conf);
    let hash = new Date().valueOf();
    if (noInjectServers && noInjectServers.length > 0) {
      const copyPath = assembleBackupUrl(hash);
      require('fs-extra').ensureFileSync(copyPath);
      conf.live(copyPath);
      await _utils.flushPromise(conf);
      conf.die(copyPath);
    }
    // 3、移除不需要的server
    if (_utils.isConfHasServer(conf)) {
      const servers = _utils.getServers(conf).filter((item) => !isRightServer(item));
      _utils.setServers(conf, servers);
    }
    // 4、注入server
    addServer(conf, hash);
    return conf;
  };

  /* 
  判断是否有注入的comments，不一定是当前程序注入的，也可能是其他程序注入的
  */
  const hasInjectComment = function (_comments) {
    return !!_utils.getKey(_comments, hashKey);
  };

  /* 
  根据_comments对象获取备份hash
  */
  const getHash = function (_comments) {
    return _utils.getKey(_comments, hashName);
  };

  /* 
  根据 hash list 获取最久的可用的备份文件地址
  */
  const getBackUpUrl = function (hashList) {
    let realUrl = '';
    hashList.some((hash) => {
      const fs = require('fs-extra');
      const url = assembleBackupUrl(hash);
      if (fs.existsSync(url)) {
        realUrl = url;
        return true;
      }
    });
    return realUrl;
  };

  /* 
  尝试回滚 nginx config
  */
  const rollBackConfig = function (conf) {
    if (_utils.isConfHasServer(conf)) {
      const servers = _utils.getServers(conf);
      const needUseServers = servers.filter((item) => !isRightServer(item));
      const rightServers = servers.filter(isRightServer);
      if (rightServers && rightServers.length > 0) {
        const noInjectServers = getNoInjectServers(conf);
        if (noInjectServers && noInjectServers.length > 0) {
          // 如果有非注入的nginx，则默认NGINX被修改过，只把带注入的NGINX清除则可
          const rightServer = noInjectServers[0]; // 只需要一份就好
          _utils.setServers(conf, [...needUseServers, rightServer]);
        } else {
          // 都是注入的nginx
          // 1、获取最早的nginx url
          const hashList = rightServers.map((item) => getHash(item._comments)).sort((a, b) => b - a);
          const url = getBackUpUrl(hashList);
          if (url) {
            // 找到url，还原配置
            return _utils.createNginx(url).then((conf2) => {
              let noInjects = getNoInjectServers(conf2);
              if (noInjects && noInjects.length > 0) noInjects = [noInjects[0]];
              _utils.setServers(conf, [...needUseServers, ...noInjects]);
              emptyBackUp(); // 清空备份文件夹
              return conf;
            });
          } else {
            // 找不到url，把所有注入的清空则可
            _utils.setServers(conf, needUseServers);
          }
        }
      }
    }
    return conf;
  };

  /* 
  把备份文件夹清空
  */
  const emptyBackUp = () => {
    return require('fs-extra').emptyDirSync(backUpDirPath);
  };

  /* 
  获取教学空间域名的非自动注入的 server 数组
  */
  const getNoInjectServers = function (conf) {
    let servers = _utils.getServers(conf);
    return servers.filter((item) => isRightServer(item) && !getHash(item._comments));
  };

  /* 
  获取非本程序的注入的其他servers
  */
  const getOtherInjectServers = function (conf) {
    return _utils.getServers(conf).filter((item) => hasInjectComment(item._comments) && !getHash(item._comments));
  };

  /* 
  启动方法
  */
  this.start = function () {
    return getInjectServer()
      .then(getPaths)
      .then(_utils.createNginx)
      .then(rollBackConfig)
      .then(writeConfig)
      .then(_utils.flushPromise)
      .then(startNginx);
  };

  /* 
  停止方法
  */
  this.stop = function () {
    return _utils.createNginx(nginxPath).then(rollBackConfig).then(stopNginx).then(_utils.flushPromise);
  };
};
