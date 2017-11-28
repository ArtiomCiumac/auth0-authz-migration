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
        updateUser: function updateUser(user) {
            const query = { id: user._id };
            if (/^fake/i.test(user._id)) return;
            
            return throttle(() => management.users.updateAppMetadata(query, user.authz))
                .catch(err => {
                    // silently skip HTTP 404 errors that happen for fake users
                    if (err.statusCode != 404) {
                        throw new Error(err);
                    }
                });
                
        },
    }
};