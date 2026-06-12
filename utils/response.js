function ok(data) {
    return { ok: true, data };
}

function fail(code, message, details) {
    const err = { code, message };
    if (details) err.details = details;
    return { ok: false, error: err };
}

module.exports = { ok, fail };
