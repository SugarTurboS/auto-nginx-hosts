const moreValuesKey = ["include"];
const { gray, red } = require("chalk");
const isWin = process.platform === 'win32';
const Win = require('../win');
const utils = {
  /* 
  根据path获取注入的servers
  */
  getInjectServer(path) {
    return utils
      .createNginx(path)
      .then((conf) =>
        conf.nginx.server.length ? conf.nginx.server[0] : conf.nginx.server
      );
  },
  /* 
    判断该server配置是否与注入配置的域名端口号一样
    */
  isSameRuleServer(server, injectServer) {
    return (
      server &&
      server.listen._value === injectServer.listen._value &&
      server.server_name._value === injectServer.server_name._value
    );
  },
  /* 
    判断该nginx对象是否有server数据
    */
  isConfHasServer(conf) {
    return conf && conf.nginx && conf.nginx.http && conf.nginx.http.server;
  },
  /* 
    获取nginx的 server 数组
    */
  getServers(conf) {
    if (utils.isConfHasServer(conf))
      return conf.nginx.http.server.length
        ? conf.nginx.http.server
        : [conf.nginx.http.server];
    return [];
  },
  /* 
    注入server
    */
  putIntoServer(conf, server) {
    const resServers = [
      ...utils
        .getServers(conf)
        .filter((item) => !utils.isSameRuleServer(item, server)),
      server,
    ];
    utils.setServers(conf, resServers);
  },
  /* 
    给conf对象更新server数据
     */
  setServers(conf, servers) {
    if (conf && conf.nginx && conf.nginx.http) {
      const hasValue = servers && servers.length > 0;
      if (hasValue) {
        conf.nginx.http.server = servers.length === 1 ? servers[0] : servers;
      } else {
        conf.nginx.http._remove("server");
      }
    }
  },
  /* 
    根据_comments对象获取备份hash
    */
  getKey(_comments, keyName) {
    if (_comments) {
      const target = _comments.find((co) => co.indexOf(keyName) >= 0);
      if (target) {
        return target.replace(keyName, "") || "empty";
      }
    }
    return "";
  },
  /* 
    合并config
    */
  mergeConfig(conf, baseConfig, keyName) {
    // 合并http
    const hasHttpConfig = baseConfig.nginx.http || conf.nginx.http;
    const hasHttpArray = (baseConfig.nginx.http && baseConfig.nginx.http.length) || (conf.nginx.http && conf.nginx.http.length);
    if (hasHttpConfig && !hasHttpArray) {
      if(!conf.nginx.http) conf.nginx.http = baseConfig.nginx.http;
      else utils.merge(conf.nginx.http, baseConfig.nginx.http);
    }
    // 合并events
    const hasEventsConfig = baseConfig.nginx.events || conf.nginx.events;
    const hasEventsArray = (baseConfig.nginx.events && baseConfig.nginx.events.length) || (conf.nginx.events && conf.nginx.events.length);
    if (hasEventsConfig && !hasEventsArray) {
      if(!conf.nginx.events) conf.nginx.events = baseConfig.nginx.events;
      else utils.merge(conf.nginx.events, baseConfig.nginx.events);
    }
    // 合并servers
    if (keyName) {
      const confServers = utils
        .getServers(conf)
        .filter((server) => !!utils.getKey(server._comments, keyName));
      const injectServers = utils
        .getServers(baseConfig)
        .filter((baseServer) => {
          return confServers.every(
            (confServer) => !utils.isSameRuleServer(baseServer, confServer)
          );
        });
      utils.setServers(conf, [...confServers, ...injectServers]);
    }
  },
  /* 
    合并
    */
  merge(target, source) {
    const injectConf = utils.fmtConfig(source);
    if(!injectConf) return;
    Object.keys(injectConf).forEach((key) => {
      if (!target[key]) {
        let values = utils.isArray(injectConf[key])
          ? injectConf[key]
          : [injectConf[key]];
        values.forEach((val) => {
          target._add(key, val);
        });
      } else if (moreValuesKey.includes(key)) {
        let values = utils.isArray(injectConf[key])
          ? injectConf[key]
          : [injectConf[key]];
        const nowValues = target[key].length
          ? target[key].map((item) => item._value)
          : [target[key]._value];
        const setValues = values.filter((value) => !nowValues.includes(value));
        setValues.forEach((val) => {
          target._add(key, val);
        });
      }
    });
  },
  watchFile(path, callback) {
    return require("fs-extra").watch(path, callback);
  },
  /* 
    获取有用的keys
    */
  getUsefulKey(obj) {
    return Object.keys(obj).filter(
      (key) =>
        ![
          "_remove",
          "_add",
          "_addVerbatimBlock",
          "_getString",
          "toString",
          "server",
        ].includes(key)
    );
  },
  /* 
    从conf.nginx对象中获取所有的值数组
    */
  fmtConfig: (obj) => {
    if (utils.isObject(obj)) {
      const keys = utils.getUsefulKey(obj);
      if (keys && keys.length > 0) {
        const newObj = {};
        keys.forEach((key) => {
          newObj[key] = utils.fmtConfig(obj[key]);
        });
        return newObj;
      } else {
        return obj._value;
      }
    } else if (utils.isArray(obj)) {
      return obj.map(utils.fmtConfig);
    } else {
      return obj;
    }
  },
  /* 
    是否object对象
    */
  isObject(obj) {
    return Object.prototype.toString.call(obj) === "[object Object]";
  },
  /* 
    是否array对象
    */
  isArray(array) {
    return Object.prototype.toString.call(array) === "[object Array]";
  },
  /* 
  创建一个nginx 操作对象
  通过nginx-conf包，把nginx内容转为一个对象，根据提供的API修改nginx
  */
  createNginx(path) {
    return new Promise((res) => {
      const nginxConf = require("nginx-conf");
      nginxConf.NginxConfFile.create(path, (err, conf) => {
        if (err) {
          console.log(err);
          return;
        }
        res(conf);
      });
    });
  },

  /* 
  获取nginx conf地址 
  通过 `nginx -t` 命令获取配置地址
  */
  getNginxConfigPath() {
    return new Promise((res) => {
      const { exec } = require("child_process");
      let getNginxCmd = "sudo nginx -t";
      let execConf = {};
      let decode;
      if(isWin) {
        const winUtils = new Win();
        const exePath = winUtils.FindExePath('nginx');
        const nginxRootDir = exePath.replace(/[\\\/]nginx.exe/, '');
        getNginxCmd = 'nginx -t';
        const decodeObj = winUtils.getExecDecode();
        decode = decodeObj.decode;
        execConf = {
          encoding: decodeObj.encoding,
          cwd: nginxRootDir
        }
      }
      const child = exec(getNginxCmd, execConf);
      child.stderr.on("data",  (info) => {
        let data = info;
        if(isWin) {
          data  = decode(info)
        } else {
          data = info.toString();
        }
        const ctx = data.split(/\r?\n/);
        const line = ctx.find(
          (item) => item.indexOf("configuration file") >= 0
        );
        if (line) {
          const words = line.split(/\s+configuration\s+file\s+/);
          if (words.length === 2) {
            res(words[1].split(" ")[0]);
          }
        }
      });
    });
  },

  /* 
  启动nginx 
  1、通过child_process执行`sudo nginx`
  2、如果失败且失败信息显示已经启动，则执行`sudo nginx -s reload`重启nginx
  */
  startNginx(startPath) {
    if(isWin) {
      const winUtils = new Win();
      const nginxExePath = winUtils.FindExePath('nginx');
      const nginxRootDir = nginxExePath.replace(/[\\\/]nginx.exe/, '');
      winUtils.stopExe('nginx');
      const startCmd = `nginx ${startPath ? '-c ' + startPath : ''}`;
      const { exec } = require("child_process");
      exec(startCmd, {cwd: nginxRootDir});
      console.log(gray("[info]start nginx success"));
    } else {
      const { execSync } = require("child_process");
      const startCommand = startPath
        ? `sudo nginx -c ${startPath}`
        : "sudo nginx";
      const stopCommand = "sudo nginx -s stop";
      try {
        execSync(startCommand); // 尝试正常启动nginx命令
        console.log(gray("[info]start nginx success"));
      } catch (e) {
        if (e.toString().indexOf("Address already in use") >= 0) {
          try {
            execSync(stopCommand); // nginx正在运行，先停止nginx
            execSync(startCommand); // 再次启动nginx命令
            console.log(gray("[info]start nginx success"));
          } catch (e) {
            console.log(red("[error]start nginx fail..."));
            throw e;
          }
        } else {
          throw e;
        }
      }
    }
  },
  stopNginx() {
    try {
      if(isWin) {
        const winUtils = new Win();
        winUtils.stopExe('nginx');
      }
      else {
        const { execSync } = require("child_process");
        execSync("sudo nginx -s stop");
      }
      console.log(gray("[info] stop nginx success"));
    } catch (e) {
      console.log(red("[error] stop nginx fail"));
    }
  },
  /* 
  写入流到文件中
  由于nginx-conf提供的conf.flush不是Promise，该方法转为promise
  */
  flushPromise(conf) {
    return new Promise((res) => {
      conf.flush(res);
    });
  },
};

module.exports = utils;
