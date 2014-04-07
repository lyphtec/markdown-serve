var fs = require('fs'),
    yaml = require('js-yaml'),
    marked = require('marked'),
    hl = require('highlight.js'),
    _ = require('lodash'),
    crypto = require('crypto');

exports = module.exports = {
    MarkdownFile : MarkdownFile,

    /**
     * Attempts to load a MarkdownFile
     * @function
     * @param {string} file - Full path to file to load
     * @param {Object} [markedOptions] - (Optional) options to pass to "marked" module for Markdown processing
     * @param {parseCallback} callback
     *
     * @callback parseCallback
     * @param {?Object} err - Errors if exist
     * @param {MarkdownFile} result
     */
    parse : function(file, markedOptions, callback) {
        var noOpts = false;

        // make 2nd arg optional
        if (arguments.length == 2 && _.isFunction(arguments[1])) {
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

            result.markedOptions = noOpts ? null : markedOptions;

            return callback(null, result);
        });
    }
};

/**
 * Represents a Markdown file
 * @class
 * @param {string} file - Full path to file
 * @property {string} file - Full path to file
 * @property {?Object} meta - De-serialized YAML front-matter as a JavaScript object if file has this data
 * @property {string} rawContent - Raw Markdown content contained in file
 * @property {?Object} markedOptions - marked module options for Markdown processing
 * @property {?Object} stats - Node fs.Stats object containing properties of file
 * @property {?Date} created - Date file was created
 * @property {?Date} modified - Date file last modified
 * @property {?number} size - Size in bytes of file
 * @property {?string} checksum - SHA1 checksum of file contents
 */
function MarkdownFile(file) {
    this._file = file;
    this.meta = null;
    this.rawContent = null;
    this.markedOptions = null;
}

/**
 * Returns HTML converted from Markdown (rawContent)
 * @param {parseContentCallback} callback - A callback to invoke
 *
 * @callback parseContentCallback
 * @param {?Object} err - Errors if applicable
 * @param {string} result - Converted HTML string
 */
MarkdownFile.prototype.parseContent = function(callback) {
    if (!this.rawContent) return callback(new Error('No rawContent to parse'));

    return parseMarkdown(this.rawContent, this.markedOptions, callback);
};

/**
 * writes changes back to file on disk, overwriting existing file if it exists
 * @param {saveChangesCallback} callback
 *
 * @callback saveChangesCallback
 * @param {?Object} err - Errors if exist
 * @param {boolean} result - Success indicator
 */
MarkdownFile.prototype.saveChanges = function(callback) {
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
        return yaml.safeLoad(data)
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
