const Promise = require("bluebird");

function run(cb) {
    return new Promise((resolve, reject) => process.nextTick(() => resolve(cb())))
}

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

module.exports = {
    arrayToMap,
    mapToArray,
    batchRun,
    batchFilter,
    run,
    runEach,
    batch,
};