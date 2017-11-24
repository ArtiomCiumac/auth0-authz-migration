module.exports = function configFactory(context) {
    require("dotenv").config();

    function contextConfig(key) {
        return context && context.secrets ? context.secrets[key] : null;
    }

    function envConfig(key){
        return process.env[key];
    }
    
    return function config(key) {
        return contextConfig(key) || envConfig(key);
    }
}