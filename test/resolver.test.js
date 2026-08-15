var resolver = require('../lib/resolver'),
    should = require('chai').should(),
    path = require('path');

describe('resolver', function() {

    var rootDir = path.resolve(__dirname, 'fixture/');

    it('should resolve "/"', function() {
        var file = resolver('/', rootDir);
        file.should.equal(path.resolve(rootDir, 'index.md'));
    });

    it('should not resolve "/" when no index.md exists', function() {
        var file = resolver('/', path.resolve(rootDir, 'no-index'));
        should.not.exist(file);
    });

    it('should resolve "/new"', function() {
        var file = resolver('/new', rootDir);
        should.exist(file);
        file.should.equal(path.resolve(rootDir, 'new.md'));
    });

    it('should resolve "/test%20space"', function() {
        var file = resolver('/test%20space', rootDir);
        should.exist(file);
        file.should.equal(path.resolve(rootDir, 'test space.md'));
    });

    it('should resolve "/test-space"', function() {
        var file = resolver('/test-space', rootDir);
        should.exist(file);
        file.should.equal(path.resolve(rootDir, 'test space.md'));
    });

    it('should resolve "/test-no-yml"', function() {
        var file = resolver('/test-no-yml', rootDir);
        should.exist(file);
        file.should.equal(path.resolve(rootDir, 'test-no-yml.md'));
    });

    it('should resolve "/sub/test"', function() {
        var file = resolver('/sub/test', rootDir);
        should.exist(file);
        file.should.equal(path.resolve(rootDir, 'sub/test.md'));
    });

    it('should resolve "/space-in-name/test"', function() {
        var file = resolver('/space-in-name/test', rootDir);
        should.exist(file);
        file.should.equal(path.resolve(rootDir, 'space in name/test.md'));
    });

    it('should resolve "/space-in-name/sub/more-spaces"', function() {
        var file = resolver('/space-in-name/sub/more-spaces', rootDir);
        should.exist(file);
        file.should.equal(path.resolve(rootDir, 'space in name/sub/more spaces.md'));
    });

    it('should resolve "/space-in-name/sub/with-dash"', function() {
        var file = resolver('/space-in-name/sub/with-dash', rootDir);
        should.exist(file);
        file.should.equal(path.resolve(rootDir, 'space in name/sub/with-dash.md'));
    });

    it('should not resolve "/space-in-name/sub/bobus-file"', function() {
        var file = resolver('/space-in-name/sub/bogus-file', rootDir);
        should.not.exist(file);
    });

    it('should resolve "/sub/"', function() {
        var file = resolver('/sub/', rootDir);
        should.exist(file);
        file.should.equal(path.resolve(rootDir, 'sub/index.md'));
    });

    it('should not resolve "/test/"', function() {
        var file = resolver('/test/', rootDir);
        should.not.exist(file);
    });

    it('should resolve "/new" with file extension option', function() {
        var file = resolver('/new', rootDir, { fileExtension: 'markdown' });
        should.exist(file);
        file.should.equal(path.resolve(rootDir, 'new.markdown'));
    });

    it('should resolve "/sub/" with default page name option', function() {
        var file = resolver('/sub/', rootDir, { defaultPageName: 'default' });
        should.exist(file);
        file.should.equal(path.resolve(rootDir, 'sub/default.md'));
    });

    it('should resolve "/sub/" with all options', function() {
        var file = resolver('/sub/', rootDir, { defaultPageName: 'custom', fileExtension: 'foo' });
        should.exist(file);
        file.should.equal(path.resolve(rootDir, 'sub/custom.foo'));
    });

    it('should resolve "/test-use-extension.md" with use extension in url option', function() {
        var file = resolver('/test-use-extension.md', rootDir, { useExtensionInUrl: true });
        should.exist(file);
        file.should.equal(path.resolve(rootDir, 'test-use-extension.md'));
    });

    it('should resolve "/sub" with default page in containing folder', function() {
        var file = resolver('/sub', rootDir);
        should.exist(file);
        file.should.equal(path.resolve(rootDir, 'sub/index.md'));
    });

    describe('directory traversal', function() {

        // "../../README.md" exists (repo root), so these would resolve without a containment check
        it('should not resolve "/../../README" outside rootDir', function() {
            should.not.exist(resolver('/../../README', rootDir));
        });

        it('should not resolve URL encoded "/..%2f..%2fREADME" outside rootDir', function() {
            should.not.exist(resolver('/..%2f..%2fREADME', rootDir));
        });

        it('should not resolve fully encoded "/%2e%2e%2f%2e%2e%2fREADME" outside rootDir', function() {
            should.not.exist(resolver('/%2e%2e%2f%2e%2e%2fREADME', rootDir));
        });

        it('should not resolve "/../../package.json" with use extension in url option', function() {
            should.not.exist(resolver('/../../package.json', rootDir, { useExtensionInUrl: true }));
        });

        it('should not resolve traversal buried in a sub-folder path', function() {
            should.not.exist(resolver('/sub/../../../README', rootDir));
        });

        it('should still resolve a file name that merely starts with dots', function() {
            // guard must not reject legitimate names -- only ".." path segments
            var file = resolver('/test', rootDir);
            file.should.equal(path.resolve(rootDir, 'test.md'));
        });
    });

    describe('segment walk fallback', function() {
        // "/space-in-name/sub/with-dash" only resolves via the segment walk: the folder needs its
        // dashes turned into spaces while the file name keeps its own dash, so neither of the
        // direct-match branches can hit it

        it('should honour fileExtension rather than assuming ".md"', function() {
            var file = resolver('/space-in-name/sub/with-dash', rootDir, { fileExtension: 'foo' });
            should.exist(file);
            file.should.equal(path.resolve(rootDir, 'space in name/sub/with-dash.foo'));
        });

        it('should honour useExtensionInUrl', function() {
            var file = resolver('/space-in-name/sub/with-dash.md', rootDir, { useExtensionInUrl: true });
            should.exist(file);
            file.should.equal(path.resolve(rootDir, 'space in name/sub/with-dash.md'));
        });

        it('should still default to ".md"', function() {
            var file = resolver('/space-in-name/sub/with-dash', rootDir);
            should.exist(file);
            file.should.equal(path.resolve(rootDir, 'space in name/sub/with-dash.md'));
        });

        it('should not return a directory it walked through', function() {
            // "/space-in-name/sub" ends on a directory & there is no default page inside it
            should.not.exist(resolver('/space-in-name/sub', rootDir, { useExtensionInUrl: true }));
        });
    });

    describe('useExtensionInUrl', function() {
        var opts = { useExtensionInUrl: true };

        it('should resolve "/" to the default page', function() {
            // the default page name is synthesised, so it still takes the real file extension
            var file = resolver('/', rootDir, opts);
            should.exist(file);
            file.should.equal(path.resolve(rootDir, 'index.md'));
        });

        it('should resolve "/sub/" to the default page in that folder', function() {
            var file = resolver('/sub/', rootDir, opts);
            should.exist(file);
            file.should.equal(path.resolve(rootDir, 'sub/index.md'));
        });

        it('should resolve "/sub" to the default page rather than the directory itself', function() {
            // with no extension to append, "/sub" matches the "sub" directory -- fs.existsSync() is
            // true for directories, so this has to fall through to sub/index.md instead
            var file = resolver('/sub', rootDir, opts);
            should.exist(file);
            file.should.equal(path.resolve(rootDir, 'sub/index.md'));
        });

        it('should honour defaultPageName & fileExtension for "/sub/"', function() {
            var file = resolver('/sub/', rootDir, { useExtensionInUrl: true, defaultPageName: 'custom', fileExtension: 'foo' });
            should.exist(file);
            file.should.equal(path.resolve(rootDir, 'sub/custom.foo'));
        });

        it('should resolve a named path that carries the extension', function() {
            resolver('/test-use-extension.md', rootDir, opts).should.equal(path.resolve(rootDir, 'test-use-extension.md'));
        });

    });

    describe('malformed percent-encoding', function() {

        // decodeURIComponent throws a URIError on these -- must be reported as "not found"
        it('should not throw for a trailing "%"', function() {
            (function() {
                resolver('/foo%', rootDir);
            }).should.not.throw();
        });

        it('should return null for a trailing "%"', function() {
            should.not.exist(resolver('/foo%', rootDir));
        });

        it('should return null for a non-hex escape', function() {
            should.not.exist(resolver('/%zz', rootDir));
        });

        it('should return null for a malformed escape in a sub-folder segment', function() {
            should.not.exist(resolver('/sub/%e0%a4%a/test', rootDir));
        });

        it('should still resolve a validly encoded path', function() {
            // guard must not swallow legitimate encodings
            resolver('/test%20space', rootDir).should.equal(path.resolve(rootDir, 'test space.md'));
        });
    });
});
