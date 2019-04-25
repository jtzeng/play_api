const _ = require('lodash');
const Promise = require('bluebird');
const rp = require('request-promise');
const crypto = require('crypto');
const path = require('path');
const fs = Promise.promisifyAll(require('fs'));
const config = require('config');

const search = require('./search');

const redis = Promise.promisifyAll(require('redis'));
let client = redis.createClient();

const LOCAL_ICON_PATH = path.join(__dirname, 'icons');
const REMOTE_ICON_PATH = config.get('publicurl') + '/icon/';
const DEFAULT_ICON = fs.readFileSync(config.get('defaulticonpath'));

// Create the icon directory.
if (!fs.existsSync(LOCAL_ICON_PATH)) {
    console.log('Creating directory: ' + LOCAL_ICON_PATH);
    fs.mkdirSync(LOCAL_ICON_PATH);
}

function hashIcon(pkg) {
    return crypto.createHash('sha1').update(pkg).digest('hex');
}

function getIconPath(pkg) {
    return path.join(LOCAL_ICON_PATH, hashIcon(pkg) + config.get('iconext'));
}

function getSearch(query) {
    let cached = true;
    let noResults = false;

    // Check if the search is cached.
    // [] = not cached.
    // [''] = cached, but no results for search.
    return client.lrangeAsync(`search:${query}`, 0, -1)
        .then((pkgs) => {
            if (pkgs && pkgs.length) {
                if (pkgs && pkgs[0] === '') {
                    noResults = true;
                }
                return Promise.map(pkgs, pkg => client.hgetallAsync(`app:${pkg}`));
            }
            cached = false;
        })
        .then((apps) => {
            if (cached) {
                if (!apps || !apps.length) {
                    throw new Error('Search cache was found, but not app cache.');
                }

                if (noResults) {
                    return Promise.join(true, []);
                }

                apps = apps.map(app => app || null);
                // Making sure the values don't contain null.
                if (Object.values(apps).indexOf(null) == -1) {
                    console.log('Found cached search result.');
                    return Promise.join(true, apps);
                }
            }

            // Otherwise, go do a new search.
            console.log(`Searching for ${query}...`);
            return Promise.join(false, search.search(query));
        })
        .catch((err) => {
            throw err;
        });
}

// Check if the search is cached. Save if it isn't.
// Either way, return the results.
function handleSearch(query) {
    return getSearch(query)
        .spread((cached, apps) => {
            console.log(`Cached: ${cached}. Apps: ${apps.length}`);

            if (cached) {
                return apps;
            }

            return saveSearch(query, apps);
        })
        .then((apps) => {
            return apps;
        })
        .catch((err) => {
            throw err;
        });
}

function saveSearch(query, apps) {
    return Promise.join(
        // Delete the previous results.
        client.delAsync(`search:${query}`),

        // Save the new results: list of package names.
        client.rpushAsync(`search:${query}`, (apps && apps.length) ? apps.map(app => app.pkg) : ''),
        client.expireAsync(`search:${query}`, config.get('expiration')),

        apps
    )
    .spread((res, res2, res3, apps) => {
        // Saves app data to apps cache.
        return Promise.join(
            Promise.all(
                apps.map((app) => client.hmsetAsync(`app:${app.pkg}`, app)),
                apps.map((app) => client.expireAsync(`app:${app.pkg}`, config.get('expiration')))
            ),
            apps
        );
    })
    .spread((res, apps) => {
        return apps;
    })
    .catch((err) => {
        throw err;
    });
}

function handleIcon(pkg) {
    let cached = false;
    if (!pkg) {
        return null;
    }

    return client.hgetallAsync(`app:${pkg}`)
        .then((app) => {
            // If we don't know the remote icon URL, i.e. it has not yet been
            // searched, don't check the filesystem or download anything.
            if (!app) {
                return null;
            }

            return fs.readFileAsync(getIconPath(pkg))
                .then((data) => {
                    console.log('Cached icon: ' + data.length);
                    cached = true;
                    return data;
                })
                .catch({code: 'ENOENT'}, (err) => {
                    // Download it.
                    // Encoding MUST be null to read stuff in binary.
                    let opts = {
                        url: app.icon,
                        encoding: null
                    };
                    return rp(opts);
                });
        })
        .then((data) => {
            // No icon.
            if (!data) {
                return null;
            }

            // New icon, not cached or saved. We don't return the promise
            // because we want to return the icon to the user first.
            if (!cached) {
                saveIcon(pkg, data);
            }

            // Cached icon. Just return the data.
            return data;
        })
        .catch((err) => {
            throw err;
        });
}

function saveIcon(pkg, data) {
    let iconPath = getIconPath(pkg);
    console.log('Icon saved at: ' + iconPath);
    return fs.writeFileAsync(getIconPath(pkg), data);
}

module.exports.handleIcon = handleIcon;
module.exports.DEFAULT_ICON = DEFAULT_ICON;
module.exports.handleSearch = handleSearch;
module.exports.REMOTE_ICON_PATH = REMOTE_ICON_PATH;
