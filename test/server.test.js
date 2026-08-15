var server = require('../lib/server.js'),
    should = require('chai').should(),
    express = require('express'),
    request= require('supertest'),
    fs = require('fs'),
    rimraf = require('rimraf'),
    path = require('path');


var ROOT_DIR = path.resolve(__dirname, 'fixture');

describe('MarkdownServer', function() {

    var s = new server.MarkdownServer(ROOT_DIR);

    describe('get()', function() {

        it('"/test" succeeds', function(done) {
            s.get('/test', function(err, result) {
                result.should.be.ok;
                should.exist(result.meta);
                should.exist(result.rawContent);
                done();
            });
        });

        it('"/foo-bar" should have error for path not found', function(done) {
            s.get('/foo-bar', function(err, result) {
                should.exist(err);

                done();
            });
        });

        it('should still expose _file & stats when used directly', function(done) {
            // only the middleware strips these -- the direct API keeps them
            s.get('/test', function(err, result) {
                should.exist(result._file);
                should.exist(result.stats);

                done();
            });
        });

    });

    describe('save()', function() {
        var rawContent = '# Some heading\n\n' +
                         'bullets: \n\n' +
                         '- uno\n' +
                         '- duos\n' +
                         '- tres\n\n\n' +
                         '[link](http://www.google.com)';

        describe('new file', function() {
            var file = path.resolve(__dirname, 'fixture/server-new.md');
            var dir = path.resolve(__dirname, 'fixture/new');

            beforeEach(function(done) {
                fs.unlink(file, function(err) {
                    rimraf(dir, function(err) {
                        done();
                    });
                });
            });

            it('with meta succeeds', function(done) {
                s.save('/server-new', rawContent, { title: 'Hello', draft: true }, function(err, result) {
                    should.not.exist(err);
                    result.should.be.ok;
                    should.exist(result.meta);
                    result.meta.draft.should.be.true;
                    result.parseContent().should.have.string('<li>duos</li>');

                    done();
                });
            });

            it('with no meta succeeds', function(done) {
                s.save('/server-new', rawContent, function(err, result) {
                    should.not.exist(err);
                    result.should.be.ok;
                    should.not.exist(result.meta);
                    result.parseContent().should.have.string('<li>duos</li>');

                    done();
                });
            });

            it('with no rawContent fails', function(done) {
                s.save('/server-new', null, function(err, result) {
                    should.exist(err);

                    done();
                });
            });

            it ('in sub-folder with meta succeeds', function(done) {
                s.save('/new/blah/test', rawContent, { title: 'Yo', draft: false }, function(err, result) {
                    should.not.exist(err);
                    result.should.be.ok;
                    should.exist(result.meta);
                    result.meta.draft.should.be.false;
                    result.meta.title.should.equal('Yo');
                    result.parseContent().should.have.string('<li>duos</li>');
                    result._file.should.equal( path.resolve(ROOT_DIR, 'new/blah/test.md') );

                    done();
                });
            });

            it ('in sub-folder with default document name succeeds', function(done) {
                s.save('/new/blah/', rawContent, function(err, result) {
                    should.not.exist(err);
                    result.should.be.ok;
                    result.parseContent().should.have.string('<li>duos</li>');
                    result._file.should.equal( path.resolve(ROOT_DIR, 'new/blah/index.md') );

                    done();
                });
            });

        });   // new file


        describe('directory traversal', function() {
            var escaped = path.resolve(__dirname, 'escaped-by-traversal.md');

            after(function(done) {
                fs.unlink(escaped, function(err) {
                    done();
                });
            });

            it('should not write outside rootDirectory', function(done) {
                s.save('/../escaped-by-traversal', rawContent, function(err, result) {
                    should.exist(err);
                    fs.existsSync(escaped).should.be.false;

                    done();
                });
            });

            it('should not write outside rootDirectory via a sub-folder path', function(done) {
                s.save('/sub/../../escaped-by-traversal', rawContent, function(err, result) {
                    should.exist(err);
                    fs.existsSync(escaped).should.be.false;

                    done();
                });
            });
        });

        describe('useExtensionInUrl', function() {
            // writes go into fixture/new/, which is gitignored & removed below
            var dir = path.resolve(__dirname, 'fixture/new');

            var e = new server.MarkdownServer(ROOT_DIR);
            e.resolverOptions = { defaultPageName: 'index', fileExtension: 'md', useExtensionInUrl: true };

            beforeEach(function(done) {
                rimraf(dir, function(err) {
                    done();
                });
            });

            after(function(done) {
                rimraf(dir, function(err) {
                    done();
                });
            });

            it('should not double the extension when the path carries it', function(done) {
                e.save('/new/with-ext.md', rawContent, function(err, result) {
                    should.not.exist(err);
                    result._file.should.equal( path.resolve(ROOT_DIR, 'new/with-ext.md') );
                    fs.existsSync( path.resolve(ROOT_DIR, 'new/with-ext.md.md') ).should.be.false;

                    done();
                });
            });

            it('should be readable back through get()', function(done) {
                e.save('/new/round-trip.md', rawContent, function(err, saved) {
                    should.not.exist(err);

                    e.get('/new/round-trip.md', function(err, result) {
                        should.not.exist(err);
                        result.parseContent().should.have.string('<li>duos</li>');

                        done();
                    });
                });
            });

            it('should still add the extension to a synthesised default page name', function(done) {
                e.save('/new/blah/', rawContent, function(err, result) {
                    should.not.exist(err);
                    result._file.should.equal( path.resolve(ROOT_DIR, 'new/blah/index.md') );

                    done();
                });
            });
        });

        describe('update', function() {
            var file = path.resolve(__dirname, 'fixture/server-update.md');

            before(function(done) {
                fs.unlink(file, function(err) {
                    fs.copyFile(path.resolve(__dirname, 'fixture/test.md'), file, function(err) {
                        done();
                    });
                });
            });

            it('with meta succeeds', function(done) {
                s.get('/server-update', function(err, result) {
                    var content = result.rawContent + '\n\n1. p1\n1. p2\n\n\n';
                    result.meta.draft = true;
                    result.meta.title = 'Updated';

                    s.save('/server-update', content, result.meta, function(err, updated) {
                        should.not.exist(err);
                        updated.should.be.ok;
                        updated.meta.draft.should.be.true;
                        updated.meta.title.should.equal('Updated');
                        updated.parseContent().should.have.string('<li>p2</li>');

                        done();
                    });
                });
            });

        });

    });

});

