# markdown-serve

[![Gitter](https://badges.gitter.im/Join%20Chat.svg)](https://gitter.im/lyphtec/markdown-serve?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge&utm_content=badge)

Simple Markdown files server that can be used as an Express middleware or standalone.

[![NPM Version](https://img.shields.io/npm/v/markdown-serve.svg?style=flat)](https://www.npmjs.org/package/markdown-serve)
[![Build Status](https://img.shields.io/travis/lyphtec/markdown-serve.svg?style=flat)](https://travis-ci.org/lyphtec/markdown-serve)


## Overview

The idea is simple.  You specify a folder containing Markdown text files you want to make available.  The module will host these files and
provide URI-like navigation to specific files based on simple routing rules.

For example, assume you have the following folder containing some Markdown files:

    /home/john/guide
    |---- index.md
    |---- about.md
    |---- walk-through/
                |---- index.md 
                |---- act-1-town-area.md
                |---- act-1-dungeon.md

By specifying `/home/john/guide` as the root directory, the module can resolve the following paths to the relevant file:

    /                             ---> /home/john/guide/index.md  (this is the "root" path)
    /about                        ---> /home/john/guide/about.md
    /walk-through/                ---> /home/john/guide/walk-through/index.md (note the trailing slash in the path)
    /walk-through/act-1-dungeon   ---> /home/john/guide/walk-through/act-1-dungeon.md

    Note that you don't need to specify the file extension (.md) in the path as this is already assumed.

The path [resolver](https://github.com/lyphtec/markdown-serve/blob/master/lib/resolver.js) is smart enough to handle spaces in sub folder /
file names. So, given this file `/home/john/guide/"cheat codes"/"open portal.md"`  (Quotes indicated here are actually not part of the
folder / file name, but just to highlight that they have spaces in the name).  The following paths all resolve to the same file:

    /cheat-codes/open-portal        (auto sluggification)
    /cheat%20codes/open%20portal    (URL encoding)
    /cheat codes/open portal

Note the auto "sluggification" - i.e. replacing spaces with dashes, allowing you to have clean URI navigation to the file.

The Markdown file can contain optional YAML front-matter (from start of file to first line starting with 3 dashes "---").  This is
compatible with files used in [Jekyll](http://jekyllrb.com), [Octopress](http://octopress.org), & [Hexo](http://hexo.io).  Any arbitrary
valid YAML tag can be specified here and will be available as a JavaScript object at the `markdownFile.meta` property.  You can use this to
specify things such as the title of the file, or whether it is published.

### Usage Scenario

When would you use this module or how is it different to Jekyll, Octopress, or Hexo?

In principle, the Markdown source files used by all of these frameworks and *markdown-serve* are cross compatible. However, these frameworks are
static site generators. A process has to be run each time a source file is updated, new files added, or the site requires style changes to re-create the updated site. *markdown-serve* on the other hand brings together
the flexiblity of having static source Markdown content files, but the serving of these files are dynamic as they are hosted in a Node
Express server.  Source content can be updated, new files added etc, and the changes will be instantly available on the website without requiring
any re-generation process to run.

It is ideally suited for any small to medium websites where a full blown CMS is not required.  It can be used to build mini CMS like sites
(ala WordPress), blogs, or integrated into a larger Node Express application.

For example, with a personal blog website, if you have full control over the hosting environment, you can use cloud storage services like DropBox to contain your source Markdown content files.  On the hosting server,
you would have the DropBox daemon running to sync with your content folder, and serve up the content with *markdown-serve* running in an
Express app. Then, regardless of which platform or device you are on, you can very easily update your website by just editing files in
DropBox!

## Install

    $ npm install markdown-serve


## API

See [API documentation](http://lyphtec.github.io/markdown-serve)

## Usage

### As a simple middleware
    
```js
// example app.js

var express = require('express'),
    mds = require('markdown-serve'),
    path = require('path');


var app = express();

app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

app.use(mds.middleware({ 
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

If no view and handler are specified, the module will return a JSON response of the `MarkdownFile` object with HTML content available as the
`markdownFile.parsedContent` property.

The `preParse` option can also be set when using a view to make the HTML content available as the `markdownFile.parsedContent`
property. This is to support some view engines like [hbs](https://github.com/donpark/hbs), as it doesn't support calling the
`parseContent()` method in the view.

```js
// pre-parse for use with hbs view engine
app.set('view engine', 'hbs');

app.use(mds.middleware({ 
    rootDirectory: path.resolve(__dirname, 'guides'),
    view: 'markdown',
    preParse: true    // setting this will parse the content and make it available as `markdownFile.parsedContent` without needing to call `parseContent()` in the view
}));

// views/markdown.hbs
<div class="container">
    <h1>{{mardownFile.meta.title}}</h1>

    {{{markdownFile.parsedContent}}}

    <footer>
        <hr />
        <strong>Created:</strong> {{markdownFile.created}}
    </footer>
</div>
```

The `preParse` option can also be specified as a function. In this case, the return object from the function will be passed directly as a
view model to the view.

```js
// preParse option specified as a function
app.use(mds.middleware({
    rootDirectory: path.resolve(__dirname, 'guides'),
    view: 'markdown',
    preParse: function(markdownFile) {
        return { title: markdownFile.meta.title, content: markdownFile.parseContent(), created: moment(markdownFile.created).format('L') };
    }
}));

// views/markdown.hbs - bind directly to properties on returned object
<div class="container">
   <h1>{{title}}</h1>

   {{{content}}}

   <footer>
       <hr />
       <strong>Created:</strong> {{created}}
   </footer>
</div>
```
If you want full customization of the middleware behaviour, specify a `handler` function. Note that to use this option, do not specify the
`view` option as that will take precedence.

```js
// custom handler
app.use(mds.middleware({
   rootDirectory: path.resolve(__dirname, 'content'),
   handler: function(markdownFile, req, res, next) {
       if (req.method !== 'GET') next();

       // limit access based on draft variable in front-matter
       if (markdownFile.meta.draft && !req.isAuthenticated && !req.user.isAdmin) {
           next();
           return;   // need return here
       }        

       res.render('markdown', { title: markdownFile.meta.title, content: markdownFile.parseContent() });
   }
}));
```

### As a custom middleware

For ultimate control, define your own middleware handler.

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

## More Samples

- [See here](https://github.com/lyphtec/markdown-serve-examples)

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
