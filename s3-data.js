module.exports = function dataFactory(config) {
    const AWS = require('aws-sdk');
    AWS.config = new AWS.Config();
    AWS.config.accessKeyId = config("S3_KEY_ID");
    AWS.config.secretAccessKey = config("S3_SECRET");

    const s3 = new AWS.S3();
    const Promise = require("bluebird");    

    return {
        getData: function getData(key) {
            const params = {
                Bucket: config("S3_BUCKET"), 
                Key: key 
            };
        
            return new Promise((resolve, reject) => {
                s3.getObject(params, function(err, data) {
                    if (err) return reject(err);
                    return resolve(data);
                });
                })
                .then(result =>  JSON.parse(result.Body.toString()));
        }
    };
}
