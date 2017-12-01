module.exports = function (config) {
    const Promise = require("bluebird");

    const { getData, setData } = require("./s3-data")(config);
    const { transform } = require("./data-transform");
    const { updateUser } = require("./users")(config);
    const resumeLogFactory = require("./resume-log");

    const resumeLogPromise = resumeLogFactory("migrate-resume-log.json");
    const dataPromise = getData(config("S3_KEY_NEW"));

    return Promise.all([resumeLogPromise, dataPromise])
        .then(result => {
            const resumeLog = result[0];
            const data = result[1];
            return transform(data)
                .then(transformedData => {
                    console.log("Loaded user in total: " + transformedData.length);
                    return transformedData;
                })
                .then(transformedData => {
                    const filteredData = transformedData.filter(x => resumeLog.isNotLogged(x._id));
                    console.log("Users to save, except ones from resume log: " + filteredData.length);

                    return filteredData;
                })
                .then(transformedData => Promise.map(transformedData, x => updateUser(x, resumeLog.log), { concurrency: 8 }))
                .then(() => resumeLog.save())
                .then(() => setData(config("S3_KEY_OLD"), data));
        });
};