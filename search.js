const Promise = require('bluebird');
const util = require('util');
const cheerio = require('cheerio');
const rp = require('request-promise');

const BASE_SEARCH_URL = 'https://play.google.com/store/search?q=%s&c=apps&hl=en';

function search(query) {
    let apps = [];

    let opts = {
        url: util.format(BASE_SEARCH_URL, encodeURIComponent(query)),
    };
    return new Promise((resolve, reject) => {
        rp(opts)
            .then((body) => {
                let $ = cheerio.load(body);

                let pkgs = $('div > div > a.title').map((i, el) => $(el).attr('href').substring(23));

                let names = $('div > div > a.title').map((i, el) => $(el).attr('title'));

                let devs = $('div > div > a.subtitle').map((i, el) => $(el).attr('title'));

                let descs = $('div > div.description').map((i, el) => $(el).text().trim());

                let icons = $('img.cover-image').map((i, el) => {
                    let s = $(el).attr('src');
                    if (!s.startsWith('https:')) {
                        s = 'https:' + s;
                    }
                    // Really bad hack to get smaller icon size.
                    if (s.endsWith('=w170')) {
                        s = s.substring(0, s.length - 5) + '=w64';
                    }
                    return s;
                });

                let ratings = $('span.stars-container > a').map((i, el) => {
                    let ch = $('div.tiny-star', el);
                    let lbl = ch.attr('aria-label');

                    return lbl ? parseFloat(lbl.substring(7, 10)) : 0.0;
                });

                if (pkgs.length !== names.length ||
                    pkgs.length !== devs.length ||
                    pkgs.length !== descs.length ||
                    pkgs.length !== icons.length ||
                    pkgs.length !== ratings.length) {
                    reject(new Error('Parsing failed: Invalid HTML'));
                    return;
                }

                for (let i = 0; i < pkgs.length; i++) {
                    apps.push({
                        pkg: pkgs[i],
                        name: names[i],
                        dev: devs[i],
                        desc: descs[i],
                        icon: icons[i],
                        rating: ratings[i]
                    });
                }
                resolve(apps);
            })
            .catch((err) => {
                reject(err);
            });
    });
}

module.exports.search = search;
