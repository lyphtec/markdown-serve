/**
 * @author Nguyen Ly <lyphtec@gmail.com>
 * @copyright Nguyen Ly 2014-2024
 * @license MIT License
 *
 * @fileOverview Markdown file resolver
 * @module markdown-serve/resolver
 * @requires path
 * @requires fs
 * @exports markdown-serve/resolver
 */

var path = require('path'),
    fs = require('fs');

/**
 * File resolver utility
 * @function
 * @param {string} urlPath Relative URL path to file to try to resolve. Must start with a / and do not include the file extension
 * @param {string} rootDir Full path to root folder on file system that contains files to resolve
 * @param {resolverOptions=} options Optional [options]{@link MarkdownServer~resolverOptions} to specify default page name and file extension
 * @param {string} [options.defaultPageName=index] Name of default document
 * @param {string} [options.fileExtension=md] File extension of Markdown files
 * @param {boolean} [options.useExtensionInUrl=false] If true, the file extension will not be removed from the url when resolving it
 * @returns {string} Full path to Markdown file if it exists and is contained within rootDir, otherwise null.
 * Paths that escape rootDir (eg. via ".." segments in urlPath) never resolve, so they cannot be used to read files elsewhere on disk.
 * A urlPath containing malformed percent-encoding (eg. "/foo%") resolves to null rather than throwing.
 */
exports = module.exports = function(urlPath, rootDir, options) {
    if (!urlPath || urlPath[0] !== '/') return null;

    rootDir = path.resolve(rootDir);

    var ext = (options && options.fileExtension) ? options.fileExtension : 'md';
    if (ext.indexOf('.') !== 0)
        ext = '.' + ext;    // default is ".md"

    if (options && options.useExtensionInUrl)
        ext = '';

    var defPageName = (options && options.defaultPageName) ? options.defaultPageName : 'index';

    // root
    if (urlPath === '/') {
        var indx = contained(path.resolve(rootDir, defPageName + ext), rootDir);
        return (indx && exists(indx)) ? indx : null;
    }

    try {
        urlPath = decodeURIComponent(urlPath).substring(1);     // strip out leading '/' and normalize URI
    } catch (e) {
        // malformed percent-encoding, eg. "/foo%" -- decodeURIComponent throws a URIError.
        // Treat as unresolvable so the middleware next()s to a 404 rather than surfacing a 500.
        return null;
    }

    // append index to trailing slashes
    if (urlPath.match(/\/$/))
        urlPath += defPageName;

    // /name
    var file = contained(path.resolve(rootDir, urlPath + ext), rootDir);
    if (file && exists(file)) return file;

    // /with-dash
    file = contained(path.resolve(rootDir, urlPath.replace(/-/g, ' ') + ext), rootDir);
    if (file && exists(file)) return file;

    // /name/defPageName (urlPath is a directory containing a default md file)
    file = contained(path.resolve(rootDir, urlPath + '/' + defPageName + ext), rootDir);
    if (file && exists(file)) return file;

   // check existence of each segment -- taking into account dashes -- and build up final path
    var segs = urlPath.split('/');
    var u = rootDir;
    for (var i = 0; i < segs.length; i++) {
        var s = segs[i];

        if (i === segs.length - 1)
            s += '.md';

        var p = contained(path.resolve(u, s), rootDir);
        if (p && exists(p)) {
            u = p;
        } else {
            p = contained(path.resolve(u, s.replace(/-/g, ' ')), rootDir);
            if (p && exists(p))
                u = p;
            else
                return null;
        }
    }
    // make sure last segment is included in final result
    if (u.match(/\.md$/) && exists(u)) return u;


    return null;
};

/**
 * Guards against directory traversal. Returns `file` only if it sits inside `rootDir`, otherwise null.
 * Exposed so that {@link MarkdownServer#save} can apply the same check to paths it builds for files that don't exist yet.
 * @function
 * @param {string} file Full (already resolved) path to check
 * @param {string} rootDir Full path to the root folder that `file` must be contained within
 * @returns {string} `file` if it is contained within `rootDir`, otherwise null
 */
function contained(file, rootDir) {
    if (!file) return null;

    var rel = path.relative(rootDir, file);

    // "" means file === rootDir; an absolute result means a different drive/root altogether
    if (!rel || path.isAbsolute(rel)) return null;

    // leading ".." means the path climbed out of rootDir
    if (rel === '..' || rel.indexOf('..' + path.sep) === 0) return null;

    return file;
}

module.exports.contained = contained;

function exists(file) {
    return fs.existsSync(file);
}
