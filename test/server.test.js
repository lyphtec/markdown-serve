var server = require('../lib/server.js'),
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

                done();
            });
        });

        it('"/foo-bar" should have error for path not found', function(done) {
            s.get('/foo-bar', function(err, result) {
                should.exist(err);

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


        describe('update', function() {
            var file = path.resolve(__dirname, 'fixture/server-update.md');

            beforeEach(function(done) {
                fs.unlink(file, function(err) {
                    // copy file : http://stackoverflow.com/questions/11293857/fastest-way-to-copy-file-in-node-js
                    fs.createReadStream(path.resolve(__dirname, 'fixture/test.md')).pipe(fs.createWriteStream(file));

                    done();
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
        app.set('view engine', 'jade');

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
        app.set('view engine', 'jade');

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
        app.set('view engine', 'jade');

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
        app.set('view engine', 'jade');

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
