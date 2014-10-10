/** 
 * @author Nguyen Ly <lyphtec@gmail.com>
 * @copyright Nguyen Ly 2014
 * @license MIT License
 *
 * @fileOverview Main object exported by module. Can be used to instantiate a new {@link MarkdownServer} instance or invoked as a [middleware]{@link module:markdown-serve.middleware} function in Express.
 * @module markdown-serve
 * @requires path
 * @requires lodash
 * @requires mkdirp
 * @requires fs
 * @requires markdown-serve/parser
 * @requires markdown-serve/resolver
 * @exports markdown-serve
 */

var path = require('path'),
    resolver = require('./resolver'),
    parser = require('./parser'),
    _ = require('lodash'),
    mkdirp = require('mkdirp'),
    fs = require('fs');

exports = module.exports = {
    /** 
    * {@link MarkdownServer}
    * @this {MarkdownServer}
    * */
    MarkdownServer: MarkdownServer,

    /**
     * preParse function option used for customizing the view model object that is passed to the view
     * @typedef {function(MarkdownFile):Object} module:markdown-serve~preParseFn
     * @alias preParseFn
     * @param {MarkdownFile} markdownFile Resolved {@link MarkdownFile} instance from `req.path` passed to middleware
     * @returns {Object} Object literal to pass as view model to view
     * @example
     * // preParse is specified as a function
     * app.use(mds.middleware({
     *    rootDirectory: path.resolve(__dirname, 'content'),
     *    view: 'markdown',
     *    preParse: function(markdownFile) {
     *        return { title: markdownFile.meta.title, content: markdownFile.parseContent(), created: moment(markdownFile.created).format('L') };
     *    }
     * }));
     * 
     * // views/markdown.hbs
     * <div class="container">
     *    <h1>{{title}}</h1>
     * 
     *    {{{content}}}
     *
     *    <footer>
     *        <hr />
     *        <strong>Created:</strong> {{created}}
     *    </footer>
     * </div>
     */

    /**
     * Customized middleware handler function option. Do not specify `options.view` if using this feature.
     * @typedef {function(MarkdownFile, req, res, next)} module:markdown-serve~handlerFn
     * @alias handlerFn
     * @param {MarkdownFile} markdownFile Resolved {@link MarkdownFile} instance from `req.path` passed to middleware
     * @param {Object} req Express Request object
     * @param {Object} res Express Response object
     * @param {function} next Express next() function
     * @example
     * // custom handler
     * app.use(mds.middleware({
     *    rootDirectory: path.resolve(__dirname, 'content'),
     *    handler: function(markdownFile, req, res, next) {
     *        if (req.method !== 'GET') next();
     *
     *        // limit access based on draft variable in front-matter
     *        if (markdownFile.meta.draft && !req.isAuthenticated && !req.user.isAdmin) {
     *            next();
     *            return;   // need return here
     *        }        
     *
     *        res.render('markdown', { title: markdownFile.meta.title, content: markdownFile.parseContent() });
     *    }
     * }));
     */

    /**
     * Simple Express middleware that hosts a {@link MarkdownServer}
     * @function
     * @param {Object} options Middleware options
     * @param {string} options.rootDirectory Full path to root physical directory containing Markdown files to serve
     * @param {Object=} options.markedOptions Global marked module options for Markdown processing
     * @param {resolverOptions=} options.resolverOptions [Options]{@link MarkdownServer~resolverOptions} to override default document name and Markdown file extension.
     * If not specified, will default to `index` and `md` resppectively.
     * @param {string=} options.view Name of view to use for rendering content. If this property & `handler` are not specified, a JSON respresentation of
     * {@link MarkdownFile} will be returned by the middleware.
     * @param {(boolean|preParseFn)=} options.preParse  Only applies when `view` is specified. If set to true (not truthy), will
     * make the parsed HTML content available as `markdownFile.parsedContent` on the view model object passed to the view. This is to
     * support some view engines like `hbs` that do not support calling methods directly on the view model.
     *
     * If specified as a [preParseFn]{@link module:markdown-serve~preParseFn} function, will return the function result as the view model object to the view.
     * @param {handlerFn=} options.handler [handlerFn]{@link module:markdown-serve~handlerFn}. Provides full customization of middleware response. Make sure `view` is not
     * set when using this feature as that takes precedence.
     *
     * @example
     * // basic usage
     * // app.js
     * var express = require('express'),
     *     path = require('path'),
     *     mds = require('markdown-serve');
     *
     * var app = express();
     *
     * app.set('view', path.join(__dirname, 'views'));
     * app.set('view engine', 'jade');
     *
     * app.use(mds.middleware({
     *    rootDirectory: path.resolve(__dirname, 'content'),
     *    view: 'markdown'    // will use views/markdown.jade file for rendering out HTML content
     * }));
     *
     * // views/markdown.jade
     * extend layout
     *
     * block content
     *    header
     *      h1= markdownFile.meta.title
     *
     *    .content
     *      != markdownFile.parseContent()
     *
     *    footer
     *      hr
     *      | <strong>Created:</strong> #{markdownFile.created} <br/>
     *
     * @example
     * // preParse set to true when using hbs view engine
     * // as calling markdownFile.parseContent() is not supported, the HTML content is pre-parsed and available as markdownFile.parsedContent
     * app.set('view engine', 'hbs');
     *
     * app.use(mds.middleware({
     *    rootDirectory: path.resolve(__dirname, 'content'),
     *    view: 'markdown',
     *    preParse: true
     * }));
     *
     * // views/markdown.hbs
     * <div class="container">
     *    <h1>{{markdownFile.meta.title}}</h1>
     * 
     *    {{{markdownFile.parsedContent}}}
     *
     *    <footer>
     *        <hr />
     *        <strong>Created:</strong> {{markdownFile.created}}
     *    </footer>
     * </div>
     */
    middleware: function(options) {
        if (!options)
            throw new Error('"options" argument is required');

        if (!options.rootDirectory)
            throw new Error('"rootDirectory" value is required');

        var server = new MarkdownServer(options.rootDirectory);

        if (options.markedOptions)
            server.markedOptions = options.markedOptions;

        if (options.resolverOptions)
            server.resolverOptions = options.resolverOptions;

        return function(req, res, next) {
            if (req.method !== 'GET' && !options.handler) next();

            server.get(req.path, function(err, result) {
                if (err) {
                    console.log(err);
                    next();
                    return;   // need return here because next call (above) is inside a callback
                }

                // remove _file property as this is potentially a security risk
                delete result._file;

                if (options.view) {
                    if (options.preParse && _.isBoolean(options.preParse) && options.preParse === true) {
                        result.parsedContent = result.parseContent();
                        res.render(options.view, { markdownFile: result });
                        return;
                    } 
                    
                    if (options.preParse && _.isFunction(options.preParse)) {
                        var vm = options.preParse(result);
                        res.render(options.view, vm);
                        return;
                    }

                    res.render(options.view, { markdownFile: result });
                    return;
                }

                if (options.handler && _.isFunction(options.handler)) {
                    return options.handler(result, req, res, next);
                }

                // default fallback is to send a JSON response of the MarkdownFile object
                result.parsedContent = result.parseContent();
                res.send(result);
            });
        };
    }
};

