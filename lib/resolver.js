var path = require('path'),
    fs = require('fs');

exports = module.exports = function(urlPath, rootDir) {
    if (!urlPath || urlPath[0] != '/') return null;

    rootDir = path.resolve(rootDir);

    // root
    if (urlPath === '/') {
        var file = path.resolve(rootDir, 'index.md');
        return exists(file) ? file : null;
    }

    urlPath = decodeURIComponent(urlPath).substring(1);     // strip out leading '/' and normalize URI

    // append index to trailing slashes
    if (urlPath.match(/\/$/))
        urlPath += 'index';
    
    // /name    
    var file = path.resolve(rootDir, urlPath + '.md');
    if (exists(file)) return file;

    // /with-dash
    file = path.resolve(rootDir, urlPath.replace(/-/g, ' ') + '.md');
    if (exists(file)) return file;

    // check existence of each segment -- taking into account dashes -- and build up final path
    var segs = urlPath.split('/');
    var u = rootDir;
    for (var i = 0; i < segs.length; i++) {
        var s = segs[i];

        if (i === segs.length - 1)
            s += '.md';

        var p = path.resolve(u, s);
        if (exists(p)) {
            u = p;
        } else {
            p = path.resolve(u, s.replace(/-/g, ' '));
            if (exists(p))
                u = p;
        }
    }
    // make sure last segment is included in final result
    if (u.match(/\.md$/) && exists(u)) return u;


    return null;
};

function exists(file) {
    return fs.existsSync(file);
}
