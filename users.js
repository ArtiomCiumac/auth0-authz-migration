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
            
            return throttle(() => management.users.get(query))
                .then(u => {
                    const appMetadata = u.app_metadata || {};

                    // TODO: check what to do with null property
                    appMetadata.authz = user.authz;

                    return appMetadata;
                })
                .then(appMetadata => throttle(() => management.users.updateAppMetadata(query, appMetadata)))
                .catch(err => {
                    // silently skip HTTP 404 errors that happen for fake users
                    if (err.statusCode != 404) {
                        throw new Error(err);
                    }
                });
                
        },
    }
};