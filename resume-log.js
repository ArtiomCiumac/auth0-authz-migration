const Promise = require("bluebird");
const fs = require("fs");

function readFile(file) {
    return new Promise((resolve, reject) => {
        fs.readFile(file, "utf8", (err, data) => {
            if (err) return reject(err);
            return resolve(JSON.parse(data));
        })
    })
}

function writeFile(file, data) {
    fs.writeFileSync(file, JSON.stringify(data));
}

module.exports = function resumeLogFactory(file) {
    const saveInterval = 100;

    console.log("Loading resume log from " + file);
    return readFile(file)
        .catch(err => { return {}; })
        .then(data => {
            if (data && Object.keys(data).length > 0) console.log("Loaded resume log from " + file + ", " + Object.keys(data).length + " entries");
            else console.log("Resume log not found for " + file);

            return data;
        })
        .then(data => {
            var callsCount = 0;

            const saveResumeLog = () => {
                console.log("Saving resume log to " + file + ", " + Object.keys(data).length + " entries");

                writeFile(file, data);
            };

            return {
                isNotLogged: id => !data[id],
                log: id => {
                    data[id] = true;

                    callsCount++;

                    if (callsCount % saveInterval === 0) {
                        saveResumeLog();
                    }
                },
                save: saveResumeLog
            };
        })
}