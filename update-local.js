const config = require("./config")();

require("./update")(config)
    .then(result => console.log(result))
    .catch(err => console.log(err));