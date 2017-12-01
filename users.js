module.exports = function factory(config) {
    const ManagementClient = require("auth0").ManagementClient;

    const throttle = require("./throttle");

    const management = new ManagementClient({
        domain: config("A0_DOMAIN"),
        clientId: config("A0_CLIENT_ID"),
        clientSecret: config("A0_CLIENT_SECRET"),
        scope: "read:users update:users",
    });

    return {
        updateUser: function updateUser(user, logCallback) {
            if (!user._id || !user._id.length || user._id === "undefined" || /^fake/i.test(user._id)) { return; }
            
            const query = { id: user._id };

            return throttle(() => management.users.updateAppMetadata(query, user.authz))
                .then(() => {
                    if (logCallback) { logCallback(user._id); }
                })
                .catch(err => {
                    // silently skip HTTP 404 errors that happen for fake users
                    if (err.statusCode != 404) {
                        console.log(err.message);
                    }
                });
                
        },
    }
};