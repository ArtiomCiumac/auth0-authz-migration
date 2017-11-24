module.exports = function (config) {
    const Promise = require("bluebird");
    
    const { getData } = require("./s3-data")(config);
    const transform = require("./data-transform");
    const { updateUser } = require("./users")(config);    

    return getData(config("S3_KEY_NEW"))
        .then(data => transform(data))
        .then(data => Promise.map(data, x => updateUser(x), { concurrency: 1 }));
};