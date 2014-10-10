/** 
 * @author Nguyen Ly <lyphtec@gmail.com>
 * @copyright Nguyen Ly 2014
 * @license MIT License
 *
 * @fileOverview Handles Markdown file parsing, extracting out the YAML front-matter and parsing the content converting to HTML
 * @module markdown-serve/parser
 * @requires fs
 * @requires js-yaml
 * @requires marked
 * @requires highlight.js
 * @requires lodash
 * @requires crypto
 * @requires path
 * @requires mkdirp
 * @exports markdown-serve/parser
 */

var fs = require('fs'),
    yaml = require('js-yaml'),
    marked = require('marked'),
    hl = require('highlight.js'),
    _ = require('lodash'),
    path = require('path'),
    mkdirp = require('mkdirp'),
    crypto = require('crypto');

exports = module.exports = {
    /** 
    * {@link MarkdownFile}
    * @this {MarkdownFile}
    */
    MarkdownFile : MarkdownFile,

    /**
     * [parse()]{@link module:markdown-serve/parser.parse} callback
     * @callback module:markdown-serve/parser~parseCallback
     * @alias parseCallback
     * @param {?Object} err Errors if any
     * @param {MarkdownFile} result
     */

    /**
     * Attempts to load a MarkdownFile
     * @function
     * @param {string} file Full path to file to load
     * @param {?Object=} markedOptions Optional options to pass to "marked" module for Markdown processing
     * @param {parseCallback} callback [parseCallback]{@link module:markdown-serve/parser~parseCallback}
     * @returns {MarkdownFile}
     */
    parse : function(file, markedOptions, callback) {
        var noOpts = false;

        // make 2nd arg optional
        if (arguments.length === 2 && _.isFunction(arguments[1])) {
            callback = arguments[1];
            noOpts = true;
        }

        fs.readFile(file, 'utf8', function(err, data) {
            if (err) {
                return callback(err);
            }

            var result = new MarkdownFile(file);
            result.checksum = checksum(data);
            result.stats = getStats(file);
            result.created = result.stats.ctime;
            result.modified = result.stats.mtime;
            result.size = result.stats.size;

            var content = data.replace(/^-{3}/, '').split('---');   // split on normalised (trimmed) "---" lines

            if (content.length === 1) {
                result.rawContent = content[0];
            } else {
                // if we cannot parse the YAML, we assume file has no front matter
                var meta = parseYml(content[0]);

                // does data have YAML front matter? : as "---" is a valid Markdown tag (ie. it's a <hr />)
                if (meta) {
                    result.meta = meta;

                    content.shift();    // strip out YAML front matter
                }

                result.rawContent = content.join('---').replace(/^\n*/, '');
            }

            result._markedOptions = noOpts ? null : markedOptions;

            return callback(null, result);
        });
    }
};

