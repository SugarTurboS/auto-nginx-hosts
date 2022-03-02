const autoNginxHosts = require("../src");
autoNginxHosts({
  nginx: {
    path: require("path").join(__dirname, "nginx.conf"),
    key: "demo",
    isMerge: true,
  },
  hosts: [{ ip: "127.0.0.1", domain: "www.demo.com" }],
});
const http = require('http');
http.createServer(function(req, res) {
    res.writeHead(200, {'Content-Type': 'text/plain'});
    res.end('hello world\n');
}).listen(12300)

console.log('server running at http://www.demo.com');