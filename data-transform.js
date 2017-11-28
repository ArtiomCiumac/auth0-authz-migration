const Promise = require("bluebird");
const prettyHrtime = require("pretty-hrtime");

const { mapToArray, run, runEach, batch } = require("./utils");

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

function transform(data) {
    const mapName = arr => {
        const result = Object.create(null);
        arr.forEach(x => result[x._id] = x.name);
        return result;
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

module.exports = {
    transform
}