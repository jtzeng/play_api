'use strict';
const Hapi = require('hapi');
const Promise = require('bluebird');
const _ = require('lodash');
const config = require('config');

const cache = require('./cache');

const server = new Hapi.Server();
server.connection({
    host: config.get('host'),
    port: config.get('port')
});

server.route({
    method: 'GET',
    path: '/',
    handler: (req, reply) => {
        return reply('Hi.');
    }
});

server.route({
    method: 'GET',
    path: '/search/{query}',
    handler: (req, reply) => {
        let query = req.params.query.toLowerCase();
        let init = new Date();

        let apps = [];
        let err = null;

        cache.handleSearch(query)
            .then((_apps) => {
                // Replace the displayed icon path to our own.
                apps = _.cloneDeep(_apps);
                _.forEach(apps, (app) => {
                    app.icon = cache.REMOTE_ICON_PATH + app.pkg;
                });
            })
            .catch((_err) => {
                err = _err;
                console.log(err);
            })
            .finally(() => {
                // Processing is done here instead of above b/c we still want
                // to return some sort of blank JSON response even if fail.

                let json = {};
                json.apps = apps;
                json.elapsed = new Date() - init;
                json.err = err ? err.toString() : null; // err.message
                reply(json);
            });
    }
});

server.route({
    method: 'GET',
    path: '/icon/{pkg}',
    handler: (req, reply) => {
        let pkg = req.params.pkg;

        let img = cache.DEFAULT_ICON;
        cache.handleIcon(pkg)
            .then((res) => {
                // Check if icon was found.
                if (res) {
                    img = new Buffer(res);
                }
            })
            .catch((err) => {
                console.log(err);
            })
            .finally(() => {
                reply(img).type('image');
            });
    }
});

const options = {
    ops: {
        interval: 1000
    },
    reporters: {
        myConsoleReporter: [{
            module: 'good-squeeze',
            name: 'Squeeze',
            args: [{ log: '*', response: '*' }]
        }, {
            module: 'good-console'
        }, 'stdout']
    }
};

server.register({
    register: require('good'),
    options
}, (err) => {
    if (err) throw err;

    server.start((err) => {
        if (err) throw err;
        console.log('Started Play API server at: ' + server.info.uri);
    });
});