/**
 * Represents a Markdown file.
 *
 * This object cannot be instantiated directly, but is returned as a result of [MarkdownServer.get()]{@link MarkdownServer#get} or [MarkdownServer.save()]{@link MarkdownServer#save}. It
 * is also made available as the `markdownFile` view model object passed to view when used as a simple middleware.
 *
 * Members with name starting with an underscore (_) are designed to be used internally.
 *
 * In typical usage, the parsed Markdown content (HTML) is available as an additional step (call to [MarkdownFile.parseContent()]{@link MarkdownFile#parseContent}),
 * rather than as a string property on the object.  The reasoning behind this is for performance reasons, sometimes you do not need to get
 * at the HTML content straight away and need to apply some custom logic to specify front-matter variables ([MarkdownFile.meta]{@link MarkdownFile#meta})
 * first, eg. implementing a "draft publishing" feature.
 *
 * However, in some situations (eg. when using the [hbs]{@link https://github.com/donpark/hbs} view engine - the view doesn't support calling methods on the view model
 * object passed to it.  In this case, when used as a middleware, you can set the `preParse` option to true and the parsed HTML content will
 * be available as the [MarkdownFile.parseContent()]{@link MarkdownFile#parsedContent} string property.
 * 
 * @class
 * @alias MarkdownFile
 * @param {string} file Full path to file on the physical file system. File does not have to exist, as [MarkdownFile.saveChanges()]{@link MarkdownFile#saveChanges} can be called to create the file
 * @property {string} _file Gets the full path to file on the physical file system. Designed to be used internally & is set from the file parameter value when instantiated. NOTE: This property is deleted and not available when used in simple middleware scenario as exposing it could potentially be a security risk.
 * @property {?Object} meta Gets or sets the Javascript option that is serialized/de-serialized to/from the YAML front-matter in the file header.  If set, the property will be serialized to YAML when [MarkdownFile.saveChanges()]{@link MarkdownFile#saveChanges} is called.
 * @property {string} rawContent Gets or sets the raw Markdown text content of file
 * @property {?Object} _markedOptions Gets the options that is passed to the [marked]{@link https://github.com/chjj/marked} module used for Markdown processing.  This is a reference to [MarkdownServer.markedOptions]{@link MarkdownServer#markedOptions}.
 * @property {Object=} stats Gets the Node fs.Stats object containing properties of file
 * @property {Date=} created Gets the date file was created
 * @property {Date=} modified Gets the date file was last modified
 * @property {number=} size Gets the size in bytes of file
 * @property {string=} checksum Gets the SHA1 checksum of file contents (can be used as an ETag)
 * @property {string=} parsedContent Gets the result from [MarkdownFile.parseContent()]{@link MarkdownFile#parseContent}. This property is only made available when used
 * in the simple middleware scenario and when the `preParse` option is set to true.  It is also set when no `view` option is specified.
 */
function MarkdownFile(file) {
    if (!file) throw new Error('file is required');
    
    this._file = file;
    this.meta = null;
    this.rawContent = null;
    this._markedOptions = null;
}

/**
 * [MarkdownFile.parseContent()]{@link MarkdownFile#parseContent} callback
 * @callback MarkdownFile~parseContentCallback
 * @alias parseContentCallback
 * @param {?Object} err Errors if any
 * @param {string} result Converted HTML string
 */

/**
 * Parses [MarkdownFile.rawContent]{@link MarkdownFile#rawContent} & returns HTML
 * @param {parseContentCallback} callback [parseContentCallback]{@link MarkdownFile~parseContentCallback}
 * @returns {string} Converted HTML string
 */
MarkdownFile.prototype.parseContent = function(callback) {
    if (!this.rawContent) return callback(new Error('No rawContent to parse'));

    return parseMarkdown(this.rawContent, this._markedOptions, callback);
};

/**
 * [MarkdownFile.saveChanges()]{@link MarkdownFile#saveChanges} method callback
 * @callback MarkdownFile~saveChangesCallback
 * @alias saveChangesCallback
 * @param {?Object} err Errors if any
 * @param {boolean} result Success indicator
 */

/**
 * Writes changes back to file on disk, overwriting existing file if it exists
 * @param {saveChangesCallback} callback [saveChangesCallback]{@link MarkdownFile~saveChangesCallback}
 * @returns {boolean} Success indicator
 */
MarkdownFile.prototype.saveChanges = function(callback) {
    // create containing folder if it doesn't exist
    var dir = path.dirname(this._file);
    if (!fs.existsSync(dir))
        mkdirp.sync(dir);

    var s = '';

    if (this.meta) {
        s = yaml.safeDump(this.meta);
        s += '---\n\n';
    }

    s += this.rawContent;

    fs.writeFile(this._file, s, function(err) {
        if (err) return callback(err);

        return callback(null, true);
    });
};


//
// Privates
//

function getStats(file) {
    return fs.statSync(file);
}

function parseYml(data) {
    if (!data) return null;

    try {
        return yaml.safeLoad(data);
    } catch (e) {
        // Log this somewhere?
        // console.log(e);
    }

    return null;
}

function parseMarkdown(source, options, callback) {
    if (options) {
        marked.setOptions(options);    
    } else {
        // this seems to be the default - but we are setting it here explicitly
        marked.setOptions({
            highlight: function(code) {
                return hl.highlightAuto(code).value;
            }
        });
    }

    return marked(source, callback);
}

function checksum(str, algorithm, encoding) {
    return crypto
        .createHash(algorithm || 'sha1')
        .update(str, 'utf8')
        .digest(encoding || 'hex');
}
