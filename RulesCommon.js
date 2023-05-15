var allowed_globals = {};

function escape_name(name) {
    return name.replace(/\s/g, '_').replace(/[\'()[\]-]/g, '');
}

module.exports = { allowed_globals, escape_name };