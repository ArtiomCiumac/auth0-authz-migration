module.exports = function (config) {
    const Promise = require("bluebird");
    
    const { getData, setData } = require("./s3-data")(config);
    const transform = require("./data-transform");
    const { updateUser } = require("./users")(config);
    const { arrayToMap, mapToArray } = require("./arrayUtils");    

    function getNewData() {
        return getData(config("S3_KEY_NEW"))
            .then(data => transform(data));
    }

    function getOldData() {
        return getData(config("S3_KEY_OLD"));
    }

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
        const b = oldDataMap[item._id];

        return !(b
            && arraysEqual(a.authz.groups, b.authz.groups)
            && arraysEqual(a.authz.roles, b.authz.roles)
            && arraysEqual(a.authz.permissions, b.authz.permissions));
    }

    return Promise.all([getNewData(), getOldData()])
        .then(data => {
            const newData = data[0];
            const oldData = data[1];

            const newDataMap = arrayToMap(newData);
            const oldDataMap = arrayToMap(oldData);

            const deleted = oldData.filter(i => !newDataMap[i._id]);
            const changed = newData.filter(i => isNewOrChanged(i));

            return Promise.map(deleted, x => updateUser({ _id: x._id, authz: null }), { concurrency: 1 })
                .then(() => Promise.map(changed, x => updateUser(x), { concurrency: 1 }))
                .then(data => setData(config("S3_KEY_OLD", data)));
        })
}