describe('middleware()', function() {

    it('should throw error if no options arg', function() {
        // see https://github.com/chaijs/chai/issues/71
        (function() {
            server.middleware();
        }).should.throw(Error);
    });

    it('should throw error if no options.rootDirectory value', function() {
        (function() {
            server.middleware({});
        }).should.throw(Error);
    });

    it('should return JSON result if no view specified', function(done) {
        var app = express();

        app.use(server.middleware({ rootDirectory: ROOT_DIR }));

        request(app)
            .get('/test')
            .expect('Content-Type', /json/)
            .expect(200)
            .end(function(err, res) {
                if (err) return done(err);

                var result = res.body;

                result.should.be.ok;
                result.parsedContent.should.be.ok;
                result.meta.should.be.ok;
                should.not.exist(result._file);

                done();
            });
    });

    it('should return view with view model if ok', function(done) {
        var app = express();

        app.set('views', path.join(__dirname, 'views'));
        app.set('view engine', 'pug');

        app.use(server.middleware({
            rootDirectory: ROOT_DIR,
            view: 'markdown'
        }));

        request(app)
            .get('/test')
            .expect('Content-Type', /html/)
            .expect(200)
            .expect(/\<li\>Moe\<\/li\>/, done);
    });

    it('should have parsedContent if preParse option is true', function(done) {
        var app = express();

        app.set('views', path.join(__dirname, 'views'));
        app.set('view engine', 'pug');

        app.use(server.middleware({
            rootDirectory: ROOT_DIR,
            view: 'markdown-preparse',
            preParse: true
        }));

        request(app)
            .get('/test')
            .expect('Content-Type', /html/)
            .expect(200)
            .expect(/\<li\>Moe\<\/li\>/, done);
    });


    it('should have custom view model if preParse option is a function', function(done) {
        var app = express();

        app.set('views', path.join(__dirname, 'views'));
        app.set('view engine', 'pug');

        app.use(server.middleware({
            rootDirectory: ROOT_DIR,
            view: 'markdown-custom',
            preParse: function(markdownFile) {
                return { title: markdownFile.meta.title, content: markdownFile.parseContent() };
            }
        }));

        request(app)
            .get('/test')
            .expect('Content-Type', /html/)
            .expect(200)
            .expect(/\<h1\>Hello World\<\/h1\>/)
            .expect(/\<li\>Moe\<\/li\>/, done);
    });

    it('should call handler if specified', function(done) {
        var app = express();

        app.set('views', path.join(__dirname, 'views'));
        app.set('view engine', 'pug');

        app.use(server.middleware({
            rootDirectory: ROOT_DIR,
            handler: function(markdownFile, req, res, next) {

                should.not.exist(markdownFile._file);
                markdownFile.meta.should.be.ok;

                res.render('markdown', { markdownFile: markdownFile });
            }
        }));

        request(app)
            .get('/test')
            .expect('Content-Type', /html/)
            .expect(200)
            .expect(/\<h1\>Hello World\<\/h1\>/)
            .expect(/\<li\>Moe\<\/li\>/, done);
    });

    it('should next() if path not found', function(done) {
        var app = express();

        app.use(server.middleware({ rootDirectory: ROOT_DIR }));

        request(app)
            .get('/foo-bar')
            .expect(404, done);
    });

  it('should call optional logger if path not found', function(done) {
    var app = express();

    // Simple logger mock
    var logger = {
      called: false,
      log: function() {
        this.called = true;
      }
    };

    app.use(server.middleware({
      rootDirectory: ROOT_DIR,
      logger: logger
    }));

    request(app)
      .get('/foo-bar')
      .expect(404)
      .expect(logger.called === true)
      .end(function() {
          return done();
      });
  });

    it('should next() rather than serve a file outside rootDirectory', function(done) {
        var app = express();

        app.use(server.middleware({ rootDirectory: ROOT_DIR }));

        // req.path keeps the escapes, so the decode -- and the traversal -- happens in the resolver
        request(app)
            .get('/%2e%2e%2f%2e%2e%2fREADME')
            .expect(404, done);
    });

    it('should not expose fs.Stats in the JSON response', function(done) {
        var app = express();

        app.use(server.middleware({ rootDirectory: ROOT_DIR }));

        request(app)
            .get('/test')
            .expect(200)
            .end(function(err, res) {
                if (err) return done(err);

                var result = res.body;

                // fs.Stats carries uid / gid / ino / dev / mode
                should.not.exist(result.stats);

                // ...but the useful values must survive
                should.exist(result.created);
                should.exist(result.modified);
                should.exist(result.size);

                done();
            });
    });

    it('should not expose fs.Stats to a handler', function(done) {
        var app = express();

        app.set('views', path.join(__dirname, 'views'));
        app.set('view engine', 'pug');

        app.use(server.middleware({
            rootDirectory: ROOT_DIR,
            handler: function(markdownFile, req, res, next) {
                should.not.exist(markdownFile.stats);
                should.exist(markdownFile.modified);

                res.render('markdown', { markdownFile: markdownFile });
            }
        }));

        request(app)
            .get('/test')
            .expect(200, done);
    });

    it('should next() rather than error on a malformed percent-escape', function(done) {
        var app = express();

        app.use(server.middleware({ rootDirectory: ROOT_DIR }));

        // decodeURIComponent throws on this -- must be a 404, not a 500
        request(app)
            .get('/foo%')
            .expect(404, done);
    });

    it('should not crash on an empty markdown file', function(done) {
        var app = express();

        app.use(server.middleware({ rootDirectory: ROOT_DIR }));

        request(app)
            .get('/empty-file')
            .expect(200)
            .end(function(err, res) {
                if (err) return done(err);

                res.body.parsedContent.should.equal('');

                done();
            });
    });

    it('should not send errors to a logger belonging to another middleware instance', function(done) {
        var otherLogger = {
            called: false,
            log: function() {
                this.called = true;
            }
        };

        // instance configured with a logger...
        server.middleware({ rootDirectory: ROOT_DIR, logger: otherLogger });

        // ...must not capture the errors of this separate instance, which has no logger
        var app = express();
        app.use(server.middleware({ rootDirectory: ROOT_DIR }));

        request(app)
            .get('/foo-bar')
            .expect(404)
            .end(function(err, res) {
                if (err) return done(err);

                otherLogger.called.should.be.false;

                done();
            });
    });

    it('should next() if method is POST', function(done) {
        var app = express();

        app.use(server.middleware({ rootDirectory: ROOT_DIR }));

        request(app)
            .post('/test')
            .expect(404)
            .end(function(err, res) {
                if (err) return done(err);
                done();
            });
    });
});
