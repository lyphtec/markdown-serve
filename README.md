# markdown-serve

[![Build Status](https://travis-ci.org/lyphtec/markdown-serve.svg?branch=master)](https://travis-ci.org/lyphtec/markdown-serve)

Simple Markdown files server that can be used as an Express (connect) middleware or standalone.

## Overview

The idea is simple.  You specify a folder containing Markdown text files you want to make available.  The module will host these files and
provide URI-like navigation to specific files based on simple routing rules.

For example, assume you have the following folder containing some Markdown files:

```
/home/john/guide
   |---- index.md
   |---- about.md
   |---- walk-through/
             |---- index.md 
             |---- act-1-town-area.md
             |---- act-1-dungeon.md
```

By specifying `/home/john/guide` as the root directory, the module can resolve the following paths to the relevant file:

```
    /                             ---> /home/john/guide/index.md  (this is the "root" path)
    /about                        ---> /home/john/guide/about.md
    /walk-through/                ---> /home/john/guide/walk-through/index.md (note the trailing slash in the path)
    /walk-through/act-1-dungeon   ---> /home/john/guide/walk-through/act-1-dungeon.md

    Note that you don't need to specify the file extension (.md) in the path as this is already assumed.
```

The path [resolver](https://github.com/lyphtec/markdown-serve/blob/master/lib/resolver.js) is smart enough to handle spaces in sub folder /
file names. So, given this file `/home/john/guide/"cheat codes"/"open portal.md"`  (Quotes indicated here are actually not part of the
folder / file name, but just to highlight that they have spaces in the name).  The following paths all resolve to the same file:

```
    /cheat-codes/open-portal        (auto sluggification)
    /cheat%20codes/open%20portal    (URL encoding)
    /cheat codes/open portal
```

Note the auto "sluggification" - i.e. replacing spaces with dashes, allowing you to have clean URI navigation to the file.

The Markdown file can contain optional YAML front-matter (from start of file to first line starting with 3 dashes "---").  This is
compatible with files used in [Jekyll](http://jekyllrb.com), [Octopress](http://octopress.org), & [Hexo](http://hexo.io).  Any arbitrary
valid YAML tag can be specified here and will be available as a JavaScript object at the `markdownFile.meta` property.  You can use this to
specify things such as the title of the file, or whether it is published.


## API

The module exposes 2 main objects. [`MarkdownFile`](https://github.com/lyphtec/markdown-serve/blob/master/lib/parser.js#L68) & [`MarkdownServer`](https://github.com/lyphtec/markdown-serve/blob/master/lib/server.js#L57).

### MarkdownFile

Member | Type | Desc
--- | --- | ---
_file | property {string} | full path to original file
meta | property {Object} | YAML front-matter converted to a JavaScript object
rawContent | property {string} | raw Markdown content of file
_markedOptions | property {Object} | options to pass to marked module for Markdown parsing
stats | property {Object} | fs.Stats object containing properties of file
created | property {Date} | Date file created
modified | property {Date} | Date file modified
size | property {number} | Size in bytes of file
checksum | property {string} | SHA1 checksum of file contents (can be used as an ETag)
parseContent | method {takes callback} | parses rawContent & returns HTML (via marked module)
saveChanges | method {takes callback} | writes changes back to file on disk, overwriting existing file if it exists

This object is made available as `markdownFile` view model object to the view when used as a simple middleware.  It also returns as a result
of the call to `MarkdownServer.get()`.

Members with name starting with an underscore (_) are designed to be used internally.

Notice that the parsed Markdown content (HTML) is available as an additional step (call to parseContent() method), rather than as a string property
on the MarkdownFile object.  The reasoning behind this is sometimes to you do not need to get at the HTML content straight away and
need to apply some custom logic to specific front-matter variables 1st - eg. implementing a "draft publishing" feature.

### MarkdownServer

Member | Type | Desc
--- | --- | ---
rootDirectory | property {string} | Full path to root directory containing Markdown files to serve
markedOptions | property {Object} | Global marked module options for Markdown processing
get | method {takes path & callback args} | resolves & returns MarkdownFile for specified URI path


## Install

    $ npm install markdown-serve


## Usage

### As a simple middleware
    
```js
// example app.js

var express = require('express'),
    markdownServer = require('markdown-serve'),
    path = require('path');


var app = express();

app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

app.use(markdownServer.middleware({ 
    rootDirectory: path.resolve(__dirname, 'guides'),
    view: 'markdown'
}));


// example views/markdown.jade (as referenced by view parameter above):

extends layout

block content
    h1= markdownFile.meta.title
    #content
        != markdownFile.parseContent()
```

If no view is specified, the module will return a JSON response of the markdownFile object with HTML content available as the
`markdownFile.parsedContent` property.


### As a custom middleware

```js
// example app.js
var express = require('express'),
    markdown = require('./routes/markdown');

var app = express();

app.get('*', markdown.handler);
```

```js
// file routes/markdown.js

var server = require('markdown-serve');

exports.handler = function(req, res, next) {
    if (req.method !== 'GET') next();

    var markdownServer = new server.MarkdownServer( path.resolve(__dirname, 'guides') );

    markdownServer.get(req.path, function(err, result) {
        // result is a MarkdownFile instance

        if (err) {
            console.log(err);
            next();   // just log error & pass it to next middleware
            return;   // need return here because we are inside a callback
        }

        // apply some custom logic based on YAML front-matter variables
        if (result.meta && !result.meta.draft) {
            var view = result.meta.layout || 'default';

            res.render(view, { markdownFile: result });
        } else {
            // treat files with no front-matter / draft mode as non-existant
            next();
        }
    });
}
```

Sample markdown file at `guides/test.md`:

```markdown
title: My awesome guide
draft: false
published: 2014-04-01 12:40:00
layout: guide
---

# My awesome guide

This is some Markdown content for [guide](http://some.co/cat.jpg)

Bullets:

- One
- Two
- Three
```

```js
// file views/guide.jade

extends layout

block content
    h1= markdownFile.meta.title

    p.
        Published: #{markdownFile.meta.published}
        Created: #{markdownFile.created}
    
    #content!= markdownFile.parseContent()
```

Note in the above example, the Markdown file can dictate which view is used to render the content (via the "layout" variable in the
front-matter).

## Best Practices

- Stick with all lowercase sub-folder / file names. On case-sensitive OS'es (Linux/Mac) - the resolver uses exact folder / file name match with '.md' as file extension for Markdown files.
- Avoid spaces in sub-folder / file names.  The resolver can find the file quicker if it's an exact match.
- Be aware of trailing slashes in the path. This is treated as a sub-folder and actually looks for a file named "index.md" contained within it.

## Similar Projects

- [Hexo](http://hexo.io) - Blog framework / static site generator
- [express-markdown](https://github.com/JamesHight/express-markdown) - Very simple Express middleware for rendering Markdown files

## Useful Resources

- [Markdown cheatsheet](https://github.com/adam-p/markdown-here/wiki/Markdown-Cheatsheet)

## License

(The MIT License)

Copyright (c) 2014 Nguyen Ly

Permission is hereby granted, free of charge, to any person obtaining
a copy of this software and associated documentation files (the
'Software'), to deal in the Software without restriction, including
without limitation the rights to use, copy, modify, merge, publish,
distribute, sublicense, and/or sell copies of the Software, and to
permit persons to whom the Software is furnished to do so, subject to
the following conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
