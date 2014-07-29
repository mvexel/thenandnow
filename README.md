# OSM Then And Now

View OpenStreetMap as it was in June 2007, and compare it to what it looks now.

THIS WILL BLOW YOUR MIND.

Watch it in action: http://mvexel.github.io/thenandnow/

Historic tiles are served from an old home server. Be gentle.

## Thanks

* @woodpeck for the help converting the ancient OSM planet file into something
* [Switch2OSM](http://switch2osm.org/) for the almost spot on instructions on how to get a tile server running
* @mapbox for the [leaflet swipe example](https://www.mapbox.com/mapbox.js/example/v1.0.0/swipe-layers/)

## Roll your own

* Clone this
* Change the [historic tile layer URL](https://github.com/mvexel/thenandnow/blob/master/app/scripts/main.js#L23) to your own.
* `npm install`
* `bower install`
* `gulp watch`

## License

MIT - see LICENSE
