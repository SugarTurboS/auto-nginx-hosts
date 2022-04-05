# auto-nginx-hosts

For automatic injection of nginx and hosts ！

## Install
```
npm install auto-nginx-hosts
```

## Use
```
const autoNginxHosts = require('auto-nginx-hosts');
autoNginxHosts({
  nginx: {
    path: require("path").join(__dirname, "nginx.conf"), // nginx.conf file url
    key: "demo", // only key
    isMerge: true, // merge existing nginx configurations
  },
  hosts: [{ ip: "127.0.0.1", domain: "www.demo.com" }],
});
```

## Author

[dee](https://github.com/deeWong)

## Demo
view [Demo](https://github.com/SugarTurboS/auto-nginx-hosts/tree/master/demo)

## Description
* 1、At present, it only supports the server configuration of nginx injection, and does not support the injection of events, HTTP and other information
* 2、Windows cannot listen to ctrl-c exit, so it cannot recover hosts and stop nginx. It can be handled manually if necessary.

## windows notice
* 1、Open the administrator user (run the command line CMD as an administrator and enter the following command：`net user administrator /active:yes`)
* 2、Set a password for the administrator user. (control panel -> user account -> management account -> click administrator account，and change password)
* 3、Run the following command `runas /env /savecred /user:Administrator cmd`. If prompted for a password, enter the password set in step 2. After waiting for the command to open another CMD, it indicates that the password is recorded successfully
