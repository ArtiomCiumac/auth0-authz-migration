const { arrayToMap, mapToArray } = require("./arrayUtils");

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

    role.permissions.forEach(id => addPermission(user, permissionsGetter(id)));
}

function addGroup(user, group, roleGetter, permissionGetter) {
    user.groups[group._id] = transformGroup(group);

    group.roles.forEach(id => addRole(user, roleGetter(id), permissionGetter));
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
    const permissions = arrayToMap(data.permissions);
    const roles = arrayToMap(data.roles);
    
    const users = {};

    data.groups.forEach(group => {
        group.members.forEach(userId => {
            const user = getOrCreateUser(users, userId);

            addGroup(user, group, id => roles[id], id => permissions[id]);
        });
    });

    data.roles.forEach(role => {
        role.users.forEach(userId => {
            const user = getOrCreateUser(users, userId);

            addRole(user, role, id => permissions[id]);
        });
    });

    return mapToArray(users, u => {
        return {
            _id: u._id,
            authz: {
                groups: mapToArray(u.groups),
                roles: mapToArray(u.roles),
                permissions: mapToArray(u.permissions)
            }
        };
    });
}