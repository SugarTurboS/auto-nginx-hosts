const { gray } = require('chalk');
const _utils = require('./utils');
const path = require('path');
let keyName = '_injectKey=';
const autoNginxFileName = 'nginx.conf.auto';
let timeoutHandle;
let watcher;
const baseConfPath = path.join(__dirname, 'nginx.base.conf');
module.exports = function AutoNginx(config = {}) {
  let status = 'stop'; // 状态
  let defaultNginxPath; // 系统nginx配置文件路径
  let autoNginxPath; // 自动注入启动的nginx配置文件路径
  let injectServer; // 需要注入的server ，目前只支持注入一个server
  if (!config.key) throw new Error('缺少key参数');
  if (!config.path) throw new Error('缺少path参数');

  /* 
  获取paths
  */
  const getPaths = () => {
    return _utils.getNginxConfigPath().then((res) => {
      defaultNginxPath = res;
      autoNginxPath = path.join(path.dirname(defaultNginxPath), autoNginxFileName);
      require('fs-extra').ensureFileSync(autoNginxPath);
      return autoNginxPath;
    });
  };

  /* 
  启动nginx 
  */
  const startNginx = function () {
    if (status === 'start') return;
    _utils.startNginx(autoNginxPath);
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
      console.log(gray("[info] check others app use nginx , don't stop nginx"));
    }
    return conf;
  };

  /* 
  获取注入的servers
  */
  const getInjectServer = () => {
    return _utils.getInjectServer(config.path).then((server) => {
      injectServer = server;
      injectServer._comments.push(keyName + config.key);
    });
  };

  /* 
  更新配置
  */
  const updateConfig = () => {
    if (timeoutHandle) clearTimeout(timeoutHandle);
    timeoutHandle = setTimeout(() => {
      console.log(gray('[info]watch default conf update, try to merge...'));
      Promise.all([_utils.createNginx(autoNginxPath), _utils.createNginx(defaultNginxPath)]).then((res) => {
        const conf = res[0];
        const defaultConf = res[1];
        _utils.mergeConfig(conf, defaultConf, keyName);
        _utils.flushPromise(conf);
        console.log(gray('[info]merge success...'));
      });
    }, 200);
  };

  /* 
  注入需要的nginx config
  */
  const writeConfig = async function (conf) {
    // 1、基础信息检查
    const baseConf = await _utils.createNginx(baseConfPath);
    _utils.mergeConfig(conf, baseConf, keyName);

    // 2、合并配置
    if (config.isMerge) {
      // 2.1、获取默认配置
      const defaultConf = await _utils.createNginx(defaultNginxPath);
      // 2.2、两份配置合并
      _utils.mergeConfig(conf, defaultConf, keyName);
      // 2.3、启动监听
      if (watcher) watcher.close();
      watcher = _utils.watchFile(defaultNginxPath, updateConfig);
    }

    // 3、注入
    _utils.putIntoServer(conf, injectServer);
    return conf;
  };

  /* 
  获取非本程序的注入的其他servers
  */
  const getOtherInjectServers = function (conf) {
    return _utils.getServers(conf).filter((item) => {
      const key = _utils.getKey(item._comments, keyName);
      return key && key !== config.key;
    });
  };

  /* 
  清空一下相同规则的config
  */
  const clearConfig = (conf) => {
    // 1、关闭watch服务
    if (watcher) watcher.close();
    _utils.setServers(
      conf,
      _utils.getServers(conf).filter((server) => !_utils.isSameRuleServer(server, injectServer))
    );
    return conf;
  };

  /* 
  启动方法
  */
  this.start = function () {
    try {
      return getInjectServer()
        .then(getPaths)
        .then(_utils.createNginx)
        .then(writeConfig)
        .then(_utils.flushPromise)
        .then(startNginx);
    } catch (e) {
      console.log(e);
    }
  };

  /* 
  停止方法
  */
  this.stop = function () {
    return _utils.createNginx(autoNginxPath).then(clearConfig).then(stopNginx).then(_utils.flushPromise);
  };
};
