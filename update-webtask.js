module.exports = function (context, cb) {
    const config = require("./config")(context);
    
    require("./update")(config)
        .then(result => cb(null, result))
        .catch(err => cb(err));
}