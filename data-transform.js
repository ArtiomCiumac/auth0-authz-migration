const Promise = require("bluebird");
Promise.setScheduler((fn) => {
    setTimeout(fn, 1);
});

const { arrayToMap, mapToArray, batchRun } = require("./arrayUtils");

function transformPermission(permission) {
    return permission.name;
}

function transformRole(role) {
    return role.name;
}

function transformGroup(group) {
    return group.name;
}

function addPermission(user, permission) {
    user.permissions[permission._id] = transformPermission(permission);
}

function addRole(user, role, permissionsGetter) {
    user.roles[role._id] = transformRole(role);

    if (role.permissions) {
        role.permissions.forEach(id => addPermission(user, permissionsGetter(id)));
    }
}

function addGroup(user, group, roleGetter, permissionGetter) {
    user.groups[group._id] = transformGroup(group);

    if (group.roles) {
        group.roles.forEach(id => addRole(user, roleGetter(id), permissionGetter));
    }
}

function getOrCreateUser(users, id) {
    var user = users[id];

    if (!user) {
        user = { 
            _id:id, 
            groups: {},
            roles: {}, 
            permissions: {}
        };

        users[id] = user;
    }

    return user;
}

module.exports = function transform(data) {
    return arrayToMap(data.permissions)
        .then(permissions => {
        const users = {};

        return Promise.resolve()
            .then(() => {
                if (data.groups) {
                    console.log("Transform: groups.");

                    return arrayToMap(data.roles).then(roles => {
                        return Promise.map(data.groups, group => {
                            if (group.members) {
                                console.log("Group with " + group.members.length + " members.")

                                return batchRun(group.members, batch => {
                                    batch.forEach(userId => {
                                        const user = getOrCreateUser(users, userId);
            
                                        addGroup(user, group, id => roles[id], id => permissions[id]);
                                    });
                                }, 10000);
                            }
                        });
                    });
                }
            })
            .then(() => {
                if (data.roles) {
                    console.log("Transform: roles.");

                    return Promise.map(data.roles, role => {
                        if (role.users) {

                            return batchRun(role.users, batch => {
                                batch.forEach(userId => {
                                    const user = getOrCreateUser(users, userId);
        
                                    addRole(user, role, id => permissions[id]);
                                });
                            }, 10000);
                        }
                    });
                }
            })
            .then(() => {
                console.log("Transform: assembling users array.");

                const result = [];

                return batchRun(Object.keys(users), batch => {
                        batch.forEach(k => {
                            const u = users[k];
                            
                            result.push({
                                _id: u._id,
                                authz: {
                                    groups: mapToArray(u.groups),
                                    roles: mapToArray(u.roles),
                                    permissions: mapToArray(u.permissions)
                                }
                            });
                        })
                    }, 500)
                    .then(() => result);
            });
    });
}