// ==UserScript==
// @name         The Pirate Calendar (for trakt.tv)
// @version      0.6.1
// @description  Adds torrent links (RARBG, The Pirate Bay and more) to trakt.tv. Now with a settings menu!
// @author       luffier
// @namespace    PirateCalendar
// @license      MIT
// @match        *://trakt.tv/
// @match        *://trakt.tv/*
// @require      https://openuserjs.org/src/libs/sizzle/GM_config.js
// @grant        GM_addStyle
// @grant        GM_listValues
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_deleteValue
// @grant        unsafeWindow
// @grant        GM_registerMenuCommand
// @run-at       document-idle
// @homepageURL  https://github.com/Luffier/the-pirate-calendar
// @supportURL   https://github.com/Luffier/the-pirate-calendar/issues
// ==/UserScript==

/* globals GM_config */
/* jshint esversion: 6 */

(() => {
    'use strict';

    // Single element selector shorthand
    const $ = document.querySelector.bind(document);

    // Multiple elements selector shorthand
    const $$ = document.querySelectorAll.bind(document);


    /* VARIABLES */

    // Global styles
    const style = `
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
        .tcp-settings {
            font-size: 40px !important;
            color: rgb(237, 28, 36);
        }
    </style>
    `;

    const regex = {
        calendar: /^\/calendars\/my\/shows/,
        show: /^\/shows\/([^\/]+)(\/)?$/,
        season: /^\/shows\/([^\/]+)\/seasons\/([^\/]+)(\/)?$/,
        episode: /^\/shows\/([^\/]+)\/seasons\/([^\/]+)\/episodes\/([^\/]+)(\/)?$/,
        movies: /^\/movies(\/(boxoffice|anticipated|popular|trending|recommended|watched|collected))?(\/weekly)?$/,
        movie: /^\/movies\/([^\/]+-[0-9]{4})$/
    };

    // Default search engines parameters
    const searchEngines = {
        'RARBG': {
            'defaultUrl': 'https://rarbg.to/',
            'defaultSearch': 'torrents.php?order=size&by=DESC&search=%s',
            'cleanQuery': (query) => encodeURIComponent(query).replace(/%20/g, '+')
        },
        'The Pirate Bay': {
            'defaultUrl': 'https://thepiratebay.org/',
            'defaultSearch': 'search/%s/1/5/0',
            'cleanQuery': (query) => encodeURIComponent(query)
        },
        'EZTV': {
            'defaultUrl': '',
            'defaultSearch': '',
            'cleanQuery': (query) => encodeURIComponent(query).replace(/%20/g, '+')
        }
    };

    // Interval storage
    const intervals = {};


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
                'options': ['RARBG', 'The Pirate Bay'],
                'default': 'RARBG',
                'section': ['Search engine']
            },
            'customUrl': {
                'label': '&#183; URL:',
                'title': 'For a custom URL (like a proxy)',
                'type': 'text',
                'default': searchEngines.RARBG.defaultUrl
            },
            'customSearch': {
                'label': '&#183; Search query:',
                'title': 'For a custom search query. Place "%s" where the query should be',
                'type': 'text',
                'default': searchEngines.RARBG.defaultSearch
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
            'init': function() {
                applySettings();
            },
            'open': function() {
                // Set default URL and search path when the search engine changes
                GM_config.fields.torrentSearchEngine.node.addEventListener('change', function() {
                    let searchEngine = searchEngines[this.value];
                    let section = this.parentElement.parentElement;
                    section.querySelector('#PirateCalendarConfig_field_customUrl').value = searchEngine.defaultUrl;
                    section.querySelector('#PirateCalendarConfig_field_customSearch').value = searchEngine.defaultSearch;
                });
            },
            'save': function() {
                applySettings();
                GM_config.close();
            }
        }
    });


    /* FUNCTIONS */

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

    // Function to replicate the `:visible` selector used in jQuery
    function isVisible(el) {
        return !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
    }

    // Pad number with leading zeros
    function zeroPad (number, places) {
        return String(number).padStart(places, '0');
    }

    // Executes the callback after the calendar finishes loading
    function whenCalendarReady(callback, intervalName) {
        setTimeout(() => {
            intervals[intervalName] = setInterval(() => {
                // If the loading indicator and the progress bar aren't visible, the calendar is ready
                if (!isVisible($('#loading-bg')) && $$('.turbolinks-progress-bar').length === 0) {
                    clearInterval(intervals[intervalName]);
                    callback();
                }
            }, 100);
        }, 200);
    }

    // Apply settings from the setting's menu
    function applySettings() {
        // Apply calendar settings
        if (regex.calendar.test(location.pathname)) {
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
        let searchEngine = searchEngines[GM_config.get('torrentSearchEngine')];
        let baseURL = GM_config.get('customUrl');
        let queryPath = GM_config.get('customSearch');
        let queryCleaned = searchEngine.cleanQuery(query);
        let url = baseURL + queryPath.replace(/%s/g, queryCleaned);
        return url;
    }

    function extractQueryFromLink(link, type) {
        let itemLinkMatches = link.match(regex[type]);
        if (itemLinkMatches === null) {
            return link.replace(/-/g, ' ').replace(/\//g, ' ');
        } else {
            let title = itemLinkMatches[1].replace(/-/g, ' ');
            let seasonNumber = itemLinkMatches[2];
            let query = title;
            if (type === 'season') {
                let codeNumber = `S${zeroPad(seasonNumber,2)}`;
                query = query + ' ' + codeNumber;
            } else if (type === 'episode') {
                let episodeNumber = itemLinkMatches[3];
                let codeNumber = `S${zeroPad(seasonNumber, 2)}E${zeroPad(episodeNumber, 2)}`;
                query = query + ' ' + codeNumber;
            }
            return query;
        }
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

    // Process calendar page
    function processCalendarPage() {
        // Torrent links
        for (const el of [...$$('.grid-item[data-type="episode"]')]) {
            addLinkToGridItem(el, 'episode');
        }
        // Autoscroll to current date
        if (GM_config.get('autoscrollToday')) {
            whenCalendarReady(() => {
                // Extract the calendar date from the URL
                let today = new Date();
                let calendarDate = new Date(window.location.href.substring(window.location.href.lastIndexOf('/') + 1));
                // If there's no date (current month) or it's current month then autoscroll
                if(isNaN(calendarDate) || (calendarDate.getMonth() === today.getMonth() && calendarDate.getYear() === today.getYear())) {
                    let todayCard = [...$$('.date-separator:not(.filler) .date')].filter((el) => {
                        return el.textContent == today.getDate();
                    })[0];
                    if (todayCard) {
                        todayCard.scrollIntoView(true);
                        // Scroll up to compensate top navbar
                        let topNav = $('#top-nav');
                        let offset = -window.getComputedStyle(topNav).getPropertyValue('height').slice(0, -2);
                        window.scrollBy(0, offset);
                    }
                }
            }, 'autoscroll');
        }

        // Settings menu icon
        let menuIcon = createElement(
            `
            <a class="tcp-settings" title="The Pirate Calendar Settings">
                <div class="fa fa-fw trakt-icon-settings"></div>
            </a>
            `
        );
        menuIcon = $('.sidenav-inner').appendChild(menuIcon);
        addEventListener(menuIcon, 'click', () => GM_config.open());

       // Add events to arrows
        whenCalendarReady(() => {
            for (const el of [...$$('.prev, .next')]) { 
                addEventListener(
                    el,
                    'click',
                    () => whenCalendarReady(() => processCalendarPage(), 'processAfterChangingMonth'),
                    'addArrowsEvents'
                );
            }
        });
        applySettings();
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
        if (regex.calendar.test(location.pathname)) {
            processCalendarPage();
        }
        else if (regex.show.test(location.pathname)) {
            processShowPage();
        }
        else if (regex.season.test(location.pathname)) {
            processSeasonPage();
        }
        else if (regex.episode.test(location.pathname)) {
            processEpisodePage();
        }
        else if (regex.movies.test(location.pathname)) {
            processMoviesPage();
        }
        else if (regex.movie.test(location.pathname)) {
            processMoviePage();
        }
    }

    // Apply styles
    $('head').append(createElement(style));

    // Process page
    processPage();
})();
