# play_api
RESTful Web API for searching apps on the Google Play Store. Caches results and retrieves icons, too.

Intro
-----

This API queries the Google Play Store website, saves the app results and returns it as JSON.

All results are cached in redis for a limited time, so identical requests will not do a new search and instead just return the cached result.

Icons are not directly saved in redis; however, their remote URLs are. To download an icon, there is an endpoint ```/icon/com.pkg.name``` that will download the icon from the remote URL and return it to the user. This will also be cached. The icon will be downloaded if its app results exist in the cache. If it doesn't exist, it will return a default icon.

The API returns its own icon path, e.g. something like ```http://example.com/icon/com.pkg.name``` instead of the remote URL.

```
{
    "apps":[
        {
            "pkg":"com.linecorp.foodcam.android",
            "name":"Foodie - Delicious Camera",
            "dev":"LINE Corporation",
            "desc":"A camera app customized for food photos",
            "icon":"http://localhost:8000/icon/com.linecorp.foodcam.android",
            "rating":4.3
        },
        {
            "pkg":"com.supersolid.honestfood",
            "name":"Food Street - Restaurant Game",
            "dev":"Supersolid",
            "desc":"Get Ready for the holidays - Festive updates! Free Restaurant and Cooking sim!",
            "icon":"http://localhost:8000/icon/com.supersolid.honestfood",
            "rating":4.4
        },
        {
            "pkg":"com.lego.duplo.food",
            "name":"LEGO® DUPLO® Food",
            "dev":"LEGO System A/S",
            "desc":"LEGO® DUPLO® Food",
            "icon":"http://localhost:8000/icon/com.lego.duplo.food",
            "rating":3.8
        },
        ...
    ],
    "elapsed":1315,
    "err":null
}
```

API results:
- apps: Array of apps. Empty array if no results.
- elapsed: Request time in milliseconds, including the search.
- err: null if everything was fine, otherwise the error message.


Usage
-----

Install the following:
- node.js
- redis
- yarn

Install the required node packages:

```yarn install```

Run it.

```node main.js```

Config
------

https://github.com/lorenwest/node-config

Default configuration is at ```./config/default.json```.

To use production configuration, create and modify ```./config/production.json``` and then set the environment variables:

```
export NODE_ENV=production
node main.js
```

The real configuration is redis's. Set the max memory limit, etc.

History
-------

I created a fully fledged crawler for the Play Store, but I wanted an alternate solution, one that gets realtime results, hence this project.

Sending requests to Google was fast, semi-reliable and returned good search results. I added a REST API and tested out the functionality on my phone, which worked quite nicely. However, the program could easily be blocked anytime. So instead of spamming Google every request, I decided that queries to Google would be cached.

There were many options but I picked redis because it had built-in time expiration. It made things pretty easy. Though it is fast, the bottleneck of my program is definitely the network, not my code.

Fetching amd storing icons was also a problem. I thought storing them in redis was a bad idea because they were too big, so I put them on the disk.

Although there are over two million apps on the Play Store, I don't think most of them would ever be found using standard search. I estimated that less than 500K apps would be searchable through normal conditions. Each app takes about 300 bytes of memory on redis, so this wouldn't have been a problem. If it ever were, the redis memory usage setting could be changed.

MongoDB is also an alternate database possibility because it handles JSON natively. However, I think performance would be a bit worse (because fetching from database every hit) unless we store an even smaller cache (of the newest of the newest data) of the cache inside the program memory.

To scale, I heard of ideas like putting node.js behind a proper web server like nginx. However, due to our implementation of icons where we have to check the database first, it might not benefit from nginx's speed of serving static files, because the files aren't really static.
