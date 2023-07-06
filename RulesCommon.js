function escape_name(name) {
    return name.replace(/\s/g, '_').replace(/[\'()[\]-]/g, '');
}

module.exports = { escape_name };