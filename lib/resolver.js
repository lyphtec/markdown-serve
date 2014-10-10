/** 
 * @author Nguyen Ly <lyphtec@gmail.com>
 * @copyright Nguyen Ly 2014
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
 * @returns {string} Full path to Markdown file if it exists, otherwise null
 */
exports = module.exports = function(urlPath, rootDir, options) {
    if (!urlPath || urlPath[0] != '/') return null;

    rootDir = path.resolve(rootDir);

    var ext = (options && options.fileExtension) ? options.fileExtension : 'md';
    if (ext.indexOf('.') !== 0)
        ext = '.' + ext;    // default is ".md"

    var defPageName = (options && options.defaultPageName) ? options.defaultPageName : 'index';

    // root
    if (urlPath === '/') {
        var indx = path.resolve(rootDir, defPageName + ext);
        return exists(indx) ? indx : null;
    }

    urlPath = decodeURIComponent(urlPath).substring(1);     // strip out leading '/' and normalize URI

    // append index to trailing slashes
    if (urlPath.match(/\/$/))
        urlPath += defPageName;
    
    // /name    
    var file = path.resolve(rootDir, urlPath + ext);
    if (exists(file)) return file;

    // /with-dash
    file = path.resolve(rootDir, urlPath.replace(/-/g, ' ') + ext);
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
            else
                return null;
        }
    }
    // make sure last segment is included in final result
    if (u.match(/\.md$/) && exists(u)) return u;


    return null;
};

function exists(file) {
    return fs.existsSync(file);
}
