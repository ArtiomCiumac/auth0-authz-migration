const Promise = require("bluebird");

function arrayToMap(arr) {
    const result = {};

    return batchRun(arr, batch => {
        batch.forEach(item => result[item._id] = item);
    }).then(() => result);
}

function mapToArray(dictionary, itemTransformCallback) {
    return Object.keys(dictionary).reduce(function (result, key){
        const item = itemTransformCallback 
            ? itemTransformCallback(dictionary[key])
            : dictionary[key];

        result.push(item);

        return result;
    }, []);
}

function batchRun(arr, cb, batchSize) {
    if (!arr || arr.length === 0) return;

    const maxBatchSize = batchSize || 30000.0;
    const promises = [];

    const batches = Math.ceil(arr.length / maxBatchSize);

    var runBatch = null;
    var i = 0;

    runBatch = () => Promise.resolve(arr.slice(i*maxBatchSize, (i+1)*maxBatchSize))
        .then(x => cb(x))
        .then(() => {
            if (++i < batches)
                return runBatch();
        });

    return runBatch();
}

function batchFilter(arr, cb) {
    const result = [];

    return batchRun(arr, batch => {
            batch.filter(x => cb(x)).forEach(x => result.push(x));
        }, 1000).then(() => result);
}

module.exports = {
    arrayToMap,
    mapToArray,
    batchRun,
    batchFilter
};