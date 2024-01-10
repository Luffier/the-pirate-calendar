// ==UserScript==
// @name         The Pirate Calendar (for trakt.tv)
// @version      0.6.7
// @description  Adds torrent links to trakt.tv. Now with a settings menu!
// @author       luffier
// @namespace    PirateCalendar
// @license      MIT
// @match        https://trakt.tv/*
// @require      https://openuserjs.org/src/libs/sizzle/GM_config.js
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM.getValue
// @grant        GM.setValue
// @run-at       document-idle
// @sandbox      raw
// @homepageURL  https://github.com/Luffier/the-pirate-calendar
// @supportURL   https://github.com/Luffier/the-pirate-calendar/issues
// ==/UserScript==

/* globals GM_config */
/* jshint esversion: 8 */

(() => {
    'use strict';

    /* VARIABLES */

    // Global styles
    const STYLE = `
    <style>
        iframe#PirateCalendarConfig {
            height: 480px !important;
            width: 500px !important;
        }
        .actions .tpc {
            transition: background-color .2s ease 0s;
            font-size: 22px !important;
            color: rgb(56, 96, 187);
        }
        .actions .tpc:hover {
            background-color: rgb(255, 255, 255, 0.25);
            transition: background-color .2s ease 0s;
            color: rgb(18, 40, 89);
        }
        .action-buttons .btn-tpc {
            margin-top: 5px;
            color: rgb(56, 96, 187);
            background-color: #fff;
            border-color: rgb(56, 96, 187);
            border: solid 1px rgb(56, 96, 187);
            transition: all .5s;
        }
        .action-buttons .btn-tpc:hover {
            background-color: rgb(18, 40, 89);
            color: white;
            transition: all .5s;
        }
        .tcp-icon {
            font-size: 40px !important;
            color: rgb(237, 28, 36);
        }
        .tcp-jump-icon {
            position: fixed;
            font-size: 30px !important;
            bottom: 25px;
            right: 25px;
            z-index: 999;
        }
    </style>
    `;

    // RegEx patterns
    // For pages: all
    // For action list: shows, movies
    // For media cards: movie, show, season, episode
    const REGEX = {
        calendar: /^\/calendars\/my\/shows/,
        shows: /^\/shows(?:\/(?:trending|popular|favorited|recommended|watched|collected|anticipated)?(?:\/[^/]+)?)$/,
        show: /^\/shows\/([^/]+)(\/)?$/,
        season: /^\/shows\/([^/]+)\/seasons\/([^/]+)(\/)?$/,
        episode: /^\/shows\/([^/]+)\/seasons\/([^/]+)\/episodes\/([^/]+)(\/)?$/,
        movies: /^\/movies(?:\/(?:trending|popular|favorited|recommended|watched|collected|anticipated|boxoffice)?(?:\/[^/]+)?)$/,
        movie: /^\/movies\/([^/]+(?<!-[0-9]{4}))(?:(?:-)([0-9]{4}))?$/m,
        list: /^\/users\/[^/]+\/((?:favorites|watchlist)(\?[^/]+)|(?:lists\/[^/]+(?:\?[^/]+)))$/,
    };

    // Default search engines parameters
    const SEARCH_ENGINES = {
        '1337x': {
            'defaultUrl': 'https://1337x.to/',
            'defaultSearch': 'sort-search/%s/size/desc/1/',
            'cleanQuery': (query) => encodeURIComponent(query).replace(/%20/g, '+')
        },
        'Torrent Galaxy': {
            'defaultUrl': 'https://torrentgalaxy.to/',
            'defaultSearch': 'torrents.php?search=%s&lang=0&nox=2&sort=size&order=desc',
            'cleanQuery': (query) => encodeURIComponent(query).replace(/%20/g, '+')
        },
        'Custom': {
            'defaultUrl': 'Write a custom URL',
            'defaultSearch': 'Write a custom query string',
            'cleanQuery': (query) => encodeURIComponent(query).replace(/%20/g, '+')
        }
    };

    // Helper for whenPageReady function
    const PAGE_READY = {
        timeout: true,
        startTimer: null
    }

    /* SETTINGS MENU */

    GM_config.init({
        'id': 'PirateCalendarConfig',
        'title': 'The Pirate Calendar Settings',
        'fields': {
            'openInNewTab': {
                'label': 'Open links in new tab:',
                'type': 'checkbox',
                'default': true,
                'section': ['General']
            },
            'autoscrollToday': {
                'label': 'Auto scroll to current day:',
                'type': 'checkbox',
                'default': true,
                'section': ['Calendar']
            },
            'hideCollectIcon': {
                'label': 'Hide collect icon:',
                'type': 'checkbox',
                'default': false
            },
            'hideListIcon': {
                'label': 'Hide list icon:',
                'type': 'checkbox',
                'default': false
            },
            'hideWatchtIcon': {
                'label': 'Hide watch-now icon:',
                'type': 'checkbox',
                'default': false
            },
            'torrentSearchEngine': {
                'label': 'Preferred torrent search engine:',
                'type': 'select',
                'options': Object.keys(SEARCH_ENGINES),
                'default': Object.keys(SEARCH_ENGINES)[0],
                'section': ['Search engine']
            },
            'customUrl': {
                'label': '&#183; URL:',
                'title': 'For a custom URL (like a proxy)',
                'type': 'text',
                'default': SEARCH_ENGINES[Object.keys(SEARCH_ENGINES)[0]].defaultUrl
            },
            'customSearch': {
                'label': '&#183; Search query:',
                'title': 'For a custom search query. Place "%s" where the query should be',
                'type': 'text',
                'default': SEARCH_ENGINES[Object.keys(SEARCH_ENGINES)[0]].defaultSearch
            }
        },
        'css':
            `
                body#PirateCalendarConfig {
                    position: relative !important;
                    font-family: 'proxima nova', 'Helvetica', 'Arial', 'sans-serif' !important;
                    margin: 0 !important;

                }
                #PirateCalendarConfig .config_var {
                    margin: 8px 8px 8px 12px !important;
                }
                #PirateCalendarConfig .config_var input[type="text"] {
                    border: 2px inset black !important;
                }
                #PirateCalendarConfig_buttons_holder {
                    position: relative !important;
                }
                #PirateCalendarConfig_header {
                    background-color: #f7f7f7;
                    border-bottom: 1px solid #ebebeb;
                    padding: 20px 0 10px 0;
                }
                #PirateCalendarConfig_buttons_holder {
                    right: 20px;
                }
                #PirateCalendarConfig_buttons_holder button {
                    color: #fff;
                    font-size: 12px;
                    padding: 4px 9px !important;
                    height: auto !important;
                    cursor: pointer;
                    border: 1px solid transparent;
                }
                #PirateCalendarConfig_buttons_holder .reset_holder {
                    position: absolute;
                    right: 12px;
                    bottom: -20px;
                }
                #PirateCalendarConfig_saveBtn {
                    background-color: #ed1c24;
                    border-color: #de1219;
                }
                #PirateCalendarConfig_closeBtn {
                    background-color: #aaa;
                    border: 1px solid transparent;
                }
                #PirateCalendarConfig_field_customSearch {
                    width: 48ex;
                }
                .config_var#PirateCalendarConfig_customUrl_var,
                .config_var#PirateCalendarConfig_customSearch_var {
                    display: flex;
                    align-items: center;
                }
                .config_var input[type="text"] {
                    flex-grow: 1;
                }
            `,
        'events': {
            'init': init,
            'open': function() {
                // Set default URL and search path when the search engine changes
                this.fields.torrentSearchEngine.node.addEventListener('change', function() {
                    let searchEngine = SEARCH_ENGINES[this.value];
                    let section = this.parentElement.parentElement;
                    section.querySelector('#PirateCalendarConfig_field_customUrl').value = searchEngine.defaultUrl;
                    section.querySelector('#PirateCalendarConfig_field_customSearch').value = searchEngine.defaultSearch;
                });
            },
            'save': function() {
                applySettings();
                this.close();
            },
        }
    });

    /* FUNCTIONS */

    // Single element selector shorthand
    const $ = document.querySelector.bind(document);

    // Multiple elements selector shorthand
    const $$ = document.querySelectorAll.bind(document);

    // Create element
    function createElement(html) {
        const template = document.createElement('template');
        template.innerHTML = html.trim();
        return template.content.firstChild;
    }

    // Function to replicate the `toggle` function in jQuery
    function toggle(el, option) {
        if (typeof option === 'boolean') {
            if (option) {
                el.style.display = '';
            } else {
                el.style.display = 'none';
            }
        } else {
            if (el.style.display === 'none') {
                el.style.display = '';
            } else {
                el.style.display = 'none';
            }
        }
    }

    // Function to replicate the `on` function in jQuery
    function addEventListener(el, eventName, eventHandler, selector) {
        if (selector) {
            const wrappedHandler = (e) => {
                if (e.target && e.target.matches(selector)) {
                    eventHandler(e);
                }
            };
            el.addEventListener(eventName, wrappedHandler);
            return wrappedHandler;
        } else {
            el.addEventListener(eventName, eventHandler);
            return eventHandler;
        }
    }

    // Pad number with leading zeros
    function zeroPad (number, places = 2) {
        return String(number).padStart(places, '0');
    }

    // Validate settings in case stored settings no longer exist in the current script version
    function validateSettings() {
        let searchEngine = GM_config.get('torrentSearchEngine');
        if (!Object.prototype.hasOwnProperty.call(SEARCH_ENGINES, searchEngine)) {
            GM_config.set('torrentSearchEngine', GM_config.fields.torrentSearchEngine.default);
        }
    }

    // Apply settings from the setting's menu
    function applySettings() {
        // Apply calendar settings
        if (REGEX.calendar.test(location.pathname)) {
            // Hide unwanted icons
            for (const el of [...$$('.quick-icons .collect')]) { toggle(el, !GM_config.get('hideCollectIcon')); }
            for (const el of [...$$('.quick-icons .list')]) { toggle(el, !GM_config.get('hideListIcon')); }
            for (const el of [...$$('.quick-icons .watch-now')]) { toggle(el, !GM_config.get('hideWatchtIcon')); }
            // Remove and add all the links again
            for (const el of [...$$('.grid-item[data-type="episode"] a.tpc')]) { el.remove(); }
            for (const el of [...$$('.grid-item[data-type="episode"]')]) { addLinkToGridItem(el, 'episode'); }
        }
    }

    function makeTorrentURL(query) {
        let baseURL = GM_config.get('customUrl');
        let queryPath = GM_config.get('customSearch');
        let searchEngine = GM_config.get('torrentSearchEngine');
        let queryCleaned = SEARCH_ENGINES[searchEngine].cleanQuery(query);
        let url = baseURL + queryPath.replace(/%s/g, queryCleaned);
        return url;
    }

    function extractQueryFromLink(link, type) {
        let query = link;
        let itemLinkMatches = link.match(REGEX[type]);
        if (itemLinkMatches !== null) {
            query = itemLinkMatches[1];
            if (type === 'movie' && itemLinkMatches[2] !== undefined) {
                query += ' ' + itemLinkMatches[2];
            }
            if (type === 'season') {
                query += ' ' + `S${zeroPad(itemLinkMatches[2])}`;
            }
            if (type === 'episode') {
                query += ' ' + `S${zeroPad(itemLinkMatches[2])}E${zeroPad(itemLinkMatches[3])}`;
            }
        }
        return query.replace(/-/g, ' ').replace(/\//g, ' ');
    }

    // Adds a search link to a grid item (like those from the calendar)
    function addLinkToGridItem(item, type) {
        let actions = item.querySelector(`:scope ${'> div.quick-icons > div.actions'}`);
        let itemLink = item.querySelector(`:scope ${'a'}`).getAttribute('href');
        let query = extractQueryFromLink(itemLink, type);
        let urlSearch = makeTorrentURL(query);
        let target = GM_config.get('openInNewTab') ? '_blank' : '_self';
        let searchEngineName = GM_config.get('torrentSearchEngine');
        actions.append(createElement(
            `
            <a class="tpc" href="${urlSearch}" target="${target}" title="Search on ${searchEngineName}">
                <div class="trakt-icon-skull-bones"></div>
            </a>
            `
        ));
    }

    // Adds a search link to an actions list (like the ones in an episode's page)
    function addLinkToActionList(actionList, type) {
        let itemLink = location.pathname;
        let query = extractQueryFromLink(itemLink, type);
        let urlSearch = makeTorrentURL(query);
        let target = GM_config.get('openInNewTab') ? '_blank' : '_self';
        let searchEngineName = GM_config.get('torrentSearchEngine');
        actionList.append(createElement(
            `
            <a class="btn btn-block btn-summary btn-tpc" href="${urlSearch}" target="${target}">
                <div class="fa fa-fw trakt-icon-skull-bones"></div>
                <div class="text">
                    <div class="main-info">Search on ${searchEngineName}</div>
                </div>
            </a>
            `
        ));
    }

    function isCalendarPageCurrentMonth() {
        let today = new Date();
        // Extract the calendar date from the URL
        let calendarDate = new Date(window.location.href.substring(window.location.href.lastIndexOf('/') + 1));
        // If there's no date (current month) or it's the current month then return true
        return (isNaN(calendarDate) || (calendarDate.getMonth() === today.getMonth() && calendarDate.getYear() === today.getYear()))
    }

    // Autoscroll to current date
    function scrollCurrentDate() {
        if(isCalendarPageCurrentMonth()) {
            let todayCard = [...$$('.date-separator:not(.filler) .date')].filter((el) => {
                return el.textContent == (new Date()).getDate();
            })[0];
            if (todayCard) {
                todayCard.scrollIntoView(true);
                // Scroll up to compensate top navbar
                let topNav = $('#top-nav');
                let offset = -window.getComputedStyle(topNav).getPropertyValue('height').slice(0, -2);
                window.scrollBy(0, offset);
            }
        }
    }

    // Process calendar page
    function processCalendarPage() {
        // Torrent links
        for (const el of [...$$('.grid-item[data-type="episode"]')]) {
            addLinkToGridItem(el, 'episode');
        }
        if (GM_config.get('autoscrollToday')) {
           scrollCurrentDate();
        }

        // Settings menu icon
        let menuIcon = createElement(
            `
            <a class="tcp-icon" title="The Pirate Calendar Settings">
                <div class="fa fa-gear"></div>
            </a>
            `
        );
        menuIcon = $('.sidenav-inner').appendChild(menuIcon);
        addEventListener(menuIcon, 'click', () => GM_config.open());

        // Jump icon
        if(isCalendarPageCurrentMonth()) {
            let jumpIcon = createElement(
                `
                <a class="tcp-icon tcp-jump-icon" title="Jump to current day">
                    <div class="fa fa-calendar-xmark"></div>
                </a>
                `
            );
            jumpIcon = $('body').appendChild(jumpIcon);
            addEventListener(jumpIcon, 'click', () => scrollCurrentDate());
        }
    }

    // Process show page
    function processShowsPage() {
        for (const el of [...$$('.grid-item[data-type="show"]')]) { addLinkToGridItem(el, 'show'); }
    }

    // Process show page
    function processShowPage() {
        for (const el of [...$$('.grid-item[data-type="season"]')]) { addLinkToGridItem(el, 'season'); }
        addLinkToActionList($('.action-buttons'), 'show');
    }

    // Process season page
    function processSeasonPage() {
        for (const el of [...$$('.grid-item[data-type="episode"]')]) { addLinkToGridItem(el, 'episode'); }
        addLinkToActionList($('.action-buttons'), 'season');
    }

    // Process episode page
    function processEpisodePage() {
        addLinkToActionList($('.action-buttons'), 'episode');
    }

    // Process movies page
    function processMoviesPage() {
        for (const el of [...$$('.grid-item[data-type="movie"]')]) { addLinkToGridItem(el, 'movie'); }
    }

    // Process movie page
    function processMoviePage() {
        addLinkToActionList($('.action-buttons'), 'movie');
    }

    // Main function
    function processPage() {
        if (REGEX.calendar.test(location.pathname)) {
            processCalendarPage();
        }
        else if (REGEX.shows.test(location.pathname)) {
            processShowsPage();
        }
        else if (REGEX.show.test(location.pathname)) {
            processShowPage();
        }
        else if (REGEX.season.test(location.pathname)) {
            processSeasonPage();
        }
        else if (REGEX.episode.test(location.pathname)) {
            processEpisodePage();
        }
        else if (REGEX.movies.test(location.pathname)) {
            processMoviesPage();
        }
        else if (REGEX.movie.test(location.pathname)) {
            processMoviePage();
        }
    }

    // Executes the callback after the page finishes loading
    // Using a MutationObserver, a timout is set every time a new mutation happens,
    // if either the elapsed time bewteen mutations is greater than intervalTime or
    // the full elapsed time is greater than maxWaitTime the callback is executed
    function whenPageReady(callback, intervalTime, maxWaitTime = 3000) {
        PAGE_READY.startTimer = Date.now();
        console.log('[The Pirate Calendar] Waiting for page to load');
        let observerCallback = (mutationList, observer) => {
            if (PAGE_READY.timeout) {
                clearTimeout(PAGE_READY.timeout);
                if ((Date.now() - PAGE_READY.startTimer) > maxWaitTime) {
                    console.log(`[The Pirate Calendar] Max wait time exceded, loading script anyway!`);
                    clearTimeout(PAGE_READY.timeout);
                    PAGE_READY.timeout = null;
                    observer.disconnect();
                    callback();
                } else {
                    PAGE_READY.timeout = setTimeout(() => {
                        console.log(`[The Pirate Calendar] Page ready in ${Date.now() - PAGE_READY.startTimer}ms!`);
                        clearTimeout(PAGE_READY.timeout);
                        PAGE_READY.timeout = null;
                        observer.disconnect();
                        callback();
                    }, intervalTime)
                }
            } else {
                observer.disconnect();
            }
        };
        let observer = new MutationObserver(observerCallback);
        observer.observe($('body'), { attributes: true, childList: true, subtree: true });
    }

    function init() {

        whenPageReady(() => {
            // Apply styles
            $('head').append(createElement(STYLE));

            validateSettings();

            processPage();

            applySettings();
        }, 250);

    }
})();
