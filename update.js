module.exports = function (config) {
    const Promise = require("bluebird");

    const { getData, setData } = require("./s3-data")(config);
    const { transform2 } = require("./data-transform");
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

    const run = cb => {
        return new Promise((resolve, reject) => process.nextTick(() => resolve(cb())))
    }

    return Promise.resolve()
        .then(() => {
            return run(() => {
                const context = {};

                return getData(config("S3_KEY_NEW"))
                    .then(x => context.newDataOriginal = x)
                    .then(() => getData(config("S3_KEY_OLD")))
                    .then(x => context.oldDataOriginal = x)
                    .then(() => context);
            });
        })
        .then(context => {
            return run(() => {
                console.log("Preparing new data set.");
                return transform2(context.newDataOriginal)
                    .then(r => {
                        context.newDataTransformed = r;
                        return context;
                    });
            });
        })
        .then(context => {
            return run(() => {
                console.log("Preparing old data set.");
                return transform2(context.oldDataOriginal)
                    .then(r => {
                        context.oldDataTransformed = r;
                        return context;
                    });
            });
        })
        .then(context => {
            return run(() => {
                context.resultReport = {};

                return processDeletedUsers(context)
                    .then(deletedCount => context.resultReport.deletedUsers = deletedCount)
                    .then(() => context);
            });
        })
        .then(context => {
            return run(() => {
                return processUpdatedUsers(context)
                    .then(updatedCount => context.resultReport.updatedUsers = updatedCount)
                    .then(() => context);
            });
        })
        .then(context => {
            return run(() => {
                return setData(config("S3_KEY_OLD"), context.newDataOriginal)
                    .then(() => context.resultReport.totalUsers = context.newDataTransformed.length)
                    .then(() => context);
            });
        })
        .then(context => context.resultReport);
}