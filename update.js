module.exports = function (config) {
    const Promise = require("bluebird");
    Promise.setScheduler((fn) => {
        setTimeout(fn, 1);
    });
    
    const { getData, setData } = require("./s3-data")(config);
    const transform = require("./data-transform");
    const { updateUser } = require("./users")(config);
    const { arrayToMap, mapToArray, batchFilter } = require("./arrayUtils");    

    function arraysEqual(a, b) {
        if (a === b) return true;
        if (a == null || b == null) return false;
        if (a.length != b.length) return false;
      
        a.sort();
        b.sort();
      
        for (var i = 0; i < a.length; ++i) {
          if (a[i] !== b[i]) return false;
        }
        return true;
      }

    function isNewOrChanged(a, oldDataMap) {
        const b = oldDataMap[a._id];

        return !(b
            && arraysEqual(a.authz.groups, b.authz.groups)
            && arraysEqual(a.authz.roles, b.authz.roles)
            && arraysEqual(a.authz.permissions, b.authz.permissions));
    }

    function processDeletedUsers(data) {
        console.log("Update: processing deleted users...");
        
        return Promise.resolve(data.newDataTransformed)
            .then(x => arrayToMap(x))
            .then(x => batchFilter(data.oldDataTransformed, i => !x[i._id]))
            .then(deleted => Promise.map(deleted, x => updateUser({ _id: x._id, authz: null }), { concurrency: 1 }))
            .then(x => x.length);
    }

    function processUpdatedUsers(data) {
        console.log("Update: processing changed users...");

        return Promise.resolve(data.oldDataTransformed)
            .then(x => arrayToMap(x))
            .then(x => batchFilter(data.newDataTransformed, i => isNewOrChanged(i, x)))
            .then(changed => Promise.map(changed, x => updateUser(x), { concurrency: 16 }))
            .then(x => x.length)
    }

    return Promise.resolve()
        .then(() => {
            const result = [];

            return getData(config("S3_KEY_NEW"))
                .then(x => result.push(x))
                .then(() => getData(config("S3_KEY_OLD")))
                .then(x => result.push(x))
                .then(() => result);
        })
        .then(data => {
            console.log("Update: transforming data to users arrays...");

            // HACK: process the data in separate event loops, otherwise
            // the node's event loop gets blocked and the webtask is killed.
            return Promise.map(data, x => transform(x), {concurrency: 1})
                .then(r => {
                    console.log("Update: data transformation complete.");
                    
                    return {
                        newDataOriginal: data[0],
                        newDataTransformed: r[0],
                        oldDataTransformed: r[1]
                    }
                })
        })
        .then(data => {
            const resultReport = {};

            return processDeletedUsers(data)
                .then(deletedCount => resultReport.deletedUsers = deletedCount)
                .then(() => processUpdatedUsers(data))
                .then(updatedCount => resultReport.updatedUsers = updatedCount)
                .then(() => setData(config("S3_KEY_OLD"), data.newDataOriginal))
                .then(() => resultReport.totalUsers = data.newDataTransformed.length)
                .then(() => resultReport)
        })
}