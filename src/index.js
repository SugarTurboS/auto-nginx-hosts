module.exports = function (config) {
  // 启动nginx及hosts
  let nginx, hosts;
  if (config.nginx) {
    const Nginx = require("./nginx");
    nginx = new Nginx(config.nginx);
  }
  if (config.hosts) {
    const Hosts = require("./hosts");
    hosts = new Hosts(config.hosts);
  }

  let isDoingExit = false;
  const exitEvent = async () => {
    if (isDoingExit) return;
    isDoingExit = true;
    nginx && nginx.stop && (await nginx.stop());
    hosts && hosts.stop && (await hosts.stop());
    isDoingExit = false;
  };

  let isDoingQuit = false;
  const forceQuitEvent = function () {
    if (isDoingQuit) return;
    isDoingQuit = true;
    exitEvent().then(() => {
      process.removeListener("exit", exitEvent);
      isDoingQuit = false;
      process.exit();
    });
  };

  process.on("exit", exitEvent);
  process.on("SIGINT", forceQuitEvent);
  process.on("SIGQUIT", forceQuitEvent);
  process.on("SIGTERM", forceQuitEvent);
  nginx && nginx.start && nginx.start();
  hosts && hosts.start && hosts.start();
};
