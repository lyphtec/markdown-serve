var server = require('../lib/server.js'),
    path = require('path');

describe('MarkdownServer', function() {

    describe('get()', function() {
        var rootDir = path.resolve(__dirname, 'fixture');
        var s = new server.MarkdownServer(rootDir);

        it('"/test-no-yml" succeeds', function(done) {
            s.get('/test-no-yml', function(err, result) {
                result.should.be.ok;
                done();
            });
        });

    });

});
