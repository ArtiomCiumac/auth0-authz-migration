const Promise = require("bluebird");

function run(cb) {
    return new Promise((resolve, reject) => process.nextTick(() => resolve(cb())))
}

function runEach(arr, cb) {
    var promise = Promise.resolve();

    arr.forEach(x => {
        promise = promise.then(() => run(() => cb(x)));
    })

    return promise;
}

function batch (arr, cb) {
    if (!arr || arr.length === 0) { return Promise.resolve(); }

    const batchSize = 1000;

    const batches = Math.ceil(arr.length / batchSize);

    var runBatch = null;
    var i = 0;

    var promise = Promise.resolve();

    const scheduleBatch = i => promise
        .then(() => arr.slice(i * batchSize, (i + 1) * batchSize))
        .then(x => run(() => x.forEach(item => cb(item))));

    for(var i = 0; i < batches; i++) {
        promise = scheduleBatch(i);
    }

    return promise;
}

function arrayToMap(arr) {
    const result = {};

    return batch(arr, item => result[item._id] = item)
        .then(() => result);
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

function batchFilter(arr, cb) {
    const result = [];

    return batch(arr, item => { if (cb(item)) { result.push(item); } })
        .then(() => result)
}

module.exports = {
    arrayToMap,
    mapToArray,
    batchFilter,
    run,
    runEach,
    batch,
};