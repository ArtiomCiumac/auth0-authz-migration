const Promise = require("bluebird");

const MAX_ITERATIONS = 10;

module.exports = function throttle(func) {
    var iteration = 0;
    var wrapped = null;

    wrapped = () => func().catch(err => {
        if (err.statusCode === 429 && (iteration++) < MAX_ITERATIONS) {
            const waitTo = parseFloat(err.originalError.response.headers["x-ratelimit-reset"]) * 1000;
            const burst = parseInt(err.originalError.response.headers["x-ratelimit-limit"])
            const waitTime = Math.abs(new Date(waitTo) - new Date());

            return Promise.delay(waitTime / burst)
                .then(wrapped);
        }

        return Promise.reject(err);
    })

    return wrapped();
}