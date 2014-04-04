var path = require('path'),
    resolver = require('./resolver'),
    parser = require('./parser'),
    fs = require('fs');


exports = module.exports = {
    MarkdownServer: MarkdownServer,

    middleware: function(options) {
        // TODO: check options

        var server = new MarkdownServer(options.rootDirectory);

        return function(req, res, next) {
        };
    }
};

function MarkdownServer(rootDirectory, markedOptions) {
    if (!rootDirectory || !fs.existsSync(rootDirectory))
        throw new Error('"rootDirectory" not specified or is invalid');

    // clean up path
    this.rootDirectory = path.resolve(rootDirectory);
    
    this.markedOptions = markedOptions;
}

MarkdownServer.prototype.get = function(uriPath, callback) {
    var self = this;
    var file = resolver(uriPath, self.rootDirectory);

    if (!file) {
        return callback(new Error('No file found matching path: ' + uriPath));
    }

    return parser.parse(file, self.markedOptions, callback);
};
