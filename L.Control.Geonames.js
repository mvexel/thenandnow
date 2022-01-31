//See this url for more info about valid adminCodes: http://www.geonames.org/export/geonames-search.html
var ADMIN_CODES = ['country', 'adminCode1', 'adminCode2', 'adminCode3', 'continentCode'];
var BBOX = ['east', 'west', 'north', 'south'];
var POSTALCODE_REGEX_US = /^\d{5}(-\d{4})?$/;

// from: https://en.wikipedia.org/wiki/Postcodes_in_the_United_Kingdom
var POSTALCODE_REGEX_UK = /^([Gg][Ii][Rr] 0[Aa]{2})|((([A-Za-z][0-9]{1,2})|(([A-Za-z][A-Ha-hJ-Yj-y][0-9]{1,2})|(([A-Za-z][0-9][A-Za-z])|([A-Za-z][A-Ha-hJ-Yj-y][0-9]?[A-Za-z])))) [0-9][A-Za-z]{2})$/

L.Control.Geonames = L.Control.extend({
    includes: L.Evented ? L.Evented.prototype : L.Mixin.Events,

    _active: false,
    _resultsList: null,
    _marker: null,
    _popup: null,
    _hasResults: false,
    options: {
        //position: 'topcenter', // In addition to standard 4 corner Leaflet control layout, this will position and size from top center.
        position: 'topleft',
        geonamesSearch: 'https://secure.geonames.org/searchJSON', // Override this if using a proxy to get connection to geonames.
        geonamesPostalCodesSearch: 'https://secure.geonames.org/postalCodeSearchJSON', // Override this if using a proxy to get connection to geonames.
        username: '', // Geonames account username.  Must be provided.
        maxresults: 5, // Maximum number of results to display per search.
        zoomLevel: null, // Max zoom level to zoom to for location. If null, will use the map's max zoom level.
        className: 'leaflet-geonames-icon', // Class for icon.
        workingClass: 'leaflet-geonames-icon-working', // Class for search underway.
        featureClasses: ['A', 'H', 'L', 'P', 'R', 'T', 'U', 'V'], // Feature classes to search against.  See: http://www.geonames.org/export/codes.html.
        baseQuery: 'isNameRequired=true', // The core query sent to GeoNames, later combined with other parameters above.
        showMarker: true, // Show a marker at the location the selected location.
        showPopup: true, // Show a tooltip at the selected location.
        adminCodes: {}, // Filter results by the specified admin codes mentioned in `ADMIN_CODES`. Each code can be a string or a function returning a string. `country` can be a comma-separated list of countries.
        bbox: {}, // An object in form of {east:..., west:..., north:..., south:...}, specifying the bounding box to limit the results to.
        lang: 'en', // Locale of results.
        alwaysOpen: false, // If true, search field is always visible.
        enablePostalCodes: true, // If true, use postalCodesRegex to test user provided string for a postal code.  If matches, then search against postal codes API instead.
        postalCodesRegex: POSTALCODE_REGEX_US, // Regex used for testing user provided string for a postal code.  If this test fails, the default geonames API is used instead.
        title: 'Search by location name or postcode', // Search input title value.
        placeholder: 'Enter a location name' // Search input placeholder text.
    },
    onAdd: function (map) {
        if (this.options.position == 'topcenter') {
            // construct a top-center location for this widget
            // trick from: https://stackoverflow.com/questions/33614912/how-to-locate-leaflet-zoom-control-in-a-desired-position
            map._controlCorners.topcenter = L.DomUtil.create('div', 'leaflet-top leaflet-center', map._controlContainer);
        }

        this._container = L.DomUtil.create('div', 'leaflet-geonames-search leaflet-bar');

        // keep mouse events from causing map to drag or zoom map
        L.DomEvent.disableClickPropagation(this._container);

        var link = this._link = L.DomUtil.create('a', this.options.className, this._container);
        link.href = '#';
        link.title = this.options.title;

        var form = L.DomUtil.create('form', '', this._container);
        L.DomEvent.addListener(form, 'submit', this._search, this);

        var input = this._input = L.DomUtil.create('input', '', form);
        input.type = 'search';
        input.placeholder = this.options.placeholder;

        this._url = this.options.geonamesSearch;
        this._resultsList = L.DomUtil.create('ul', '', this._container);

        L.DomEvent.on(input, 'keyup change search', function (e) {
            if (e.type === 'search') {
                // When input changes, clear out the results
                L.DomUtil.removeClass(this._resultsList, 'hasResults');
                L.DomUtil.removeClass(this._resultsList, 'noResults');
                this._hasResults = false;
                this._resultsList.innerHTML = '';
                this.removeMarker();
                this.removePopup();
            }
        }, this);

        L.DomEvent.on(input, 'focus', function () {
            if (!this.active) {
                this.show();
            }
        }, this);

        if (this.options.alwaysOpen) {
            this._active = true;
            L.DomUtil.addClass(this._container, 'active');
            L.DomEvent.on(link, 'click', this.show, this);
        } else {
            // Control button toggles visibility of the search field
            L.DomEvent.on(link, 'click', function () {
                if (this._active) {
                    this.hide();
                } else {
                    this.focus();
                }
            }, this);
        }

        map.on('click', this._mapClicked, this);

        return this._container;
    },
    onRemove: function () {
        this._map.off('click', this._mapClicked, this);
    },
    _mapClicked: function (event) {
        // ENTER key raises a click event too; ignore it
        if (event.originalEvent instanceof KeyboardEvent) {
            return;
        }
        if (this.options.alwaysOpen) {
            this.hideResults();
        } else {
            this.hide();
        }
    },
    addPoint: function (geoname) {
        var that = this
        // clear out previous point / popup
        this.removeMarker();
        this.removePopup();

        var name = this._getNameParts(geoname).join(', ');
        var lat = parseFloat(geoname.lat);
        var lon = parseFloat(geoname.lng);

        // if (this.options.showMarker || this.options.showPopup) {
            var zoomLevel = this.options.zoomLevel || this._map.getMaxZoom();
            this._map.setView([lat, lon], zoomLevel, false);
        // }

        if (this.options.showMarker) {
            this._marker = L.marker([lat, lon]).addTo(this._map);

            if (this.options.showPopup) {
                this._marker.bindPopup(name);
                this._marker.openPopup()
                this._marker.on('popupclose', function() {
                    that._onPopupClosed()
                });
            }
        } else if (this.options.showPopup) {
            this._popup = L.popup()
                .setLatLng([lat, lon])
                .setContent(name)
                .openOn(this._map)
                .on('remove', function() {
                    that._onPopupClosed()
                });
        }
    },
    show: function () {
        this._active = true;
        L.DomUtil.addClass(this._container, 'active');
        if (this._hasResults) {
            L.DomUtil.addClass(this._resultsList, 'hasResults');
        } else {
            L.DomUtil.addClass(this._resultsList, 'noResults');
        }
    },
    hide: function () {
        this._active = false;
        L.DomUtil.removeClass(this._container, 'active');
        this.hideResults();
    },
    hideResults: function () {
        L.DomUtil.removeClass(this._resultsList, 'hasResults');
        L.DomUtil.removeClass(this._resultsList, 'noResults');
    },
    focus: function () {
        this.show();
        this._input.focus();
    },
    _close: function () {
        // Clear search field (if not alwaysOpen, close results list, and
        // remove marker
        this.hide();
        this.removeMarker();
        this.removePopup();
    },
    removeMarker: function () {
        if (this._marker != null) {
            this._map.removeLayer(this._marker);
            this._marker = null;
        }
    },
    removePopup: function () {
        if (this._popup != null) {
            this._map.closePopup(this._popup);
            this._popup = null;
        }
    },
    _onPopupClosed: function () {
        this.removeMarker();
        this.removePopup();
        this._hasResults = false;
        this._resultsList.innerHTML = '';
    },
    _search: function (event) {
        L.DomEvent.preventDefault(event);

        L.DomUtil.addClass(this._link, this.options.workingClass);
        L.DomUtil.removeClass(this._resultsList, 'noResults');

        //clear results
        this._hasResults = false;
        this._resultsList.innerHTML = '';

        var i, param, apiURL;
        var query = this._input.value;
        var searchParams = {
            lang: this.options.lang
        };
        var extraQueryParams = '';

        if (this.options.enablePostalCodes && this.options.postalCodesRegex.test(query)) {
            // search against postalCodes API
            apiURL = this.options.geonamesPostalCodesSearch;
            searchParams.postalcode = query;
            searchParams.isReduced = false;

        } else {
            // search against default API
            apiURL = this.options.geonamesSearch;
            searchParams.q = query;

            if (this.options.featureClasses && this.options.featureClasses.length) {
                extraQueryParams += '&' + this.options.featureClasses.map(function (fc) {
                    return 'featureClass=' + fc
                }).join('&');
            }
        }

        // Add adminCodes to query
        for (param in this.options.adminCodes) {
            // Ignore any admin codes that are not valid
            if (ADMIN_CODES.indexOf(param) == -1) continue;

            var paramValue = this.options.adminCodes[param];
            searchParams[param] = (typeof paramValue == 'function') ? paramValue() : paramValue;
        }

        // Add bbox to query
        var bbox = (typeof this.options.bbox == 'function') ? this.options.bbox() : this.options.bbox;
        for (i in BBOX) {
            // Ignore the bbox if it is not valid
            if (!bbox[BBOX[i]]) {
                bbox = null;
                break;
            }
        }
        if (bbox) {
            for (i in BBOX) {
                param = BBOX[i];
                searchParams[param] = bbox[param];
            }
        }

        this.fire('search', {
            params: searchParams
        });

        // parameters excluded from event above
        var coreParams = {
            username: this.options.username,
            maxRows: this.options.maxresults,
            style: "LONG"
        };

        var url = apiURL + '?' + this._objToQuery(coreParams) + '&' + this._objToQuery(searchParams) + extraQueryParams;
        if (this.options.baseQuery) {
            url += '&' + this.options.baseQuery;
        }

        var origScope = this;
        var callbackName = 'geonamesSearchCallback' + new Date().getTime();
        this._jsonp(url,
            function (response) {
                document.body.removeChild(document.getElementById('getJsonP'));
                delete window[callbackName];
                origScope._processResponse(response);
            },
            callbackName
        );

    },
    _objToQuery: function (obj) {
        var queryParams = [];
        for (var param in obj)
            if (obj.hasOwnProperty(param)) {
                queryParams.push(encodeURIComponent(param) + "=" + encodeURIComponent(obj[param]));
            }
        return queryParams.join("&");
    },
    _jsonp: function (url, callback, callbackName) {
        callbackName = callbackName || 'jsonpCallback';
        window[callbackName] = callback;

        url += '&callback=' + callbackName;
        var script = document.createElement('script');
        script.id = 'getJsonP';
        script.src = url;
        script.async = true;
        document.body.appendChild(script);
    },
    _processResponse: function (response) {
        var jsonResponse;
        if (typeof response.geonames != 'undefined') {
            jsonResponse = response.geonames;
        } else if (typeof response.postalCodes != 'undefined') {
            jsonResponse = response.postalCodes;
        }
        L.DomUtil.removeClass(this._link, this.options.workingClass);

        if (jsonResponse.length > 0) {
            L.DomUtil.addClass(this._resultsList, 'hasResults');
            this._hasResults = true;
            var li;
            jsonResponse.forEach(function (geoname) {
                li = L.DomUtil.create('li', '', this._resultsList);
                var nameParts = this._getNameParts(geoname);
                var primaryName = nameParts.slice(0, 2).join(', ');
                var countryName = (nameParts.length > 2) ? '<br/><em>' + nameParts[2] + '</em>' : '';
                li.innerHTML = primaryName + countryName;

                L.DomEvent.addListener(li, 'click', function () {
                    //The user picks a location and it changes the search text to be that location
                    this._input.value = primaryName;

                    if (this.options.alwaysOpen) {
                        this.hideResults();
                    } else {
                        this.hide();
                    }

                    this.fire('select', {
                        geoname: geoname
                    });
                    this.addPoint(geoname);
                }, this);
            }, this);
        } else {
            L.DomUtil.addClass(this._resultsList, 'noResults');
            li = L.DomUtil.create('li', '', this._resultsList);
            li.innerText = 'No results found';
        }
    },
    _getNameParts: function (geoname) {
        var extraName;
        var parts = [];
        if (typeof geoname.name != 'undefined') {
            parts.push(geoname.name);
        } else if (typeof geoname.postalCode != 'undefined') {
            parts.push(geoname.postalCode);
        }

        ['adminName1', 'adminName2', 'countryName', 'countryCode'].forEach(function (d) {
            extraName = geoname[d];
            if (extraName && extraName != '' && extraName != parts[0]) {
                parts.push(extraName);
            }
        }, this);
        return parts;
    }
});

L.control.geonames = function (options) {
    return new L.Control.Geonames(options);
};