// ==UserScript==
// @name         The Pirate Calendar (for trakt.tv)
// @version      0.5.1
// @description  Adds torrent links (RARBG, The Pirate Bay, and more) to trakt.tv (now with a settings menu!)
// @author       luffier
// @namespace    PirateCalendar
// @license      MIT
// @match        *://trakt.tv/
// @match        *://trakt.tv/*
// @require      https://openuserjs.org/src/libs/sizzle/GM_config.js
// @require      https://code.jquery.com/jquery-3.6.1.slim.min.js
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

/* globals $, GM_config */
/* jshint esversion: 6 */

(() => {
    'use strict';

    /* GLOBAL STYLES */
    $(
        `
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
        `
    ).appendTo($('head'));


    /* GLOBAL VARIABLES */
    const regex = {
        calendar: /^\/calendars\/my\/shows/,
        show: /^\/shows\/([^\/]+)(\/)?$/,
        season: /^\/shows\/([^\/]+)\/seasons\/([^\/]+)(\/)?$/,
        episode: /^\/shows\/([^\/]+)\/seasons\/([^\/]+)\/episodes\/([^\/]+)(\/)?$/,
    };
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
    // Pad number with leading zeros
    function zeroPad (number, places) {
        return String(number).padStart(places, '0');
    }

    // Executes the callback after the calendar finishes loading
    function whenCalendarReady(callback, intervalName) {
        setTimeout(() => {
            intervals[intervalName] = setInterval(() => {
                // If the loading indicator and the progress bar aren't visible, the calendar is ready
                if (!$('#loading-bg').is(':visible') && $('.turbolinks-progress-bar').length === 0) {
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
            $('.quick-icons .collect').toggle(!GM_config.get('hideCollectIcon'));
            $('.quick-icons .list').toggle(!GM_config.get('hideListIcon'));
            $('.quick-icons .watch-now').toggle(!GM_config.get('hideWatchtIcon'));
            // Remove and add all the links again
            $('.grid-item[data-type="episode"] a.tpc').remove();
            $('.grid-item[data-type="episode"]').each(function() {
                addLinkToGridItem(this, 'episode');
            });
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
        let showTitle = itemLinkMatches[1].replace(/-/g, ' ');
        let seasonNumber = itemLinkMatches[2];
        let codeNumber = '';
        if (type === 'season') {
            codeNumber = `S${zeroPad(seasonNumber,2)}`;
        } else if (type === 'episode') {
            let episodeNumber = itemLinkMatches[3];
            codeNumber = `S${zeroPad(seasonNumber, 2)}E${zeroPad(episodeNumber, 2)}`;
        }
        let query = showTitle + ' ' + codeNumber;
        return query;
    }

    // Adds a search link to a grid item (like those from the calendar)
    function addLinkToGridItem(gridItem, type) {
        let item = $(gridItem);
        let actions = item.find('> div.quick-icons > div.actions').first();
        let itemLink = item.find('a').first().attr('href');
        let query = extractQueryFromLink(itemLink, type);
        let urlSearch = makeTorrentURL(query);
        let target = GM_config.get('openInNewTab') ? '_blank' : '_self';
        let searchEngineName = GM_config.get('torrentSearchEngine');
        actions.append(
            `
            <a class="tpc" href="${urlSearch}" target="${target}" title="Search on ${searchEngineName}">
                <div class="trakt-icon-skull-bones"></div>
            </a>
            `
        );
    }

    // Adds a search link to an actions list (like the ones in an episode's page)
    function addLinkToActionList(actionList, type) {
        let itemLink = location.pathname;
        let query = extractQueryFromLink(itemLink, type);
        let urlSearch = makeTorrentURL(query);
        let target = GM_config.get('openInNewTab') ? '_blank' : '_self';
        let searchEngineName = GM_config.get('torrentSearchEngine');
        actionList.append(
            `
            <a class="btn btn-block btn-summary btn-tpc" href="${urlSearch}" target="${target}">
                <div class="fa fa-fw trakt-icon-skull-bones"></div>
                <div class="text">
                    <div class="main-info">Search on ${searchEngineName}</div>
                </div>
            </a>
            `
        );
    }

    // Process calendar page
    function processCalendarPage() {
        // Torrent links
        $('.grid-item[data-type="episode"]').each(function() {
            addLinkToGridItem(this, 'episode');
        });

        // Autoscroll to current date
        if (GM_config.get('autoscrollToday')) {
            whenCalendarReady(() => {
                // Extract the calendar date from the URL
                let today = new Date();
                let calendarDate = new Date(window.location.href.substring(window.location.href.lastIndexOf('/') + 1));
                // If there's no date (current month) or it's current month then autoscroll
                if(isNaN(calendarDate) || (calendarDate.getMonth() === today.getMonth() && calendarDate.getYear() === today.getYear())) {
                    let todayCard = $('.date-separator:not(.filler) .date').filter(function () {
                        return $(this).text() == today.getDate();
                    }).first().get(0);
                    if (todayCard) {
                        todayCard.scrollIntoView(true);
                        // Scroll up to compensate top navbar
                        let topNav = $('#top-nav').first().get(0);
                        let offset = -window.getComputedStyle(topNav).getPropertyValue('height').slice(0, -2);
                        window.scrollBy(0, offset);
                    }
                }
            }, 'autoscroll');
        }

        // Settings menu icon
        $(
            `
            <a class="tcp-settings" title="The Pirate Calendar Settings">
                <div class="fa fa-fw trakt-icon-settings"></div>
            </a>
            `
        ).on('click', () => GM_config.open())
        .appendTo('.sidenav-inner');

       // Add events to arrows
        whenCalendarReady(() =>
            // Add events to process page again if the user changes month
            $('.prev, .next').on('click', () => whenCalendarReady(() =>
                processCalendarPage(), 'processAfterChangingMonth')),
        'addArrowsEvents');

        applySettings();
    }

    // Process show page
    function processShowPage() {
        $('.grid-item[data-type="season"]').each(function() {
            addLinkToGridItem(this, 'season');
        });
    }

    // Process season page
    function processSeasonPage() {
        $('.grid-item[data-type="episode"]').each(function() {
            addLinkToGridItem(this, 'episode');
        });
        addLinkToActionList($('.action-buttons'), 'season');
    }

    // Process episode page
    function processEpisodePage() {
        addLinkToActionList($('.action-buttons'), 'episode');
    }

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
    }

    processPage();
})();
