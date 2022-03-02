# auto-nginx-hosts

## 说明
用于自动启动nginx及hosts

## 安装
```
npm install auto-nginx-hosts
```

## 使用方式
```
const autoNginxHosts = require('auto-nginx-hosts');
autoNginxHosts({
  nginx: {
    path: require("path").join(__dirname, "nginx.conf"), // nginx.conf文件路径
    key: "demo", // 唯一key
    isMerge: true, // 是否合并已有nginx配置
  },
  hosts: [{ ip: "127.0.0.1", domain: "www.demo.com" }],
});
```

## Demo
详询 [Demo](https://github.com/deeWong/auto-nginx-hosts/demo)

## 说明
* 1、目前仅支持注入nginx的server配置，不支持注入events、http等信息
* 2、windows无法监听ctrl-c退出，所以无法恢复hosts及停止nginx，有需要可手动处理。

## windows注意项
* 1、开启Administrator用户（以管理员身份运行命令行CMD，输入以下命令：`net user administrator /active:yes`）
* 2、给administrator用户设置一个密码。（控制面板 - 用户账户 - 管理账户 - 点击Administrator账户， 更改密码）
* 3、打开cmd，运行以下命令`runas /env /savecred /user:Administrator cmd`，如果提示输入密码，请输入步骤2设置好的密码。等待命令打开另一个cmd后，表示成功记录密码。