/**
 * Options to pass to the resolver indicating default document name and Markdown file extension
 * @typedef {Object} MarkdownServer~resolverOptions
 * @alias resolverOptions
 * @property {string=} [defaultPagename=index] Name of default document
 * @property {string=} [fileExtension=md] File extension of Markdown files
 */

/**
 * Create an instance of a Markdown files server. Can be instantiated from the module, and is mainly used in custom middleware scenarios.
 * @class
 * @alias MarkdownServer
 * @param {string} rootDirectory Full path to root directory containing Markdown files to serve
 * @property {string} rootDirectory Gets or sets the full path to root directory containing Markdown files to server. Set to same as rootDirectory parameter when class is instantiated.
 * @property {?Object} markedOptions Gets or sets optional global [marked]{@link https://github.com/chjj/marked} module options used for Markdown processing
 * @property {?resolverOptions} resolverOptions [resolverOptions]{@link MarkdownServer~resolverOptions}. Gets or sets optional global options used by the resolver to configure default page name and file extension of Markdown files.
 *
 * @example
 * var path = require('path'),
 *     mds = require('markdown-serve');
 *
 * // Instantiate a new instance of MarkdownServer
 * var server = new mds.MarkdownServer( path.resolve(__dirname, 'content') );
 */
function MarkdownServer(rootDirectory) {
    if (!rootDirectory || !fs.existsSync(rootDirectory))
        throw new Error('"rootDirectory" not specified or is invalid');

    // clean up path
    this.rootDirectory = path.resolve(rootDirectory);

    this.markedOptions = null;
    this.resolverOptions = {
        defaultPageName: 'index',   // name of default document in each sub folder
        fileExtension: 'md'
    };
}

