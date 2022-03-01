module.exports = function (config) {
  if (config.way === 'cover') {
    const Nginx = require('./coverFile');
    return new Nginx(config);
  } else {
    const Nginx = require('./newFile');
    return new Nginx(config);
  }
};
