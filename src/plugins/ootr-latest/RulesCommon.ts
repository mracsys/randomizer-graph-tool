function escape_name(name: string) {
    return name.replace(/\s/g, '_').replace(/[\'()[\]-]/g, '');
}

export default escape_name;