/**
 * [MarkdownServer.get()]{@link MarkdownServer#get} callback
 * @callback MarkdownServer~getCallback
 * @alias getCallback
 * @param {?Object} err Errors if any
 * @param {MarkdownFile} result
 */

/**
 * Resolves & returns {@link MarkdownFile} for specified URI path.
 * @function
 * @param {string} uriPath Path (relative to root) with leading / (slash) to Markdown file we want to obtain eg. "/subfolder/file". Note: Do not include ".md" extension.
 * @param {getCallback} callback [getCallback]{@link MarkdownServer~getCallback}
 * @returns {MarkdownFile}
 *
 * @example
 * var server = new mds.MarkdownServer( path.resolve(__dirname, 'content') );
 *
 * server.get('/intro', function(err, result) {
 *    if (err) return err;
 *
 *    // result == MarkdownFile instance
 *    console.log(result.parseContent());   // the parsed HTML result
 * });
 */
MarkdownServer.prototype.get = function(uriPath, callback) {
    var self = this;
    var file = resolver(uriPath, self.rootDirectory, self.resolverOptions);

    if (!file) {
        return callback(new Error('No file found matching path: ' + uriPath));
    }

    return parser.parse(file, self.markedOptions, callback);
};

/**
 * [MarkdownServer.save()]{@link MarkdownServer#save} callback
 * @callback MarkdownServer~saveCallback
 * @alias saveCallback
 * @param {?Object} err Errors if any, otherwise null
 * @param {MarkdownFile} result Saved file returned as a {@link MarkdownFile} object
 */

/**
 * Saves MarkdownFile for given uriPath
 * @function
 * @param {string} uriPath Path (relative to root) with leading / (slash) to Markdown file we want to save eg. "/subfolder/file". Will overwrite existing file or create new file if it doesn't exist. Note: Do not include ".md" extension.
 * @param {string} rawContent Markdown text content to save
 * @param {?Object=} meta Optional Javascript object to serialize as YAML front-matter and saved in file header
 * @param {saveCallback} callback [saveCallback]{@link MarkdownServer~saveCallback}
 * @returns {MarkdownFile}
 *
 * @example
 * var mdContent = '# Heading\n\n' +
 *                 'Bullets:\n\n' +
 *                 '- one\n' +
 *                 '- two\n' +
 *                 '- three\nn';
 *
 * // will create any subfolders in hierarchy if it doesn't exist
 * server.save('/subfolder/new', mdContent, { title: 'New file', draft: true }, function(err, result) {
 *    if (err) return err;
 *
 *    // result == MarkdownFile instance
 *    console.log(result.parseContent());
 * });
 */
MarkdownServer.prototype.save = function(uriPath, rawContent, meta, callback) {
    var self = this;

    // make "meta" param optional
    var hasMeta = true;
    if (arguments.length === 3 && _.isFunction(arguments[2])) {
        callback = arguments[2];
        hasMeta = false;
    }

    if (!rawContent)
        return callback(new Error('rawContent is required'));

    if (!_.isString(rawContent))
        return callback(new Error('rawContent must be a string'));


    var file = resolver(uriPath, self.rootDirectory, self.resolverOptions);

    if (!file) {
        var ext = (self.resolverOptions && self.resolverOptions.fileExtension) ? self.resolverOptions.fileExtension : '.md';
        if (ext.indexOf('.') !== 0)
            ext = '.' + ext;

        var defPageName = (self.resolverOptions && self.resolverOptions.defaultPageName) ? self.resolverOptions.defaultPageName : 'index';

        // append default page name to trailing slashes
        if (uriPath.match(/\/$/))
            uriPath += defPageName;

        file = path.join(self.rootDirectory, uriPath + ext);
    }

    var dir = path.dirname(file);
    if (!fs.existsSync(dir))
        mkdirp.sync(dir);

    var mdFile = new parser.MarkdownFile(file);

    if (hasMeta && meta)
        mdFile.meta = meta;

    mdFile.rawContent = rawContent;

    mdFile.saveChanges(function(err, success) {
        if (err) return callback(err);

        return self.get(uriPath, callback);
    });
};
