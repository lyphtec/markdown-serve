var resolver = require('../lib/resolver'),
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

    it('should resolve "/new" with file extention option', function() {
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
});
