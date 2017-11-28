module.exports = function dataFactory(config) {
    const AWS = require('aws-sdk');
    AWS.config = new AWS.Config();
    AWS.config.accessKeyId = config("S3_KEY_ID");
    AWS.config.secretAccessKey = config("S3_SECRET");
    AWS.config.signatureVersion = "v4";

    const s3 = new AWS.S3();
    const Promise = require("bluebird");    

    return {
        getData: function getData(key) {
            console.log("Downloading from S3: " + key);

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
                .then(result => JSON.parse(result.Body.toString()));
        },
        setData: function setData(key, data) {
            console.log("Uploading to S3: " + key);
            
            const params = {
                Bucket: config("S3_BUCKET"), 
                Key: key,
                Body: JSON.stringify(data)
            };

            return new Promise((resolve, reject) => {
                s3.putObject(params, function(err, data) {
                    if (err) return reject(err);
                    return resolve(data);
                });
            })
        }
    };
}
