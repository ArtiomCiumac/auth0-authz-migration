const Promise = require("bluebird");
const prettyHrtime = require("pretty-hrtime");

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
            _id: id,
            groups: {},
            roles: {},
            permissions: {}
        };

        users[id] = user;
    }

    return user;
}

function transform2(data) {
    const mapName = arr => {
        const result = Object.create(null);
        arr.forEach(x => result[x._id] = x.name);
        return result;
    }

    const run = cb => {
        return new Promise((resolve, reject) => process.nextTick(() => resolve(cb())))
    }

    const runEach = (arr, cb) => {
        var promise = Promise.resolve();

        arr.forEach(x => {
            promise = promise.then(() => run(() => cb(x)));
        })

        return promise;
    }

    const batch = (arr, cb) => {
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

    const mapPromise = arr => Promise.resolve(arr).then(x => mapName(x))

    const forEach = (arr, cb) => Promise.each(arr, i => Promise.resolve(i).then(x => cb(x)));

    const createUser = id => { return { _id: id, groups: {}, roles: {}, permissions: {} } };

    const getOrCreate = (context, id) => {
        var user = context.users[id];
        if (!user) {
            user = createUser(id);
            context.users[id] = user;
        }
        return user;
    }

    const dataMapPromises = [
        mapPromise(data.groups),
        mapPromise(data.roles),
        mapPromise(data.permissions),
    ]

    var lastTimestamp;
    const ts = title => {
        const startTime = () => process.hrtime();
        const endTime = time => logTime(process.hrtime(time));
        const logTime = time => console.log(title + " " + prettyHrtime(time));

        if (lastTimestamp) {
            endTime(lastTimestamp);
        }

        lastTimestamp = startTime();
    }

    return Promise.all(dataMapPromises)
        .then(maps => {
            ts("Init data transform context...");
            return {
                groupsMap: maps[0],
                rolesMap: maps[1],
                permissionsMap: maps[2],
                users: Object.create(null)
            };
        })
        .then(context => {
            if (data.groups) {
                ts("Processing groups...");
                return runEach(data.groups, g => {
                    return batch(g.members, id => addGroup(getOrCreateUser(context.users, id), g, x => context.rolesMap[x], x => context.permissionsMap[x]));
                }).then(() => context);
            }

            return context;
        })
        .then(context => {
            if (data.roles) {
                ts("Processing roles...");
                return runEach(data.roles, r => {
                    return batch(r.users, id => addRole(getOrCreateUser(context.users, id), r, x => context.permissionsMap[x]));
                }).then(() => context);
            }

            return context;
        })
        .then(context => {
            ts("Finishing transform...");
            const result = [];
            
            return run(() => {
                return batch(Object.keys(context.users), k => {
                    const u = context.users[k];
                    result.push({
                        _id: u._id,
                        authz: {
                            groups: mapToArray(u.groups),
                            roles: mapToArray(u.roles),
                            permissions: mapToArray(u.permissions)
                        }
                    });
                });
            }).then(() => ts("Transform done.")).then(() => result);

        });
}

function transform(data) {
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

module.exports = {
    transform,
    transform2
}