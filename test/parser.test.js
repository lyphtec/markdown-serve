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

        it('should not treat plain prose before a "---" rule as front matter', function(done) {
            // YAML parses ordinary prose as a string -- if that counts as front matter the
            // first section of the file is silently discarded
            var file = path.resolve(__dirname, 'fixture/prose-then-rule.md');

            parser.parse(file, null, function(err, result) {
                should.not.exist(err);
                should.not.exist(result.meta);
                result.rawContent.should.contain('Just a normal opening paragraph');
                result.rawContent.should.contain('# Section two');

                result.parseContent(function(err, content) {
                    content.should.contain('Just a normal opening paragraph');
                    content.should.contain('<li>Moe</li>');

                    done();
                });
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

        describe('parseContent()', function() {
            var file = path.resolve(__dirname, 'fixture/empty-file.md');

            it('should return empty string for an empty file when called synchronously', function(done) {
                // called with no callback this must not throw -- lib/server.js uses the synchronous
                // form from inside an async callback, where a throw would take the process down
                parser.parse(file, null, function(err, result) {
                    should.not.exist(err);

                    var content = result.parseContent();
                    content.should.equal('');

                    done();
                });
            });

            it('should error for an empty file when called with a callback', function(done) {
                parser.parse(file, null, function(err, result) {
                    should.not.exist(err);

                    result.parseContent(function(err, content) {
                        should.exist(err);

                        done();
                    });
                });
            });
        });

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
