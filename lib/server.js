var path = require('path'),
    resolver = require('./resolver'),
    parser = require('./parser'),
    fs = require('fs');


exports = module.exports = {
    MarkdownServer: MarkdownServer,

    /**
     * Simple Express middleware that can serve converted Markdown content
     * @function
     * @param {Object} options - Middleware options
     */
    middleware: function(options) {
        if (!options)
            throw new Error('"options" argument is required');

        if (!options.rootDirectory)
            throw new Error('"rootDirectory" value is required');

        var server = new MarkdownServer(options.rootDirectory);

        if (options.markedOptions)
            server.markedOptions = options.markedOptions;

        return function(req, res, next) {
            if (req.method !== 'GET') next();

            server.get(req.path, function(err, result) {
                if (err) {
                    console.log(err);
                    next();
                    return;   // need return here because next call (above) is inside a callback
                }

                if (options.view)
                    res.render(options.view, { context: result });
                else {
                    result.parseContent(function(err2, content) {
                        if (err2)
                            result.parsedContent = JSON.stringify(err2);
                        else
                            result.parsedContent = content;

                        res.send(result);
                    });
                }
            });
        };
    }
};

/**
 * Markdown files server
 * @class
 * @param {string} rootDirectory - Full path to root directory containing Markdown files to serve
 * @property {string} rootDirectory
 * @property {?Object} markedOptions - Global marked module options for Markdown processing
 */
function MarkdownServer(rootDirectory) {
    if (!rootDirectory || !fs.existsSync(rootDirectory))
        throw new Error('"rootDirectory" not specified or is invalid');

    // clean up path
    this.rootDirectory = path.resolve(rootDirectory);

    this.markedOptions = null;
}

/**
 * Returns MarkdownFile for given uriPath
 * @function
 * @param {string} uriPath - Path (relative to root) to Markdown file we want to obtain eg. "/subfolder/file". Note: Do not include ".md" extension.
 * @param {getCallback} callback
 *
 * @callback getCallback
 * @param {?Object} err - Errors if any
 * @param {MarkdownFile} result
 */
MarkdownServer.prototype.get = function(uriPath, callback) {
    var self = this;
    var file = resolver(uriPath, self.rootDirectory);

    if (!file) {
        return callback(new Error('No file found matching path: ' + uriPath));
    }

    return parser.parse(file, self.markedOptions, callback);
};
