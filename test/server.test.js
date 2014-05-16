var server = require('../lib/server.js'),
    express = require('express'),
    request= require('supertest'),
    path = require('path');


var ROOT_DIR = path.resolve(__dirname, 'fixture');

describe('MarkdownServer', function() {

    describe('get()', function() {
        var s = new server.MarkdownServer(ROOT_DIR);

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
