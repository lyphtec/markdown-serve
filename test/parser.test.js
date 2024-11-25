var parser = require('../lib/parser'),
    path = require('path'),
    should = require('chai').should(),
    fs = require('fs');

describe('parser', function() {

    describe('parse()', function() {

        it('should error if file does not exist', function(done) {
            parser.parse('/tmp/not-a-real-file.md', null, function(err, result) {
                should.exist(err);
                done();
            });
        });

        it('should succeed for file with no YAML front matter', function(done) {
            var file = path.resolve(__dirname, 'fixture/test-no-yml.md');

            parser.parse(file, null, function(err, result) {
                should.not.exist(err);
                result.should.be.ok;
                result._file.should.equal(file);
                should.not.exist(result.meta);
                should.exist(result.checksum);
                should.exist(result.stats);

                result.parseContent(function (err, content) {
                    content.should.be.ok;
                    content.should.contain('<li>Moe</li>');

                    done();
                });
            });
        });

        it('should succeed', function(done) {
            var file = path.resolve(__dirname, 'fixture/test.md');

            parser.parse(file, null, function(err, result) {
                should.not.exist(err);
                result.should.be.ok;
                result._file.should.equal(file);
                should.exist(result.meta);
                result.meta.title.should.equal('Hello World');

                result.parseContent(function(err, content) {
                    content.should.be.ok;
                    done();
                });
            });
        });

        it('should succeed for Jekyll format', function(done) {
            var file = path.resolve(__dirname, 'fixture/test-jekyll.md');

            parser.parse(file, null, function(err, result) {
                should.not.exist(err);
                result.should.be.ok;
                result._file.should.equal(file);
                should.exist(result.meta);
                result.meta.title.should.equal('Hello World');

                result.parseContent(function(err, content) {
                    content.should.be.ok;
                    done();
                });
            });
        });

        it('should succeed when called with 2 args', function(done) {
            var file = path.resolve(__dirname, 'fixture/test.md');

            parser.parse(file, function(err, result) {
                should.not.exist(err);
                result.should.be.ok;
                should.exist(result.meta);
                should.not.exist(result._markedOptions);

                done();
            });
        });

        it('should succeed with markedOptions', function(done) {
            var file = path.resolve(__dirname, 'fixture/test.md');

            var opts = {
                tables: false,
                highlight: function(code) {
                    return code;
                }
            };

            parser.parse(file, opts, function(err, result) {
                should.not.exist(err);
                result.should.be.ok;
                should.exist(result.meta);
                should.exist(result._markedOptions);
                result._markedOptions.should.equal(opts);

                result.parseContent(function(err, content) {
                    content.should.not.contain('hljs-keyword');

                    done();
                });
            });
        });

    });    

    describe('MarkdownFile', function() {
        describe('saveChanges()', function() {

            var file = path.resolve(__dirname, 'fixture/new.md');

            beforeEach(function(done) {
                fs.unlink(file, function(err) {
                    done();
                });
            });

            it('new file succeeds', function(done) {
                var n = new parser.MarkdownFile(file);
                n.meta = {
                    title: 'Hello, me new',
                    draft: true
                };
                n.rawContent = '# Heading\n\n Some random points: \n\n- One\n- Two\n- Three';

                n.saveChanges(function(err, success) {
                    success.should.be.true;

                    fs.exists(file, function(exists) {
                        exists.should.be.true;
                        done();
                    });
                });
            });

        });
    });

});
